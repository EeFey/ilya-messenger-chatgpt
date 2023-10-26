require('dotenv').config()

import { Roles } from '../interfaces/Roles';

export const FB_COOKIES: string | undefined = process.env.FB_COOKIES || undefined;
export const FB_EMAIL: string | undefined = process.env.FB_EMAIL || undefined;
export const FB_PASSWORD: string | undefined = process.env.FB_PASSWORD || undefined;

export const FB_CHECK_ACTIVE_EVERY: number = parseInt(process.env.FB_CHECK_ACTIVE_EVERY!);
export const MESSAGE_QUEUE_SIZE: number = parseInt(process.env.MESSAGE_QUEUE_SIZE!);
export const ANSWER_QUEUE_SIZE: number = parseInt(process.env.ANSWER_QUEUE_SIZE!);
export const MAX_REQUEST_LENGTH: number = parseInt(process.env.MAX_REQUEST_LENGTH!);
export const ONLINE_HOURS: number[] = JSON.parse(process.env.ONLINE_HOURS!);

export const CHATGPT_ROLES: Roles = JSON.parse(process.env.CHATGPT_ROLES!);
export const MIN_RESPONSE_TIME: number = parseInt(process.env.MIN_RESPONSE_TIME!);
export const AUTO_REPLY_CHANCE: number = parseFloat(process.env.AUTO_REPLY_CHANCE!);
export const WEB_SEARCH_ROLES: string[] = JSON.parse(process.env.WEB_SEARCH_ROLES!);

export const AUTO_REPLY_ROLE: string = process.env.AUTO_REPLY_ROLE!;

export const OPENAI_API_KEY: string = process.env.OPENAI_API_KEY!;
export const CHATGPT_MODEL: string = process.env.CHATGPT_MODEL!;
export const CHATGPT_MAX_TOKENS: number = parseInt(process.env.CHATGPT_MAX_TOKENS!);
export const CHATGPT_TEMPERATURE: number = parseFloat(process.env.CHATGPT_TEMPERATURE!);