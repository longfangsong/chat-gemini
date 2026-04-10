import { Chat, GoogleGenAI, PartListUnion } from "@google/genai";
import { DBMessage, isTGTextMessage, TGMessage } from "../model/message";
import { description as cronDescription, call as set_cron_message } from "./tools/cron";
import { description as searchMessagesDescription, call as searchMessage } from "./tools/search_messages";
import { saveMemory, callSaveMemory, retrieveMemory, callRetrieveMemory } from "./tools/memory";
import { description as getCurrentTimeDescription, call as callGetCurrentTime } from "./tools/get_current_time";

export async function createChat(apiKey: string, bot_user_id: string, chatHistory: Array<DBMessage>): Promise<Chat> {
	const accountId = '222e85dea05422bd47315da07b175bb0';
	const gatewayName = 'gemini-bot';
	const botUsername = "MFGWBot";

	console.log('Creating chat with API key:', apiKey);
	const ai = new GoogleGenAI({
		apiKey: apiKey,
	});

	return ai.chats.create(
		{
			model: 'models/gemini-flash-lite-latest',
			config: {
				tools: [
					// { googleSearch: {} },
					// { urlContext: {} },
					{
						functionDeclarations: [
							cronDescription,
							// searchMessagesDescription,
							saveMemory, retrieveMemory,
							getCurrentTimeDescription
						]
					}
				],
				systemInstruction: `Role: You are a witty, helpful AI peer in a group chat with username ${botUsername}. Be concise, socially aware, and accurate.
Core Rules:
    Language: Always mirror the user’s language.
    Accuracy: Proactively use the search tool to fact-check and the code tool for deterministic math or logic. No hallucinations.
    Context: Use search_messages to search for past chat history.
    Utility: Use set_cron_message for setting up reminders/tasks mentioned by the group. Use get_current_time to get the current date and time when needed.
	Message Format: Messages will be provided in JSON form containing message sender id (from_id) and content (payload).
	Tone: Maintain a natural, friendly, and objective vibe. Avoid "walls of text" and biased/offensive content.`
			},
			history: chatHistory.map((message) => ({
				role: message.from_id === parseInt(bot_user_id , 10) ? 'model' : 'user',
				parts: [{ text: JSON.stringify({ from_id: message.from_id, payload: message.payload }) }],
			})),
		}
	);
}


export async function generateResponseFor(
	chat: Chat,
	db: D1Database,
	cron_token: string,
	deploy_url: string,
	in_coming_message: TGMessage
): Promise<string> {
	if (!isTGTextMessage(in_coming_message)) {
		return 'Only text messages are supported';
	}
	let sendToAI: PartListUnion = in_coming_message.text!;
	let finalResponse = '';
	while (true) {
		console.log('Sending message to AI:', sendToAI);
		const result = await chat.sendMessage({
			message: sendToAI
		});
		if (result?.functionCalls?.length && result?.functionCalls?.length > 0) {
			// Handle function calls
			const call = result.functionCalls[0];
			console.log('AI requested function call:', call.name, 'with args:', call.args);
			let call_result: unknown;
			if (call.name === 'set_cron_message' && call.args) {
				console.log('Setting cron message with args:', call.args);
				const { content, time, timezone, expire_at } = call.args as Record<string, unknown>;
				call_result = await set_cron_message({ db, cron_token, deploy_url, chat_id: in_coming_message.chat.id }, {
					content: content as string,
					time: time as string,
					timezone: timezone as string | undefined,
					expire_at: expire_at as string | undefined,
				});
			}
			// if (call.name === 'searchMessages' && call.args) {
			// 	console.log('Searching messages with args:', call.args);
			// 	const args = call.args as Record<string, unknown>;
			// 	const searchText = typeof args === 'string' ? args : (args.text || args.query || Object.values(args)[0]) as string;
			// 	call_result = await searchMessage({ db }, searchText);
			// }
			if (call.name === 'save_memory' && call.args) {
				console.log('Saving memory with args:', call.args);
				const { content } = call.args as Record<string, unknown>;
				call_result = await callSaveMemory({ db }, { content: content as string });
			}
			if (call.name === 'retrieve_memory') {
				console.log('Retrieving memory');
				call_result = await callRetrieveMemory({ db });
			}
			if (call.name === 'get_current_time') {
				console.log('Getting current time');
				call_result = await callGetCurrentTime();
			}

			const functionResponsePart = {
				name: call.name,
				response: {
					result: result,
				},
				id: call.id,
			};
			sendToAI = {
				functionResponse: functionResponsePart
			};
		} else {
			finalResponse = result?.text ?? '';
			return result.text ?? '';
		}
	}
}
