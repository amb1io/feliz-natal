import type { FelizNatalEnv } from './types';

export const createNotification = async (
	db: D1Database,
	targetUserId: string | null,
	title: string,
	body: string,
	groupTargetId: string | null = null,
	messageId: string | null = null
) => {
	if (!targetUserId) return;
	try {
		await db
			.prepare(
				`INSERT INTO notificacao (id, usuario_id, grupo_id, mensagem_id, title, body, lido, created_at)
				 VALUES (?, ?, ?, ?, ?, ?, 0, ?)`
			)
			.bind(
				crypto.randomUUID(),
				targetUserId,
				groupTargetId,
				messageId,
				title,
				body,
				new Date().toISOString()
			)
			.run();
	} catch (error) {
		console.error('Erro ao criar notificação:', error);
	}
};

export const ensureNotification = async (
	db: D1Database,
	targetUserId: string | null,
	title: string,
	body: string,
	groupTargetId: string | null = null
) => {
	if (!targetUserId) return;
	try {
		const existing = await db
			.prepare(
				`SELECT id
				 FROM notificacao
				 WHERE usuario_id = ?
				   AND COALESCE(grupo_id, '') = COALESCE(?, '')
				   AND title = ?
				   AND body = ?
				   AND lido = 0
				   AND datetime(created_at) >= datetime(?, '-1 day')
				 LIMIT 1`
			)
			.bind(targetUserId, groupTargetId, title, body, new Date().toISOString())
			.first();

		if (!existing) {
			await createNotification(db, targetUserId, title, body, groupTargetId);
		}
	} catch (error) {
		console.error('Erro ao garantir notificação:', error);
	}
};

export const checkPendingInvitesNotification = async (
	env: FelizNatalEnv,
	organizerId: string | null,
	groupId: string
) => {
	if (!organizerId) return;
	try {
		const pendingInviteRow = await env.DB.prepare(
			`SELECT COUNT(*) AS total
			 FROM convite
			 WHERE grupo_id = ?
			   AND (status IS NULL OR status != 'aceito')
			   AND enviado_em IS NOT NULL
			   AND datetime(enviado_em) <= datetime(?, '-24 hours')`
		)
			.bind(groupId, new Date().toISOString())
			.first();

		const pendingCount = Number(pendingInviteRow?.total ?? 0);
		if (pendingCount > 0) {
			await ensureNotification(
				env.DB,
				organizerId,
				'Convites não aceitos',
				`${pendingCount} convites ainda não foram aceitos. Veja mais`,
				groupId
			);
		}
	} catch (error) {
		console.error('Erro ao verificar convites pendentes:', error);
	}
};
