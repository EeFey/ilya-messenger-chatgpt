import { MessageQueue } from './MessageQueue';

export class ThreadMessageQueue {
  private threadQueues: Map<string, MessageQueue> = new Map();
  private maxLength: number;

  constructor(maxLength: number) {
    if (maxLength <= 0) {
      throw new Error("Max length must be greater than zero");
    }
    this.maxLength = maxLength;
  }

  // Enqueue a message for a specific thread
  enqueue(threadId: string, message: string): void {
    let queue = this.threadQueues.get(threadId);

    // If the queue doesn't exist for the thread, create it
    if (!queue) {
      queue = new MessageQueue(this.maxLength);
      this.threadQueues.set(threadId, queue);
    }

    // Enqueue the message in the thread's queue
    queue.enqueue(message);
  }

  // Dequeue a message for a specific thread
  dequeue(threadId: string): string | undefined {
    const queue = this.threadQueues.get(threadId);

    if (queue) {
      return queue.dequeue();
    }

    return undefined; // Thread queue doesn't exist
  }

  // Get the size of the message queue for a specific thread
  size(threadId: string): number {
    const queue = this.threadQueues.get(threadId);

    if (queue) {
      return queue.size();
    }

    return 0; // Thread queue doesn't exist
  }

  // Check if the message queue for a specific thread is empty
  isEmpty(threadId: string): boolean {
    const queue = this.threadQueues.get(threadId);

    if (queue) {
      return queue.isEmpty();
    }

    return true; // Thread queue doesn't exist
  }

  // Get the entire queue for a specific thread
  getMessageQueue(threadId: string): string[] | undefined {
    const queue = this.threadQueues.get(threadId);

    if (queue) {
      return queue.getAllMessages();
    }

    return undefined; // Thread queue doesn't exist
  }

  getMessageQueueInString(threadId: string): string | undefined {
    const queue = this.threadQueues.get(threadId);

    if (queue) {
      return queue.getAllMessages().join(". ");
    }

    return undefined; // Thread queue doesn't exist
  }
}