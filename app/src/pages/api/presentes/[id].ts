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

const resolveEnv = (locals: { cloudflare?: { env?: RuntimeEnv }; runtime?: { env?: RuntimeEnv }; env?: RuntimeEnv } | null | undefined) =>
	locals?.cloudflare?.env ?? locals?.runtime?.env ?? locals?.env ?? null;

export const DELETE: APIRoute = async ({ params, locals, cookies }) => {
	const env = resolveEnv(locals);
	const sessionId = cookies.get('felizNatalSession')?.value ?? null;

	if (!env?.DB || !sessionId) {
		return jsonResponse({ ok: false, error: 'Não autorizado.' }, 401);
	}

	const presentId = params.id?.trim();
	if (!presentId) {
		return jsonResponse({ ok: false, error: 'Identificador inválido.' }, 400);
	}

	try {
		const deletedAt = new Date().toISOString();
		const result = await env.DB.prepare(
			`UPDATE presentes
         SET deleted_at = ?
       WHERE id = ?
         AND usuario_id = ?
         AND deleted_at IS NULL`
		)
			.bind(deletedAt, presentId, sessionId)
			.run();

		const changes = typeof result === 'object' && result ? Number((result as { meta?: { changes?: number } }).meta?.changes ?? 0) : 0;

		if (changes === 0) {
			return jsonResponse({ ok: false, error: 'Presente não encontrado.' }, 404);
		}

		return jsonResponse({ ok: true, deletedAt });
	} catch (error) {
		console.error('Erro ao remover presente:', error);
		return jsonResponse({ ok: false, error: 'Não foi possível remover o presente.' }, 500);
	}
};
