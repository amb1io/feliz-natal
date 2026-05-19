import { sendDrawCompletedEmail } from "./email";
import { sendDrawCompletedWhatsApp } from "./whatsapp";

type GroupRow = {
  id: string;
  slug: string;
  titulo: string;
  data_revelacao?: string | null;
};

type ParticipantContact = {
  id: string;
  email?: string | null;
  nome?: string | null;
  telefone?: string | null;
};

const DEFAULT_SITE_URL = "https://feliz.natal.br";

export default {
  async fetch() {
    return new Response("Feliz Natal schedule worker ativo.", {
      status: 200,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  },

  async scheduled(event: ScheduledController, env: Env, ctx: ExecutionContext) {
    const runDate = new Date(event.scheduledTime ?? Date.now());
    const targetDate = runDate.toISOString().slice(0, 10);

    const groups = await fetchGroupsForDate(env, targetDate);
    if (!groups.length) {
      console.log(`Nenhum grupo com sorteio agendado para ${targetDate}.`);
      return;
    }

    for (const group of groups) {
      ctx.waitUntil(
        runAutomaticDraw(env, group).catch((error) => {
          console.error(
            `Erro ao processar sorteio automático do grupo ${group.id}:`,
            error
          );
        })
      );
    }
  },
};

type Env = {
  DB: D1Database;
  SITE_URL?: string;
  SES_REGION?: string;
  AWS_REGION?: string;
  SES_FROM_EMAIL?: string;
  SES_FROM_NAME?: string;
  AWS_SES_ACCESS_KEY_ID?: string;
  AWS_SES_SECRET_ACCESS_KEY?: string;
  AWS_SESSION_TOKEN?: string;
  WHATSAPP_ACCESS_TOKEN?: string;
  META_WHATSAPP_ACCESS_TOKEN?: string;
  WHATSAPP_PHONE_NUMBER_ID?: string;
  META_WHATSAPP_PHONE_NUMBER_ID?: string;
  WHATSAPP_API_VERSION?: string;
  WHATSAPP_DRAW_TEMPLATE_NAME?: string;
  WHATSAPP_DRAW_TEMPLATE_LANG?: string;
  WHATSAPP_DRAW_TEMPLATE_COMPONENTS?: string;
  WHATSAPP_DRAW_INCLUDE_HEADER?: string;
  WHATSAPP_DRAW_INCLUDE_BUTTON?: string;
  WHATSAPP_SITE_BASE_URL?: string;
  WHATSAPP_HEADER_IMAGE_URL?: string;
  WHATSAPP_DEFAULT_COUNTRY_CODE?: string;
};

const fetchGroupsForDate = async (env: Env, isoDate: string) => {
  const statement = await env.DB.prepare(
    `SELECT id, slug, titulo, data_revelacao
     FROM grupo
     WHERE DATE(data_sorteio) = DATE(?1)
       AND status = 'ativo'`
  ).bind(isoDate);

  const result = await statement.all<GroupRow>();
  return (result.results ?? []) as GroupRow[];
};

const runAutomaticDraw = async (env: Env, group: GroupRow) => {
  const participants = await fetchActiveParticipants(env, group.id);
  if (participants.length < 2) {
    console.warn(
      `Grupo ${group.id} ignorado: participantes ativos insuficientes (${participants.length}).`
    );
    return;
  }

  const alreadyDrawn = await hasCompletedDraw(env, group.id);
  if (alreadyDrawn) {
    console.log(`Grupo ${group.slug} já possui sorteio concluído. Ignorando.`);
    return;
  }

  const assignments = buildAssignments(participants);
  if (!assignments) {
    console.error(`Não foi possível gerar pares válidos para o grupo ${group.id}.`);
    return;
  }

  const sorteioId = crypto.randomUUID();
  const sorteadoEm = new Date().toISOString();
  const groupUrl = buildGroupUrl(env, group.slug);

  await env.DB.prepare(
    `INSERT INTO sorteio (id, grupo_id, sorteado_em, status)
     VALUES (?1, ?2, ?3, 'concluido')`
  )
    .bind(sorteioId, group.id, sorteadoEm)
    .run();

  const contacts = await fetchParticipantContacts(env, participants);
  await mergeInvitePhonesIntoContacts(env, group.id, contacts);

  const insertResultado = env.DB.prepare(
    `INSERT INTO sorteio_resultado (sorteio_id, remetente_id, recipiente_id)
     VALUES (?1, ?2, ?3)`
  );

  const notificationPromises: Array<Promise<unknown>> = [];

  for (let index = 0; index < participants.length; index += 1) {
    const giverId = participants[index];
    const recipientId = assignments[index];

    await insertResultado.bind(sorteioId, giverId, recipientId).run();

    notificationPromises.push(
      createNotification(env, recipientId, group.id)
    );

    const contact = contacts.get(giverId);
    if (contact?.email) {
      await sendDrawCompletedEmail(env, {
        to: contact.email,
        groupTitle: group.titulo,
        groupUrl,
        revealDate: group.data_revelacao ?? null,
        participantName: contact.nome ?? null,
      });
      await wait(600); // throttle requests to avoid provider rate limits
    }

    if (contact?.telefone) {
      await sendDrawCompletedWhatsApp(env, {
        to: contact.telefone,
        groupTitle: group.titulo,
        groupUrl,
        recipientName: contact.nome ?? null,
        revealDate: group.data_revelacao ?? null,
      });
      await wait(400); // throttle requests to avoid provider rate limits
    }
  }

  await Promise.all(notificationPromises);

  console.log(`Sorteio automático concluído para o grupo ${group.slug}.`);
};

const fetchActiveParticipants = async (env: Env, groupId: string) => {
  const statement = await env.DB.prepare(
    `SELECT usuario_id
     FROM grupo_participante
     WHERE grupo_id = ?1
       AND is_ativo = 1`
  ).bind(groupId);

  const result = await statement.all<{ usuario_id: string }>();
  return (result.results ?? [])
    .map((row) => row.usuario_id)
    .filter(Boolean);
};

const fetchParticipantContacts = async (
  env: Env,
  participantIds: string[]
) => {
  const map = new Map<string, ParticipantContact>();
  if (!participantIds.length) return map;

  const placeholders = participantIds.map(() => "?").join(", ");
  const statement = await env.DB.prepare(
    `SELECT id, email, nome
     FROM usuario
     WHERE id IN (${placeholders})`
  ).bind(...participantIds);

  const result = await statement.all<ParticipantContact>();
  for (const record of result.results ?? []) {
    map.set(record.id, record);
  }

  return map;
};

const mergeInvitePhonesIntoContacts = async (
  env: Env,
  groupId: string,
  contacts: Map<string, ParticipantContact>
) => {
  const participantEmails = Array.from(
    new Set(
      Array.from(contacts.values())
        .map((contact) => contact.email?.trim().toLowerCase())
        .filter((value): value is string => Boolean(value))
    )
  );

  if (!participantEmails.length) return;

  const result = await env.DB.prepare(
    `SELECT lower(email) AS email_key, telefone
     FROM convite
     WHERE grupo_id = ?1
       AND email IS NOT NULL
       AND telefone IS NOT NULL
       AND trim(telefone) != ''
     ORDER BY datetime(COALESCE(aceito_em, enviado_em, criado_em, '1970-01-01')) DESC`
  )
    .bind(groupId)
    .all<{ email_key?: string | null; telefone?: string | null }>();

  const phoneByEmail = new Map<string, string>();
  for (const row of result.results ?? []) {
    const emailKey = row.email_key?.trim().toLowerCase() ?? "";
    const phone = row.telefone?.trim() ?? "";
    if (!emailKey || !phone) continue;
    if (!participantEmails.includes(emailKey)) continue;
    if (!phoneByEmail.has(emailKey)) {
      phoneByEmail.set(emailKey, phone);
    }
  }

  for (const [participantId, contact] of contacts.entries()) {
    const emailKey = contact.email?.trim().toLowerCase() ?? "";
    if (!emailKey) continue;
    const phone = phoneByEmail.get(emailKey);
    if (phone) {
      contacts.set(participantId, { ...contact, telefone: phone });
    }
  }
};

const createNotification = async (
  env: Env,
  userId: string,
  groupId: string
) => {
  const notificationId = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  return env.DB.prepare(
    `INSERT INTO notificacao (id, usuario_id, grupo_id, mensagem_id, title, body, lido, created_at)
     VALUES (?1, ?2, ?3, NULL, 'Sorteio realizado', 'Veja só quem você tirou clicando aqui', 0, ?4)`
  )
    .bind(notificationId, userId, groupId, createdAt)
    .run();
};

const buildAssignments = (participantIds: string[]) => {
  const candidates = [...participantIds];
  for (let attempt = 0; attempt < 100; attempt += 1) {
    shuffleInPlace(candidates);
    if (participantIds.every((id, index) => id !== candidates[index])) {
      return [...candidates];
    }
  }
  return null;
};

const shuffleInPlace = <T>(items: T[]) => {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
};

const buildGroupUrl = (env: Env, slug: string) => {
  const base = env.SITE_URL?.trim() || DEFAULT_SITE_URL;
  try {
    const url = new URL(base);
    url.pathname = `/app/grupo/${slug}`;
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return `${DEFAULT_SITE_URL.replace(/\/$/, "")}/app/grupo/${slug}`;
  }
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const hasCompletedDraw = async (env: Env, groupId: string) => {
  const result = await env.DB.prepare(
    `SELECT 1
     FROM sorteio
     WHERE grupo_id = ?1
       AND status = 'concluido'
     ORDER BY sorteado_em DESC
     LIMIT 1`
  )
    .bind(groupId)
    .first();

  return Boolean(result);
};
