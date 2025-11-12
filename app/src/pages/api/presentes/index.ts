import type { APIRoute } from 'astro';
import type { D1Database } from '@cloudflare/workers-types';

export const prerender = false;

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
	new Response(JSON.stringify(body), {
		status,
		headers: {
			'Content-Type': 'application/json; charset=utf-8'
		}
	});

type RuntimeEnv =
	| {
			DB?: D1Database;
	  }
	| null;

const resolveEnv = (
	locals:
		| {
				cloudflare?: { env?: RuntimeEnv };
				runtime?: { env?: RuntimeEnv };
				env?: RuntimeEnv;
		  }
		| null
		| undefined
) => locals?.cloudflare?.env ?? locals?.runtime?.env ?? locals?.env ?? null;

const slugify = (value: string) =>
	value
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/-{2,}/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 120);

const SUPPORTED_PROTOCOLS = new Set(['http:', 'https:']);

const normalizeSource = (value: string) => {
	try {
		const parsed = new URL(value);
		return SUPPORTED_PROTOCOLS.has(parsed.protocol) ? parsed.toString() : null;
	} catch {
		return null;
	}
};

const ensureUniqueSlug = async (base: string, env: D1Database) => {
	if (!base) {
		return crypto.randomUUID();
	}

	let candidate = base;
	let attempt = 1;

	while (attempt < 10) {
		const existing = await env
			.prepare('SELECT 1 FROM presentes WHERE slug = ? LIMIT 1')
			.bind(candidate)
			.first();

		if (!existing) {
			return candidate;
		}

		attempt += 1;
		candidate = `${base}-${attempt}`;
	}

	return `${base}-${crypto.randomUUID().split('-')[0]}`;
};

const mapRecord = (record: Record<string, unknown>) => ({
	id: String(record.id),
	title: (record.titulo as string) ?? null,
	price: (record.price as string | null) ?? null,
	image: (record.image as string | null) ?? null,
	url: (record.source as string) ?? ''
});

export const GET: APIRoute = async ({ locals, cookies }) => {
	const env = resolveEnv(locals);
	const sessionId = cookies.get('felizNatalSession')?.value ?? null;

	if (!env?.DB || !sessionId) {
		return jsonResponse({ ok: false, error: 'Não autorizado.' }, 401);
	}

	try {
		const result = await env.DB.prepare(
			`SELECT id, titulo, price, source, image, created_at
         FROM presentes
        WHERE deleted_at IS NULL
          AND usuario_id = ?
        ORDER BY datetime(coalesce(created_at, '1970-01-01')) DESC`
		)
			.bind(sessionId)
			.all();

		const presents = (result?.results ?? []).map((record) => mapRecord(record as Record<string, unknown>));
		return jsonResponse({ ok: true, presents });
	} catch (error) {
		console.error('Erro ao listar presentes:', error);
		return jsonResponse({ ok: false, error: 'Não foi possível carregar a lista de presentes.' }, 500);
	}
};

export const POST: APIRoute = async ({ request, locals, cookies }) => {
	const env = resolveEnv(locals);
	const sessionId = cookies.get('felizNatalSession')?.value ?? null;

	if (!env?.DB || !sessionId) {
		return jsonResponse({ ok: false, error: 'Não autorizado.' }, 401);
	}

	let payload: unknown;
	try {
		payload = await request.json();
	} catch {
		return jsonResponse({ ok: false, error: 'Payload inválido.' }, 400);
	}

	const titleRaw =
		payload && typeof payload === 'object' && 'title' in payload && typeof (payload as { title: unknown }).title === 'string'
			? (payload as { title: string }).title.trim()
			: null;

	const sourceRaw =
		payload && typeof payload === 'object' && 'source' in payload && typeof (payload as { source: unknown }).source === 'string'
			? (payload as { source: string }).source.trim()
			: null;

	const price =
		payload && typeof payload === 'object' && 'price' in payload && typeof (payload as { price: unknown }).price === 'string'
			? (payload as { price: string }).price.trim() || null
			: null;

	const image =
		payload && typeof payload === 'object' && 'image' in payload && typeof (payload as { image: unknown }).image === 'string'
			? (payload as { image: string }).image.trim() || null
			: null;

	const title = titleRaw && titleRaw.length > 2 ? titleRaw : 'Produto sem título';
	const source = sourceRaw ? normalizeSource(sourceRaw) : null;

	if (!source) {
		return jsonResponse({ ok: false, error: 'Informe uma URL válida para o presente.' }, 400);
	}

	try {
		const baseSlug = slugify(title) || slugify(new URL(source).hostname);
		const slug = await ensureUniqueSlug(baseSlug, env.DB);
		const id = crypto.randomUUID();
		const createdAt = new Date().toISOString();

		await env.DB.prepare(
			`INSERT INTO presentes (id, usuario_id, titulo, slug, price, source, image, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
		)
			.bind(id, sessionId, title, slug, price, source, image, createdAt)
			.run();

		return jsonResponse(
			{
				ok: true,
				present: {
					id,
					title,
					price,
					image,
					url: source,
					slug,
					created_at: createdAt
				}
			},
			201
		);
	} catch (error) {
		console.error('Erro ao salvar presente:', error);
		return jsonResponse({ ok: false, error: 'Não foi possível salvar o presente.' }, 500);
	}
};
