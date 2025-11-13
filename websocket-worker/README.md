# WebSocket Worker

Implementa um servidor de WebSocket em Cloudflare Workers usando Durable Objects, inspirado no exemplo oficial da Cloudflare. Cada caminho (`/sala`) encaminha os clientes para a mesma instância do Durable Object, permitindo broadcast entre todas as conexões dessa sala.

## Scripts

- `npm run dev`: inicia o modo de desenvolvimento do Wrangler em ambiente local.
- `npm run deploy`: publica o worker na sua conta Cloudflare.

## Fluxo básico

1. Clientes devem abrir uma conexão WebSocket para o endpoint do worker (`wss://.../sala`).
2. Mensagens no formato JSON `{ "type": "message", "payload": { "text": "...", "sender": "..." } }` são retransmitidas para todos os demais clientes da sala.
3. Enviar `{ "type": "ping" }` retorna `{ "type": "pong" }`, ajudando em verificações de heartbeat.

Antes do deploy execute `npx wrangler login` (caso ainda não tenha autenticado) e ajuste entradas extras no `wrangler.toml` se precisar apontar para rotas específicas.
