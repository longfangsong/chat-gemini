import { DBMemory as Memory } from "../model/memory";

export async function create(db: D1Database, memory: Memory) {
	await db.prepare('INSERT INTO Memory (content) VALUES (?)').bind(
		memory.content
	).run();
}

export async function get(db: D1Database): Promise<Memory | null> {
	const result = await db.prepare('SELECT * FROM Memory LIMIT 1').first<Memory>();
	return result || null;
}

export async function update(db: D1Database, memory: Memory) {
	await db.prepare('DELETE FROM Memory').run();
	await db.prepare('INSERT INTO Memory (content) VALUES (?)').bind(
		memory.content
	).run();
}

export async function deleteAll(db: D1Database) {
	await db.prepare('DELETE FROM Memory').run();
}
