import { sendDrawCompletedEmail } from "../shared/utils/email";
import { notifyDrawCompletedByPhone } from "../shared/utils/twilio";

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
  RESEND_API?: string;
  RESEND_API_KEY?: string;
  RESEND_FROM_EMAIL?: string;
  RESEND_FROM_NAME?: string;
  TWILIO_ACCOUNT_SID?: string;
  TWILIO_AUTH_TOKEN?: string;
  TWILIO_SMS_FROM?: string;
  TWILIO_WHATSAPP_FROM?: string;
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
  const phoneNumbers = await fetchGroupPhones(env, group.id);
  const revealDateFriendly = formatFriendlyDate(group.data_revelacao);

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
      await wait(600); // throttle Resend requests (~2 per second limit)
    }
  }

  const phoneNotifications = phoneNumbers.map((phone) =>
    notifyDrawCompletedByPhone(env, {
      phone,
      groupTitle: group.titulo,
      groupUrl,
      revealDate: revealDateFriendly,
    })
  );

  await Promise.all([...notificationPromises, ...phoneNotifications]);

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

const fetchGroupPhones = async (env: Env, groupId: string) => {
  const statement = await env.DB.prepare(
    `SELECT DISTINCT telefone
     FROM convite
     WHERE grupo_id = ?1
       AND telefone IS NOT NULL
       AND TRIM(telefone) != ''`
  ).bind(groupId);

  const result = await statement.all<{ telefone?: string | null }>();
  return (result.results ?? [])
    .map((row) => row.telefone?.trim())
    .filter((value): value is string => Boolean(value));
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

const formatFriendlyDate = (value?: string | null) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
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
