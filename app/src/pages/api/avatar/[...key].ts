import type { APIRoute } from "astro";
import { getEnv } from "../../../server/request-context";

export const prerender = false;

const sanitizeObjectKey = (rawKey?: string) => {
	if (!rawKey) return null;
	const segments = rawKey
		.split("/")
		.map((segment) => segment.trim())
		.filter(Boolean);

	if (!segments.length) return null;
	if (segments.some((segment) => segment === "." || segment === "..")) return null;

	const objectKey = segments.join("/");
	if (!objectKey.startsWith("avatars/")) return null;
	return objectKey;
};

export const GET: APIRoute = async ({ params }) => {
	const env = getEnv();
	const objectKey = sanitizeObjectKey(params.key);

	if (!env?.AVATARS_BUCKET || !objectKey) {
		return new Response("Not found.", { status: 404 });
	}

	const object = await env.AVATARS_BUCKET.get(objectKey);
	if (!object || !object.body) {
		return new Response("Not found.", { status: 404 });
	}

	const headers = new Headers();
	object.writeHttpMetadata(headers);
	headers.set("etag", object.httpEtag);
	headers.set("cache-control", "public, max-age=31536000, immutable");

	return new Response(object.body, {
		status: 200,
		headers
	});
};
