import { DBJob } from "../model/cron";

export async function create(db: D1Database, dbJob: DBJob) {
	await db.prepare('INSERT INTO CronMessage (id, chat_id, content) VALUES (?, ?, ?)').bind(dbJob.id, dbJob.chat_id, dbJob.content).run();
}

export async function get(db: D1Database, id: string): Promise<DBJob | null> {
	const result = await db.prepare('SELECT * FROM CronMessage WHERE id = ?').bind(id).first<DBJob>();
	return result || null;
}

export async function deleteById(db: D1Database, id: string) {
	await db.prepare('DELETE FROM CronMessage WHERE id = ?').bind(id).run();
}
