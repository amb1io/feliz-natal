import { formatDateForInput } from '../utils/date';
import { toNumberOrNull } from '../utils/numbers';
import { findGroupForEdit, findGroupTags } from './repositories/group-repository';
import { findGroupInvitesForEdit } from './repositories/invite-repository';
import { findGroupMembersForEdit } from './repositories/participant-repository';

export type ParticipantDraft = { email: string | null; phone: string | null };

export type GroupInitialData = {
	id: string;
	slug: string;
	name: string;
	description: string;
	drawDate: string;
	revealDate: string;
	giftType: string;
	priceMin: number;
	priceMax: number;
	noLimit: boolean;
	location: string;
	locationName: string | null;
	locationLat: number | null;
	locationLng: number | null;
	tags: string[];
	participants: ParticipantDraft[];
};

const appendParticipant = (
	map: Map<string, ParticipantDraft>,
	email?: string | null,
	phone?: string | null
) => {
	const sanitizedEmail = email?.toString().trim() || null;
	const sanitizedPhone = phone?.toString().trim() || null;
	if (!sanitizedEmail && !sanitizedPhone) return;
	const key = `${sanitizedEmail?.toLowerCase() ?? ''}|${sanitizedPhone ?? ''}`;
	if (!map.has(key)) {
		map.set(key, { email: sanitizedEmail, phone: sanitizedPhone });
	}
};

export async function loadGroupDraft(
	db: D1Database,
	editingSlug: string,
	sessionId: string
): Promise<GroupInitialData | null> {
	const groupRow = await findGroupForEdit(db, editingSlug, sessionId);
	if (!groupRow) return null;

	const groupId = groupRow.id;
	const tags = await findGroupTags(db, groupId);
	const convites = await findGroupInvitesForEdit(db, groupId);
	const membros = await findGroupMembersForEdit(db, groupId, sessionId);

	const participantMap = new Map<string, ParticipantDraft>();

	for (const row of convites) {
		const record = row as { email?: string | null; telefone?: string | null };
		appendParticipant(participantMap, record.email ?? null, record.telefone ?? null);
	}

	for (const row of membros) {
		const record = row as { email?: string | null };
		appendParticipant(participantMap, record.email ?? null, null);
	}

	const priceMinRaw = toNumberOrNull(groupRow.orcamento_minimo ?? null);
	const priceMaxRaw = toNumberOrNull(groupRow.orcamento_maximo ?? null);

	return {
		id: groupId,
		slug: groupRow.slug,
		name: groupRow.titulo,
		description: groupRow.descricao ?? '',
		drawDate: formatDateForInput(groupRow.data_sorteio ?? null),
		revealDate: formatDateForInput(groupRow.data_revelacao ?? null),
		giftType: groupRow.tipo_presente ?? '',
		priceMin: priceMinRaw ?? 50,
		priceMax: priceMaxRaw ?? 200,
		noLimit: Boolean(groupRow.orcamento_sem_limites ?? false),
		location: groupRow.localizacao ?? '',
		locationName: groupRow.localizacao_nome ?? null,
		locationLat: toNumberOrNull(groupRow.localizacao_lat ?? null),
		locationLng: toNumberOrNull(groupRow.localizacao_lng ?? null),
		tags,
		participants: Array.from(participantMap.values())
	};
}
