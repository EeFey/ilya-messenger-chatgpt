import facebookLogin from 'ts-messenger-api';
import Api from 'ts-messenger-api/dist/lib/api'

import { FB_COOKIES, FB_EMAIL, FB_PASSWORD } from '../../config/config';

export class FacebookLoginManager {
  private api: Api | null = null;

  get apiInstance(): Api | null {
    return this.api;
  }

  async login(): Promise<Api | null> {
    this.api = null;
    try {
      if (!FB_COOKIES) throw Error('FB_COOKIES undefined. Credentials will be used');
      const appState = this.cookiesToAppState(FB_COOKIES);
      this.api = (await facebookLogin({ appState: appState })) as Api;
      return this.api;
    } catch (error) {
      console.log(error);
    }

    try {
      console.log("Use credentials to login");
      this.api = (await facebookLogin({ email: FB_EMAIL, password: FB_PASSWORD })) as Api;
      return this.api;
    } catch (error) {
      console.log(error);
    }
    return null;
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