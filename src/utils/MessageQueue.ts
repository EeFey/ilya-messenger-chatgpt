export class MessageQueue {
  private messages: string[] = [];
  private maxLength: number;

  constructor(maxLength: number) {
    if (maxLength <= 0) {
      throw new Error("Max length must be greater than zero");
    }
    this.maxLength = maxLength;
  }

  enqueue(item: string): void {
    if (this.messages.length >= this.maxLength) {
      this.messages.shift(); // Remove the oldest item if the queue is full
    }
    this.messages.push(item);
  }

  dequeue(): string | undefined {
    return this.messages.shift();
  }

  size(): number {
    return this.messages.length;
  }

  isEmpty(): boolean {
    return this.messages.length === 0;
  }

  getAllMessages(): string[] {
    return this.messages;
  }
}