
require('dotenv').config()

import { EventEmitter } from 'events';
import facebookLogin from 'ts-messenger-api';
import Api from 'ts-messenger-api/dist/lib/api'

import { ThreadMessageQueue } from './utils/ThreadMessageQueue';
import { Message } from './interfaces/Message';
import { AvailableGPTFunctions, GPTFunctionDefinition } from './interfaces/GPTFunctions';
import { WebSearcher } from './utils/WebSearcher';

import { Roles } from './interfaces/Roles';
import { ChatGPT } from './utils/ChatGPT';

const CHATGPT_ROLES: Roles = JSON.parse(process.env.CHATGPT_ROLES!);

const MESSAGE_QUEUE_SIZE: number = parseInt(process.env.MESSAGE_QUEUE_SIZE!);
const ANSWER_QUEUE_SIZE: number = parseInt(process.env.ANSWER_QUEUE_SIZE!);
const MIN_RESPONSE_TIME: number = parseInt(process.env.MIN_RESPONSE_TIME!);
const MAX_REQUEST_LENGTH: number = parseInt(process.env.MAX_REQUEST_LENGTH!);
const FB_CHECK_ACTIVE_EVERY: number = parseInt(process.env.FB_CHECK_ACTIVE_EVERY!);
const AUTO_REPLY_CHANCE: number = parseFloat(process.env.AUTO_REPLY_CHANCE!);
const WEB_SEARCH_ROLES: string[] = JSON.parse(process.env.WEB_SEARCH_ROLES!);
const ONLINE_HOURS: number[] = JSON.parse(process.env.ONLINE_HOURS!);

let api: Api | null = null;
let listener: EventEmitter | undefined = undefined;
let lastAnswered: Date = new Date();
let retryLoginCount: number = 0;

const threadMsgQueue = new ThreadMessageQueue(MESSAGE_QUEUE_SIZE, MAX_REQUEST_LENGTH);
const threadAnsQueue = new ThreadMessageQueue(ANSWER_QUEUE_SIZE);

const webSearcher = new WebSearcher();

const availableFunctions: AvailableGPTFunctions = {
  get_web_search: webSearcher.getWebSearch,
};

const functionDefinitions: GPTFunctionDefinition[] = [
  {
    name: "get_web_search",
    description: "Get the latest information from google",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "The query to search for" },
      },
      required: ["query"],
    },
  },
];

const chatGPT = new ChatGPT(availableFunctions, functionDefinitions);



const findKeyword = (string: string, keywords: string[]) => {
	for(var keyword of keywords) {
		if (string.slice(0, keyword.length).toLowerCase() === keyword.toLowerCase()) return keyword;
	}
	return null;
}

const removeKeyword = (string: string, keyword: string | null) => {
	if (keyword === null) return string;
	string = string.slice(keyword.length);
	while([",", ".", " "].includes(string.charAt(0))){
		string = string.slice(1);
	}
	return string;
}

const cookiesToAppState = (cookies: string) => {
	var cookiesJSON = JSON.parse(cookies).cookies;
	cookiesJSON.forEach((item: any) => {
		item.key = item.name;
		delete item.name;
	});
	return cookiesJSON;
}

const delay = (ms: number) => {
  return new Promise( resolve => setTimeout(resolve, ms) );
}

const autoReplyChance = (message: string) => {
	const wordCountBase = 10;
	const wordCount = message.split(/\s+/).length;
	const wordChance = Math.max(Math.min(wordCount / wordCountBase, 1), 0.1);
	return wordChance * AUTO_REPLY_CHANCE;
}

const getFbLogin = async () => {
	api = null;
	try {
		if (process.env.FB_COOKIES == undefined) throw Error('FB_COOKIES undefined. Credentials will be used');
		console.log("Use cookies to login");
		const appState = cookiesToAppState(process.env.FB_COOKIES);
		api = (await facebookLogin({appState: appState}, {} )) as Api;
		return api;
	} catch (error) {
		console.log(error);
	};
	
	try {
		console.log("Use credentials to login");
		api = (await facebookLogin({ email: process.env.FB_EMAIL, password: process.env.FB_PASSWORD }, {})) as Api;
		return api;
	} catch (error) {
		console.log(error);
	}
	return null;
}

const fbLogin = async () => {
	api = await getFbLogin();
	if (!api) throw Error('fbLogin: Unable to establish connection to Facebook.');
}

const fbListen = async () => {
	listener?.removeAllListeners();
	
	try {
		listener = await api?.listen();
	} catch (error) {
		console.log(error);
	}
	if (!api?.isActive() || !listener) throw Error('fbListen: Unable to establish connection to Facebook.');

	listener?.addListener('error', (error) => {
	  console.log(error);
	});

	listener?.addListener('presence', (presence) => {
	  console.log("presence", presence);
	});

	listener?.addListener('close', (close) => {
	  console.log("close", close);
	});

	listener?.addListener('message', async (message) => {
		console.log(message.body);

		api?.markAsRead(message.threadId);
		setTimeout(() => { api?.markAsRead(message.threadId); }, 3000);

		threadMsgQueue.enqueueMessageToThread(message.threadId, {role: "user", content: message.body});

		const keywords = Object.keys(CHATGPT_ROLES);
		const matchedKeyword = findKeyword(message.body, keywords);

		const autoReply = Math.random() < autoReplyChance(message.body);
		if (!matchedKeyword && !autoReply) return;

		const question = removeKeyword(message.body, matchedKeyword);
		console.log(message.threadId, " Q:", question);

		if (new Date().getTime() - lastAnswered.getTime() < MIN_RESPONSE_TIME){
			await delay(MIN_RESPONSE_TIME);
		}
		lastAnswered = new Date();

		if (question.length == 0) {
			api?.sendMessage({ body: "What" }, message.threadId);
			api?.markAsRead(message.threadId);
			return
		}
		if (question.length > MAX_REQUEST_LENGTH) {
			api?.sendMessage({ body: "Your question is too long!" }, message.threadId);
			api?.markAsRead(message.threadId);
			return
		}

		let chatgptRole = matchedKeyword ? matchedKeyword : Object.keys(CHATGPT_ROLES)[0];
		let messageQueue = threadAnsQueue.getAllMessagesFromThread(message.threadId);
		let gptQuestion: string | null = question;

		if (message.sourceMessage) {
			messageQueue = [{role: "user", content: message.sourceMessage.body}];
		}

		if (!matchedKeyword) {
			messageQueue = threadMsgQueue.getAllMessagesFromThread(message.threadId);
			gptQuestion = null;
		}

		const webSearchEnabled = WEB_SEARCH_ROLES.includes(chatgptRole);
		chatGPT.getReply(CHATGPT_ROLES[chatgptRole], gptQuestion, messageQueue, webSearchEnabled).then((chatGPTReply) => {
			console.log(message.threadId, " A:", chatGPTReply);
			threadAnsQueue.enqueueMessageToThread(message.threadId, {role: "assistant", content: chatGPTReply});

			api?.sendMessage({ body: chatGPTReply }, message.threadId);
			api?.markAsRead(message.threadId);
		}).catch((error) => {
			console.log(error);
		});
	});
}

const fb_check_active_interval = setInterval((): void => {
	const currentHour = new Date().getHours();
	if ((currentHour >= ONLINE_HOURS[0] && currentHour <= 23) || (currentHour >= 0 && currentHour < ONLINE_HOURS[1])) {
		console.log("Checking if FB api is active");
		restartListener();
	}
}, FB_CHECK_ACTIVE_EVERY);

const catchErrors = (fn: any) => {
	console.log(fn);
	console.log("Caught Error, will retry to login again");
	if (retryLoginCount >= 3) {
		console.log("Exceeded 3 login attempt. Gracefully exiting");
		clearInterval(fb_check_active_interval);
	}
	retryLoginCount += 1;
};

const restartListener = async () => {
	try {
		if (!api?.isActive()) {
			console.log("FB api is not active, trying to login");
			api?.stopListening();
			await fbLogin();
		}
		await fbListen();
		retryLoginCount = 0;
	}
	catch (error) {
		catchErrors(error);
	}
}

restartListener();

setInterval((): void => { if(1<0) return; }, 86400000);
