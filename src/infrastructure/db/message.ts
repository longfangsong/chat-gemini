import { DBMessage as Message } from "../model/message";

export async function create(db: D1Database, message: Message) {
	console.log('Creating message in database with from_id:', message.from_id, 'type:', message.type, 'date:', message.date);
	await db.prepare('INSERT INTO Message (from_id, type, date, payload, reply_to_message_id) VALUES (?, ?, ?, ?, ?)').bind(
		message.from_id,
		message.type,
		message.date,
		message.payload,
		message.reply_to_message_id || null
	).run();
}

export async function get(db: D1Database, id: number): Promise<Message | null> {
	const result = await db.prepare('SELECT * FROM Message WHERE id = ?').bind(id).first<Message>();
	return result || null;
}

export async function getByUserId(db: D1Database, userId: number): Promise<Message[]> {
	const result = await db.prepare('SELECT * FROM Message WHERE from_id = ?').bind(userId).all<Message>();
	return result.results || [];
}

export async function deleteById(db: D1Database, id: number) {
	await db.prepare('DELETE FROM Message WHERE id = ?').bind(id).run();
}

export async function update(db: D1Database, message: Message) {
	await db.prepare('UPDATE Message SET from_id = ?, type = ?, date = ?, payload = ?, reply_to_message_id = ? WHERE id = ?').bind(
		message.from_id,
		message.type,
		message.date,
		message.payload,
		message.reply_to_message_id || null,
		message.id
	).run();
}

export async function searchByPayload(db: D1Database, query: string): Promise<Message[]> {
	const result = await db.prepare('SELECT * FROM Message WHERE type = ? AND payload LIKE ?').bind('text', `%${query}%`).all<Message>();
	return result.results || [];
}

export async function lastNMessages(db: D1Database, n: number): Promise<Array<Message>> {
	const result = await db.prepare('SELECT * FROM Message ORDER BY date DESC LIMIT ?').bind(n).all<Message>();
	return result.results || [];
}

export async function messagesInTimeRange(db: D1Database, start: number, end: number): Promise<Array<Message>> {
	const result = await db.prepare('SELECT * FROM Message WHERE date BETWEEN ? AND ? ORDER BY date ASC').bind(start, end).all<Message>();
	return result.results || [];
}
