import type { APIRoute } from 'astro';
import { getEnv } from '../../../../server/request-context';
import type { FelizNatalEnv } from '../../../../server/types';

const jsonResponse = (status: number, message: string) =>
	new Response(JSON.stringify({ message }), {
		status,
		headers: { 'Content-Type': 'application/json; charset=utf-8' }
	});

export const prerender = false;

export const GET: APIRoute = async ({ request, params, cookies }) => {
	const reqId = crypto.randomUUID().slice(0, 8);
	const slug = params.slug;
	const sessionCookie = cookies.get('felizNatalSession');
	const userId = sessionCookie?.value ?? null;

	console.log('[chat-ws-route] handshake start', {
		reqId,
		path: new URL(request.url).pathname,
		slug: slug ?? null,
		hasUpgradeHeader: Boolean(request.headers.get('Upgrade')),
		hasSessionCookie: Boolean(userId)
	});

	try {
		if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
			console.warn('[chat-ws-route] invalid upgrade header', { reqId });
			return jsonResponse(426, 'Expected websocket Upgrade header');
		}

		const env = getEnv() as FelizNatalEnv & { PRESENTES_STATE?: DurableObjectNamespace };
		if (!env?.DB || !env?.PRESENTES_STATE) {
			console.error('[chat-ws-route] missing cloudflare bindings', {
				reqId,
				hasDB: Boolean(env?.DB),
				hasPresentesState: Boolean(env?.PRESENTES_STATE)
			});
			return jsonResponse(500, 'Cloudflare bindings not available');
		}

		if (!slug) {
			console.warn('[chat-ws-route] missing slug', { reqId });
			return jsonResponse(400, 'Grupo não informado');
		}

		if (!userId) {
			console.warn('[chat-ws-route] missing session user', { reqId, slug });
			return jsonResponse(401, 'Faça login para acessar o chat');
		}

		const groupRow = await env.DB.prepare(
			`SELECT g.id, g.criado_por
			 FROM grupo g
			 WHERE g.slug = ?
			 LIMIT 1`
		)
			.bind(slug)
			.first();

		if (!groupRow) {
			console.warn('[chat-ws-route] group not found', { reqId, slug });
			return jsonResponse(404, 'Grupo não encontrado');
		}

		const { id: groupId, criado_por: ownerId } = groupRow as { id: string; criado_por: string | null };

		let isAuthorized = ownerId === userId;
		if (!isAuthorized) {
			const membership = await env.DB.prepare(
				`SELECT 1
				 FROM grupo_participante
				 WHERE grupo_id = ?
				   AND usuario_id = ?
				 LIMIT 1`
			)
				.bind(groupId, userId)
				.first();

			isAuthorized = Boolean(membership);
		}

		if (!isAuthorized) {
			console.warn('[chat-ws-route] user unauthorized', { reqId, groupId, userId });
			return jsonResponse(403, 'Você não pode participar deste chat');
		}

		const userRecord = await env.DB.prepare(
			`SELECT nome, email
			 FROM usuario
			 WHERE id = ?
			 LIMIT 1`
		)
			.bind(userId)
			.first();

		const displayName =
			(userRecord as { nome?: string | null; email?: string | null })?.nome ??
			(userRecord as { email?: string | null })?.email ??
			'Participante';

		const roomId = env.PRESENTES_STATE.idFromName(groupId);
		const stub = env.PRESENTES_STATE.get(roomId);
		console.log('[chat-ws-route] forwarding handshake to durable object', { reqId, groupId, userId });

		const forwardHeaders = new Headers(request.headers);
		forwardHeaders.set('x-chat-group-id', groupId);
		forwardHeaders.set('x-chat-group-slug', slug);
		forwardHeaders.set('x-chat-user-id', userId);
		forwardHeaders.set('x-chat-display-name', displayName);

		const stubUrl = new URL('https://presentes/chat');
		const stubRequest = new Request(stubUrl.toString(), {
			method: 'GET',
			headers: forwardHeaders
		});
		const stubResponse = await stub.fetch(stubRequest);

		if (stubResponse.status !== 101) {
			const errorMessage = await stubResponse.text();
			console.error('[chat-ws-route] durable object rejected handshake', {
				reqId,
				status: stubResponse.status,
				errorMessage
			});
			return jsonResponse(stubResponse.status, errorMessage || 'Erro ao conectar com o chat');
		}

		console.log('[chat-ws-route] handshake upgraded', { reqId, groupId, userId });
		return stubResponse;
	} catch (error) {
		console.error('[chat-ws-route] unexpected error', {
			reqId,
			slug: slug ?? null,
			userId: userId ?? null,
			error
		});
		return jsonResponse(500, 'Erro interno ao iniciar chat websocket');
	}
};
