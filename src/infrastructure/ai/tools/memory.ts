import { Type } from '@google/genai';
import * as memoryDBOperations from '../../db/memory';
import { DBMemory } from '../../model/memory';

export const saveMemory = {
	name: 'save_memory',
	description: 'Save or update the long-term memory with new content.',
	parameters: {
		type: Type.OBJECT,
		description: 'Configuration for saving memory.',
		properties: {
			content: {
				type: Type.STRING,
				description: 'The memory content to save.',
			},
		},
		required: ['content'],
	},
};

export async function callSaveMemory(
	ctx: { db: D1Database },
	args: {
		content: string,
	}
): Promise<{ success: boolean }> {
	const { db } = ctx;
	const { content } = args;
	const memory: DBMemory = { content };
	await memoryDBOperations.update(db, memory);
	return { success: true };
}

export const retrieveMemory = {
	name: 'retrieve_memory',
	description: 'Retrieve the saved long-term memory content.',
	parameters: {
		type: Type.OBJECT,
		description: 'No parameters needed for retrieval.',
		properties: {},
		required: [],
	},
};

export async function callRetrieveMemory(
	ctx: { db: D1Database }
): Promise<string | null> {
	const { db } = ctx;
	const memory = await memoryDBOperations.get(db);
	return memory ? memory.content : null;
}
