import { derange } from '../../utils/random';

export const findActiveParticipantIds = async (db: D1Database, groupId: string) => {
	const result = await db
		.prepare(
			`SELECT usuario_id
			 FROM grupo_participante
			 WHERE grupo_id = ?
			   AND is_ativo = 1`
		)
		.bind(groupId)
		.all();

	const participantIdsRaw = (result?.results ?? [])
		.map((row) => (row as { usuario_id: string }).usuario_id)
		.filter(Boolean);
	return Array.from(new Set(participantIdsRaw));
};

export const findLatestDraw = async (db: D1Database, groupId: string) =>
	db
		.prepare(
			`SELECT id, sorteado_em
			 FROM sorteio
			 WHERE grupo_id = ?
			   AND status = ?
			 ORDER BY datetime(COALESCE(sorteado_em, '1970-01-01')) DESC
			 LIMIT 1`
		)
		.bind(groupId, 'concluido')
		.first<{ id?: string; sorteado_em?: string | null }>();

export const findDrawRecipient = async (db: D1Database, drawId: string, userId: string) =>
	db
		.prepare(
			`SELECT sr.recipiente_id AS id, COALESCE(u.nome, u.email, 'Participante') AS nome
			 FROM sorteio_resultado sr
			 LEFT JOIN usuario u ON u.id = sr.recipiente_id
			 WHERE sr.sorteio_id = ?
			   AND sr.remetente_id = ?
			 LIMIT 1`
		)
		.bind(drawId, userId)
		.first<{ id?: string; nome?: string }>();

export const findDrawGiver = async (db: D1Database, drawId: string, userId: string) =>
	db
		.prepare(
			`SELECT sr.remetente_id AS id, COALESCE(u.nome, u.email, 'Participante') AS nome
			 FROM sorteio_resultado sr
			 LEFT JOIN usuario u ON u.id = sr.remetente_id
			 WHERE sr.sorteio_id = ?
			   AND sr.recipiente_id = ?
			 LIMIT 1`
		)
		.bind(drawId, userId)
		.first<{ id?: string; nome?: string }>();

export const findParticipantContacts = async (db: D1Database, participantIds: string[]) => {
	const contacts = new Map<string, { email: string; nome?: string | null; telefone?: string | null }>();
	if (!participantIds.length) return contacts;

	const placeholders = participantIds.map(() => '?').join(', ');
	const contactsResult = await db
		.prepare(`SELECT id, email, nome FROM usuario WHERE id IN (${placeholders})`)
		.bind(...participantIds)
		.all();

	for (const row of contactsResult?.results ?? []) {
		const record = row as { id: string; email?: string | null; nome?: string | null };
		if (record?.id && record.email) {
			contacts.set(record.id, { email: record.email, nome: record.nome });
		}
	}
	return contacts;
};

export const performDraw = async (
	db: D1Database,
	groupId: string,
	participantIds: string[]
) => {
	const recipients = derange(participantIds);
	if (!recipients) return null;

	const sorteioId = crypto.randomUUID();
	const sorteadoEm = new Date().toISOString();

	await db
		.prepare(`INSERT INTO sorteio (id, grupo_id, sorteado_em, status) VALUES (?, ?, ?, ?)`)
		.bind(sorteioId, groupId, sorteadoEm, 'concluido')
		.run();

	const insertResultado = db.prepare(
		`INSERT INTO sorteio_resultado (sorteio_id, remetente_id, recipiente_id) VALUES (?, ?, ?)`
	);

	for (let index = 0; index < participantIds.length; index += 1) {
		await insertResultado.bind(sorteioId, participantIds[index], recipients[index]).run();
	}

	return { sorteioId, recipients, sorteadoEm };
};
