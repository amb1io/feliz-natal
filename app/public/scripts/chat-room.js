const escapeHtml = (value) =>
	value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');

const formatBody = (body) => escapeHtml(body).replace(/\r?\n/g, '<br />');

const renderMessageBubble = (message, viewerId) => {
	const isSelf = message.authorId === viewerId;
	const alignment = isSelf ? 'flex justify-end' : 'flex justify-start';
	const ordering = isSelf ? 'flex-row-reverse' : '';
	const avatarClass = isSelf
		? 'border-[rgba(230,57,70,0.35)] bg-[rgba(230,57,70,0.12)] text-[var(--color-primary)]'
		: 'border-[rgba(42,157,143,0.35)] bg-[rgba(42,157,143,0.12)] text-[var(--color-text-muted)]';
	const bubbleClass = isSelf ? 'rounded-br-sm bg-[rgba(230,57,70,0.2)]' : 'rounded-bl-sm bg-[rgba(42,157,143,0.18)]';

	return `
<div class="${alignment}" data-message-id="${message.id}" data-from="${isSelf ? 'me' : 'friend'}">
	<div class="flex items-end gap-3 ${ordering}">
		<span class="flex h-8 w-8 items-center justify-center rounded-full border ${avatarClass} text-xs font-semibold uppercase">
			${escapeHtml(message.initials)}
		</span>
		<p class="max-w-xs rounded-2xl px-4 py-2 text-sm text-[var(--color-text)] ${bubbleClass}">
			${formatBody(message.body)}
		</p>
	</div>
</div>`.trim();
};

const SELECTOR = '[data-chat-room]';

const toWebsocketUrl = (endpoint) => {
	const url = endpoint instanceof URL ? endpoint : new URL(endpoint, window.location.href);
	url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
	return url.toString();
};

const appendMessage = (container, viewerId, message) => {
	const tpl = document.createElement('template');
	tpl.innerHTML = renderMessageBubble(message, viewerId);
	const node = tpl.content.firstElementChild;
	if (node) {
		container.appendChild(node);
		container.scrollTop = container.scrollHeight;
	}
};

const setupChatRoom = (root) => {
	const endpoint = root.dataset.chatEndpoint;
	const viewerId = root.dataset.viewerId ?? '';
	const groupId = root.dataset.groupId ?? '';
	const viewerInitials = root.dataset.viewerInitials ?? '??';
	const messagesContainer = root.querySelector('[data-chat-log]');
	const form = root.querySelector('[data-chat-form]');
	const input = root.querySelector('[data-chat-input]');
	const feedback = root.querySelector('[data-chat-error]');

	if (!endpoint || !viewerId || !groupId || !messagesContainer || !form || !input) {
		return;
	}

	let socket = null;
	let reconnectTimer = null;
	let manualClose = false;

	const setFeedback = (message) => {
		if (!feedback) return;
		if (message) {
			feedback.textContent = message;
			feedback.classList.remove('hidden');
		} else {
			feedback.textContent = '';
			feedback.classList.add('hidden');
		}
	};

	const buildSocketUrl = () => {
		const target = new URL(endpoint, window.location.href);
		target.searchParams.set('userId', viewerId);
		target.searchParams.set('groupId', groupId);
		if (viewerInitials) {
			target.searchParams.set('initials', viewerInitials);
		}
		return toWebsocketUrl(target);
	};

	const connect = () => {
		if (socket) {
			socket.removeEventListener('close', handleClose);
			socket.close();
			socket = null;
		}

		setFeedback('Conectando ao chat...');
		socket = new WebSocket(buildSocketUrl());

		socket.addEventListener('open', () => {
			setFeedback('');
		});

		socket.addEventListener('message', (event) => {
			try {
				const payload = JSON.parse(event.data);
				if (payload.type === 'message') {
					appendMessage(messagesContainer, viewerId, payload.payload);
				} else if (payload.type === 'error') {
					setFeedback(payload.message);
				}
			} catch (error) {
				console.error('[chat] failed to parse event', error);
			}
		});

		socket.addEventListener('error', () => {
			socket?.close();
		});

		socket.addEventListener('close', handleClose);
	};

	const handleClose = () => {
		if (manualClose) return;
		setFeedback('Conexão perdida. Tentando reconectar...');
		if (reconnectTimer) {
			window.clearTimeout(reconnectTimer);
		}
		reconnectTimer = window.setTimeout(connect, 2000);
	};

	const teardown = () => {
		manualClose = true;
		if (reconnectTimer) {
			window.clearTimeout(reconnectTimer);
		}
		socket?.close();
	};

	form.addEventListener(
		'submit',
		(event) => {
			event.preventDefault();
			const value = input.value.trim();
			if (!value) {
				return;
			}

			if (!socket || socket.readyState !== WebSocket.OPEN) {
				setFeedback('Conexão indisponível. Aguarde a reconexão para enviar mensagens.');
				return;
			}

			socket.send(JSON.stringify({ type: 'message', body: value }));
			input.value = '';
		},
		false
	);

	window.addEventListener('beforeunload', teardown);
	connect();
};

const init = () => {
	document.querySelectorAll(SELECTOR).forEach((element) => setupChatRoom(element));
};

if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', init);
} else {
	init();
}
