import { ThreadMessageQueue } from '../../utils/ThreadMessageQueue';
import { Message } from '../../interfaces/Message';

import { AUTO_REPLY_ROLE } from '../../config/config';

export class ReplyStrategy {

  constructor(
    private readonly threadMsgQueue: ThreadMessageQueue,
    private readonly threadAnsQueue: ThreadMessageQueue
  ) {}

  getReplyStrategy(message: any, matchedKeyword: string | null, question: string): [string, string | null, Message[] | null] {
    if (matchedKeyword && message.sourceMessage) {
      return this.keywordReplyWithSourceMessage(message, matchedKeyword, question);
    } else if (matchedKeyword) {
      return this.keywordReply(message, matchedKeyword, question);
    } else {
      return this.nonKeywordReply(message);
    }
  }

  private keywordReply(message: any, matchedKeyword: string, question: string): [string, string, Message[] | null] {
    const role = matchedKeyword;
    const gptQuestion = question;
    const messageQueue = this.threadAnsQueue.getAllMessagesFromThread(message.threadId);
    return [role, gptQuestion, messageQueue];
  }

  private nonKeywordReply(message: any): [string, null, Message[] | null] {
    const role = AUTO_REPLY_ROLE;
    const gptQuestion = null;
    const messageQueue = this.threadMsgQueue.getAllMessagesFromThread(message.threadId);
    return [role, gptQuestion, messageQueue];
  }

  private keywordReplyWithSourceMessage(message: any, matchedKeyword: string, question: string): [string, string, Message[] | null] {
    const role = matchedKeyword;
    const gptQuestion = question;
    const messageQueue = [{role: "user", content: message.sourceMessage.body}];
    return [role, gptQuestion, messageQueue];
  }
}