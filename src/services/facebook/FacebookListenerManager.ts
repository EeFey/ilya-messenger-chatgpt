import { EventEmitter } from 'events';
import Api from 'ts-messenger-api/dist/lib/api'
import { ThreadMessageQueue } from '../../utils/ThreadMessageQueue';

import { AvailableGPTFunctions, GPTFunctionDefinition } from '../../interfaces/GPTFunctions';
import { WebSearcher } from '../WebSearcher';

import { ChatGPT } from '../ChatGPT';
import { MessageHandler } from '../messaging/MessageHandler';

import { MESSAGE_QUEUE_SIZE, ANSWER_QUEUE_SIZE, MAX_REQUEST_LENGTH } from '../../config/config';

export class FacebookListenerManager {
  private api: Api | null;
  private listener?: EventEmitter;
  private readonly chatGPT: ChatGPT;
  private readonly threadMsgQueue: ThreadMessageQueue;
  private readonly threadAnsQueue: ThreadMessageQueue;
  private messageHandler?: MessageHandler;
  private readonly errorCallback: () => void;

  constructor(api: Api | null, errorCallback: () => void) {
    this.api = api;
    this.threadMsgQueue = new ThreadMessageQueue(MESSAGE_QUEUE_SIZE, MAX_REQUEST_LENGTH);
    this.threadAnsQueue = new ThreadMessageQueue(ANSWER_QUEUE_SIZE);
    this.errorCallback = errorCallback;
    const webSearcher = new WebSearcher();
    const availableFunctions: AvailableGPTFunctions = {
      get_web_search: webSearcher.getWebSearch,
    };
    const functionDefinitions: GPTFunctionDefinition[] = [{
      name: "get_web_search",
      description: "Get the latest information from google",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "The query to search for" },
        },
        required: ["query"],
      },
    }];
    this.chatGPT = new ChatGPT(availableFunctions, functionDefinitions);
  }

  set apiInstance(api: Api | null) {
    this.api = api;
  }

  async listen(): Promise<void> {
    if (!this.api) throw Error('API instance is not provided.');
    this.listener?.removeAllListeners();

    try {
      this.listener = await this.api.listen();
    } catch (error) {
      console.log(error);
    }
    if (!this.api.isActive() || !this.listener) throw Error('Unable to establish connection to Facebook.');
    
    this.listener.addListener('error', (error) => this.handleListenerError("error", error));
    this.listener.addListener('close', (close) => this.handleListenerError("close", close));
    
    if (!this.messageHandler) {
      this.messageHandler = new MessageHandler(this.api, this.chatGPT, this.threadMsgQueue, this.threadAnsQueue);
    } else {
      this.messageHandler.apiInstance = this.api;
    }

    this.listener.addListener('message', this.messageHandler.handleIncomingMessage.bind(this.messageHandler));
  }

  stopListening(): void {
    this.api?.stopListening();
  }

  private handleListenerError(eventName: string, error: any): void {
    console.log(`Listener Error on ${eventName}: ${error}`);
    this.errorCallback();
  }
}