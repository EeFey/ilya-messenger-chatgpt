
require('dotenv').config()
const { Configuration, OpenAIApi } = require("openai");
import facebookLogin from 'ts-messenger-api';
import Api from 'ts-messenger-api/dist/lib/api'

let api: Api | null = null;
let lastAnswered: Date = new Date();
let contextQueue: Record<string, string> = {};

const CONTEXT_QUEUE_ENABLED: boolean = process.env.CONTEXT_QUEUE_ENABLED === 'true';
const MIN_RESPONSE_TIME: number = parseInt(process.env.MIN_RESPONSE_TIME!);


async function getGPTReply(message: string, previousMessage: string){
	const configuration = new Configuration({
		apiKey: process.env.OPENAI_API_KEY,
	});
	const openai = new OpenAIApi(configuration);

	let messages = [{"role": "system", "content": process.env.CHAT_GPT_SYSTEM_INSTRUCTION}];
	if (CONTEXT_QUEUE_ENABLED && previousMessage) {messages.push({role: "assistant", content: previousMessage})}
	messages.push({role: "user", content: message})

	const completion = await openai.createChatCompletion({
		model: "gpt-3.5-turbo",
		temperature: 1.1,
		max_tokens: 384,
		messages: messages,
	});
	return Promise.resolve(completion.data.choices[0].message.content);
}

function findKeyword(string: string, keywords: string[]){
	for(var keyword of keywords) {
		if (string.slice(0, keyword.length).toLowerCase() === keyword) return keyword;
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

function cookieToAppState(cookies: string){
	var cookiesJSON = JSON.parse(cookies);
	cookiesJSON.cookies.forEach((item: any) => {
		item.key = item.name;
		delete item.name;
	});
	return cookiesJSON;
}

function delay(ms: number) {
  return new Promise( resolve => setTimeout(resolve, ms) );
}

async function run(){
	try {
		if (process.env.FB_COOKIE == undefined) return;
		console.log("Use cookies to login");
		const appState = cookieToAppState(JSON.parse(process.env.FB_COOKIE));
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

	api.listener.addListener('message', async (message) => {
		api?.markAsRead(message.threadId);
		setTimeout(() => { api?.markAsRead(message.threadId); }, 3000);

		const keywords = ["ilya", "illya"]
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
		if (question.length > 512) {
			api?.sendMessage({ body: "Too long! Lazy to read." }, message.threadId);
			api?.markAsRead(message.threadId);
			return
		}
		getGPTReply(question, contextQueue[message.threadId]).then((chatgptReply) => {
			console.log(message.threadId, " A:", chatgptReply);
			contextQueue[message.threadId] = chatgptReply;

			api?.sendMessage({ body: chatgptReply }, message.threadId);
			api?.markAsRead(message.threadId);
		}).catch((error) => {
			console.log(error);
		});
	});

}
run();
