type EnvSource = Record<string, unknown> | undefined;

export type WhatsAppCloudConfig = {
	accessToken?: string;
	phoneNumberId?: string;
	apiVersion: string;
	templateName?: string;
	templateLanguage: string;
	templateComponents: TemplateComponentsMode;
	useNamedParameters: boolean;
	includeHeaderImage: boolean;
	includeInviteButton: boolean;
	siteBaseUrl: string;
	headerImageUrl: string;
	defaultCountryCode: string;
};

export type SendInviteWhatsAppOptions = {
	to: string;
	groupTitle: string;
	inviteLink: string;
	groupOwner?: string | null;
};

export type SendSecretMessageWhatsAppOptions = {
	to: string;
	groupTitle: string;
	groupUrl: string;
	recipientName?: string | null;
};

type TemplateComponentsMode = 'none' | 'body' | 'header_body' | 'body_button';

type WhatsAppSendResponse = {
	messaging_product?: string;
	contacts?: Array<{ input?: string; wa_id?: string }>;
	messages?: Array<{ id?: string; message_status?: string }>;
	error?: {
		message?: string;
		type?: string;
		code?: number;
		error_subcode?: number;
		fbtrace_id?: string;
	};
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

const parseComponentsMode = (value?: string): TemplateComponentsMode => {
	const normalized = value?.trim().toLowerCase();
	if (normalized === 'none' || normalized === 'body' || normalized === 'header_body' || normalized === 'body_button') {
		return normalized;
	}

	return 'body';
};

export const buildWhatsAppCloudConfig = (env?: EnvSource): WhatsAppCloudConfig => ({
	accessToken: readEnvValue(env, ['WHATSAPP_ACCESS_TOKEN', 'META_WHATSAPP_ACCESS_TOKEN']),
	phoneNumberId: readEnvValue(env, ['WHATSAPP_PHONE_NUMBER_ID', 'META_WHATSAPP_PHONE_NUMBER_ID']),
	apiVersion: readEnvValue(env, ['WHATSAPP_API_VERSION']) ?? 'v25.0',
	templateName: readEnvValue(env, ['WHATSAPP_INVITE_TEMPLATE_NAME']),
	templateLanguage: readEnvValue(env, ['WHATSAPP_INVITE_TEMPLATE_LANG']) ?? 'pt_BR',
	templateComponents: parseComponentsMode(readEnvValue(env, ['WHATSAPP_INVITE_TEMPLATE_COMPONENTS'])),
	useNamedParameters: readEnvValue(env, ['WHATSAPP_INVITE_USE_NAMED_PARAMETERS']) === 'true',
	includeHeaderImage: readEnvValue(env, ['WHATSAPP_INVITE_INCLUDE_HEADER']) === 'true',
	includeInviteButton: readEnvValue(env, ['WHATSAPP_INVITE_INCLUDE_BUTTON']) === 'true',
	siteBaseUrl: readEnvValue(env, ['WHATSAPP_SITE_BASE_URL', 'PUBLIC_SITE_URL']) ?? 'https://feliz.natal.br',
	headerImageUrl:
		readEnvValue(env, ['WHATSAPP_HEADER_IMAGE_URL']) ??
		`${readEnvValue(env, ['WHATSAPP_SITE_BASE_URL', 'PUBLIC_SITE_URL']) ?? 'https://feliz.natal.br'}/og-image-whatsapp.jpg`,
	defaultCountryCode: readEnvValue(env, ['WHATSAPP_DEFAULT_COUNTRY_CODE']) ?? '55'
});

export const isWhatsAppCloudConfigured = (config: WhatsAppCloudConfig) =>
	Boolean(config.accessToken && config.phoneNumberId && config.templateName);

export const normalizeWhatsAppPhone = (value: string, defaultCountryCode = '55'): string | null => {
	const trimmed = value.trim();
	if (!trimmed) return null;

	const digits = trimmed.replace(/\D/g, '');
	if (!digits) return null;

	if (trimmed.startsWith('+') || digits.length > 11) {
		return digits;
	}

	if (digits.startsWith(defaultCountryCode)) {
		return digits;
	}

	return `${defaultCountryCode}${digits}`;
};

export const buildInviteButtonSuffix = (inviteLink: string, siteBaseUrl: string): string => {
	try {
		const inviteUrl = new URL(inviteLink);
		const baseUrl = new URL(siteBaseUrl.endsWith('/') ? siteBaseUrl : `${siteBaseUrl}/`);

		if (inviteUrl.origin === baseUrl.origin) {
			const path = inviteUrl.pathname.replace(/^\//, '');
			return `${path}${inviteUrl.search}`;
		}

		return `${inviteUrl.pathname.replace(/^\//, '')}${inviteUrl.search}`;
	} catch {
		return inviteLink;
	}
};

type TemplateParameter = {
	type: 'text';
	text: string;
	parameter_name?: string;
};

type ImageTemplateParameter = {
	type: 'image';
	image: { link: string };
};

type TemplateComponent =
	| { type: 'header'; parameters: ImageTemplateParameter[] }
	| { type: 'body'; parameters: TemplateParameter[] }
	| {
			type: 'button';
			sub_type: 'url';
			index: string;
			parameters: TemplateParameter[];
	  };

const resolveHeaderImageUrl = (config: WhatsAppCloudConfig): string => config.headerImageUrl;

const buildTextParameter = (text: string, parameterName?: string): TemplateParameter => {
	const parameter: TemplateParameter = { type: 'text', text };
	if (parameterName) {
		parameter.parameter_name = parameterName;
	}
	return parameter;
};

const buildInviteTemplateComponents = (
	options: SendInviteWhatsAppOptions,
	config: WhatsAppCloudConfig
): TemplateComponent[] | undefined => {
	if (config.templateComponents === 'none') {
		return undefined;
	}

	const owner = (options.groupOwner ?? 'Alguém').trim() || 'Alguém';
	const title = options.groupTitle.trim() || 'Amigo secreto';
	const components: TemplateComponent[] = [];

	const shouldIncludeHeader =
		config.templateComponents === 'header_body' || config.includeHeaderImage;

	if (shouldIncludeHeader) {
		components.push({
			type: 'header',
			parameters: [{ type: 'image', image: { link: resolveHeaderImageUrl(config) } }]
		});
	}

	const bodyParameters: TemplateParameter[] = config.useNamedParameters
		? [
				buildTextParameter(title, 'nome_do_grupo'),
				buildTextParameter(owner, 'dono_do_grupo')
			]
		: [buildTextParameter(owner), buildTextParameter(title)];

	components.push({
		type: 'body',
		parameters: bodyParameters
	});

	const shouldIncludeButton =
		config.templateComponents === 'body_button' || config.includeInviteButton;

	if (shouldIncludeButton) {
		components.push({
			type: 'button',
			sub_type: 'url',
			index: '0',
			parameters: [buildTextParameter(buildInviteButtonSuffix(options.inviteLink, config.siteBaseUrl))]
		});
	}

	return components;
};

const buildSecretMessageWhatsAppConfig = (env?: EnvSource): WhatsAppCloudConfig => ({
	accessToken: readEnvValue(env, ['WHATSAPP_ACCESS_TOKEN', 'META_WHATSAPP_ACCESS_TOKEN']),
	phoneNumberId: readEnvValue(env, ['WHATSAPP_PHONE_NUMBER_ID', 'META_WHATSAPP_PHONE_NUMBER_ID']),
	apiVersion: readEnvValue(env, ['WHATSAPP_API_VERSION']) ?? 'v25.0',
	templateName: readEnvValue(env, ['WHATSAPP_SECRET_MESSAGE_TEMPLATE_NAME']),
	templateLanguage: readEnvValue(env, ['WHATSAPP_SECRET_MESSAGE_TEMPLATE_LANG']) ?? 'pt_BR',
	templateComponents: parseComponentsMode(readEnvValue(env, ['WHATSAPP_SECRET_MESSAGE_TEMPLATE_COMPONENTS'])),
	useNamedParameters: readEnvValue(env, ['WHATSAPP_SECRET_MESSAGE_USE_NAMED_PARAMETERS']) === 'true',
	includeHeaderImage: readEnvValue(env, ['WHATSAPP_SECRET_MESSAGE_INCLUDE_HEADER']) === 'true',
	includeInviteButton: readEnvValue(env, ['WHATSAPP_SECRET_MESSAGE_INCLUDE_BUTTON']) === 'true',
	siteBaseUrl: readEnvValue(env, ['WHATSAPP_SITE_BASE_URL', 'PUBLIC_SITE_URL']) ?? 'https://feliz.natal.br',
	headerImageUrl:
		readEnvValue(env, ['WHATSAPP_HEADER_IMAGE_URL']) ??
		`${readEnvValue(env, ['WHATSAPP_SITE_BASE_URL', 'PUBLIC_SITE_URL']) ?? 'https://feliz.natal.br'}/og-image-whatsapp.jpg`,
	defaultCountryCode: readEnvValue(env, ['WHATSAPP_DEFAULT_COUNTRY_CODE']) ?? '55'
});

const buildSecretMessageTemplateComponents = (
	options: SendSecretMessageWhatsAppOptions,
	config: WhatsAppCloudConfig
): TemplateComponent[] | undefined => {
	if (config.templateComponents === 'none') {
		return undefined;
	}

	const title = options.groupTitle.trim() || 'Amigo secreto';
	const components: TemplateComponent[] = [];

	const shouldIncludeHeader =
		config.templateComponents === 'header_body' || config.includeHeaderImage;

	if (shouldIncludeHeader) {
		components.push({
			type: 'header',
			parameters: [{ type: 'image', image: { link: resolveHeaderImageUrl(config) } }]
		});
	}

	const bodyParameters: TemplateParameter[] = config.useNamedParameters
		? [buildTextParameter(title, 'nome_do_grupo')]
		: [buildTextParameter(title)];

	components.push({
		type: 'body',
		parameters: bodyParameters
	});

	const shouldIncludeButton =
		config.templateComponents === 'body_button' || config.includeInviteButton;

	if (shouldIncludeButton) {
		components.push({
			type: 'button',
			sub_type: 'url',
			index: '0',
			parameters: [buildTextParameter(buildInviteButtonSuffix(options.groupUrl, config.siteBaseUrl))]
		});
	}

	return components;
};

export const sendInviteWhatsApp = async (
	env: EnvSource,
	options: SendInviteWhatsAppOptions
): Promise<boolean> => {
	const config = buildWhatsAppCloudConfig(env);

	if (!isWhatsAppCloudConfigured(config)) {
		console.warn('[whatsapp-cloud] Credenciais ou template de convite não configurados.');
		return false;
	}

	const recipient = normalizeWhatsAppPhone(options.to, config.defaultCountryCode);
	if (!recipient) {
		console.warn('[whatsapp-cloud] Telefone inválido para convite:', options.to);
		return false;
	}

	const components = buildInviteTemplateComponents(options, config);
	const template: Record<string, unknown> = {
		name: config.templateName,
		language: { code: config.templateLanguage }
	};

	if (components?.length) {
		template.components = components;
	}

	const url = `https://graph.facebook.com/${config.apiVersion}/${config.phoneNumberId}/messages`;
	const payload = {
		messaging_product: 'whatsapp',
		to: recipient,
		type: 'template',
		template
	};

	try {
		console.info(
			'[whatsapp-cloud] Payload de envio:',
			JSON.stringify(
				{
					url,
					apiVersion: config.apiVersion,
					phoneNumberId: config.phoneNumberId,
					templateName: config.templateName,
					templateLanguage: config.templateLanguage,
					templateComponents: config.templateComponents,
					payload
				},
				null,
				2
			)
		);

		const response = await fetch(url, {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${config.accessToken}`,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(payload)
		});

		const responseBody = await response.text();
		let parsedResponse: WhatsAppSendResponse | null = null;
		try {
			parsedResponse = responseBody ? (JSON.parse(responseBody) as WhatsAppSendResponse) : null;
		} catch {
			parsedResponse = null;
		}

		if (!response.ok) {
			const errorCode = parsedResponse?.error?.code ?? 'n/a';
			const errorType = parsedResponse?.error?.type ?? 'n/a';
			const errorMessage = parsedResponse?.error?.message ?? responseBody;
			console.error(
				'[whatsapp-cloud] Falha ao enviar template de convite:',
				JSON.stringify(
					{
						status: response.status,
						errorCode,
						errorType,
						errorMessage,
						hint:
							'Confira se WHATSAPP_INVITE_TEMPLATE_NAME/LANG e WHATSAPP_INVITE_TEMPLATE_COMPONENTS batem com o template no Meta.',
						raw: responseBody
					},
					null,
					2
				)
			);
			return false;
		}

		const wamid = parsedResponse?.messages?.[0]?.id ?? null;
		const messageStatus = parsedResponse?.messages?.[0]?.message_status ?? null;
		const waId = parsedResponse?.contacts?.[0]?.wa_id ?? null;

		console.info(
			'[whatsapp-cloud] Template aceito pela Meta:',
			JSON.stringify(
				{
					status: response.status,
					wamid,
					messageStatus,
					waId,
					templateName: config.templateName,
					to: recipient,
					raw: parsedResponse ?? responseBody
				},
				null,
				2
			)
		);

		return true;
	} catch (error) {
		console.error('[whatsapp-cloud] Erro inesperado ao enviar convite:', error);
		return false;
	}
};

export const sendSecretMessageWhatsApp = async (
	env: EnvSource,
	options: SendSecretMessageWhatsAppOptions
): Promise<boolean> => {
	const config = buildSecretMessageWhatsAppConfig(env);

	if (!isWhatsAppCloudConfigured(config)) {
		console.warn('[whatsapp-cloud] Credenciais ou template de mensagem secreta não configurados.');
		return false;
	}

	const recipient = normalizeWhatsAppPhone(options.to, config.defaultCountryCode);
	if (!recipient) {
		console.warn('[whatsapp-cloud] Telefone inválido para mensagem secreta:', options.to);
		return false;
	}

	const components = buildSecretMessageTemplateComponents(options, config);
	const template: Record<string, unknown> = {
		name: config.templateName,
		language: { code: config.templateLanguage }
	};

	if (components?.length) {
		template.components = components;
	}

	const url = `https://graph.facebook.com/${config.apiVersion}/${config.phoneNumberId}/messages`;
	const payload = {
		messaging_product: 'whatsapp',
		to: recipient,
		type: 'template',
		template
	};

	try {
		console.info(
			'[whatsapp-cloud] Payload de mensagem secreta:',
			JSON.stringify(
				{
					url,
					apiVersion: config.apiVersion,
					phoneNumberId: config.phoneNumberId,
					templateName: config.templateName,
					templateLanguage: config.templateLanguage,
					templateComponents: config.templateComponents,
					payload
				},
				null,
				2
			)
		);

		const response = await fetch(url, {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${config.accessToken}`,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(payload)
		});

		const responseBody = await response.text();
		let parsedResponse: WhatsAppSendResponse | null = null;
		try {
			parsedResponse = responseBody ? (JSON.parse(responseBody) as WhatsAppSendResponse) : null;
		} catch {
			parsedResponse = null;
		}

		if (!response.ok) {
			const errorCode = parsedResponse?.error?.code ?? 'n/a';
			const errorType = parsedResponse?.error?.type ?? 'n/a';
			const errorMessage = parsedResponse?.error?.message ?? responseBody;
			console.error(
				'[whatsapp-cloud] Falha ao enviar template de mensagem secreta:',
				JSON.stringify(
					{
						status: response.status,
						errorCode,
						errorType,
						errorMessage,
						hint:
							'Confira WHATSAPP_SECRET_MESSAGE_TEMPLATE_NAME/LANG e WHATSAPP_SECRET_MESSAGE_TEMPLATE_COMPONENTS no Meta.',
						raw: responseBody
					},
					null,
					2
				)
			);
			return false;
		}

		const wamid = parsedResponse?.messages?.[0]?.id ?? null;
		const messageStatus = parsedResponse?.messages?.[0]?.message_status ?? null;
		const waId = parsedResponse?.contacts?.[0]?.wa_id ?? null;

		console.info(
			'[whatsapp-cloud] Template de mensagem secreta aceito pela Meta:',
			JSON.stringify(
				{
					status: response.status,
					wamid,
					messageStatus,
					waId,
					templateName: config.templateName,
					to: recipient,
					raw: parsedResponse ?? responseBody
				},
				null,
				2
			)
		);

		return true;
	} catch (error) {
		console.error('[whatsapp-cloud] Erro inesperado ao enviar mensagem secreta:', error);
		return false;
	}
};
