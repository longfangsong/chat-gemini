import { Job } from "../model/cron";

export async function create(
	ctx: { cron_token: string },
	job: Omit<Job, 'jobId'>): Promise<Job> {
	console.log('Creating cron job with payload:', job);
	console.log('body:', JSON.stringify({job: job}));
	const response = await fetch("https://api.cron-job.org/jobs", {
		method: 'PUT',
		headers: {
			'Content-Type': 'application/json',
			'Authorization': `Bearer ${ctx.cron_token || ''}`,
		},
		body: JSON.stringify({job: job}),
	});
	if (!response.ok) {
		throw new Error(`Failed to create job: ${response.statusText}`);
	}
	const { jobId } = await response.json<{ jobId: number }>();
	return { ...job, jobId };
}
