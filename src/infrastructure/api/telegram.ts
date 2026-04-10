import telegramifyMarkdown from 'telegramify-markdown';

export async function sendTelegramMessage(botToken: string, chatId: number, text: string, replyToMessageId?: number) {
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

	return response.json<{ ok: boolean; result: { message_id: number }; description?: string }>();
}

export async function sendChatAction(botToken: string, chatId: number) {
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

// 持续发送"正在输入"状态，直到 AI 生成完成
export async function sendTypingUntilDone(botToken: string, chatId: number, promise: Promise<any>) {
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
