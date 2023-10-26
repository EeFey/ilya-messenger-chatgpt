import { FacebookActivityChecker } from './services/facebook/FacebookActivityChecker';

const keepAliveInterval = setInterval(() => {}, 86400000);

new FacebookActivityChecker();