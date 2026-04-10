-- Migration number: 0001 	 2026-03-15T08:59:20.666Z

CREATE TABLE IF NOT EXISTS User (
	id INTEGER PRIMARY KEY,
	username TEXT NOT NULL
);

INSERT INTO User (id, username) VALUES (2131134862, 'MFGWBot') ON CONFLICT(id) DO NOTHING;
INSERT INTO User (id, username) VALUES (1199598103, 'longfangsong') ON CONFLICT(id) DO NOTHING;
INSERT INTO User (id, username) VALUES (939315465, 'KarlWu_965') ON CONFLICT(id) DO NOTHING;
INSERT INTO User (id, username) VALUES (664096891, 'zhoudian64') ON CONFLICT(id) DO NOTHING;
INSERT INTO User (id, username) VALUES (1589909923, 'zsa') ON CONFLICT(id) DO NOTHING;

CREATE TABLE IF NOT EXISTS Message (
	id INTEGER PRIMARY KEY,
	from_id INTEGER NOT NULL REFERENCES User(id),
	type TEXT NOT NULL, /* "text", "sticker", "photo" */
	date INTEGER NOT NULL,
	payload TEXT NOT NULL,
	reply_to_message_id INTEGER REFERENCES Message(id)
);

CREATE TABLE IF NOT EXISTS Topic (
	id INTEGER PRIMARY KEY,
	name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS UserTopicPreference (
	user_id INTEGER NOT NULL REFERENCES User(id),
	topic_id INTEGER NOT NULL REFERENCES Topic(id),
	update_history TEXT NOT NULL, -- Array of AI summary

	PRIMARY KEY (user_id, topic_id)
);

CREATE TABLE IF NOT EXISTS CronMessage (
	id CHAR(8) NOT NULL PRIMARY KEY,
	chat_id INTEGER NOT NULL,
	content TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS Memory (
	content TEXT NOT NULL DEFAULT ''
);
