import type { AstroCookies } from 'astro';
import type { FelizNatalEnv } from './types';

export const SESSION_COOKIE = 'felizNatalSession';

export const getEnv = (locals: App.Locals): FelizNatalEnv | undefined =>
	(locals.cloudflare?.env ?? (locals as { env?: FelizNatalEnv }).env) as FelizNatalEnv | undefined;

export const getSessionUserId = (cookies: AstroCookies): string | null =>
	cookies.get(SESSION_COOKIE)?.value ?? null;
