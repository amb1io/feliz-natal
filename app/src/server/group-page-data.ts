import { computeInitials, renderMessageList } from '../utils/message-renderer';
import { formatDateValue, toDateValue } from '../utils/date';
import { buildBudgetDescription, buildDisplayLocation } from '../utils/group-display';
import { countAcceptedInvites, findPendingInvites } from './repositories/invite-repository';
import { findGroupMessages, findSecretMessages } from './repositories/message-repository';
import {
	findLatestDraw,
	findDrawRecipient,
	findDrawGiver
} from './repositories/draw-repository';
import { findGroupParticipants } from './repositories/participant-repository';
import type { FelizNatalEnv, GrupoRow } from './types';

export type GroupPageData = {
	group: {
		id: string;
		slug: string;
		title: string;
		description: string;
		drawDate: string;
		revealDate: string;
		participants: number;
		budget: string;
		location: string;
		locationName: string | null;
		locationAddress: string | null;
		locationLat: number | null;
		locationLng: number | null;
		status: string;
		details: {
			keyFacts: Array<{ label: string; value: string }>;
			highlights: string[];
			nextActions: Array<{ title: string; due: string; description: string }>;
		};
		participantsList: string[];
	};
	participantEntries: Array<{
		id: string;
		name: string;
		initials: string;
		isConfirmed: boolean;
		statusLabel: string;
		inviteTag: string | null;
		isPendingInvite: boolean;
		modalPayload: Record<string, unknown>;
	}>;
	timelineUpdates: Array<{ avatar: string; message: string }>;
	acceptedInviteCount: number;
	hasDraw: boolean;
	recipientInitials: string;
	recipientDisplay: string;
	drawerInitials: string;
	drawerDisplay: string;
	yourRecipientId: string | null;
	secretRecipientId: string | null;
	secretMessagingAvailable: boolean;
	secretRecipientIdValue: string;
	shouldAutoOpenSecretModal: boolean;
	initialSecretModalOpen: boolean;
	messageHistory: Array<{ id: string; body: string; authorId: string; initials: string }>;
	secretMessageHistory: Array<{ id: string; body: string; authorId: string; initials: string }>;
	secretMessagesHtml: string;
	chatEndpoint: string | null;
	chatEnabled: boolean;
	isGroupActive: boolean;
};

export async function loadGroupPageData(
	env: FelizNatalEnv,
	grupoRow: GrupoRow,
	userId: string,
	organizerId: string | null,
	canEdit: boolean,
	isOrganizer: boolean,
	url: URL
): Promise<GroupPageData> {
	const groupId = grupoRow.id;
	const groupStatus = grupoRow.status ?? 'indefinido';
	const isGroupActive = groupStatus === 'ativo';

	const participantRecords = await findGroupParticipants(env.DB, groupId);
	const participantsList = participantRecords.map((record) => record.nome);
	const pendingInviteRecords = await findPendingInvites(env.DB, groupId);
	const acceptedInviteCount = await countAcceptedInvites(env.DB, groupId);

	const rawDrawDateValue = grupoRow.data_sorteio ?? null;
	const rawRevealDateValue = grupoRow.data_revelacao ?? null;
	const drawDate = formatDateValue(rawDrawDateValue);
	const revealDate = formatDateValue(rawRevealDateValue);
	const drawDateTimestamp = toDateValue(rawDrawDateValue);
	const revealDateTimestamp = toDateValue(rawRevealDateValue);
	const budgetDescription = buildBudgetDescription(grupoRow);
	const participantCount = participantsList.length;
	const displayLocation = buildDisplayLocation(grupoRow);
	const giftTheme = grupoRow.tipo_presente ?? null;
	const locationName = grupoRow.localizacao_nome ?? null;
	const locationAddress = grupoRow.localizacao ?? null;

	const keyFacts = [
		{ label: 'Sorteio', value: drawDate ?? 'Data não definida' },
		{ label: 'Revelação', value: revealDate ?? 'Data não definida' },
		{ label: 'Orçamento', value: budgetDescription }
	];

	const highlights = [
		`Status atual: ${groupStatus}`,
		giftTheme ? `Tema do presente: ${giftTheme}` : 'Nenhum tema definido para os presentes.',
		participantCount
			? `${participantCount} participante(s) adicionados.`
			: 'Ainda não há participantes cadastrados.'
	];

	if (displayLocation) {
		highlights.push(`Encontro planejado em ${displayLocation}.`);
	}

	const organizerActions = [
		{
			title: 'Gerenciar participantes',
			due: 'Enquanto houver convites',
			description: 'Convide e confirme participantes diretamente pelo painel.'
		},
		{
			title: 'Preparar sorteio',
			due: drawDate ? `Antes de ${drawDate}` : 'Defina uma data de sorteio',
			description: 'Garanta que todos os participantes estejam confirmados antes do sorteio.'
		},
		{
			title: 'Atualizar orçamento',
			due: 'Conforme necessário',
			description: 'Mantenha o orçamento alinhado com a expectativa do grupo.'
		}
	];

	const participantActions = [
		{
			title: 'Confirmar participação',
			due: drawDate ? `Antes de ${drawDate}` : 'Assim que possível',
			description: 'Mantenha seu cadastro atualizado para que o sorteio ocorra sem imprevistos.'
		},
		{
			title: 'Planejar presente',
			due: drawDate ? `Até ${drawDate}` : 'Após o sorteio',
			description: 'Escolha o presente ideal alinhado ao orçamento definido pelo grupo.'
		},
		{
			title: 'Acompanhar novidades',
			due: 'Periodicamente',
			description: 'Verifique as mensagens do organizador para não perder nenhuma atualização.'
		}
	];

	const nextActions = canEdit ? organizerActions : participantActions;

	const organizerParticipantRecord = organizerId
		? participantRecords.find((participant) => participant.usuario_id === organizerId) ?? null
		: null;

	const orderedParticipantRecords = [
		...(organizerParticipantRecord ? [organizerParticipantRecord] : []),
		...participantRecords.filter((participant) => participant.usuario_id !== organizerId)
	];

	const pendingInviteByEmail = new Map<string, (typeof pendingInviteRecords)[number]>();
	for (const invite of pendingInviteRecords) {
		const emailLower = invite.email?.trim().toLowerCase();
		if (emailLower && !pendingInviteByEmail.has(emailLower)) {
			pendingInviteByEmail.set(emailLower, invite);
		}
	}

	const participantEmails = new Set(
		participantRecords
			.map((participant) => participant.email?.trim().toLowerCase())
			.filter((email): email is string => Boolean(email))
	);

	const standalonePendingInvites = pendingInviteRecords.filter((invite) => {
		const emailLower = invite.email?.trim().toLowerCase();
		return !(emailLower && participantEmails.has(emailLower));
	});

	const participantEntries = [
		...orderedParticipantRecords.map((participant) => {
			const displayName = participant.nome;
			const initials = computeInitials(displayName) || displayName.slice(0, 2).toUpperCase();
			const isRecordOrganizer = organizerId ? participant.usuario_id === organizerId : false;
			const isConfirmed = Boolean(
				typeof participant.is_confirmado === 'number'
					? participant.is_confirmado
					: participant.is_confirmado
			);
			const statusLabel = isRecordOrganizer
				? 'Organizador'
				: isConfirmed
					? 'Convidado'
					: 'Convite pendente';
			const participantEmailLower = participant.email?.trim().toLowerCase() ?? null;
			const linkedInvite =
				!isRecordOrganizer && !isConfirmed && participantEmailLower
					? (pendingInviteByEmail.get(participantEmailLower) ?? null)
					: null;
			const linkedContact =
				linkedInvite?.email ?? linkedInvite?.telefone ?? participant.email ?? null;
			return {
				id: participant.usuario_id,
				name: displayName,
				initials,
				isConfirmed,
				statusLabel,
				inviteTag: isRecordOrganizer || isConfirmed ? null : 'Convite pendente',
				isPendingInvite: false,
				modalPayload: {
					userId: participant.usuario_id,
					name: displayName,
					initials,
					status: statusLabel,
					inviteId: linkedInvite?.id ?? null,
					contact: linkedContact,
					isConfirmed
				}
			};
		}),
		...standalonePendingInvites.map((invite) => {
			const contact = invite.email ?? invite.telefone ?? 'Contato não informado';
			return {
				id: invite.id,
				name: 'Convite Pendente',
				initials: 'C',
				isConfirmed: false,
				statusLabel: contact,
				inviteTag: 'Convite pendente',
				isPendingInvite: true,
				modalPayload: {
					userId: null,
					name: 'Convite Pendente',
					initials: 'C',
					status: 'Convite pendente',
					inviteId: invite.id,
					contact,
					isConfirmed: false
				}
			};
		})
	];

	const latestDrawRow = await findLatestDraw(env.DB, groupId);
	const latestDrawId = latestDrawRow?.id ?? null;
	const latestDrawDateDisplay = latestDrawRow?.sorteado_em
		? formatDateValue(latestDrawRow.sorteado_em)
		: null;
	const latestDrawTimestamp = toDateValue(latestDrawRow?.sorteado_em ?? null);

	let yourRecipientName: string | null = null;
	let yourDrawerName: string | null = null;
	let yourRecipientId: string | null = null;
	let yourDrawerId: string | null = null;

	if (latestDrawId) {
		const recipientRow = await findDrawRecipient(env.DB, latestDrawId, userId);
		if (recipientRow?.nome) yourRecipientName = recipientRow.nome;
		if (recipientRow?.id) yourRecipientId = recipientRow.id;

		const drawerRow = await findDrawGiver(env.DB, latestDrawId, userId);
		if (drawerRow?.nome) yourDrawerName = drawerRow.nome;
		if (drawerRow?.id) yourDrawerId = drawerRow.id;
	}

	const hasDraw = Boolean(latestDrawId);
	const recipientInitials = hasDraw && yourRecipientName ? computeInitials(yourRecipientName) : '??';
	const recipientDisplay =
		hasDraw && yourRecipientName ? yourRecipientName : 'Realize o sorteio para descobrir.';
	const drawerInitials = !isGroupActive && yourDrawerName ? computeInitials(yourDrawerName) : '??';
	const drawerDisplay = !isGroupActive && yourDrawerName ? yourDrawerName : '???';

	let latestParticipantName: string | null = null;
	let latestParticipantDate: Date | null = null;
	for (let index = participantRecords.length - 1; index >= 0; index -= 1) {
		const record = participantRecords[index];
		if (record.usuario_id !== userId) {
			latestParticipantName = record.nome;
			latestParticipantDate = toDateValue(record.criado_em ?? null);
			break;
		}
	}

	const timelineEventsRaw: Array<{ icon: string; message: string; date: Date | null; order: number }> = [
		{
			icon: '📍',
			message: displayLocation ? `Encontro planejado em ${displayLocation}.` : 'Encontro ainda sem local definido.',
			date: null,
			order: 0
		},
		{
			icon: '🧑‍🤝‍🧑',
			message: participantCount
				? `${participantCount} participante(s) adicionados.`
				: 'Nenhum participante adicionado ainda.',
			date: latestParticipantDate,
			order: 1
		},
		{
			icon: '🗓️',
			message: latestDrawDateDisplay
				? `Sorteio realizado em ${latestDrawDateDisplay}.`
				: 'Sorteio ainda não realizado.',
			date: latestDrawTimestamp,
			order: 2
		},
		{
			icon: '✅',
			message: latestParticipantName
				? `O participante ${latestParticipantName} aceitou o convite.`
				: 'Nenhum participante confirmou presença ainda.',
			date: latestParticipantDate,
			order: 3
		},
		{
			icon: '🎁',
			message: giftTheme ? `Tema do presente: ${giftTheme}.` : 'Tema do presente ainda não definido.',
			date: null,
			order: 4
		},
		{
			icon: '📅',
			message: drawDate ? `Sorteio previsto para ${drawDate}.` : 'Sorteio ainda sem data definida.',
			date: drawDateTimestamp,
			order: 5
		},
		{
			icon: '🎉',
			message: revealDate ? `Revelação prevista para ${revealDate}.` : 'Revelação ainda sem data definida.',
			date: revealDateTimestamp,
			order: 6
		}
	];

	const timelineUpdates = timelineEventsRaw
		.sort((a, b) => {
			if (a.date && b.date) return b.date.getTime() - a.date.getTime();
			if (a.date && !b.date) return -1;
			if (!a.date && b.date) return 1;
			return a.order - b.order;
		})
		.map(({ icon, message }) => ({ avatar: icon, message }));

	const group = {
		id: groupId,
		slug: grupoRow.slug,
		title: grupoRow.titulo,
		description: grupoRow.descricao ?? 'Nenhuma descrição adicionada ainda.',
		drawDate: drawDate ?? 'Data não definida',
		revealDate: revealDate ?? 'Data não definida',
		participants: participantCount,
		budget: budgetDescription,
		location: locationName ?? locationAddress ?? 'Local não definido',
		locationName,
		locationAddress,
		locationLat: grupoRow.localizacao_lat ?? null,
		locationLng: grupoRow.localizacao_lng ?? null,
		status: groupStatus,
		details: { keyFacts, highlights, nextActions },
		participantsList
	};

	const messagesResult = await findGroupMessages(env.DB, groupId);
	const messageHistory = messagesResult.map((row) => {
		const record = row as {
			id: string;
			body: string;
			remetente_id: string;
			nome?: string | null;
			email?: string | null;
		};
		const displayName = record.nome ?? record.email ?? 'Participante';
		return {
			id: record.id,
			body: record.body,
			authorId: record.remetente_id,
			initials: computeInitials(displayName)
		};
	});

	const secretRecipientId = hasDraw ? yourDrawerId : null;
	const secretMessagingAvailable = Boolean(secretRecipientId);
	const secretModalForcedOpen =
		secretMessagingAvailable && (url.searchParams.get('openSecret') ?? '').toLowerCase() === '1';

	const websocketWorkerBase =
		typeof env.WEBSOCKET_WORKER_URL === 'string' ? env.WEBSOCKET_WORKER_URL.trim() : '';
	const chatEndpoint =
		websocketWorkerBase && grupoRow.slug
			? `${websocketWorkerBase.replace(/\/$/, '')}/${grupoRow.slug}`
			: null;
	const chatEnabled = Boolean(chatEndpoint);

	let secretMessageHistory =
		secretMessagingAvailable && secretRecipientId
			? await findSecretMessages(env.DB, groupId, userId, secretRecipientId)
			: [];

	secretMessageHistory = secretMessageHistory.map((row) => {
		const record = row as {
			id: string;
			body: string;
			remetente_id: string;
			nome?: string | null;
			email?: string | null;
		};
		const isSelf = record.remetente_id === userId;
		return {
			id: record.id,
			body: record.body,
			authorId: record.remetente_id,
			initials: isSelf ? 'EU' : '??'
		};
	});

	const secretMessagesHtml = renderMessageList(secretMessageHistory, userId);
	const secretRecipientIdValue = secretRecipientId ?? '';

	return {
		group,
		participantEntries,
		timelineUpdates,
		acceptedInviteCount,
		hasDraw,
		recipientInitials,
		recipientDisplay,
		drawerInitials,
		drawerDisplay,
		yourRecipientId,
		secretRecipientId,
		secretMessagingAvailable,
		secretRecipientIdValue,
		shouldAutoOpenSecretModal: Boolean(secretModalForcedOpen),
		messageHistory,
		secretMessageHistory,
		secretMessagesHtml,
		chatEndpoint,
		chatEnabled,
		isGroupActive
	};
}
