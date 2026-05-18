import type { APIRoute } from 'astro';
import {
	buildWhatsAppWebhookConfig,
	isWhatsAppBusinessWebhook,
	processWhatsAppWebhook,
	type WhatsAppMessageStatus,
	validateSignature,
	verifySubscription
} from '../../../shared/utils/whatsapp-webhook';

export const prerender = false;

type RuntimeEnv = Record<string, unknown> | undefined;

const textResponse = (body: string, status = 200) =>
	new Response(body, {
		status,
		headers: { 'Content-Type': 'text/plain; charset=utf-8' }
	});

const logMessageStatuses = (statuses: unknown) => {
	if (!Array.isArray(statuses) || statuses.length === 0) {
		return;
	}

	for (const statusEntry of statuses as WhatsAppMessageStatus[]) {
		const errors =
			statusEntry.errors?.map((error) => ({
				code: error.code ?? null,
				title: error.title ?? null,
				message: error.message ?? null,
				details: error.error_data?.details ?? null
			})) ?? [];

		console.info(
			'[whatsapp-webhook] status update',
			JSON.stringify(
				{
					wamid: statusEntry.id ?? null,
					status: statusEntry.status ?? null,
					recipientId: statusEntry.recipient_id ?? null,
					timestamp: statusEntry.timestamp ?? null,
					conversationId: statusEntry.conversation?.id ?? null,
					conversationOrigin: statusEntry.conversation?.origin?.type ?? null,
					pricingCategory: statusEntry.pricing?.category ?? null,
					billable: statusEntry.pricing?.billable ?? null,
					errors
				},
				null,
				2
			)
		);
	}
};

const resolveEnv = (
	locals:
		| {
				cloudflare?: { env?: RuntimeEnv };
				runtime?: { env?: RuntimeEnv };
				env?: RuntimeEnv;
		  }
		| null
		| undefined
) => locals?.cloudflare?.env ?? locals?.runtime?.env ?? locals?.env ?? undefined;

export const GET: APIRoute = async ({ request, locals }) => {
	const config = buildWhatsAppWebhookConfig(resolveEnv(locals));

	if (!config.verifyToken) {
		console.error('[whatsapp-webhook] WHATSAPP_VERIFY_TOKEN não configurado.');
		return textResponse('Webhook não configurado.', 503);
	}

	const challenge = verifySubscription(new URL(request.url).searchParams, config.verifyToken);

	if (!challenge) {
		return textResponse('Forbidden', 403);
	}

	return textResponse(challenge);
};

export const POST: APIRoute = async ({ request, locals }) => {
	const config = buildWhatsAppWebhookConfig(resolveEnv(locals));
	const rawBody = await request.text();

	if (config.appSecret) {
		const signature = request.headers.get('X-Hub-Signature-256');
		const valid = await validateSignature(rawBody, signature, config.appSecret);

		if (!valid) {
			console.warn('[whatsapp-webhook] Assinatura inválida.');
			return textResponse('Forbidden', 403);
		}
	} else {
		console.warn('[whatsapp-webhook] META_APP_SECRET ausente; assinatura não validada.');
	}

	let payload: unknown;
	try {
		payload = rawBody ? JSON.parse(rawBody) : null;
	} catch {
		return textResponse('Bad Request', 400);
	}

	if (!isWhatsAppBusinessWebhook(payload)) {
		return textResponse('EVENT_RECEIVED');
	}

	const events = processWhatsAppWebhook(payload);
	for (const event of events) {
		if (event.type === 'message_status') {
			const statuses = (event.data as { statuses?: unknown }).statuses;
			logMessageStatuses(statuses);
			continue;
		}

		console.log(`[whatsapp-webhook] ${event.type}`, JSON.stringify(event.data));
	}

	return textResponse('EVENT_RECEIVED');
};
