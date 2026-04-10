import { Type } from '@google/genai';
import { nanoid } from 'nanoid';
import { parseCronToArrays } from '../../../utils';
import { Job } from '../../model/cron';
import * as api from '../../api/cron';
import * as cronDBOperations from '../../db/cron';

export const description = {
	name: 'set_cron_message',
	description: 'Scheduled sending of a message.',
	parameters: {
		type: Type.OBJECT,
		description: 'Configuration for the cron message.',
		properties: {
			content: {
				type: Type.STRING,
				description: 'The content of the message.',
			},
			time: {
				type: Type.STRING,
				description: 'The time to send the cron message, in crontab format.',
			},
			timezone: {
				type: Type.STRING,
				description: 'The timezone for the cron message, in IANA format. Default is UTC.',
			},
			expire_at: {
				type: Type.STRING,
				description: 'The expiration time for the cron message, in YYYYMMDDhhmmss format, in timezone in `timezone` field. After this time, the cron message will be automatically deleted.',
			},
		},
		required: ['content', 'time'],
	},
};

export async function call(
	ctx: { db: D1Database, cron_token: string, deploy_url: string, chat_id: number },
	args: {
		content: string,
		time: string,
		timezone?: string,
		expire_at?: string
	}
): Promise<{ success: boolean }> {
	const { db, chat_id } = ctx;
	const { content, time, timezone, expire_at } = args;
	const timezoneToUse = timezone || 'UTC';
	const cronArrays = parseCronToArrays(time);
	const messageId = nanoid(8);
	const payload: Omit<Job, 'jobId'> = {
		url: ctx.deploy_url + `/croncallback?id=${messageId}`,
		enabled: true,
		schedule: {
			timezone: timezoneToUse,
			expiresAt: expire_at ? parseInt(expire_at) : 0,
			...cronArrays,
		}
	};

	const job = await api.create(ctx, payload);
	const dbJob = {
		id: messageId,
		chat_id,
		content,
	};
	await cronDBOperations.create(db, dbJob);
	return { success: true };
}
