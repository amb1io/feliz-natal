import type { GrupoRow } from '../types';

export const findGroupBySlug = async (db: D1Database, slug: string) =>
	db
		.prepare(
			`SELECT
				g.id,
				g.slug,
				g.titulo,
				g.descricao,
				g.data_sorteio,
				g.data_revelacao,
				g.status,
				g.criado_em,
				g.criado_por,
				gm.tipo_presente,
				gm.orcamento_minimo,
				gm.orcamento_maximo,
				gm.orcamento_sem_limites,
				gm.localizacao,
				gm.localizacao_nome,
				gm.localizacao_lat,
				gm.localizacao_lng
			 FROM grupo g
			 LEFT JOIN grupo_metadata gm ON gm.grupo_id = g.id
			 WHERE g.slug = ?
			 LIMIT 1`
		)
		.bind(slug)
		.first<GrupoRow>();

export const findGroupForEdit = async (db: D1Database, slug: string, sessionId: string) =>
	db
		.prepare(
			`SELECT
				g.id,
				g.slug,
				g.titulo,
				g.descricao,
				g.data_sorteio,
				g.data_revelacao,
				g.status,
				gm.tipo_presente,
				gm.orcamento_minimo,
				gm.orcamento_maximo,
				gm.orcamento_sem_limites,
				gm.localizacao,
				gm.localizacao_nome,
				gm.localizacao_lat,
				gm.localizacao_lng
			 FROM grupo g
			 LEFT JOIN grupo_metadata gm ON gm.grupo_id = g.id
			 WHERE g.slug = ?
			   AND g.criado_por = ?
			 LIMIT 1`
		)
		.bind(slug, sessionId)
		.first<GrupoRow>();

export const isParticipant = async (db: D1Database, groupId: string, userId: string) => {
	const participation = await db
		.prepare('SELECT 1 FROM grupo_participante WHERE grupo_id = ? AND usuario_id = ? LIMIT 1')
		.bind(groupId, userId)
		.first();
	return Boolean(participation);
};

export const deactivateGroup = async (db: D1Database, groupId: string) =>
	db.prepare(`UPDATE grupo SET status = ? WHERE id = ?`).bind('inativo', groupId).run();

export const findViewer = async (db: D1Database, userId: string) =>
	db
		.prepare(`SELECT nome, email FROM usuario WHERE id = ? LIMIT 1`)
		.bind(userId)
		.first<{ nome?: string | null; email?: string | null }>();

export const findGroupTags = async (db: D1Database, groupId: string) => {
	const tagsResult = await db
		.prepare(`SELECT tag FROM grupo_tag WHERE grupo_id = ? ORDER BY tag ASC`)
		.bind(groupId)
		.all();
	return tagsResult?.results?.map((row) => (row as { tag: string }).tag) ?? [];
};
