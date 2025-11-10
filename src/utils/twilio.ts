type EnvSource = Record<string, unknown> | undefined;

type TwilioConfig = {
	accountSid?: string;
	authToken?: string;
	smsFrom?: string;
	whatsappFrom?: string;
};

type TwilioMessageOptions = {
	to: string;
	body: string;
	sendSms?: boolean;
	sendWhatsapp?: boolean;
	env?: EnvSource;
};

const readEnvValue = (env: EnvSource, key: string): string | undefined => {
	const fromEnvObject = typeof env === 'object' && env !== null ? (env as Record<string, unknown>)[key] : undefined;
	if (typeof fromEnvObject === 'string' && fromEnvObject.trim()) {
		return fromEnvObject.trim();
	}
	if (typeof process !== 'undefined' && process.env && typeof process.env[key] === 'string' && process.env[key]) {
		return process.env[key];
	}
	return undefined;
};

const buildConfig = (env: EnvSource): TwilioConfig => ({
	accountSid: readEnvValue(env, 'TWILIO_ACCOUNT_SID'),
	authToken: readEnvValue(env, 'TWILIO_AUTH_TOKEN'),
	smsFrom: readEnvValue(env, 'TWILIO_SMS_FROM'),
	whatsappFrom: readEnvValue(env, 'TWILIO_WHATSAPP_FROM')
});

const hasCredentials = (config: TwilioConfig) =>
	Boolean(config.accountSid && config.authToken && (config.smsFrom || config.whatsappFrom));

const encodeBasicAuth = (accountSid: string, authToken: string) => {
	if (typeof btoa === 'function') {
		return btoa(`${accountSid}:${authToken}`);
	}
	if (typeof Buffer !== 'undefined') {
		return Buffer.from(`${accountSid}:${authToken}`).toString('base64');
	}
	throw new Error('Base64 encoding is not supported in this environment.');
};

const ensureWhatsappAddress = (value: string) =>
	value.startsWith('whatsapp:') ? value : `whatsapp:${value}`;

const stripWhatsappPrefix = (value: string) =>
	value.startsWith('whatsapp:') ? value.slice('whatsapp:'.length) : value;

const normalizePhoneNumber = (value: string): string | null => {
	const trimmed = value?.trim() ?? '';
	if (!trimmed) return null;
	const withoutWhatsapp = stripWhatsappPrefix(trimmed);
	const hasPlus = withoutWhatsapp.startsWith('+');
	const digits = withoutWhatsapp.replace(/\D/g, '');
	if (!digits) return null;
	return hasPlus ? `+${digits}` : `+55${digits}`;
};

const sendRequest = async (
	credentials: { accountSid: string; authToken: string },
	params: { from: string; to: string; body: string }
) => {
	const authHeader = encodeBasicAuth(credentials.accountSid, credentials.authToken);
	const payload = new URLSearchParams();
	payload.set('From', params.from);
	payload.set('To', params.to);
	payload.set('Body', params.body);

	try {
		const response = await fetch(
			`https://api.twilio.com/2010-04-01/Accounts/${credentials.accountSid}/Messages.json`,
			{
				method: 'POST',
				headers: {
					Authorization: `Basic ${authHeader}`,
					'Content-Type': 'application/x-www-form-urlencoded'
				},
				body: payload
			}
		);

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(`Twilio responded with ${response.status}: ${errorText}`);
		}
	} catch (error) {
		console.error('Erro ao enviar mensagem via Twilio:', error);
	}
};

export const sendTwilioMessage = async (options: TwilioMessageOptions) => {
	const config = buildConfig(options.env);
	const normalizedRecipient = options.to ? normalizePhoneNumber(options.to) : null;
	if (!hasCredentials(config) || !normalizedRecipient || !options.body) {
		return;
	}

	const credentials = {
		accountSid: config.accountSid as string,
		authToken: config.authToken as string
	};
	const tasks: Array<Promise<void>> = [];

	if (config.smsFrom && options.sendSms !== false) {
		tasks.push(sendRequest(credentials, { from: config.smsFrom, to: normalizedRecipient, body: options.body }));
	}

	if (config.whatsappFrom && options.sendWhatsapp !== false) {
		tasks.push(
			sendRequest(credentials, {
				from: ensureWhatsappAddress(config.whatsappFrom),
				to: ensureWhatsappAddress(normalizedRecipient),
				body: options.body
			})
		);
	}

	await Promise.all(tasks);
};

export const notifyInviteByPhone = async (
	env: EnvSource,
	options: { phone: string | null; groupTitle: string; inviteLink: string }
) => {
	if (!options.phone) return;
	const body = `🎄 Você foi convidado para o grupo "${options.groupTitle}". Participe em: ${options.inviteLink}`;
	await sendTwilioMessage({
		to: options.phone,
		body,
		env
	});
};

export const notifyDrawCompletedByPhone = async (
	env: EnvSource,
	options: { phone: string; groupTitle: string; groupUrl: string; revealDate?: string | null }
) => {
	const revealHint = options.revealDate ? ` Revelação: ${options.revealDate}.` : '';
	const body = `🎁 O sorteio do grupo "${options.groupTitle}" foi realizado! Veja quem você tirou: ${options.groupUrl}.${revealHint}`;
	await sendTwilioMessage({
		to: options.phone,
		body,
		env
	});
};
