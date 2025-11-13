import type { DurableObjectState } from '@cloudflare/workers-types';

interface Env {
  WEBSOCKET_ROOM: DurableObjectNamespace;
  DB: D1Database;
}

type SessionMetadata = {
  userId: string;
  groupId: string;
  initials: string;
};

type Session = SessionMetadata & {
  webSocket: WebSocket;
  id: string;
};

export default {
  async fetch(request: Request, env: Env) {
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response('Expected WebSocket request.', { status: 426 });
    }

    const url = new URL(request.url);
    const roomName = sanitizeRoom(url.pathname);
    const id = env.WEBSOCKET_ROOM.idFromName(roomName);
    const stub = env.WEBSOCKET_ROOM.get(id);
    return stub.fetch(request);
  },
};

function sanitizeRoom(pathname: string) {
  const cleaned = pathname.replace(/^\/+/, '').trim();
  return cleaned.length > 0 ? cleaned : 'lobby';
}

export class WebsocketRoomDurableObject {
  private sessions: Session[] = [];

  constructor(private readonly state: DurableObjectState, private readonly env: Env) {}

  async fetch(request: Request) {
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Expected WebSocket request.', { status: 426 });
    }

    const url = new URL(request.url);
    const metadata = extractSessionMetadata(url);

    if (!metadata) {
      return new Response('Missing required session metadata.', { status: 400 });
    }

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    this.handleSession(server, metadata).catch((error) => {
      console.error('WebSocket session failed', error);
      server.close(1011, 'Internal Error');
    });

    return new Response(null, { status: 101, webSocket: client });
  }

  private async handleSession(webSocket: WebSocket, metadata: SessionMetadata) {
    webSocket.accept();
    const session: Session = { webSocket, id: crypto.randomUUID(), ...metadata };
    this.sessions.push(session);

    webSocket.addEventListener('message', (event) => this.onMessage(event, session));
    webSocket.addEventListener('close', () => this.closeSession(session, 'closed'));
    webSocket.addEventListener('error', () => this.closeSession(session, 'errored'));

    webSocket.send(JSON.stringify({ type: 'system', message: 'connected', id: session.id }));
  }

  private async onMessage(event: MessageEvent, session: Session) {
    const data = parseIncomingPayload(event.data);

    if (!data) {
      this.safeSend(session.webSocket, JSON.stringify({ type: 'error', message: 'Unsupported payload.' }));
      return;
    }

    if (data.type === 'ping') {
      this.safeSend(session.webSocket, JSON.stringify({ type: 'pong', ts: Date.now() }));
      return;
    }

    if (data.type === 'message') {
      const body = (data.body ?? '').trim();
      if (!body) {
        this.safeSend(session.webSocket, JSON.stringify({ type: 'error', message: 'Digite algo antes de enviar.' }));
        return;
      }

      const messageId = crypto.randomUUID();

      try {
        await this.env.DB.prepare(
          `INSERT INTO mensagem (id, grupo_id, remetente_id, body)
           VALUES (?, ?, ?, ?)`
        )
          .bind(messageId, session.groupId, session.userId, body)
          .run();
      } catch (error) {
        console.error('Failed to persist message', error);
        this.safeSend(session.webSocket, JSON.stringify({ type: 'error', message: 'Não foi possível enviar agora.' }));
        return;
      }

      const broadcastPayload: BroadcastMessage = {
        type: 'message',
        payload: {
          id: messageId,
          body,
          authorId: session.userId,
          initials: session.initials || '??',
        },
      };

      this.broadcast(broadcastPayload);
    }
  }

  private broadcast(message: BroadcastMessage) {
    const payload = JSON.stringify(message);
    this.cleanupSessions();

    for (const session of this.sessions) {
      this.safeSend(session.webSocket, payload);
    }
  }

  private closeSession(session: Session, reason: string) {
    this.sessions = this.sessions.filter((s) => s !== session);
    try {
      if (session.webSocket.readyState === 1) {
        session.webSocket.close(1000, reason);
      }
    } catch (error) {
      console.error('Failed closing WebSocket', error);
    }
  }

  private cleanupSessions() {
    this.sessions = this.sessions.filter((session) => session.webSocket.readyState === 1);
  }

  private safeSend(socket: WebSocket, data: string) {
    try {
      socket.send(data);
    } catch (error) {
      console.error('Failed to send WebSocket payload', error);
    }
  }
}

type BroadcastMessage = {
  type: 'message';
  payload: {
    id: string;
    body: string;
    authorId: string;
    initials: string;
  };
};

type IncomingPayload =
  | { type: 'ping' }
  | {
      type: 'message';
      body?: string;
    };

function parseIncomingPayload(raw: unknown): IncomingPayload | null {
  if (typeof raw !== 'string') return null;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const type = parsed.type;
    if (type === 'ping') return { type: 'ping' };
    if (type === 'message') {
      const body = typeof parsed.body === 'string' ? parsed.body : parsed.body?.toString();
      return { type: 'message', body };
    }
    return null;
  } catch {
    return null;
  }
}

function extractSessionMetadata(url: URL): SessionMetadata | null {
  const userId = url.searchParams.get('userId')?.trim() ?? '';
  const groupId = url.searchParams.get('groupId')?.trim() ?? '';
  const initials = url.searchParams.get('initials')?.trim() ?? '';

  if (!userId || !groupId) {
    return null;
  }

  return {
    userId,
    groupId,
    initials: initials || '??',
  };
}
