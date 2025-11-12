import type { DurableObjectState } from '@cloudflare/workers-types';
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
};

export class PresentesDurableObject {
	private readonly state: DurableObjectState;
	private readonly env: FelizNatalEnv;
	private readonly sessions = new Map<string, ChatSession>();
	private groupId: string | null = null;

	constructor(state: DurableObjectState, env: FelizNatalEnv) {
		this.state = state;
		this.env = env;
	}

	async fetch(request: Request): Promise<Response> {
		if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
			return new Response('Expected websocket', { status: 426 });
		}

		const webSocket = request.webSocket;
		if (!webSocket) {
			return new Response('WebSocket not found on request', { status: 500 });
		}

		const url = new URL(request.url);
		const headerGroupId = request.headers.get('x-chat-group-id');
		const headerUserId = request.headers.get('x-chat-user-id');
		const headerDisplayName = request.headers.get('x-chat-display-name');
		const groupId = headerGroupId ?? url.searchParams.get('groupId');
		const userId = headerUserId ?? url.searchParams.get('userId');
		const displayName = headerDisplayName ?? url.searchParams.get('displayName') ?? 'Participante';

		if (!groupId || !userId) {
			return new Response('Missing connection metadata', { status: 400 });
		}

		this.groupId ??= groupId;

		const sessionId = crypto.randomUUID();
		const session: ChatSession = {
			id: sessionId,
			socket: webSocket,
			userId,
			displayName
		};

		this.sessions.set(sessionId, session);

		webSocket.accept();

		webSocket.addEventListener('message', (event) => {
			this.handleIncomingMessage(session, event as MessageEvent).catch((error) => {
				console.error('[chat] failed to handle message', error);
				this.safeSend(session.socket, JSON.stringify({ type: 'error', message: 'Falha ao processar mensagem.' }));
			});
		});

		const teardown = () => {
			this.sessions.delete(sessionId);
		};

		webSocket.addEventListener('close', teardown);
		webSocket.addEventListener('error', teardown);

		return new Response(null, { status: 101, webSocket });
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
		await this.env.DB.prepare(
			`INSERT INTO mensagem (id, grupo_id, remetente_id, body)
			 VALUES (?, ?, ?, ?)`
		)
			.bind(messageId, groupId, session.userId, body)
			.run();

		const messageRecord: MessageRecord = {
			id: messageId,
			body,
			authorId: session.userId,
			initials: computeInitials(session.displayName)
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
