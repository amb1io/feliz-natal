export const getSessionCookie = (): string | null => {
	if (typeof document === 'undefined') return null;
	const match = document.cookie.match(/(?:^|;\s*)felizNatalSession=([^;]*)/);
	return match?.[1] ? decodeURIComponent(match[1]) : null;
};
