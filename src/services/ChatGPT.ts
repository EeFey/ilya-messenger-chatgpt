const { Configuration, OpenAIApi } = require("openai");

import { OPENAI_API_KEY, CHATGPT_MODEL, CHATGPT_MAX_TOKENS, CHATGPT_TEMPERATURE } from '../config/config';

import { Message } from '../interfaces/Message';
import { AvailableGPTFunctions, GPTFunctionDefinition } from '../interfaces/GPTFunctions';
import { delay } from '../utils/Utils';

export class ChatGPT {
  private readonly openai: typeof OpenAIApi;
  private static readonly MAX_RETRIES = 5;
  private static readonly INITIAL_RETRY_DELAY = 2000;

  constructor(
    private readonly availableFunctions: AvailableGPTFunctions,
    private readonly functionDefinitions: GPTFunctionDefinition[]
  ) {
    const configuration = new Configuration({
      apiKey: OPENAI_API_KEY,
    });
    this.openai = new OpenAIApi(configuration);
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

    const completion =  await this.createChatCompletionRequest(messages, useFunctions);

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
      const secondResponse = await this.createChatCompletionRequest(messages, false);

      return secondResponse.data.choices[0].message.content;
    }

    return responseMessage.content;
  }

  private async createChatCompletionRequest(
    messages: Message[],
    useFunctions: boolean = false
  ) {
    const request = this.buildChatCompletionRequest(messages, useFunctions);
    for (let i = 0; i < ChatGPT.MAX_RETRIES; i++) {
      try {
        return await this.openai.createChatCompletion(request);
      } catch (error) {
        if (this.isRateLimitError(error)) {
          console.log('Rate limit hit. Retrying...');
          await delay(ChatGPT.INITIAL_RETRY_DELAY * (i + 1));
        } else {
          throw error;
        }
      }
    }
    throw new Error('Rate limit exceeded. Please try again later.');
  }

  private buildChatCompletionRequest(
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

    return request;
  }

  private isRateLimitError(error: any): boolean {
    return error.response && error.response.status === 429;
  }

}