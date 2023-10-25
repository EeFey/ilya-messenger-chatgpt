import { FacebookLoginManager } from './FacebookLoginManager';
import { FacebookListenerManager } from './FacebookListenerManager';

import { FB_CHECK_ACTIVE_EVERY, ONLINE_HOURS } from '../../config/config';

const MAX_LOGIN_RETRY = 3;

export class FacebookActivityChecker {
  private readonly fbLoginManager: FacebookLoginManager;
  private readonly fbListenerManager: FacebookListenerManager;
  private retryLoginCount: number = 0;
  private fbCheckActiveInterval: NodeJS.Timeout;

  constructor() {
    this.fbLoginManager = new FacebookLoginManager();
    this.fbListenerManager = new FacebookListenerManager(this.fbLoginManager.apiInstance, this.checkActivity.bind(this));
    this.fbCheckActiveInterval = setInterval(this.checkActivity.bind(this), FB_CHECK_ACTIVE_EVERY);
    this.restartListener();
  }

  private async restartListener(): Promise<void> {
    try {
      if (!this.fbLoginManager.apiInstance?.isActive()) {
        console.log("FB api is not active, trying to login");
        this.fbListenerManager.stopListening();

        await this.fbLoginManager.login();
        if (!this.fbLoginManager.apiInstance) throw Error("Unable to login to FB");
        this.fbListenerManager.apiInstance = this.fbLoginManager.apiInstance;
      }
      await this.fbListenerManager.listen();
      this.retryLoginCount = 0;
    } catch (error) {
      console.log(error);
      console.log("Caught Error, will retry to login again");
      if (this.retryLoginCount >= MAX_LOGIN_RETRY) {
        console.log("Exceeded ${MAX_LOGIN_RETRY} login attempt. Gracefully exiting");
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