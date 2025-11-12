import type { APIRoute } from 'astro';

export const prerender = false;

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
	new Response(JSON.stringify(body), {
		status,
		headers: { 'Content-Type': 'application/json; charset=utf-8' }
	});

export const POST: APIRoute = async ({ request, locals, cookies }) => {
	const env = locals.cloudflare?.env ?? locals.runtime?.env ?? locals?.env ?? null;
	const sessionId = cookies.get('felizNatalSession')?.value ?? null;

	if (!env?.DB || !sessionId) {
		return jsonResponse({ ok: false, error: 'Não autorizado' }, 401);
	}

	let payload: unknown;
	try {
		payload = await request.json();
	} catch (error) {
		return jsonResponse({ ok: false, error: 'Formato inválido.' }, 400);
	}

	const notificationId =
		payload && typeof payload === 'object' && 'id' in payload && typeof (payload as { id: unknown }).id === 'string'
			? (payload as { id: string }).id.trim()
			: null;

	if (!notificationId) {
		return jsonResponse({ ok: false, error: 'Identificador de notificação ausente.' }, 400);
	}

	try {
		const agora = new Date().toISOString();
		const result = await env.DB.prepare(
			`UPDATE notificacao
			 SET lido = 1,
			     lido_em = ?
			 WHERE id = ?
			   AND usuario_id = ?`
		)
			.bind(agora, notificationId, sessionId)
			.run();

		const changes = typeof result === 'object' && result ? Number((result as { meta?: { changes?: number } }).meta?.changes ?? 0) : 0;

		if (changes === 0) {
			return jsonResponse({ ok: false, error: 'Notificação não encontrada.' }, 404);
		}

		return jsonResponse({ ok: true, readAt: agora });
	} catch (error) {
		console.error('Erro ao atualizar notificação como lida:', error);
		return jsonResponse({ ok: false, error: 'Não foi possível atualizar a notificação.' }, 500);
	}
};
