import type { DurableObjectState } from '@cloudflare/workers-types';
import { DurableObject } from 'cloudflare:workers';
import type { MessageRecord } from '../utils/message-renderer';
import { computeInitials } from '../utils/message-renderer';

type FelizNatalEnv = {
	DB: D1Database;
};

type ChatSession = {
	id: string;
	socket: WebSocket;
	userId: string;
	displayName: string;
	avatarUrl?: string | null;
};

export class PresentesDurableObject extends DurableObject {
	private readonly state: DurableObjectState;
	private readonly env: FelizNatalEnv;
	private readonly sessions = new Map<string, ChatSession>();
	private groupId: string | null = null;

	constructor(state: DurableObjectState, env: FelizNatalEnv) {
		super(state, env);
		this.state = state;
		this.env = env;
	}

	async fetch(request: Request): Promise<Response> {
		const reqId = crypto.randomUUID().slice(0, 8);
		console.log('[chat-do] fetch start', {
			reqId,
			path: new URL(request.url).pathname,
			hasUpgradeHeader: Boolean(request.headers.get('Upgrade'))
		});

		if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
			console.warn('[chat-do] invalid upgrade header', { reqId });
			return new Response('Expected websocket', { status: 426 });
		}

		const pair = new WebSocketPair();
		const [client, server] = Object.values(pair);

		const url = new URL(request.url);
		const headerGroupId = request.headers.get('x-chat-group-id');
		const headerUserId = request.headers.get('x-chat-user-id');
		const headerDisplayName = request.headers.get('x-chat-display-name');
		const headerAvatarUrl = request.headers.get('x-chat-avatar-url');
		const groupId = headerGroupId ?? url.searchParams.get('groupId');
		const userId = headerUserId ?? url.searchParams.get('userId');
		const displayName = headerDisplayName ?? url.searchParams.get('displayName') ?? 'Participante';

		if (!groupId || !userId) {
			console.warn('[chat-do] missing connection metadata', { reqId, groupId, userId });
			return new Response('Missing connection metadata', { status: 400 });
		}

		this.groupId ??= groupId;

		const sessionId = crypto.randomUUID();
		const session: ChatSession = {
			id: sessionId,
			socket: server,
			userId,
			displayName,
			avatarUrl: headerAvatarUrl?.trim() || null
		};

		this.sessions.set(sessionId, session);
		console.log('[chat-do] session accepted', {
			reqId,
			sessionId,
			groupId,
			userId,
			activeSessions: this.sessions.size
		});

		server.accept();

		server.addEventListener('message', (event) => {
			this.handleIncomingMessage(session, event as MessageEvent).catch((error) => {
				console.error('[chat] failed to handle message', error);
				this.safeSend(session.socket, JSON.stringify({ type: 'error', message: 'Falha ao processar mensagem.' }));
			});
		});

		const teardown = () => {
			this.sessions.delete(sessionId);
			console.log('[chat-do] session closed', {
				reqId,
				sessionId,
				groupId: this.groupId,
				activeSessions: this.sessions.size
			});
		};

		server.addEventListener('close', teardown);
		server.addEventListener('error', teardown);

		return new Response(null, { status: 101, webSocket: client });
	}

	private async handleIncomingMessage(session: ChatSession, event: MessageEvent): Promise<void> {
		if (typeof event.data !== 'string') {
			this.safeSend(session.socket, JSON.stringify({ type: 'error', message: 'Formato inválido.' }));
			return;
		}

		let payload: { type?: string; body?: unknown };
		try {
			payload = JSON.parse(event.data);
		} catch {
			this.safeSend(session.socket, JSON.stringify({ type: 'error', message: 'Mensagem inválida.' }));
			return;
		}

		if (payload.type !== 'message') {
			return;
		}

		const body = (payload.body ?? '').toString().trim();
		if (!body) {
			this.safeSend(session.socket, JSON.stringify({ type: 'error', message: 'Digite algo antes de enviar.' }));
			return;
		}

		const groupId = this.groupId;
		if (!groupId) {
			this.safeSend(session.socket, JSON.stringify({ type: 'error', message: 'Grupo indisponível no momento.' }));
			return;
		}

		const messageId = crypto.randomUUID();
		try {
			await this.env.DB.prepare(
				`INSERT INTO mensagem (id, grupo_id, remetente_id, body)
				 VALUES (?, ?, ?, ?)`
			)
				.bind(messageId, groupId, session.userId, body)
				.run();
		} catch (error) {
			console.error('[chat-do] failed to persist message', {
				groupId,
				userId: session.userId,
				messageId,
				error
			});
			this.safeSend(
				session.socket,
				JSON.stringify({ type: 'error', message: 'Falha ao salvar mensagem no servidor.' })
			);
			return;
		}

		const messageRecord: MessageRecord = {
			id: messageId,
			body,
			authorId: session.userId,
			initials: computeInitials(session.displayName),
			avatarUrl: session.avatarUrl ?? null
		};

		this.broadcast(JSON.stringify({ type: 'message', payload: messageRecord }));
	}

	private broadcast(serialized: string): void {
		for (const session of this.sessions.values()) {
			this.safeSend(session.socket, serialized);
		}
	}

	private safeSend(socket: WebSocket, data: string): void {
		try {
			socket.send(data);
		} catch (error) {
			console.error('[chat] failed to send payload', error);
		}
	}
}
