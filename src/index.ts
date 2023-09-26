
require('dotenv').config()
const { Configuration, OpenAIApi } = require("openai");
import { EventEmitter } from 'events';
import facebookLogin from 'ts-messenger-api';
import Api from 'ts-messenger-api/dist/lib/api'

import { ThreadMessageQueue } from './utils/ThreadMessageQueue';

let api: Api | null = null;
let listener: EventEmitter | undefined = undefined;
let lastAnswered: Date = new Date();
let contextQueue: Record<string, string> = {};
let retryLoginCount: number = 0;

const threadMsgQueue = new ThreadMessageQueue(5);

const CHATGPT_MAX_TOKENS: number = parseInt(process.env.CHATGPT_MAX_TOKENS!);
const CHATGPT_TEMPERATURE: number = parseFloat(process.env.CHATGPT_TEMPERATURE!);
const CHATGPT_ROLES: Record<string, string> = JSON.parse(process.env.CHATGPT_ROLES!);

const CONTEXT_QUEUE_ENABLED: boolean = process.env.CONTEXT_QUEUE_ENABLED === 'true';
const MIN_RESPONSE_TIME: number = parseInt(process.env.MIN_RESPONSE_TIME!);
const MAX_REQUEST_LENGTH: number = parseInt(process.env.MAX_REQUEST_LENGTH!);
const FB_CHECK_ACTIVE_EVERY: number = parseInt(process.env.FB_CHECK_ACTIVE_EVERY!);
const AUTO_REPLY_CHANCE: number = parseFloat(process.env.AUTO_REPLY_CHANCE!);

const getGPTReply = async (chatgptRole: string, message: string, previousMessage: string | null) => {
	const configuration = new Configuration({
		apiKey: process.env.OPENAI_API_KEY,
	});
	const openai = new OpenAIApi(configuration);

	let messages = [{"role": "system", "content": CHATGPT_ROLES[chatgptRole]}];
	if (CONTEXT_QUEUE_ENABLED && previousMessage) {messages.push({role: "assistant", content: previousMessage})}
	messages.push({role: "user", content: message})

	const completion = await openai.createChatCompletion({
		model: process.env.CHATGPT_MODEL,
		temperature: CHATGPT_TEMPERATURE,
		max_tokens: CHATGPT_MAX_TOKENS,
		messages: messages,
	});
	return completion.data.choices[0].message.content;
}

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
		threadMsgQueue.enqueue(message.threadId, message.body);
		api?.markAsRead(message.threadId);
		setTimeout(() => { api?.markAsRead(message.threadId); }, 3000);

		const keywords = Object.keys(CHATGPT_ROLES);
		const matchedKeyword = findKeyword(message.body, keywords);
		
		const autoReply = Math.random() < AUTO_REPLY_CHANCE;
		if (matchedKeyword === null && !autoReply) return;

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

		const chatgptRole = matchedKeyword === null ? Object.keys(CHATGPT_ROLES)[0] : matchedKeyword;
		const previousMessage = matchedKeyword === null ? null : contextQueue[message.threadId];
		const gptQuestion = matchedKeyword === null ? autoReplyPrompt(message.threadId) : question;

		getGPTReply(chatgptRole, gptQuestion, previousMessage).then((chatgptReply) => {
			console.log(message.threadId, " A:", chatgptReply);
			contextQueue[message.threadId] = chatgptReply;

			api?.sendMessage({ body: chatgptReply }, message.threadId);
			api?.markAsRead(message.threadId);
		}).catch((error) => {
			console.log(error);
		});
	});
}

const autoReplyPrompt = (threadId: string) => {
	return "The following are chat history from oldest to latest, and you will reply as yourself in a sentence. " + threadMsgQueue.getMessageQueueInString(threadId);
}

const fb_check_active_interval = setInterval((): void => {
	console.log("Checking if FB api is active");
	restartListener();
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
