import { MessageQueue } from './MessageQueue';
import { Message } from '../interfaces/Message';

export class ThreadMessageQueue {
  private readonly threadQueues: Map<string, MessageQueue> = new Map();

  constructor(
    private readonly maxQueueSize: number,
    private readonly maxMessageLength: number = Number.MAX_SAFE_INTEGER
  ) {
    if (maxQueueSize < 0) {
      throw new Error("Max queue size must be non-negative");
    }
  }

  enqueueMessageToThread(threadId: string, message: Message): void {
    let queue = this.threadQueues.get(threadId);

    if (!queue) {
      queue = new MessageQueue(this.maxQueueSize, this.maxMessageLength);
      this.threadQueues.set(threadId, queue);
    }

    queue.enqueueMessage(message);
  }

  dequeueMessageFromThread(threadId: string): Message | undefined {
    const queue = this.threadQueues.get(threadId);

    if (queue) {
      return queue.dequeueMessage();
    }

    return undefined;
  }

  messageCountForThread(threadId: string): number {
    const queue = this.threadQueues.get(threadId);

    if (queue) {
      return queue.messageCount();
    }

    return 0;
  }

  isThreadQueueEmpty(threadId: string): boolean {
    const queue = this.threadQueues.get(threadId);

    if (queue) {
      return queue.isQueueEmpty();
    }

    return true;
  }

  getAllMessagesFromThread(threadId: string): Message[] | null {
    const queue = this.threadQueues.get(threadId);

    if (queue) {
      return queue.getAllMessages();
    }

    return null;
  }
}