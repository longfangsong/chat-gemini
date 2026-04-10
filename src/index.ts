/**
 * Telegram Bot implemented with Cloudflare Workers
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * 注意：你需要在 wrangler.toml 中设置 TELEGRAM_BOT_TOKEN 和 GOOGLE_API_KEY 环境变量
 */

import { sendTelegramMessage, sendChatAction, sendTypingUntilDone } from './infrastructure/api/telegram';
import { createChat, generateResponseFor } from './infrastructure/ai';
import * as messageDb from './infrastructure/db/message';
import * as cronDb from './infrastructure/db/cron';
import { MessageType, TGMessage, isTGTextMessage } from './infrastructure/model/message';

// 定义消息类型
interface TelegramUpdate {
	update_id: number;
	message?: TGMessage;
	callback_query?: any;
}

export interface Env {
	TELEGRAM_BOT_TOKEN: string;
	GOOGLE_API_KEY: string;
	CHAT_HISTORY: KVNamespace;
	REDIS_HOST: string;
	REDIS_PASSWORD: string;
	DB: D1Database;
	CF_AIG_TOKEN: string;
	BOT_USER_ID: string;
	CRON_TOKEN: string;
	DEPLOY_URL: string;
}

// 主处理函数
async function handleTelegramUpdate(update: TelegramUpdate, env: Env, ctx: ExecutionContext) {
	if (!update.message || !update.message.message_id) {
		return new Response('No message found', { status: 200 });
	}

	// Check if it's a text message
	if (!isTGTextMessage(update.message)) {
		return new Response('Only text messages are supported', { status: 200 });
	}

	const message = update.message;
	const chatId = message.chat.id;
	const userId = message.from?.id;

	if (!userId) {
		return new Response('Message from field is missing', { status: 200 });
	}

	try {
		// Send typing indicator
		ctx.waitUntil(sendChatAction(env.TELEGRAM_BOT_TOKEN, chatId));

		// Get chat history for context
		const chatHistory = (await messageDb.lastNMessages(env.DB, 20)).reverse();
		console.log('Fetched chat history:', chatHistory);
		// Create chat with AI
		const chat = await createChat(env.GOOGLE_API_KEY, env.BOT_USER_ID, chatHistory);

		// Generate response
		const response = await generateResponseFor(chat, env.DB, env.CRON_TOKEN, env.DEPLOY_URL, message);

		// Save incoming message to database
		await messageDb.create(env.DB, {
			from_id: userId,
			type: MessageType.TEXT,
			date: Math.floor(Date.now()),
			payload: message.text,
			reply_to_message_id: message.reply_to_message?.message_id,
		} as any);

		// Save AI response to database
		await messageDb.create(env.DB, {
			from_id: parseInt(env.BOT_USER_ID),
			type: MessageType.TEXT,
			date: Math.floor(Date.now()),
			payload: response,
		} as any);

		// Send response back to Telegram
		await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, chatId, response, message.message_id);

		return new Response('OK', { status: 200 });
	} catch (error) {
		console.error('Error handling update:', error);
		await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, chatId, 'Sorry, an error occurred while processing your message.');
		return new Response('Error', { status: 200 });
	}
}

// 主处理函数
export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const url = new URL(request.url);

		// Handle cron callback
		if (url.pathname === '/croncallback') {
			try {
				const cronId = url.searchParams.get('id');
				if (!cronId) {
					return new Response('Missing id parameter', { status: 400 });
				}

				const cronMessage = await cronDb.get(env.DB, cronId);
				if (!cronMessage) {
					return new Response('Cron message not found', { status: 404 });
				}

				await sendTypingUntilDone(
					env.TELEGRAM_BOT_TOKEN,
					cronMessage.chat_id,
					sendTelegramMessage(
						env.TELEGRAM_BOT_TOKEN,
						cronMessage.chat_id,
						cronMessage.content
					)
				);
				return new Response('OK', { status: 200 });
			} catch (error) {
				console.error('Error sending cron callback message:', error);
				return new Response('Error sending message', { status: 500 });
			}
		}

		// 只处理 POST 请求
		if (request.method !== 'POST') {
			return new Response('Send a POST request to this endpoint to use the Telegram bot.', {
				status: 200,
			});
		}

		try {
			const update: TelegramUpdate = await request.json();
			console.log('Received update:', update);
			const chatId = update.message?.chat.id;
			if (chatId) {
				return await sendTypingUntilDone(
					env.TELEGRAM_BOT_TOKEN,
					chatId,
					handleTelegramUpdate(update, env, ctx)
				);
			}
			return new Response('Error processing request', { status: 200 });
		} catch (error) {
			console.error('Error processing request:', error);
			return new Response('Error processing request', { status: 200 });
		}
		return new Response('Error processing request', { status: 200 });
	},
	async scheduled(controller: ScheduledController, env: Env): Promise<void> { },
};

