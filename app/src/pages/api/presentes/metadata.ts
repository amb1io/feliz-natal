import type { APIRoute } from 'astro';
import { parseHTML } from 'linkedom';

export const prerender = false;

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
	new Response(JSON.stringify(body), {
		status,
		headers: {
			'Content-Type': 'application/json; charset=utf-8'
		}
	});

const SUPPORTED_PROTOCOLS = new Set(['http:', 'https:']);

const userAgent =
	'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36';

type ExtractedMetadata = {
	title: string | null;
	image: string | null;
	price: string | null;
	url: string;
};

const selectMetaContent = (document: Document, keys: string[]): string | null => {
	for (const key of keys) {
		const byProperty = document.querySelector(`meta[property="${key}"]`);
		if (byProperty?.getAttribute('content')) {
			return byProperty.getAttribute('content')?.trim() || null;
		}

		const byName = document.querySelector(`meta[name="${key}"]`);
		if (byName?.getAttribute('content')) {
			return byName.getAttribute('content')?.trim() || null;
		}

		const byItemprop = document.querySelector(`meta[itemprop="${key}"]`);
		if (byItemprop?.getAttribute('content')) {
			return byItemprop.getAttribute('content')?.trim() || null;
		}
	}
	return null;
};

const absolutify = (maybeUrl: string | null, base: URL): string | null => {
	if (!maybeUrl) return null;
	try {
		return new URL(maybeUrl, base).toString();
	} catch {
		return null;
	}
};

const extractMetadata = (html: string, base: URL): ExtractedMetadata => {
	const { document } = parseHTML(html);

	const title =
		selectMetaContent(document, ['og:title', 'twitter:title']) ||
		document.querySelector('title')?.textContent?.trim() ||
		null;

	const price =
		selectMetaContent(document, [
			'product:price:amount',
			'og:price:amount',
			'price',
			'price:amount',
			'product:price',
			'twitter:data1'
		]) || null;

	const image =
		absolutify(
			selectMetaContent(document, ['og:image', 'twitter:image', 'image', 'og:image:url']),
			base
		) ||
		absolutify(document.querySelector('link[rel="image_src"]')?.getAttribute('href') || null, base);

	return {
		title,
		price,
		image,
		url: base.toString()
	};
};

export const POST: APIRoute = async ({ request }) => {
	let payload: unknown;
	try {
		payload = await request.json();
	} catch {
		return jsonResponse({ ok: false, error: 'Payload inválido.' }, 400);
	}

	const url =
		payload && typeof payload === 'object' && 'url' in payload && typeof (payload as { url: unknown }).url === 'string'
			? (payload as { url: string }).url.trim()
			: null;

	if (!url) {
		return jsonResponse({ ok: false, error: 'Informe uma URL.' }, 400);
	}

	let parsed: URL;
	try {
		parsed = new URL(url);
	} catch {
		return jsonResponse({ ok: false, error: 'URL inválida.' }, 400);
	}

	if (!SUPPORTED_PROTOCOLS.has(parsed.protocol)) {
		return jsonResponse({ ok: false, error: 'Apenas URLs http(s) são suportadas.' }, 400);
	}

	try {
		const response = await fetch(parsed.toString(), {
			redirect: 'follow',
			headers: {
				'User-Agent': userAgent,
				Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
				'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8'
			}
		});

		if (!response.ok) {
			return jsonResponse(
				{ ok: false, error: `Não foi possível carregar a página (${response.status}).` },
				response.status >= 400 && response.status < 600 ? response.status : 500
			);
		}

		const contentType = response.headers.get('content-type');
		if (!contentType || !contentType.toLowerCase().includes('text/html')) {
			return jsonResponse({ ok: false, error: 'O endereço informado não retornou uma página HTML.' }, 422);
		}

		const html = await response.text();
		const product = extractMetadata(html, parsed);

		return jsonResponse({ ok: true, product });
	} catch (error) {
		console.error('Erro ao capturar metadata do produto:', error);
		return jsonResponse({ ok: false, error: 'Não foi possível capturar as informações do produto.' }, 500);
	}
};
