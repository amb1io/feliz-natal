type EnvSource = Record<string, unknown> | undefined;

type TelegramConfig = {
	botToken?: string;
	username?: string;
};

type TelegramApiResponse = {
	ok?: boolean;
	description?: string;
	result?: {
		id?: number;
		username?: string;
		message?: {
			chat?: { id?: number };
			from?: { id?: number; username?: string };
		};
	};
};

let cachedChatId: string | null = null;

const readEnvValue = (env: EnvSource, keys: string[]): string | undefined => {
	for (const key of keys) {
		const fromEnvObject =
			typeof env === 'object' && env !== null ? (env as Record<string, unknown>)[key] : undefined;
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

const normalizeUsername = (value: string) => value.replace(/^@/, '').trim().toLowerCase();

export const getTelegramConfig = (env?: EnvSource): TelegramConfig => ({
	botToken: readEnvValue(env, ['botfather_token', 'BOTFATHER_TOKEN', 'TELEGRAM_BOT_TOKEN']),
	username: readEnvValue(env, ['my_telegram', 'MY_TELEGRAM', 'TELEGRAM_USERNAME'])
});

export const isTelegramConfigured = (config: TelegramConfig) =>
	Boolean(config.botToken && config.username);

const apiCall = async <T>(
	botToken: string,
	method: string,
	body?: Record<string, unknown>
): Promise<T> => {
	const response = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: body ? JSON.stringify(body) : undefined
	});
	return (await response.json()) as T;
};

const resolveChatId = async (botToken: string, username: string): Promise<string | null> => {
	if (cachedChatId) return cachedChatId;

	const normalized = normalizeUsername(username);
	if (/^-?\d+$/.test(normalized)) {
		cachedChatId = normalized;
		return cachedChatId;
	}

	const updates = await apiCall<{
		ok?: boolean;
		description?: string;
		result?: Array<{
			message?: {
				chat?: { id?: number };
				from?: { username?: string };
			};
		}>;
	}>(botToken, 'getUpdates', { limit: 100, allowed_updates: ['message'] });

	if (!updates.ok) {
		console.warn('Telegram getUpdates falhou:', updates.description ?? 'erro desconhecido');
		return null;
	}

	for (const update of updates.result ?? []) {
		const fromUsername = update.message?.from?.username;
		const chatId = update.message?.chat?.id;
		if (!fromUsername || chatId == null) continue;
		if (normalizeUsername(fromUsername) === normalized) {
			cachedChatId = String(chatId);
			return cachedChatId;
		}
	}

	console.warn(
		`Telegram: não encontrei chat para @${normalized}. Abra o bot e envie /start uma vez.`
	);
	return null;
};

export const sendTelegramMessage = async (env: EnvSource, text: string): Promise<boolean> => {
	const config = getTelegramConfig(env);
	if (!isTelegramConfigured(config) || !config.botToken || !config.username) {
		console.warn('Telegram não configurado (botfather_token / my_telegram).');
		return false;
	}

	const chatId = await resolveChatId(config.botToken, config.username);
	if (!chatId) return false;

	const payload = await apiCall<TelegramApiResponse>(config.botToken, 'sendMessage', {
		chat_id: chatId,
		text,
		disable_web_page_preview: true
	});

	if (!payload.ok) {
		console.warn('Telegram sendMessage falhou:', payload.description ?? 'erro desconhecido');
		return false;
	}

	return true;
};

export const notifyTelegramSafely = async (env: EnvSource, text: string): Promise<void> => {
	try {
		await sendTelegramMessage(env, text);
	} catch (error) {
		console.warn('Falha ao notificar Telegram:', error);
	}
};

export const saoPauloDateIso = (date = new Date()) =>
	date.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });

export const templateNewUser = (input: {
	label: string;
	todayCount: number;
	totalCount: number;
}) =>
	[
		'✨ Feliz Natal — novo cadastro',
		`usuário: ${input.label}`,
		`hoje: ${input.todayCount} novos · total: ${input.totalCount}`
	].join('\n');

export const templateDrawError = (input: { groupLabel: string; reason: string }) =>
	[
		'⚠️ Feliz Natal — erro no sorteio',
		`grupo: ${input.groupLabel}`,
		`motivo: ${input.reason}`
	].join('\n');

export const templateAppError = (input: { where: string; detail: string }) =>
	[
		'🚨 Feliz Natal — erro na aplicação',
		`onde: ${input.where}`,
		`detalhe: ${input.detail}`
	].join('\n');

export const templateDailyDigest = (input: {
	groupsCreated: number;
	drawsDone: number;
	drawsScheduled: number;
}) =>
	[
		'✨ Feliz Natal — resumo do dia',
		`grupos: ${input.groupsCreated} criados`,
		`sorteios: ${input.drawsDone} feitos · ${input.drawsScheduled} previstos para hoje`
	].join('\n');

export const countUsuariosTodayAndTotal = async (
	db: D1Database,
	isoDate: string
): Promise<{ todayCount: number; totalCount: number }> => {
	const today = await db
		.prepare(`SELECT COUNT(*) AS total FROM usuario WHERE DATE(criado_em) = DATE(?1)`)
		.bind(isoDate)
		.first<{ total: number }>();
	const all = await db.prepare(`SELECT COUNT(*) AS total FROM usuario`).first<{ total: number }>();

	return {
		todayCount: Number(today?.total ?? 0),
		totalCount: Number(all?.total ?? 0)
	};
};
