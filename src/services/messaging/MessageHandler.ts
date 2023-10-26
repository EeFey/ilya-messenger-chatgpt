import Api from 'ts-messenger-api/dist/lib/api'
import { ThreadMessageQueue } from '../../utils/ThreadMessageQueue';

import { ChatGPT } from '../ChatGPT';
import { delay } from '../../utils/Utils';
import { ReplyStrategy } from './ReplyStrategy';

import { CHATGPT_ROLES, MIN_RESPONSE_TIME, AUTO_REPLY_CHANCE, WEB_SEARCH_ROLES, MAX_REQUEST_LENGTH } from '../../config/config';

const MARK_AS_READ_DELAY: number = 3000;

export class MessageHandler {
  private lastAnswered = new Date();
  private readonly replyStrategy: ReplyStrategy;
  
  constructor(
    private api: Api,
    private readonly chatGPT: ChatGPT,
    private readonly threadMsgQueue: ThreadMessageQueue,
    private readonly threadAnsQueue: ThreadMessageQueue
  ) {
    this.replyStrategy = new ReplyStrategy(threadMsgQueue, threadAnsQueue);
  }

  set apiInstance(api: Api) {
    this.api = api;
  }

  async handleIncomingMessage(message: any): Promise<void> {
    console.log(message.body);

    this.markAsRead(message.threadId);

    this.threadMsgQueue.enqueueMessageToThread(message.threadId, {role: "user", content: message.body});

    const matchedKeyword = this.findKeyword(message.body, Object.keys(CHATGPT_ROLES));

    if (!matchedKeyword && !this.shouldAutoReply(message.body)) return;
    // check image and links
    // if (message.body.length <= 0) return;

    await this.processQuestion(message, matchedKeyword);
  }

  async markAsRead(threadId: string): Promise<void> {
    this.api.markAsRead(threadId);
    await delay(MARK_AS_READ_DELAY);
    this.api.markAsRead(threadId);
  }

  async processQuestion(message: any, matchedKeyword: string | null): Promise<void> {
    const question = this.extractQuestionFromMessage(message.body, matchedKeyword);
    console.log(message.threadId, " Q:", question);

    await this.ensureMinResponseTime();

    if (question.length === 0) {
      await this.sendMessage("What", message.threadId);
      return;
    }

    if (question.length > MAX_REQUEST_LENGTH) {
      await this.sendMessage("You're asking for too much", message.threadId);
      return;
    }

    await this.chatGPTReply(message, matchedKeyword, question);
  }

  async sendMessage(body: string, threadId: string) {
      this.api.sendMessage({ body }, threadId);
      await this.markAsRead(threadId);
  }

  private async chatGPTReply(message: any, matchedKeyword: string | null, question: string) {
    const [role, gptQuestion, messageQueue] = this.replyStrategy.getReplyStrategy(message, matchedKeyword, question);

    const isWebSearchEnabled = WEB_SEARCH_ROLES.includes(role);
    try {
      const chatGPTReply = await this.chatGPT.getReply(CHATGPT_ROLES[role], gptQuestion, messageQueue, isWebSearchEnabled);
      console.log(message.threadId, " A:", chatGPTReply);
      this.threadAnsQueue.enqueueMessageToThread(message.threadId, {role: "assistant", content: chatGPTReply});
      await this.sendMessage(chatGPTReply, message.threadId);
    } catch (error) {
      console.log(error);
    }
  }

  private async ensureMinResponseTime() {
    const timeSinceLastAnswer = new Date().getTime() - this.lastAnswered.getTime();
    if (timeSinceLastAnswer < MIN_RESPONSE_TIME) {
      await delay(MIN_RESPONSE_TIME - timeSinceLastAnswer);
    }
    this.lastAnswered = new Date();
  }

  private shouldAutoReply = (message: string): boolean => {
    const wordCountBase = 10;
    const wordCount = message.split(/\s+/).length;
    const wordChance = Math.max(Math.min(wordCount / wordCountBase, 1), 0.1);
    return Math.random() < wordChance * AUTO_REPLY_CHANCE;
  }

  private findKeyword = (message: string, keywords: string[]): string | null => {
    return keywords.find(keyword => message.toLowerCase().startsWith(keyword.toLowerCase())) || null
  }

  private extractQuestionFromMessage = (message: string, keyword: string | null) => {
    if (!keyword) return message;
    message = message.slice(keyword.length);
    while([",", ".", " "].includes(message.charAt(0))){
      message = message.slice(1);
    }
    return message;
  }
}
