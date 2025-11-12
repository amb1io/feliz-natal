const escapeHtml = (value: string): string =>
	value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');

export const formatBody = (body: string): string =>
	escapeHtml(body).replace(/\r?\n/g, '<br />');

export const computeInitials = (input: string | null | undefined): string => {
	if (!input) return '??';
	const trimmed = input.trim();
	if (!trimmed) return '??';

	const parts = trimmed.split(/\s+/).filter(Boolean);

	if (parts.length === 1) {
		const segment = parts[0];
		if (segment.includes('@')) {
			return segment[0]?.toUpperCase() ?? '??';
		}
		return segment.slice(0, 2).toUpperCase();
	}

	const first = parts[0]?.[0] ?? '';
	const last = parts[parts.length - 1]?.[0] ?? '';

	const combination = `${first}${last}`.replace(/[^A-Za-z0-9]/g, '');
	return combination ? combination.toUpperCase() : (parts[0]?.slice(0, 2) ?? '??').toUpperCase();
};

type MessageForRender = {
	id: string;
	body: string;
	authorId: string;
	initials: string;
};

const messageAvatarClass = (isSelf: boolean) =>
	isSelf
		? 'border-[rgba(230,57,70,0.35)] bg-[rgba(230,57,70,0.12)] text-[var(--color-primary)]'
		: 'border-[rgba(42,157,143,0.35)] bg-[rgba(42,157,143,0.12)] text-[var(--color-text-muted)]';

const messageBubbleClass = (isSelf: boolean) =>
	isSelf ? 'rounded-br-sm bg-[rgba(230,57,70,0.2)]' : 'rounded-bl-sm bg-[rgba(42,157,143,0.18)]';

export const renderMessageBubble = (message: MessageForRender, viewerId: string): string => {
	const isSelf = message.authorId === viewerId;
	const alignment = isSelf ? 'flex justify-end' : 'flex justify-start';
	const ordering = isSelf ? 'flex-row-reverse' : '';
	const avatar = messageAvatarClass(isSelf);
	const bubble = messageBubbleClass(isSelf);

	return `
<div class="${alignment}" data-message-id="${message.id}" data-from="${isSelf ? 'me' : 'friend'}">
	<div class="flex items-end gap-3 ${ordering}">
		<span class="flex h-8 w-8 items-center justify-center rounded-full border ${avatar} text-xs font-semibold uppercase">
			${escapeHtml(message.initials)}
		</span>
		<p class="max-w-xs rounded-2xl px-4 py-2 text-sm text-[var(--color-text)] ${bubble}">
			${formatBody(message.body)}
		</p>
	</div>
</div>`.trim();
};

export const renderMessageList = (messages: MessageForRender[], viewerId: string): string =>
	messages.map((message) => renderMessageBubble(message, viewerId)).join('');

export type MessageRecord = MessageForRender;
