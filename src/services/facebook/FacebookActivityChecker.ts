import { FacebookAPI } from './FacebookAPI';
import { FacebookListenerManager } from './FacebookListenerManager';

import { FB_CHECK_ACTIVE_EVERY, ONLINE_HOURS } from '../../config/config';

const MAX_LOGIN_RETRY = 3;

export class FacebookActivityChecker {
  private readonly fbAPI: FacebookAPI;
  private readonly fbListenerManager: FacebookListenerManager;
  private retryLoginCount: number = 0;
  private fbCheckActiveInterval: NodeJS.Timeout;

  constructor() {
    this.fbAPI = new FacebookAPI();
    this.fbListenerManager = new FacebookListenerManager(this.fbAPI, this.checkActivity.bind(this));
    this.fbCheckActiveInterval = setInterval(this.checkActivity.bind(this), FB_CHECK_ACTIVE_EVERY);
    this.checkActivity();
  }

  private async restartListener(): Promise<void> {
    try {
      await this.fbAPI.checkActive();
      await this.fbListenerManager.listen();
      this.retryLoginCount = 0;
    } catch (error) {
      console.log(error);
      console.log("Caught Error, will retry to login again");
      if (this.retryLoginCount >= MAX_LOGIN_RETRY) {
        console.log(`Exceeded ${MAX_LOGIN_RETRY} login attempt. Gracefully exiting`);
        clearInterval(this.fbCheckActiveInterval);
      }
      this.retryLoginCount += 1;
    }
  }

  private checkActivity(): void {
    const currentHour = new Date().getHours();
    const withinActiveHour = (ONLINE_HOURS[0] > ONLINE_HOURS[1]) 
      ? (currentHour >= ONLINE_HOURS[0] || currentHour < ONLINE_HOURS[1]) 
      : (currentHour >= ONLINE_HOURS[0] && currentHour <= ONLINE_HOURS[1]);
    if (withinActiveHour) {
      console.log("Check if FB api is active");
      this.restartListener();
    }
  }
}