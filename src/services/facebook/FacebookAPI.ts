import facebookLogin from 'ts-messenger-api';
import Api from 'ts-messenger-api/dist/lib/api'
import { EventEmitter } from 'events';

import { FB_COOKIES, FB_EMAIL, FB_PASSWORD } from '../../config/config';
import { delay } from '../../utils/Utils';

export class FacebookAPI {

  constructor(
    private api: Api | null = null 
  ) {}

  async checkActive(): Promise<void> {
    if (this.api?.isActive()) return
    await this.login();
    await this.listen();
  }

  // listener may be disconnected after a while, so we need to re-listen
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
    await delay(100);
    this.api?.markAsRead(threadId);
    await delay(3000);
    this.api?.markAsRead(threadId);
  }

  async sendMessage(body: string, threadId: string): Promise<void> {
    await this.checkActive();
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