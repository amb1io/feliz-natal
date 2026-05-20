import { defineMiddleware } from 'astro:middleware';

export const onRequest = defineMiddleware((context, next) => {
	const { pathname, search } = context.url;

	if (pathname === '/app' || pathname.startsWith('/app/')) {
		const destination = pathname.replace(/^\/app/, '/amigo-secreto') + search;
		return context.redirect(destination, 301);
	}

	return next();
});
