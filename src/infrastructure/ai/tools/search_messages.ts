import { Type } from "@google/genai";
import * as messageDBOperations from '../../db/message';
import { DBMessage } from "../../model/message";

export const description = {
	name: 'search_messages',
	description: 'Perform a full-text search for all recent history messages.',
	parameters: {
		type: Type.STRING,
		description: 'The text for searching.',
	},
};

export async function call(
	ctx: { db: D1Database },
	arg: string
): Promise<Array<DBMessage>> {
	const { db } = ctx;
	return messageDBOperations.searchByPayload(db, arg);
}
