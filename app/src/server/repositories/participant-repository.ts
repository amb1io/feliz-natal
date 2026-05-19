export const findGroupParticipants = async (db: D1Database, groupId: string) => {
	const result = await db
		.prepare(
			`SELECT gp.usuario_id, gp.criado_em, gp.is_confirmado, u.email, COALESCE(u.nome, u.email, 'Participante') AS nome
			 FROM grupo_participante gp
			 JOIN usuario u ON u.id = gp.usuario_id
			 WHERE gp.grupo_id = ?
			   AND gp.is_ativo = 1
			 ORDER BY gp.criado_em ASC`
		)
		.bind(groupId)
		.all();
	return (result?.results ?? []) as Array<{
		usuario_id: string;
		nome: string;
		email?: string | null;
		criado_em?: string | null;
		is_confirmado?: number | boolean | null;
	}>;
};

export const findGroupMembersForEdit = async (
	db: D1Database,
	groupId: string,
	excludeUserId: string
) => {
	const result = await db
		.prepare(
			`SELECT u.email
			 FROM grupo_participante gp
			 JOIN usuario u ON u.id = gp.usuario_id
			 WHERE gp.grupo_id = ?
			   AND gp.usuario_id != ?`
		)
		.bind(groupId, excludeUserId)
		.all();
	return result?.results ?? [];
};
