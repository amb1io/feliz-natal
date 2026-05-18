export const insertGroupMessage = async (
	db: D1Database,
	groupId: string,
	userId: string,
	body: string
) => {
	const messageId = crypto.randomUUID();
	await db
		.prepare(
			`INSERT INTO mensagem (id, grupo_id, remetente_id, body)
			 VALUES (?, ?, ?, ?)`
		)
		.bind(messageId, groupId, userId, body)
		.run();
	return messageId;
};

export const insertSecretMessage = async (
	db: D1Database,
	groupId: string,
	userId: string,
	recipientId: string,
	body: string
) => {
	const messageId = crypto.randomUUID();
	await db
		.prepare(
			`INSERT INTO mensagem (id, grupo_id, remetente_id, recipiente_id, body, is_secret)
			 VALUES (?, ?, ?, ?, ?, 1)`
		)
		.bind(messageId, groupId, userId, recipientId, body)
		.run();
	return messageId;
};

export const findGroupMessages = async (db: D1Database, groupId: string) => {
	const result = await db
		.prepare(
			`SELECT m.id, m.body, m.remetente_id, u.nome, u.email
			 FROM mensagem m
			 LEFT JOIN usuario u ON u.id = m.remetente_id
			 WHERE m.grupo_id = ?
			   AND m.is_secret = 0
			 ORDER BY datetime(m.criado_em) ASC
			 LIMIT 200`
		)
		.bind(groupId)
		.all();
	return result?.results ?? [];
};

export const findSecretMessages = async (
	db: D1Database,
	groupId: string,
	userId: string,
	secretRecipientId: string
) => {
	const result = await db
		.prepare(
			`SELECT m.id, m.body, m.remetente_id, m.recipiente_id, u.nome, u.email
			 FROM mensagem m
			 LEFT JOIN usuario u ON u.id = m.remetente_id
			 WHERE m.grupo_id = ?
			   AND m.is_secret = 1
			   AND (
			     (m.remetente_id = ? AND m.recipiente_id = ?)
			     OR (m.remetente_id = ? AND m.recipiente_id = ?)
			   )
			 ORDER BY datetime(m.criado_em) ASC
			 LIMIT 200`
		)
		.bind(groupId, userId, secretRecipientId, secretRecipientId, userId)
		.all();
	return result?.results ?? [];
};

export const findUserContact = async (db: D1Database, userId: string) =>
	db
		.prepare(`SELECT nome, email FROM usuario WHERE id = ? LIMIT 1`)
		.bind(userId)
		.first<{ nome?: string | null; email?: string | null }>();
