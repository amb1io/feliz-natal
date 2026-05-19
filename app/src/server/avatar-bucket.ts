type EnvSource = Record<string, unknown> | undefined;

const MAX_AVATAR_UPLOAD_BYTES = 10 * 1024 * 1024;
const DEFAULT_AVATAR_MIME_TYPE = "application/octet-stream";
const AVATAR_PROXY_PREFIX = "/api/avatar/";

const readEnvValue = (env: EnvSource, keys: string[]): string | undefined => {
	for (const key of keys) {
		const fromEnvObject = typeof env === "object" && env !== null ? (env as Record<string, unknown>)[key] : undefined;
		if (typeof fromEnvObject === "string" && fromEnvObject.trim()) {
			return fromEnvObject.trim();
		}

		if (typeof process !== "undefined" && process.env?.[key]) {
			return process.env[key]!.trim();
		}

		const metaEnv = (import.meta as { env?: Record<string, string | undefined> }).env;
		const metaValue = metaEnv?.[key];
		if (typeof metaValue === "string" && metaValue.trim()) {
			return metaValue.trim();
		}
	}

	return undefined;
};

const detectExtensionFromMime = (mimeType: string) => {
	const normalized = mimeType.trim().toLowerCase();
	if (normalized === "image/jpeg" || normalized === "image/jpg") return "jpg";
	if (normalized === "image/png") return "png";
	if (normalized === "image/webp") return "webp";
	if (normalized === "image/gif") return "gif";
	if (normalized === "image/avif") return "avif";
	if (normalized === "image/svg+xml") return "svg";
	return "bin";
};

const buildPublicAvatarUrl = (baseUrl: string | undefined, key: string) => {
	const normalizedKey = key.replace(/^\/+/, "");
	if (baseUrl) {
		return `${baseUrl.replace(/\/+$/, "")}/${normalizedKey}`;
	}
	return `${AVATAR_PROXY_PREFIX}${normalizedKey}`;
};

const getObjectKeyFromAvatarUrl = (baseUrl: string | undefined, avatarUrl: string) => {
	const normalized = avatarUrl.trim();
	if (!normalized) return null;

	if (normalized.startsWith(AVATAR_PROXY_PREFIX)) {
		const keyFromProxy = normalized.slice(AVATAR_PROXY_PREFIX.length).replace(/^\/+/, "");
		return keyFromProxy || null;
	}

	if (normalized.startsWith("/")) {
		return null;
	}

	if (!baseUrl) return null;

	try {
		const parsedBase = new URL(baseUrl);
		const parsedAvatar = new URL(avatarUrl);
		if (parsedBase.origin !== parsedAvatar.origin) return null;

		const basePath = parsedBase.pathname.replace(/\/+$/, "");
		const objectPath = parsedAvatar.pathname;
		if (!objectPath.startsWith(basePath)) return null;

		const key = objectPath.slice(basePath.length).replace(/^\/+/, "");
		return key || null;
	} catch {
		return null;
	}
};

const getAvatarBucket = (env: EnvSource): R2Bucket => {
	const bucket = typeof env === "object" && env !== null ? (env as Record<string, unknown>).AVATARS_BUCKET : undefined;
	if (!bucket) {
		throw new Error("Bucket de avatars não configurado no ambiente.");
	}
	return bucket as R2Bucket;
};

const getAvatarPublicBaseUrl = (env: EnvSource) => {
	const baseUrl = readEnvValue(env, ["AVATAR_PUBLIC_BASE_URL"]);
	return baseUrl || undefined;
};

export const uploadAvatarToBucket = async (env: EnvSource, avatarFile: File, userId: string): Promise<string> => {
	if (!avatarFile.type.startsWith("image/")) {
		throw new Error("Selecione um arquivo de imagem válido para o avatar.");
	}

	if (avatarFile.size > MAX_AVATAR_UPLOAD_BYTES) {
		throw new Error("O avatar deve ter no máximo 10MB.");
	}

	const bucket = getAvatarBucket(env);
	const publicBaseUrl = getAvatarPublicBaseUrl(env);
	const extension = detectExtensionFromMime(avatarFile.type);
	const objectKey = `avatars/${userId}/${crypto.randomUUID()}.${extension}`;
	const payload = await avatarFile.arrayBuffer();

	await bucket.put(objectKey, payload, {
		httpMetadata: {
			contentType: avatarFile.type || DEFAULT_AVATAR_MIME_TYPE
		},
		customMetadata: {
			source: "perfil",
			userId
		}
	});

	return buildPublicAvatarUrl(publicBaseUrl, objectKey);
};

export const deleteAvatarFromBucket = async (env: EnvSource, avatarUrl?: string | null) => {
	if (!avatarUrl) return;
	const bucket = getAvatarBucket(env);
	const publicBaseUrl = getAvatarPublicBaseUrl(env);
	const objectKey = getObjectKeyFromAvatarUrl(publicBaseUrl, avatarUrl);
	if (!objectKey) return;
	await bucket.delete(objectKey);
};
