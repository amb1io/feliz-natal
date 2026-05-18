import { env } from 'cloudflare:workers';
import type { AstroCookies } from 'astro';
import type { FelizNatalEnv } from './types';

export const SESSION_COOKIE = 'felizNatalSession';

/** Cloudflare bindings (D1, KV, secrets). Astro v6: use cloudflare:workers, not locals.cloudflare.env. */
export const getEnv = (): FelizNatalEnv => env as FelizNatalEnv;

export const getSessionUserId = (cookies: AstroCookies): string | null =>
	cookies.get(SESSION_COOKIE)?.value ?? null;
