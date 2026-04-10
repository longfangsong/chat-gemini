export interface DBJob {
	id: string;
	chat_id: number;
	content: string;
}

// https://docs.cron-job.org/rest-api.html#jobschedule
export interface JobSchedule {
	timezone: string;
	expiresAt: number;

	hours: Array<number>;
	mdays: Array<number>;
	minutes: Array<number>;
	months: Array<number>;
	wdays: Array<number>;
}

// https://docs.cron-job.org/rest-api.html#job
export interface Job {
	jobId: number;
	enabled: boolean;
	url: string;
	schedule: JobSchedule
}
