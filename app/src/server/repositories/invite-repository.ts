export const countAcceptedInvites = async (db: D1Database, groupId: string) => {
	const row = await db
		.prepare(
			`SELECT COUNT(*) AS total
			 FROM convite
			 WHERE grupo_id = ?
			   AND status = 'aceito'`
		)
		.bind(groupId)
		.first();
	return Number(row?.total ?? 0);
};

export const findPendingInvites = async (db: D1Database, groupId: string) => {
	const result = await db
		.prepare(
			`SELECT id, email, telefone, status
			 FROM convite
			 WHERE grupo_id = ?
			   AND status = 'pendente'`
		)
		.bind(groupId)
		.all();
	return (result?.results ?? []) as Array<{
		id: string;
		email?: string | null;
		telefone?: string | null;
		status?: string | null;
	}>;
};

export const findGroupInvitesTimeline = async (db: D1Database, groupId: string) => {
	const result = await db
		.prepare(
			`SELECT id, email, telefone, status, criado_em, enviado_em, aceito_em
			 FROM convite
			 WHERE grupo_id = ?
			 ORDER BY datetime(COALESCE(aceito_em, enviado_em, criado_em, '1970-01-01')) DESC`
		)
		.bind(groupId)
		.all();
	return (result?.results ?? []) as Array<{
		id: string;
		email?: string | null;
		telefone?: string | null;
		status?: string | null;
		criado_em?: string | null;
		enviado_em?: string | null;
		aceito_em?: string | null;
	}>;
};

export const findInviteById = async (db: D1Database, inviteId: string, groupId: string) =>
	db
		.prepare(
			`SELECT id, email, telefone, token, status
			 FROM convite
			 WHERE id = ?
			   AND grupo_id = ?
			 LIMIT 1`
		)
		.bind(inviteId, groupId)
		.first<{ id: string; email?: string | null; telefone?: string | null; token: string; status?: string }>();

export const updateInviteSentAt = async (db: D1Database, inviteId: string) =>
	db.prepare(`UPDATE convite SET enviado_em = ? WHERE id = ?`).bind(new Date().toISOString(), inviteId).run();

export const deleteInvite = async (db: D1Database, inviteId: string, groupId: string) =>
	db
		.prepare(`DELETE FROM convite WHERE id = ? AND grupo_id = ?`)
		.bind(inviteId, groupId)
		.run();

export const findInvitePhoneByEmail = async (db: D1Database, groupId: string, email: string) => {
	const inviteRecord = await db
		.prepare(
			`SELECT telefone
			 FROM convite
			 WHERE grupo_id = ?
			   AND lower(email) = lower(?)
			   AND telefone IS NOT NULL
			   AND trim(telefone) != ''
			 ORDER BY datetime(COALESCE(aceito_em, enviado_em, criado_em, '1970-01-01')) DESC
			 LIMIT 1`
		)
		.bind(groupId, email)
		.first();
	return (inviteRecord as { telefone?: string | null } | null)?.telefone?.trim() ?? null;
};

export const findInvitePhonesByGroup = async (db: D1Database, groupId: string) => {
	const result = await db
		.prepare(
			`SELECT lower(email) AS email_key, telefone
			 FROM convite
			 WHERE grupo_id = ?
			   AND email IS NOT NULL
			   AND telefone IS NOT NULL
			   AND trim(telefone) != ''
			 ORDER BY datetime(COALESCE(aceito_em, enviado_em, criado_em, '1970-01-01')) DESC`
		)
		.bind(groupId)
		.all();
	return result?.results ?? [];
};

export const findGroupInvitesForEdit = async (db: D1Database, groupId: string) => {
	const result = await db
		.prepare(`SELECT email, telefone FROM convite WHERE grupo_id = ? ORDER BY criado_em ASC`)
		.bind(groupId)
		.all();
	return result?.results ?? [];
};
