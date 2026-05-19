import {
	sendDrawCompletedEmail,
	sendInviteEmail,
	sendSecretMessageEmail
} from '../shared/utils/email';
import {
	sendInviteWhatsApp,
	sendDrawCompletedWhatsApp,
	sendSecretMessageWhatsApp
} from '../shared/utils/whatsapp-cloud';
import { isHtmxRequest, isAjaxRequest, respondJson, respondText, hxRedirect } from './http/htmx';
import { createNotification } from './notifications';
import { countAcceptedInvites, findInviteById, updateInviteSentAt, deleteInvite, findInvitePhoneByEmail, findInvitePhonesByGroup } from './repositories/invite-repository';
import { insertGroupMessage, insertSecretMessage, findUserContact } from './repositories/message-repository';
import { findActiveParticipantIds, findParticipantContacts, performDraw } from './repositories/draw-repository';
import { deactivateGroup } from './repositories/group-repository';
import type { FelizNatalEnv, GrupoRow } from './types';

export type GroupActionContext = {
	env: FelizNatalEnv;
	request: Request;
	url: URL;
	userId: string;
	groupId: string;
	grupoRow: GrupoRow;
	canEdit: boolean;
	viewerDisplayName: string;
};

export type GroupActionState = {
	submissionError: string | null;
	draftMessage: string;
	drawError: string | null;
	secretMessageError: string | null;
	secretDraft: string;
};

export type GroupActionResult =
	| { type: 'continue'; state: GroupActionState }
	| { type: 'redirect'; target: string }
	| { type: 'response'; response: Response };

const emptyState = (): GroupActionState => ({
	submissionError: null,
	draftMessage: '',
	drawError: null,
	secretMessageError: null,
	secretDraft: ''
});

const redirectPath = (ctx: GroupActionContext) => `${ctx.url.pathname}${ctx.url.search}`;

async function handleMessage(
	ctx: GroupActionContext,
	formData: FormData,
	state: GroupActionState
): Promise<GroupActionResult> {
	const bodyRaw = formData.get('body');
	const bodyString =
		typeof bodyRaw === 'string' ? bodyRaw : bodyRaw ? bodyRaw.toString() : '';
	state.draftMessage = bodyString;
	const messageContent = bodyString.trim();

	if (!messageContent) {
		state.submissionError = 'Digite uma mensagem antes de enviar.';
		return { type: 'continue', state };
	}

	try {
		await insertGroupMessage(ctx.env.DB, ctx.groupId, ctx.userId, messageContent);
		return { type: 'redirect', target: redirectPath(ctx) };
	} catch (error) {
		console.error('Erro ao salvar mensagem do grupo:', error);
		state.submissionError = 'Não foi possível enviar a mensagem agora.';
		return { type: 'continue', state };
	}
}

async function handleSecretMessage(
	ctx: GroupActionContext,
	formData: FormData,
	state: GroupActionState
): Promise<GroupActionResult> {
	const bodyRaw = formData.get('body');
	const recipientRaw = formData.get('recipient_id');
	const bodyString =
		typeof bodyRaw === 'string' ? bodyRaw : bodyRaw ? bodyRaw.toString() : '';
	const recipientId =
		typeof recipientRaw === 'string'
			? recipientRaw.trim()
			: recipientRaw
				? recipientRaw.toString().trim()
				: '';

	state.secretDraft = bodyString;
	const messageContent = bodyString.trim();

	if (!recipientId) {
		state.secretMessageError = 'Não foi possível identificar o destinatário da mensagem secreta.';
		return { type: 'continue', state };
	}
	if (!messageContent) {
		state.secretMessageError = 'Digite uma mensagem secreta antes de enviar.';
		return { type: 'continue', state };
	}

	try {
		const messageId = await insertSecretMessage(
			ctx.env.DB,
			ctx.groupId,
			ctx.userId,
			recipientId,
			messageContent
		);

		try {
			const recipientRecord = await findUserContact(ctx.env.DB, recipientId);
			const recipientEmail = recipientRecord?.email?.trim() ?? null;
			const recipientName = recipientRecord?.nome ?? null;
			let recipientPhone: string | null = null;

			if (recipientEmail) {
				recipientPhone = await findInvitePhoneByEmail(ctx.env.DB, ctx.groupId, recipientEmail);
			}

			const secretGroupTitle = ctx.grupoRow.titulo;
			const secretGroupSlug = ctx.grupoRow.slug;
			const secretGroupUrl = new URL(
				`/app/grupo/${encodeURIComponent(secretGroupSlug)}?openSecret=1`,
				ctx.url
			).toString();

			if (recipientEmail) {
				const sent = await sendSecretMessageEmail(ctx.env as Parameters<typeof sendSecretMessageEmail>[0], {
					to: recipientEmail,
					groupTitle: secretGroupTitle,
					groupUrl: secretGroupUrl,
					recipientName
				});
				if (!sent) {
					console.warn('Nao foi possivel enviar email de mensagem secreta para:', recipientEmail);
				}
			}

			if (recipientPhone) {
				const sent = await sendSecretMessageWhatsApp(ctx.env, {
					to: recipientPhone,
					groupTitle: secretGroupTitle,
					groupUrl: secretGroupUrl,
					recipientName
				});
				if (!sent) {
					console.warn('Nao foi possivel enviar WhatsApp de mensagem secreta para:', recipientPhone);
				}
			}
		} catch (error) {
			console.error('Erro ao enviar alertas de mensagem secreta:', error);
		}

		await createNotification(
			ctx.env.DB,
			recipientId,
			'Mensagem Recebida',
			'Seu amigo te mandou uma mensagem. Veja aqui',
			ctx.groupId,
			messageId
		);

		return { type: 'redirect', target: redirectPath(ctx) };
	} catch (error) {
		console.error('Erro ao enviar mensagem secreta do grupo:', error);
		state.secretMessageError = 'Não foi possível enviar a mensagem secreta agora.';
		return { type: 'continue', state };
	}
}

async function handleDraw(
	ctx: GroupActionContext,
	state: GroupActionState
): Promise<GroupActionResult> {
	const htmx = isHtmxRequest(ctx.request);
	const ajax = isAjaxRequest(ctx.request);

	try {
		const acceptedInviteCount = await countAcceptedInvites(ctx.env.DB, ctx.groupId);
		if (acceptedInviteCount < 1) {
			state.drawError = 'Espere as pessoas aceitarem o convite antes de fazer o sorteio';
			if (htmx) return { type: 'response', response: respondText(state.drawError, 400) };
			if (ajax) return { type: 'response', response: respondJson({ ok: false, error: state.drawError }, 400) };
			return { type: 'continue', state };
		}

		const participantIds = await findActiveParticipantIds(ctx.env.DB, ctx.groupId);

		if (participantIds.length < 2) {
			state.drawError = 'É necessário pelo menos 2 participantes ativos para realizar o sorteio.';
			if (htmx) return { type: 'response', response: respondText(state.drawError, 400) };
			if (ajax) return { type: 'response', response: respondJson({ ok: false, error: state.drawError }, 400) };
			return { type: 'continue', state };
		}

		const drawResult = await performDraw(ctx.env.DB, ctx.groupId, participantIds);

		if (!drawResult) {
			state.drawError = 'Não foi possível concluir o sorteio. Tente novamente.';
			if (htmx) return { type: 'response', response: respondText(state.drawError, 400) };
			if (ajax) return { type: 'response', response: respondJson({ ok: false, error: state.drawError }, 400) };
			return { type: 'continue', state };
		}

		const { recipients } = drawResult;
		const groupTitle = ctx.grupoRow.titulo;
		const groupSlug = ctx.grupoRow.slug;
		const revealDateValue = ctx.grupoRow.data_revelacao ?? null;
		const revealLocationValue = ctx.grupoRow.localizacao_nome ?? ctx.grupoRow.localizacao ?? null;
		const groupUrl = new URL(`/app/grupo/${groupSlug}`, ctx.url).toString();

		const notificationPromises: Array<Promise<void>> = [];
		const emailPromises: Array<Promise<unknown>> = [];
		const whatsappPromises: Array<Promise<unknown>> = [];

		const participantContacts = await findParticipantContacts(ctx.env.DB, participantIds);

		const participantEmails = Array.from(
			new Set(
				Array.from(participantContacts.values())
					.map((contact) => contact.email?.trim().toLowerCase())
					.filter((value): value is string => Boolean(value))
			)
		);

		if (participantEmails.length > 0) {
			try {
				const invitePhones = await findInvitePhonesByGroup(ctx.env.DB, ctx.groupId);
				const phoneByEmail = new Map<string, string>();
				for (const row of invitePhones) {
					const record = row as { email_key?: string | null; telefone?: string | null };
					const emailKey = record.email_key?.trim().toLowerCase() ?? '';
					const phoneValue = record.telefone?.trim() ?? '';
					if (!emailKey || !phoneValue) continue;
					if (!participantEmails.includes(emailKey)) continue;
					if (!phoneByEmail.has(emailKey)) {
						phoneByEmail.set(emailKey, phoneValue);
					}
				}

				for (const [participantId, contact] of participantContacts.entries()) {
					const emailKey = contact.email.trim().toLowerCase();
					const phoneValue = phoneByEmail.get(emailKey) ?? null;
					if (phoneValue) {
						participantContacts.set(participantId, { ...contact, telefone: phoneValue });
					}
				}
			} catch (error) {
				console.error('Erro ao carregar contatos dos participantes:', error);
			}
		}

		for (let index = 0; index < participantIds.length; index += 1) {
			const giverId = participantIds[index];
			const recipientId = recipients[index];

			notificationPromises.push(
				createNotification(
					ctx.env.DB,
					recipientId,
					'Sorteio realizado',
					'Veja só quem você tirou clicando aqui',
					ctx.groupId
				)
			);

			const contact = participantContacts.get(giverId);
			if (contact?.email) {
				const displayName =
					contact.nome?.trim() ||
					(contact.email.includes('@') ? contact.email.split('@')[0] ?? null : null);
				emailPromises.push(
					sendDrawCompletedEmail(ctx.env, {
						to: contact.email,
						groupTitle,
						groupUrl,
						revealDate: revealDateValue,
						participantName: displayName
					})
				);
			}
			if (contact?.telefone) {
				const displayName =
					contact.nome?.trim() ||
					(contact.email.includes('@') ? contact.email.split('@')[0] ?? null : null);
				whatsappPromises.push(
					sendDrawCompletedWhatsApp(ctx.env, {
						to: contact.telefone,
						groupTitle,
						groupUrl,
						recipientName: displayName,
						revealDate: revealDateValue,
						revealLocation: revealLocationValue
					})
				);
			}
		}

		await Promise.all([...notificationPromises, ...emailPromises, ...whatsappPromises]);

		const redirectTarget = redirectPath(ctx);
		if (htmx) return { type: 'response', response: hxRedirect(redirectTarget) };
		if (ajax) return { type: 'response', response: respondJson({ ok: true, redirectUrl: redirectTarget }) };
		return { type: 'redirect', target: redirectTarget };
	} catch (error) {
		console.error('Erro ao realizar o sorteio do grupo:', error);
		state.drawError = 'Não foi possível realizar o sorteio agora.';
		if (htmx) {
			return {
				type: 'response',
				response: respondText(state.drawError ?? 'Não foi possível realizar o sorteio agora.', 500)
			};
		}
		if (ajax) {
			return {
				type: 'response',
				response: respondJson(
					{ ok: false, error: state.drawError ?? 'Não foi possível realizar o sorteio agora.' },
					500
				)
			};
		}
		return { type: 'continue', state };
	}
}

async function handleResendInvite(
	ctx: GroupActionContext,
	formData: FormData
): Promise<GroupActionResult> {
	if (!ctx.canEdit) {
		return { type: 'response', response: respondText('Apenas o organizador pode reenviar convites.', 403) };
	}

	const inviteIdRaw = formData.get('invite_id');
	const inviteId =
		typeof inviteIdRaw === 'string'
			? inviteIdRaw.trim()
			: inviteIdRaw
				? inviteIdRaw.toString().trim()
				: '';
	if (!inviteId) {
		return { type: 'response', response: respondText('Convite inválido.', 400) };
	}

	try {
		const inviteRow = await findInviteById(ctx.env.DB, inviteId, ctx.groupId);
		if (!inviteRow) {
			return { type: 'response', response: respondText('Convite não encontrado.', 404) };
		}

		const inviteEmail = inviteRow.email?.trim() || null;
		const invitePhone = inviteRow.telefone?.trim() || null;
		const inviteToken = inviteRow.token;
		const groupTitle = ctx.grupoRow.titulo;
		const inviteLink = new URL(`/convite?token=${encodeURIComponent(inviteToken)}`, ctx.url).toString();

		if (!inviteEmail && !invitePhone) {
			return {
				type: 'response',
				response: respondText('Este convite não possui e-mail ou telefone configurado.', 400)
			};
		}

		let inviteSent = false;

		if (inviteEmail) {
			await sendInviteEmail(ctx.env, {
				to: inviteEmail,
				groupTitle,
				inviteLink,
				inviterName: null,
				groupOwner: ctx.viewerDisplayName
			});
			inviteSent = true;
		}

		if (invitePhone) {
			const whatsappSent = await sendInviteWhatsApp(ctx.env, {
				to: invitePhone,
				groupTitle,
				inviteLink,
				groupOwner: ctx.viewerDisplayName
			});
			inviteSent = inviteSent || whatsappSent;
		}

		if (!inviteSent) {
			return {
				type: 'response',
				response: respondText(
					'Não foi possível reenviar o convite. Verifique as configurações de e-mail e WhatsApp.',
					502
				)
			};
		}

		await updateInviteSentAt(ctx.env.DB, inviteId);

		const redirectTarget = redirectPath(ctx);
		if (isHtmxRequest(ctx.request)) {
			return { type: 'response', response: hxRedirect(redirectTarget) };
		}
		return { type: 'redirect', target: redirectTarget };
	} catch (error) {
		console.error('Erro ao reenviar convite:', error);
		return { type: 'response', response: respondText('Não foi possível reenviar o convite agora.', 500) };
	}
}

async function handleDeleteInvite(
	ctx: GroupActionContext,
	formData: FormData
): Promise<GroupActionResult> {
	if (!ctx.canEdit) {
		return { type: 'response', response: respondText('Apenas o organizador pode apagar convites.', 403) };
	}

	const inviteIdRaw = formData.get('invite_id');
	const inviteId =
		typeof inviteIdRaw === 'string'
			? inviteIdRaw.trim()
			: inviteIdRaw
				? inviteIdRaw.toString().trim()
				: '';
	if (!inviteId) {
		return { type: 'response', response: respondText('Convite inválido.', 400) };
	}

	try {
		await deleteInvite(ctx.env.DB, inviteId, ctx.groupId);

		const redirectTarget = redirectPath(ctx);
		if (isHtmxRequest(ctx.request)) {
			return { type: 'response', response: hxRedirect(redirectTarget) };
		}
		return { type: 'redirect', target: redirectTarget };
	} catch (error) {
		console.error('Erro ao apagar convite:', error);
		return { type: 'response', response: respondText('Não foi possível apagar o convite agora.', 500) };
	}
}

async function handleDeactivateGroup(ctx: GroupActionContext): Promise<GroupActionResult> {
	if (!ctx.canEdit) {
		return { type: 'response', response: respondText('Apenas o organizador pode apagar o grupo.', 403) };
	}

	try {
		await deactivateGroup(ctx.env.DB, ctx.groupId);

		const redirectTarget = '/app/grupos';
		if (isHtmxRequest(ctx.request)) {
			return { type: 'response', response: hxRedirect(redirectTarget) };
		}
		return { type: 'redirect', target: redirectTarget };
	} catch (error) {
		console.error('Erro ao apagar grupo:', error);
		return { type: 'response', response: respondText('Não foi possível apagar o grupo agora.', 500) };
	}
}

export async function handleGroupPost(
	ctx: GroupActionContext,
	formData: FormData
): Promise<GroupActionResult> {
	const intent = formData.get('intent')?.toString() ?? 'message';
	const state = emptyState();

	switch (intent) {
		case 'message':
			return handleMessage(ctx, formData, state);
		case 'secret-message':
			return handleSecretMessage(ctx, formData, state);
		case 'draw':
			return handleDraw(ctx, state);
		case 'resend-invite':
			return handleResendInvite(ctx, formData);
		case 'delete-invite':
			return handleDeleteInvite(ctx, formData);
		case 'deactivate-group':
			return handleDeactivateGroup(ctx);
		default:
			return { type: 'continue', state };
	}
}
