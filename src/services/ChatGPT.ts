const { Configuration, OpenAIApi } = require("openai");

import { OPENAI_API_KEY, CHATGPT_MODEL, CHATGPT_MAX_TOKENS, CHATGPT_TEMPERATURE } from '../config/config';

import { Message } from '../interfaces/Message';
import { AvailableGPTFunctions, GPTFunctionDefinition } from '../interfaces/GPTFunctions';

export class ChatGPT {
  private readonly openai: typeof OpenAIApi;

  constructor(
    private readonly availableFunctions: AvailableGPTFunctions,
    private readonly functionDefinitions: GPTFunctionDefinition[]
  ) {
    const configuration = new Configuration({
      apiKey: OPENAI_API_KEY,
    });
    this.openai = new OpenAIApi(configuration);
  }

  private async createChatCompletion(
    messages: Message[],
    useFunctions: boolean = false
  ) {
    const request: any = {
      model: CHATGPT_MODEL,
      temperature: CHATGPT_TEMPERATURE,
      max_tokens: CHATGPT_MAX_TOKENS,
      messages,
    };

    if (useFunctions) {
      request.functions = this.functionDefinitions;
      request.function_call = "auto";
    }

    return await this.openai.createChatCompletion(request);
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