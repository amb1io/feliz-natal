import { PresentesDurableObject } from './workers/presentes-durable-object';
import { handle } from '@astrojs/cloudflare/handler';

export default {
	fetch(request, env, ctx) {
		return handle(request, env, ctx);
	}
};
export { PresentesDurableObject };
