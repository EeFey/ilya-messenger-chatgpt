import { Message } from '../interfaces/Message';

export class MessageQueue {
  private readonly messages: Message[] = [];

  constructor(
    private readonly maxQueueSize: number,
    private readonly maxMessageLength: number = Number.MAX_SAFE_INTEGER
  ) {
    if (maxQueueSize < 0) {
      throw new Error("Max queue size must be non-negative");
    }
  }

  enqueueMessage(item: Message): void {
    if (this.maxQueueSize === 0 || item.content.length > this.maxMessageLength) {
      return;
    }

    if (this.messages.length >= this.maxQueueSize) {
      this.messages.shift();
    }
    this.messages.push(item);
  }

  dequeueMessage(): Message | undefined {
    return this.messages.shift();
  }

  messageCount(): number {
    return this.messages.length;
  }

  isQueueEmpty(): boolean {
    return this.messages.length === 0;
  }

  getAllMessages(): Message[] {
    return this.messages;
  }
}