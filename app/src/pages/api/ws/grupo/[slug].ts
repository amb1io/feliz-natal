import type { APIRoute } from 'astro';

type FelizNatalEnv = {
	DB: D1Database;
	PRESENTES_STATE: DurableObjectNamespace;
};

const jsonResponse = (status: number, message: string) =>
	new Response(JSON.stringify({ message }), {
		status,
		headers: { 'Content-Type': 'application/json; charset=utf-8' }
	});

export const prerender = false;

export const GET: APIRoute = async ({ request, params, locals, cookies }) => {
	if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
		return jsonResponse(426, 'Expected websocket Upgrade header');
	}

	const env = (locals.cloudflare?.env ?? locals.runtime?.env ?? locals?.env) as FelizNatalEnv | undefined;
	if (!env?.DB || !env?.PRESENTES_STATE) {
		return jsonResponse(500, 'Cloudflare bindings not available');
	}

	const slug = params.slug;
	const sessionCookie = cookies.get('felizNatalSession');
	const userId = sessionCookie?.value ?? null;

	if (!slug) {
		return jsonResponse(400, 'Grupo não informado');
	}

	if (!userId) {
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

	const upgradeHeader = request.headers.get('Upgrade');
	if ((upgradeHeader ?? '').toLowerCase() !== 'websocket') {
		return jsonResponse(426, 'Expected websocket Upgrade header');
	}

	const roomId = env.PRESENTES_STATE.idFromName(groupId);
	const stub = env.PRESENTES_STATE.get(roomId);

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

	const pair = new WebSocketPair();
	const [client, server] = Object.values(pair);

	const stubResponse = await stub.fetch(stubRequest, {
		headers: {
			Upgrade: 'websocket'
		},
		webSocket: server
	});

	if (stubResponse.status !== 101) {
		const errorMessage = await stubResponse.text();
		return jsonResponse(stubResponse.status, errorMessage || 'Erro ao conectar com o chat');
	}

	return new Response(null, { status: 101, webSocket: client });
};
