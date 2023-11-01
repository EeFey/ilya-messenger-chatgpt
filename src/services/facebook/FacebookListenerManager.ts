import { EventEmitter } from 'events';
import { FacebookAPI } from './FacebookAPI';
import { ThreadMessageQueue } from '../../utils/ThreadMessageQueue';

import { AvailableGPTFunctions, GPTFunctionDefinition } from '../../interfaces/GPTFunctions';
import { WebSearcher } from '../WebSearcher';

import { ChatGPT } from '../ChatGPT';
import { MessageHandler } from '../messaging/MessageHandler';

import { MESSAGE_QUEUE_SIZE, ANSWER_QUEUE_SIZE, MAX_REQUEST_LENGTH } from '../../config/config';

export class FacebookListenerManager {
  private readonly fbAPI: FacebookAPI;
  private listener?: EventEmitter;
  private readonly chatGPT: ChatGPT;
  private readonly threadMsgQueue: ThreadMessageQueue;
  private readonly threadAnsQueue: ThreadMessageQueue;
  private readonly messageHandler: MessageHandler;
  private readonly checkActivityCallback: () => void;

  constructor(fbAPI: FacebookAPI, checkActivityCallback: () => void) {
    this.fbAPI = fbAPI;
    this.threadMsgQueue = new ThreadMessageQueue(MESSAGE_QUEUE_SIZE, MAX_REQUEST_LENGTH);
    this.threadAnsQueue = new ThreadMessageQueue(ANSWER_QUEUE_SIZE);
    
    this.checkActivityCallback = checkActivityCallback;

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
    this.messageHandler = new MessageHandler(this.fbAPI, this.chatGPT, this.threadMsgQueue, this.threadAnsQueue);
  }

  async listen(): Promise<void> {
    this.listener?.removeAllListeners();

    this.listener = await this.fbAPI.listen();
    if (!this.listener) throw Error('Facebook listener is undefined');

    this.listener.addListener('error', (error) => this.handleListenerError("error", error));
    this.listener.addListener('close', (close) => this.handleListenerError("close", close));
    this.listener.addListener('message', this.messageHandler.handleIncomingMessage.bind(this.messageHandler));
  }

  stopListening(): void {
    this.listener?.removeAllListeners();
    this.fbAPI.stopListening();
  }

  private handleListenerError(eventName: string, error: any): void {
    console.log(`Listener Error on ${eventName}: ${error}`);
    this.stopListening();
    this.checkActivityCallback();
  }
}