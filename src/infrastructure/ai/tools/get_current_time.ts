import { Type } from '@google/genai';

export const description = {
	name: 'get_current_time',
	description: 'Get the current date and time in ISO 8601 format.',
	parameters: {
		type: Type.OBJECT,
		description: 'No parameters needed.',
		properties: {},
		required: [],
	},
};

export async function call(): Promise<{
	current_time: string,
	timestamp: number,
	timezone: string
}> {
	const now = new Date();
	return {
		current_time: now.toISOString(),
		timestamp: now.getTime(),
		timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
	};
}
