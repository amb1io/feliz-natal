import { getSessionCookie } from './session';

export const ensureClientSession = () => {
	if (typeof window === 'undefined') return;
	const session = getSessionCookie();
	if (!session) {
		window.location.replace('/app/');
	}
};
