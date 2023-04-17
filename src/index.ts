
require('dotenv').config()
const { Configuration, OpenAIApi } = require("openai");
import facebookLogin from 'ts-messenger-api';
import Api from 'ts-messenger-api/dist/lib/api'

let api: Api | null = null;
let lastAnswered: Date = new Date();
let contextQueue: Record<string, string> = {};

const CHATGPT_MAX_TOKENS: number = parseInt(process.env.CHATGPT_MAX_TOKENS!);
const CHATGPT_TEMPERATURE: number = parseFloat(process.env.CHATGPT_TEMPERATURE!);
const CHATGPT_ROLES: Record<string, string> = JSON.parse(process.env.CHATGPT_ROLES!);

const CONTEXT_QUEUE_ENABLED: boolean = process.env.CONTEXT_QUEUE_ENABLED === 'true';
const MIN_RESPONSE_TIME: number = parseInt(process.env.MIN_RESPONSE_TIME!);
const MAX_REQUEST_LENGTH: number = parseInt(process.env.MAX_REQUEST_LENGTH!);


async function getGPTReply(chatgptRole: string, message: string, previousMessage: string){
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
	return Promise.resolve(completion.data.choices[0].message.content);
}

function findKeyword(string: string, keywords: string[]){
	for(var keyword of keywords) {
		if (string.slice(0, keyword.length).toLowerCase() === keyword.toLowerCase()) return keyword;
	}
	return null;
}

function removeKeyword(string: string, keyword: string){
	string = string.slice(keyword.length);
	while([",", ".", " "].includes(string.charAt(0))){
		string = string.slice(1);
	}
	return string;
}

function cookiesToAppState(cookies: string){
	var cookiesJSON = JSON.parse(cookies).cookies;
	cookiesJSON.forEach((item: any) => {
		item.key = item.name;
		delete item.name;
	});
	return cookiesJSON;
}

function delay(ms: number) {
  return new Promise( resolve => setTimeout(resolve, ms) );
}

async function main(){

	try {
		if (process.env.FB_COOKIES == undefined) throw Error('FB_COOKIES undefined. Credentials will be used');
		console.log("Use cookies to login");
		const appState = cookiesToAppState(process.env.FB_COOKIES);
		api = (await facebookLogin({appState: appState}, {} )) as Api;
	} catch (error) {
		console.log(error);
	};
  
	if(!api) {
		console.log("Use credentials to login");
		try {
			api = (await facebookLogin({ email: process.env.FB_EMAIL, password: process.env.FB_PASSWORD }, {})) as Api;
		} catch (error) {
			console.log(error);
		}
	}
	if (!api) throw Error('Unable to establish connection to Facebook.');

	try {
		await api.listen();
	} catch (error) {
		console.log(error);
	}
	if (!api.isActive() || !api.listener) throw Error('Unable to establish connection to Facebook.');

	api.listener.addListener('error', (error) => {
	  console.log(error);
	});

	api.listener.addListener('message', async (message) => {
		api?.markAsRead(message.threadId);
		setTimeout(() => { api?.markAsRead(message.threadId); }, 3000);

		const keywords = Object.keys(CHATGPT_ROLES);
		const matchedKeyword = findKeyword(message.body, keywords);
		if (matchedKeyword === null) return;

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
		getGPTReply(matchedKeyword, question, contextQueue[message.threadId]).then((chatgptReply) => {
			console.log(message.threadId, " A:", chatgptReply);
			contextQueue[message.threadId] = chatgptReply;

			api?.sendMessage({ body: chatgptReply }, message.threadId);
			api?.markAsRead(message.threadId);
		}).catch((error) => {
			console.log(error);
		});
	});

}
main();
