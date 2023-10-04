require('dotenv').config()

const { Configuration, OpenAIApi } = require("openai");

const CHATGPT_MAX_TOKENS: number = parseInt(process.env.CHATGPT_MAX_TOKENS!);
const CHATGPT_TEMPERATURE: number = parseFloat(process.env.CHATGPT_TEMPERATURE!);

import { Message } from '../interfaces/Message';
import { AvailableGPTFunctions, GPTFunctionDefinition } from '../interfaces/GPTFunctions';

export class ChatGPT {
  private openai: typeof OpenAIApi;

  constructor(
    private availableFunctions: AvailableGPTFunctions,
    private functionDefinitions: GPTFunctionDefinition[]
  ) {
    const configuration = new Configuration({
      apiKey: process.env.OPENAI_API_KEY,
    });
    this.openai = new OpenAIApi(configuration);
  }

  private async createChatCompletion(
    messages: Message[],
    useFunctions: boolean = false
  ) {
    const options: any = {
      model: process.env.CHATGPT_MODEL,
      temperature: CHATGPT_TEMPERATURE,
      max_tokens: CHATGPT_MAX_TOKENS,
      messages,
    };

    if (useFunctions) {
      options.functions = this.functionDefinitions;
      options.function_call = "auto";
    }

    return await this.openai.createChatCompletion(options);
  }

  public async getReply(
    roleDescription: string,
    message?: string | null,
    messageQueue?: Message[] | null,
    useFunctions: boolean = false
  ) {
    let messages: Message[] = [{ role: "system", content: roleDescription }];

    if (messageQueue) messages = messages.concat(messageQueue);
    if (message) messages.push({ role: "user", content: message });

    const completion =  await this.createChatCompletion(messages, useFunctions);

    const responseMessage = completion.data.choices[0].message;
    if (responseMessage.function_call) {
      const functionName = responseMessage.function_call.name as keyof AvailableGPTFunctions;
      const functionToCall = this.availableFunctions[functionName];
      const functionArgs = JSON.parse(responseMessage.function_call.arguments);
      const functionResponse = await functionToCall(functionArgs.query);

      if (!functionResponse && responseMessage.content) return responseMessage.content;

      messages.splice(1, messageQueue ? messageQueue.length : 0);
      messages.push(responseMessage);
      messages.push({ role: "function", name: functionName, content: functionResponse });
      const secondResponse = await this.createChatCompletion(messages, false);

      return secondResponse.data.choices[0].message.content;
    }

    return responseMessage.content;
  }
}