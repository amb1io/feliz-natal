import type { SSRManifest } from 'astro';
import { createExports as cfCreateExports } from '@astrojs/cloudflare/entrypoints/server.js';
import { PresentesDurableObject } from './workers/presentes-durable-object';

export const createExports = (manifest: SSRManifest) => {
	const baseExports = cfCreateExports(manifest);
	return {
		...baseExports,
		PresentesDurableObject
	};
};

export default createExports;
export { PresentesDurableObject };
