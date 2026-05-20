type RuntimeEnv = Record<string, unknown> | null | undefined;

export type CognitoConfig = {
	domain: string;
	clientId: string;
	redirectUri: string;
	logoutUri: string;
	region: string;
	providers: string[];
};

export type CognitoProviderDefinition = {
	id: string;
	name: string;
	accent: string;
	icon: string;
};

export const COGNITO_PROVIDER_DEFINITIONS: CognitoProviderDefinition[] = [
	{
		id: 'Google',
		name: 'Google',
		accent: 'bg-white text-[#1F2937] hover:bg-[#F3F4F6] border border-gray-300',
		icon: 'google',
	},
	{
		id: 'Facebook',
		name: 'Facebook',
		accent: 'bg-[#1877F2] !text-white hover:bg-[#166FE5]',
		icon: 'facebook',
	},
	{
		id: 'Microsoft',
		name: 'Microsoft',
		accent: 'bg-[#2563EB] !text-white hover:bg-[#1D4ED8]',
		icon: 'microsoft',
	},
	{
		id: 'Slack',
		name: 'Slack',
		accent: 'bg-[#1A1D21] !text-white hover:bg-[#0F1114]',
		icon: 'slack',
	},
];

const readEnv = (runtime: RuntimeEnv, key: string): string => {
	const fromRuntime = runtime?.[key];
	if (typeof fromRuntime === 'string' && fromRuntime.trim()) {
		return fromRuntime.trim();
	}

	const fromMeta = import.meta.env[key];
	if (typeof fromMeta === 'string' && fromMeta.trim()) {
		return fromMeta.trim();
	}

	return '';
};

const parseProviders = (value: string) =>
	value
		.split(',')
		.map((provider) => provider.trim())
		.filter(Boolean);

export const resolveCognitoConfig = (
	runtime?: RuntimeEnv,
	options?: { requestUrl?: string }
): CognitoConfig => {
	const providersRaw =
		readEnv(runtime, 'PUBLIC_COGNITO_SUPPORTED_PROVIDERS') || 'Google,Facebook';

	let redirectUri = readEnv(runtime, 'PUBLIC_COGNITO_REDIRECT_URI');
	if (!redirectUri && options?.requestUrl) {
		redirectUri = `${new URL(options.requestUrl).origin}/auth/callback`;
	}

	return {
		domain: normalizeCognitoDomain(readEnv(runtime, 'PUBLIC_COGNITO_DOMAIN')),
		clientId: readEnv(runtime, 'PUBLIC_COGNITO_CLIENT_ID'),
		redirectUri,
		logoutUri: readEnv(runtime, 'PUBLIC_COGNITO_LOGOUT_URI'),
		region: readEnv(runtime, 'PUBLIC_COGNITO_REGION'),
		providers: parseProviders(providersRaw),
	};
};

export const resolveCognitoClientSecret = (runtime?: RuntimeEnv): string | null => {
	const secret =
		readEnv(runtime, 'COGNITO_CLIENT_SECRET') ||
		readEnv(runtime, 'PRIVATE_COGNITO_CLIENT_SECRET');
	return secret || null;
};

export const hasCognitoConfig = (config: CognitoConfig): boolean =>
	Boolean(config.domain && config.clientId && config.redirectUri);

export const normalizeCognitoDomain = (value: string) =>
	value.replace(/^https?:\/\//i, '').replace(/\/+$/, '');

/** Base URL for Cognito Hosted UI (authorize, token, logout). */
export const cognitoBaseUrl = (domain: string): string => {
	const host = normalizeCognitoDomain(domain);
	return host ? `https://${host}` : '';
};

export const buildCognitoAuthorizeUrl = (
	config: CognitoConfig,
	options?: { provider?: string; state?: string }
): string => {
	if (!hasCognitoConfig(config)) return '#';

	const base = cognitoBaseUrl(config.domain);
	const params = new URLSearchParams({
		response_type: 'code',
		client_id: config.clientId,
		redirect_uri: config.redirectUri,
		scope: 'email openid profile',
	});

	if (options?.provider) {
		params.append('identity_provider', options.provider);
	}
	if (options?.state) {
		params.set('state', options.state);
	}

	return `${base}/oauth2/authorize?${params.toString()}`;
};

export const buildCognitoTokenUrl = (config: CognitoConfig): string => {
	const base = cognitoBaseUrl(config.domain);
	return base ? `${base}/oauth2/token` : '';
};

export type CognitoSocialProvider = CognitoProviderDefinition & { href: string };

export const buildCognitoSocialProviders = (
	config: CognitoConfig,
	options?: { state?: string }
): CognitoSocialProvider[] =>
	COGNITO_PROVIDER_DEFINITIONS.filter((definition) =>
		config.providers.includes(definition.id)
	).map((definition) => ({
		...definition,
		href: buildCognitoAuthorizeUrl(config, {
			provider: definition.id,
			state: options?.state,
		}),
	}));

export const getCognitoDisabledClasses = (config: CognitoConfig): string =>
	hasCognitoConfig(config) ? '' : 'pointer-events-none opacity-50';
