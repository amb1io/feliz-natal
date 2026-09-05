import { PresentesDurableObject } from './workers/presentes-durable-object';
import { handle } from '@astrojs/cloudflare/handler';
import { notifyTelegramSafely, templateAppError } from './shared/utils/telegram';

export default {
	async fetch(request, env, ctx) {
		try {
			return await handle(request, env, ctx);
		} catch (error) {
			console.error('Erro não tratado no worker:', error);
			const detail = error instanceof Error ? error.message : 'erro desconhecido';
			const where = new URL(request.url).pathname.slice(0, 120) || '/';
			ctx.waitUntil(
				notifyTelegramSafely(
					env as Record<string, unknown>,
					templateAppError({ where, detail: detail.slice(0, 200) })
				)
			);
			return new Response('Erro interno', { status: 500 });
		}
	}
};
export { PresentesDurableObject };
