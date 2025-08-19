/**
 * Telegram Bot implemented with Cloudflare Workers
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * 注意：你需要在 wrangler.toml 中设置 TELEGRAM_BOT_TOKEN 和 GOOGLE_API_KEY 环境变量
 */

import { Chat, GoogleGenAI, createUserContent } from '@google/genai';
import telegramifyMarkdown from 'telegramify-markdown';

export interface Env {
	TELEGRAM_BOT_TOKEN: string;
	GOOGLE_API_KEY: string;
	CHAT_HISTORY: KVNamespace;
	ALLOWED_CHAT_IDS: string;
}

// 白名单chat ID列表
function getAllowedChatIds(env: Env): number[] {
	return env.ALLOWED_CHAT_IDS.split(',').map((id) => parseInt(id.trim()));
}

// 定义消息类型
interface TelegramUpdate {
	update_id: number;
	message?: TelegramMessage;
	callback_query?: any;
}

interface TelegramMessage {
	message_id: number;
	from: TelegramUser;
	chat: TelegramChat;
	date: number;
	text?: string;
	reply_to_message?: TelegramMessage;
}

interface TelegramUser {
	id: number;
	is_bot: boolean;
	first_name: string;
	last_name?: string;
	username?: string;
}

interface TelegramChat {
	id: number;
	type: string;
	title?: string;
	username?: string;
	first_name?: string;
	last_name?: string;
}

// 定义对话历史记录类型
interface ChatHistory {
	messages: {
		role: 'user' | 'model';
		content: string;
	}[];
	lastUpdated: number;
}

// 设置 Gemini 模型
function setupGeminiModel(apiKey: string, chatHistory: ChatHistory) {
	const accountId = 'ba6c3ee6481f83e9ced0460cb55a4ade';
	const gatewayName = 'gemini-bot';

	const genAI = new GoogleGenAI({
		apiKey: apiKey,
		httpOptions: {
			baseUrl: `https://gateway.ai.cloudflare.com/v1/${accountId}/${gatewayName}/google-ai-studio`,
		},
	});
	const config = {
		tools: [{ googleSearch: {} }, { urlContext: {} }],
		systemInstruction: `You are an AI assistant in a group chat. Your goal is to be a helpful and accurate conversational partner.

# Key responsibilities

- Answer with the same language as the user.
- Answer user questions and provide relevant information based on the ongoing conversation.
- Proactively use your search tool to fact-check information and ensure your responses are accurate and up-to-date.
- Maintain a natural, conversational, and friendly tone.
- Avoid generating content that is unhelpful, offensive, or biased.`,
	};
	const chat = genAI.chats.create({
		model: 'gemini-2.5-flash',
		history: chatHistory.messages.map((message) => ({
			role: message.role,
			parts: [{ text: message.content }],
		})),
		config,
	});
	return chat;
}

// 发送消息到 Telegram
async function sendTelegramMessage(botToken: string, chatId: number, text: string, replyToMessageId?: number) {
	const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
	const response = await fetch(url, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			chat_id: chatId,
			text: telegramifyMarkdown(text, 'keep'),
			parse_mode: 'MarkdownV2',
			reply_to_message_id: replyToMessageId,
		}),
	});

	return response.json<{ result: { message_id: number } }>();
}

// 发送"正在输入"状态到 Telegram
async function sendChatAction(botToken: string, chatId: number) {
	const url = `https://api.telegram.org/bot${botToken}/sendChatAction`;
	await fetch(url, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			chat_id: chatId,
			action: 'typing',
		}),
	});
}

// 获取对话历史
async function getChatHistory(kv: KVNamespace, messageId: number | undefined): Promise<ChatHistory | null> {
	if (!messageId) {
		return null;
	}
	const sessionId = await kv.get(`message-session:${messageId}`);
	if (!sessionId) {
		return null;
	}

	const key = `session:${sessionId}`;
	const history = await kv.get(key);

	if (history) {
		return JSON.parse(history);
	}

	return {
		messages: [],
		lastUpdated: Date.now(),
	};
}

async function saveChatHistory(kv: KVNamespace, sessionId: number, history: ChatHistory) {
	const key = `session:${sessionId}`;
	history.lastUpdated = Date.now();
	await kv.put(key, JSON.stringify(history), { expirationTtl: 60 * 60 * 24 * 2 });
}

async function getMessageSession(kv: KVNamespace, messageId: number | undefined): Promise<number | null> {
	if (!messageId) {
		return null;
	}
	const sessionId = await kv.get(`message-session:${messageId}`);
	return sessionId ? parseInt(sessionId) : null;
}

async function setMessageSession(kv: KVNamespace, messageId: number, sessionId: number) {
	await kv.put(`message-session:${messageId}`, sessionId.toString(), { expirationTtl: 60 * 60 * 24 });
}

async function createMessageSession(kv: KVNamespace, messageId: number) {
	await setMessageSession(kv, messageId, messageId);
	return messageId;
}

// 持续发送"正在输入"状态，直到 AI 生成完成
async function sendTypingUntilDone(botToken: string, chatId: number, promise: Promise<any>) {
	// 立即发送第一个"正在输入"状态
	await sendChatAction(botToken, chatId);

	// 创建一个间隔为 5 秒的定时器，持续发送"正在输入"状态
	const interval = setInterval(async () => {
		await sendChatAction(botToken, chatId);
	}, 5000);

	try {
		// 等待 promise 完成
		const result = await promise;
		// 清除定时器
		clearInterval(interval);
		return result;
	} catch (error) {
		// 发生错误时也要清除定时器
		clearInterval(interval);
		throw error;
	}
}

// 处理 Telegram 更新
async function handleTelegramUpdate(update: TelegramUpdate, env: Env) {
	if (!update.message || !update.message.text) {
		return new Response('No message text found', { status: 200 });
	}

	const message = update.message;

	// 检查白名单
	if (!getAllowedChatIds(env).includes(message.chat.id)) {
		await sendTelegramMessage(
			env.TELEGRAM_BOT_TOKEN,
			message.chat.id,
			'Sorry, you are not authorized to use this bot. You may fork the repo at https://github.com/longfangsong/chat-gemini, deploy your own instance at Cloudflare for free with a free Google Gemini API key.',
			message.message_id,
		);
		return new Response('Unauthorized chat', { status: 200 });
	}

	// 检查是否是群聊
	const isGroup = message.chat.type === 'group' || message.chat.type === 'supergroup';

	// 获取机器人的用户名
	const botUsername = 'MFGWBot';

	// 在群聊中，只处理@机器人或回复机器人消息的情况
	if (isGroup) {
		const isAtBot = message.text?.includes(`@${botUsername}`);
		const isReplyToBot = message.reply_to_message?.from?.is_bot && message.reply_to_message?.from?.username === botUsername;

		if (!isAtBot && !isReplyToBot) {
			return new Response('Message not directed to bot in group chat', { status: 200 });
		}
	}

	let userText = message.text!;
	// 如果消息包含 @BotUsername，则移除这个部分
	if (userText.includes(`@${botUsername}`)) {
		userText = userText.replace(new RegExp(`@${botUsername}\\s*`, 'g'), '').trim();
	}

	let sessionId = await getMessageSession(env.CHAT_HISTORY, message.reply_to_message?.message_id);
	let chatHistory;
	if (sessionId !== null) {
		// existing session
		await setMessageSession(env.CHAT_HISTORY, message.message_id, sessionId);
		chatHistory = await getChatHistory(env.CHAT_HISTORY, sessionId);
		if (chatHistory == null) {
			chatHistory = {
				messages: [],
				lastUpdated: Date.now(),
			};
		}
	} else {
		// new session
		sessionId = await createMessageSession(env.CHAT_HISTORY, message.message_id);
		chatHistory = {
			messages: [],
			lastUpdated: Date.now(),
		};
	}

	const chat = setupGeminiModel(env.GOOGLE_API_KEY, chatHistory);
	try {
		// 使用 sendTypingUntilDone 包装 AI 生成过程
		const result = await sendTypingUntilDone(env.TELEGRAM_BOT_TOKEN, message.chat.id, chat.sendMessage({ message: userText }));
		const botResponse = result.text;

		chatHistory.messages.push({
			role: 'user',
			content: userText,
		});
		chatHistory.messages.push({
			role: 'model',
			content: botResponse,
		});
		// 保存更新后的对话历史
		await saveChatHistory(env.CHAT_HISTORY, sessionId, chatHistory);

		const sendResult = await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, message.chat.id, botResponse, message.message_id);
		await setMessageSession(env.CHAT_HISTORY, sendResult.result.message_id, sessionId);

		return new Response('Message sent', { status: 200 });
	} catch (error) {
		console.error('Error generating response:', error);
		return new Response('Error generating response', { status: 500 });
	}
}

// 主处理函数
export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		// 只处理 POST 请求
		if (request.method !== 'POST') {
			return new Response('Send a POST request to this endpoint to use the Telegram bot.', {
				status: 200,
			});
		}

		try {
			const update: TelegramUpdate = await request.json();
			return await handleTelegramUpdate(update, env);
		} catch (error) {
			console.error('Error processing request:', error);
			return new Response('Error processing request', { status: 500 });
		}
	},
};
