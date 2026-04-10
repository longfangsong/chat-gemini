import { DBUser as User } from "../model/user";

export async function create(db: D1Database, user: User) {
	await db.prepare('INSERT INTO User (id, username) VALUES (?, ?)').bind(user.id, user.username).run();
}

export async function get(db: D1Database, id: number): Promise<User | null> {
	const result = await db.prepare('SELECT * FROM User WHERE id = ?').bind(id).first<User>();
	return result || null;
}

export async function getByUsername(db: D1Database, username: string): Promise<User | null> {
	const result = await db.prepare('SELECT * FROM User WHERE username = ?').bind(username).first<User>();
	return result || null;
}

export async function deleteById(db: D1Database, id: number) {
	await db.prepare('DELETE FROM User WHERE id = ?').bind(id).run();
}

export async function update(db: D1Database, user: User) {
	await db.prepare('UPDATE User SET username = ? WHERE id = ?').bind(user.username, user.id).run();
}
