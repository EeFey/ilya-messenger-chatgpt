import facebookLogin from 'ts-messenger-api';
import Api from 'ts-messenger-api/dist/lib/api'
import { EventEmitter } from 'events';

import { FB_COOKIES, FB_EMAIL, FB_PASSWORD } from '../../config/config';
import { delay } from '../../utils/Utils';

const MARK_AS_READ_DELAY: number = 3000;

export class FacebookAPI {

  constructor(
    private api: Api | null = null 
  ) {}

  isActive(): boolean {
    return this.api ? this.api.isActive() : false;
  }

  async listen(): Promise<EventEmitter | undefined> {
    if (!this.api) return undefined;
    try {
      return await this.api.listen();
    } catch (error) {
      console.log(error);
    }
    return undefined;
  }

  stopListening(): void {
    this.api?.stopListening();
  }

  async markAsRead(threadId: string): Promise<void> {
    this.api?.markAsRead(threadId);
    await delay(MARK_AS_READ_DELAY);
    this.api?.markAsRead(threadId);
  }

  sendMessage(body: string, threadId: string): void {
    this.api?.sendMessage({ body }, threadId);
    this.markAsRead(threadId);
  }

  async login(): Promise<void> {
    this.api = null;
    try {
      if (!FB_COOKIES) throw Error('FB_COOKIES undefined. Credentials will be used');
      const appState = this.cookiesToAppState(FB_COOKIES);
      this.api = (await facebookLogin({ appState: appState })) as Api;
      return;
    } catch (error) {
      console.log(error);
    }

    try {
      console.log("Use credentials to login");
      this.api = (await facebookLogin({ email: FB_EMAIL, password: FB_PASSWORD })) as Api;
      return;
    } catch (error) {
      console.log(error);
    }
    throw Error("Unable to login to FB");
  }

  private cookiesToAppState(cookies: string) {
    const cookiesJSON = JSON.parse(cookies).cookies;
    cookiesJSON.forEach((item: any) => {
      item.key = item.name;
      delete item.name;
    });
    return cookiesJSON;
  }
}