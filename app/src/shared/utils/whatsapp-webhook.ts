type EnvSource = Record<string, unknown> | undefined;

export type WhatsAppWebhookConfig = {
	verifyToken?: string;
	appSecret?: string;
};

export type WhatsAppWebhookPayload = {
	object?: string;
	entry?: Array<{
		id: string;
		changes: Array<{
			field: string;
			value: Record<string, unknown>;
		}>;
	}>;
};

export type WhatsAppWebhookEvent = {
	type: string;
	data: unknown;
};

const readEnvValue = (env: EnvSource, keys: string[]): string | undefined => {
	for (const key of keys) {
		const fromEnvObject = typeof env === 'object' && env !== null ? (env as Record<string, unknown>)[key] : undefined;
		if (typeof fromEnvObject === 'string' && fromEnvObject.trim()) {
			return fromEnvObject.trim();
		}

		if (typeof process !== 'undefined' && process.env?.[key]) {
			return process.env[key]!.trim();
		}

		const metaEnv = (import.meta as { env?: Record<string, string | undefined> }).env;
		const metaValue = metaEnv?.[key];
		if (typeof metaValue === 'string' && metaValue.trim()) {
			return metaValue.trim();
		}
	}

	return undefined;
};

export const buildWhatsAppWebhookConfig = (env?: EnvSource): WhatsAppWebhookConfig => ({
	verifyToken: readEnvValue(env, ['WHATSAPP_VERIFY_TOKEN', 'META_WHATSAPP_VERIFY_TOKEN']),
	appSecret: readEnvValue(env, ['META_APP_SECRET', 'WHATSAPP_APP_SECRET', 'FACEBOOK_APP_SECRET'])
});

export const verifySubscription = (params: URLSearchParams, expectedToken: string): string | null => {
	const mode = params.get('hub.mode');
	const token = params.get('hub.verify_token');
	const challenge = params.get('hub.challenge');

	if (mode !== 'subscribe' || !challenge || !token || token !== expectedToken) {
		return null;
	}

	return challenge;
};

const timingSafeEqual = (a: string, b: string): boolean => {
	if (a.length !== b.length) {
		return false;
	}

	let result = 0;
	for (let i = 0; i < a.length; i += 1) {
		result |= a.charCodeAt(i) ^ b.charCodeAt(i);
	}

	return result === 0;
};

const bytesToHex = (bytes: ArrayBuffer): string =>
	[...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, '0')).join('');

export const validateSignature = async (
	rawBody: string,
	signatureHeader: string | null,
	appSecret: string
): Promise<boolean> => {
	if (!signatureHeader?.startsWith('sha256=')) {
		return false;
	}

	const expected = signatureHeader.slice('sha256='.length);
	const encoder = new TextEncoder();
	const key = await crypto.subtle.importKey(
		'raw',
		encoder.encode(appSecret),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign']
	);
	const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(rawBody));
	const digest = bytesToHex(signature);

	return timingSafeEqual(digest, expected);
};

export const isWhatsAppBusinessWebhook = (payload: unknown): payload is WhatsAppWebhookPayload =>
	typeof payload === 'object' &&
	payload !== null &&
	(payload as WhatsAppWebhookPayload).object === 'whatsapp_business_account';

export const processWhatsAppWebhook = (payload: WhatsAppWebhookPayload): WhatsAppWebhookEvent[] => {
	const events: WhatsAppWebhookEvent[] = [];

	for (const entry of payload.entry ?? []) {
		for (const change of entry.changes ?? []) {
			const value = change.value;

			if (change.field === 'messages') {
				const messages = value.messages;
				const statuses = value.statuses;

				if (Array.isArray(messages) && messages.length > 0) {
					events.push({
						type: 'incoming_message',
						data: {
							messages,
							metadata: value.metadata,
							contacts: value.contacts
						}
					});
				}

				if (Array.isArray(statuses) && statuses.length > 0) {
					events.push({
						type: 'message_status',
						data: {
							statuses,
							metadata: value.metadata
						}
					});
				}

				continue;
			}

			events.push({ type: change.field, data: value });
		}
	}

	return events;
};
