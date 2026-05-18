export const isHtmxRequest = (request: Request) =>
	(request.headers.get('hx-request') ?? '').toLowerCase() === 'true';

export const isAjaxRequest = (request: Request) =>
	isHtmxRequest(request) ||
	(request.headers.get('x-requested-with') ?? '').toLowerCase() === 'xmlhttprequest';

export const respondJson = (
	body: Record<string, unknown>,
	status = 200,
	extraHeaders: Record<string, string> = {}
) =>
	new Response(JSON.stringify(body), {
		status,
		headers: { 'Content-Type': 'application/json; charset=utf-8', ...extraHeaders }
	});

export const respondText = (message: string, status = 400) =>
	new Response(message, {
		status,
		headers: { 'Content-Type': 'text/plain; charset=utf-8' }
	});

export const hxRedirect = (redirectTarget: string) =>
	new Response(null, {
		status: 204,
		headers: { 'HX-Redirect': redirectTarget }
	});
