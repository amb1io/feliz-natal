import { computeInitials } from '../../../utils/message-renderer';
import { getEnv, getSessionUserId } from '../../../server/request-context';
import {
	findGroupBySlug,
	findViewer,
	isParticipant as checkIsParticipant
} from '../../../server/repositories/group-repository';
import { handleGroupPost } from '../../../server/group-actions';
import { loadGroupPageData } from '../../../server/group-page-data';
import { checkPendingInvitesNotification } from '../../../server/notifications';
import type { APIContext } from 'astro';

export async function loadSlugPageContext(context: APIContext) {
	const { Astro } = context;
	const env = getEnv();
	const userId = getSessionUserId(Astro.cookies);
	const slug = Astro.params.slug;

	if (!userId) {
		return { redirect: '/amigo-secreto/' as const };
	}

	if (!env?.DB || !slug) {
		return {
			notFound: new Response('<div>Grupo não encontrado.</div>', {
				status: 404,
				headers: { 'Content-Type': 'text/html; charset=utf-8' }
			})
		};
	}

	const grupoRow = await findGroupBySlug(env.DB, slug);

	if (!grupoRow) {
		return {
			notFound: new Response('<div>Grupo não encontrado.</div>', {
				status: 404,
				headers: { 'Content-Type': 'text/html; charset=utf-8' }
			})
		};
	}

	const groupStatusValue = grupoRow.status ?? 'indefinido';
	if (groupStatusValue !== 'ativo') {
		return { redirect: '/amigo-secreto/grupos' as const };
	}

	const organizerId = grupoRow.criado_por ?? null;
	const isOrganizer = organizerId === userId;
	let isParticipantUser = isOrganizer;

	if (!isParticipantUser) {
		isParticipantUser = await checkIsParticipant(env.DB, grupoRow.id, userId);
	}

	if (!isParticipantUser) {
		return { redirect: '/amigo-secreto/' as const };
	}

	const canEdit = isOrganizer;
	const groupId = grupoRow.id;

	const viewerRecord = await findViewer(env.DB, userId);
	const viewerDisplayName = viewerRecord?.nome ?? viewerRecord?.email ?? 'Participante';
	const viewerInitials = computeInitials(viewerDisplayName);

	let submissionError: string | null = null;
	let draftMessage = '';
	let drawError: string | null = null;
	let secretMessageError: string | null = null;
	let secretDraft = '';

	if (Astro.request.method === 'POST') {
		const formData = await Astro.request.formData();
		const result = await handleGroupPost(
			{
				env,
				request: Astro.request,
				url: Astro.url,
				userId,
				groupId,
				grupoRow,
				canEdit,
				viewerDisplayName
			},
			formData
		);

		if (result.type === 'response') {
			return { response: result.response };
		}
		if (result.type === 'redirect') {
			return { redirect: result.target };
		}

		submissionError = result.state.submissionError;
		draftMessage = result.state.draftMessage;
		drawError = result.state.drawError;
		secretMessageError = result.state.secretMessageError;
		secretDraft = result.state.secretDraft;
	}

	const pageData = await loadGroupPageData(
		env,
		grupoRow,
		userId,
		organizerId,
		canEdit,
		isOrganizer,
		Astro.url
	);

	const initialSecretModalOpen = Boolean(
		secretMessageError || pageData.shouldAutoOpenSecretModal
	);

	if (isOrganizer) {
		await checkPendingInvitesNotification(env, organizerId, groupId);
	}

	return {
		env,
		userId,
		slug,
		grupoRow,
		canEdit,
		isOrganizer,
		groupId,
		viewerDisplayName,
		viewerInitials,
		submissionError,
		draftMessage,
		drawError,
		secretMessageError,
		secretDraft,
		initialSecretModalOpen,
		...pageData
	};
}
