export enum MessageType {
	TEXT = 'text',
	STICKER = 'sticker',
	PHOTO = 'photo',
}

export interface DBMessage {
	id: number;
	from_id: number;
	type: MessageType;
	// Unix timestamp in seconds
	date: number;
	payload: string;
	reply_to_message_id?: number | null;
}

type MediaFile = {
	file_id: string;
	file_unique_id: string;
};

type TGMessageBase = {
	message_id: number;
	from?: {
		id: number;
		is_bot: boolean;
	};
	chat: {
		id: number;
		type: string;
	};
	// Unix timestamp in seconds
	date: number;
	reply_to_message?: {
		message_id: number;
	};
};

type TGMessageContent =
	| { text: string }
	| { photo: Array<MediaFile> }
	| { sticker: MediaFile };

export type TGMessage = TGMessageBase & TGMessageContent;

export function getTGMessageType(message: TGMessage): MessageType {
	if ('text' in message) {
		return MessageType.TEXT;
	}
	if ('photo' in message) {
		return MessageType.PHOTO;
	}
	if ('sticker' in message) {
		return MessageType.STICKER;
	}
	throw new Error('Unknown message type');
}

export function isTGTextMessage(message: TGMessage): message is TGMessage & { text: string } {
	return 'text' in message;
}

export function isTGPhotoMessage(message: TGMessage): message is TGMessage & { photo: Array<MediaFile> } {
	return 'photo' in message;
}

export function isTGStickerMessage(message: TGMessage): message is TGMessage & { sticker: Array<MediaFile> } {
	return 'sticker' in message;
}

export interface TGSendMessageRequest {
	chat_id: number,
	text: string,
	parse_mode: 'MarkdownV2',
	reply_to_message_id?: number,
}

