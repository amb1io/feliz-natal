# WebSocket Worker

Implementa um servidor de WebSocket em Cloudflare Workers usando Durable Objects, inspirado no exemplo oficial da Cloudflare. Cada caminho (`/sala`) encaminha os clientes para a mesma instância do Durable Object, permitindo broadcast entre todas as conexões dessa sala. Cada mensagem também é persistida em um banco D1 compartilhado com o app principal.

## Scripts

- `npm run dev`: inicia o modo de desenvolvimento do Wrangler em ambiente local.
- `npm run deploy`: publica o worker na sua conta Cloudflare.

## Configuração

- Faça login com `npx wrangler login`.
- Atualize `wrangler.toml` com o `database_id` do seu banco D1 principal (já preenchido com exemplo).
- Após o deploy, copie a URL pública (`https://websocket-worker.seu-subdominio.workers.dev`) e configure `WEBSOCKET_WORKER_URL` no app Astro.

## Protocolo

Ao abrir a conexão, inclua os `query params`:

- `groupId`: ID real do grupo no banco D1.
- `userId`: ID do usuário autenticado.
- `initials`: duas letras usadas para o avatar no chat.

As mensagens enviadas devem seguir `{ "type": "message", "body": "texto" }`. Eventos recebidos chegam como `{ "type": "message", "payload": { "id", "body", "authorId", "initials" } }`.

## Fluxo básico

1. Clientes devem abrir uma conexão WebSocket para o endpoint do worker (`wss://.../sala`).
2. Mensagens no formato JSON `{ "type": "message", "body": "..." }` são retransmitidas para todos os demais clientes da sala.
3. Enviar `{ "type": "ping" }` retorna `{ "type": "pong" }`, ajudando em verificações de heartbeat.

Antes do deploy execute `npx wrangler login` (caso ainda não tenha autenticado) e ajuste entradas extras no `wrangler.toml` se precisar apontar para rotas específicas.
