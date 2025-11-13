interface Env {
  WEBSOCKET_ROOM: DurableObjectNamespace;
}

type Session = {
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

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    this.handleSession(server).catch((error) => {
      console.error('WebSocket session failed', error);
      server.close(1011, 'Internal Error');
    });

    return new Response(null, { status: 101, webSocket: client });
  }

  private async handleSession(webSocket: WebSocket) {
    webSocket.accept();
    const session: Session = { webSocket, id: crypto.randomUUID() };
    this.sessions.push(session);

    webSocket.addEventListener('message', (event) => this.onMessage(event, session));
    webSocket.addEventListener('close', () => this.closeSession(session, 'closed'));
    webSocket.addEventListener('error', () => this.closeSession(session, 'errored'));

    webSocket.send(JSON.stringify({ type: 'system', message: 'connected', id: session.id }));
  }

  private onMessage(event: MessageEvent, session: Session) {
    let data: unknown = event.data;

    if (typeof data === 'string') {
      try {
        data = JSON.parse(data);
      } catch {
        // treat as raw text message
        data = { type: 'message', payload: { text: event.data } };
      }
    }

    if (!isPayload(data)) {
      session.webSocket.send(JSON.stringify({ type: 'error', message: 'Unsupported payload.' }));
      return;
    }

    if (data.type === 'ping') {
      session.webSocket.send(JSON.stringify({ type: 'pong', ts: Date.now() }));
      return;
    }

    if (data.type === 'message') {
      const enriched = {
        type: 'message',
        payload: {
          text: data.payload?.text ?? '',
          sender: data.payload?.sender ?? session.id,
          ts: Date.now(),
        },
      };
      this.broadcast(enriched, session);
    }
  }

  private broadcast(message: BroadcastMessage, sender: Session) {
    const payload = JSON.stringify(message);
    this.cleanupSessions();

    for (const session of this.sessions) {
      if (session === sender) continue;
      try {
        session.webSocket.send(payload);
      } catch (error) {
        console.error('Failed to send message', error);
        this.closeSession(session, 'send-error');
      }
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
}

type BroadcastMessage = {
  type: 'message';
  payload: {
    text: string;
    sender: string;
    ts: number;
  };
};

type Payload =
  | { type: 'ping' }
  | {
      type: 'message';
      payload?: {
        text?: string;
        sender?: string;
      };
    };

function isPayload(data: unknown): data is Payload {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
  const payload = data as Record<string, unknown>;
  if (payload.type === 'ping') return true;
  if (payload.type === 'message') return true;
  return false;
}
