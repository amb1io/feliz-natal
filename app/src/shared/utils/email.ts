import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";
import addedToGroupTemplate from "../../templates/email-added-to-group.html?raw";
import drawCompletedTemplate from "../../templates/email-draw-completed.html?raw";
import groupCreatedTemplate from "../../templates/email-group-created.html?raw";
import inviteTemplate from "../../templates/email-invite.html?raw";
import welcomeTemplate from "../../templates/email-welcome.html?raw";

type EmailEnv = {
  SES_REGION?: string;
  AWS_REGION?: string;
  SES_FROM_EMAIL?: string;
  SES_FROM_NAME?: string;
  AWS_SES_ACCESS_KEY_ID?: string;
  AWS_SES_SECRET_ACCESS_KEY?: string;
  AWS_SESSION_TOKEN?: string;
};

type SendEmailOptions = {
  to: string;
  subject: string;
  html: string;
  from?: string;
};

type DrawEmailOptions = {
  to: string;
  groupTitle: string;
  groupUrl: string;
  revealDate?: string | null;
  participantName?: string | null;
};

type WelcomeEmailOptions = {
  to: string;
  name?: string | null;
  dashboardUrl: string;
};

type InviteEmailOptions = {
  to: string;
  groupTitle: string;
  inviteLink: string;
  inviterName?: string | null;
  groupOwner?: string | null;
};

type GroupCreatedEmailOptions = {
  to: string;
  groupTitle: string;
  groupUrl: string;
  ownerName?: string | null;
};

type AddedToGroupEmailOptions = {
  to: string;
  groupTitle: string;
  groupUrl: string;
  inviteLink?: string | null;
  participantName?: string | null;
  groupOwner?: string | null;
};

const DEFAULT_FROM_EMAIL = "no-reply@feliz.natal.br";
const DEFAULT_FROM_NAME = "Feliz Natal";
const DEFAULT_AWS_REGION = "sa-east-1";

const readEnvValue = (
  env: EmailEnv | null | undefined,
  keys: string[],
  fallbackEnvKeys: string[] = []
) => {
  for (const key of keys) {
    const value = env?.[key as keyof EmailEnv];
    if (value) return value;
  }

  const metaEnv =
    (import.meta as { env?: Record<string, string | undefined> }).env ??
    undefined;
  if (metaEnv) {
    for (const key of fallbackEnvKeys) {
      const value = metaEnv[key];
      if (typeof value === "string" && value) {
        return value;
      }
    }
  }

  const processEnv = typeof process !== "undefined" ? process.env : undefined;
  if (processEnv) {
    for (const key of fallbackEnvKeys) {
      const value = processEnv[key];
      if (typeof value === "string" && value) {
        return value;
      }
    }
  }

  return null;
};

const isValidEmailAddress = (value: string) => {
  const candidate = value.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(candidate);
};

const sanitizeDisplayName = (value: string) =>
  value
    .replace(/[\r\n]/g, " ")
    .replace(/[<>]/g, "")
    .replace(/"/g, "'")
    .trim();

const formatRecipientAddress = (email: string, name?: string | null) => {
  const address = email.trim();
  if (!name) return address;
  const safeName = sanitizeDisplayName(name);
  return safeName.length ? `${safeName} <${address}>` : address;
};

const extractEmailAddress = (value: string) => {
  const trimmed = value.trim();
  const match = trimmed.match(/<([^>]+)>/);
  return (match?.[1] ?? trimmed).trim();
};

const getDefaultFrom = (env: EmailEnv | null | undefined) => {
  const sesFromValue = readEnvValue(
    env,
    ["SES_FROM_EMAIL"],
    ["SES_FROM_EMAIL", "PUBLIC_SES_FROM_EMAIL"]
  );
  const sesFromNameValue = readEnvValue(
    env,
    ["SES_FROM_NAME"],
    ["SES_FROM_NAME", "PUBLIC_SES_FROM_NAME"]
  );
  if (sesFromValue && isValidEmailAddress(sesFromValue.trim())) {
    const name = sesFromNameValue
      ? sanitizeDisplayName(sesFromNameValue)
      : DEFAULT_FROM_NAME;
    return `${name} <${sesFromValue.trim()}>`;
  }

  return `${DEFAULT_FROM_NAME} <${DEFAULT_FROM_EMAIL}>`;
};

const renderTemplate = (
  template: string,
  variables: Record<string, string | null | undefined>
) =>
  Object.entries(variables).reduce((html, [key, value]) => {
    const safeValue = value ?? "";
    return html.replaceAll(`{{${key}}}`, safeValue);
  }, template);

const DEFAULT_HEADER_IMAGE_URL = "https://feliz.natal.br/og-image.png";

const resolveHeaderImageUrl = (referenceUrl?: string | null) => {
  return DEFAULT_HEADER_IMAGE_URL;
};

export const sendEmail = async (
  env: EmailEnv | null | undefined,
  options: SendEmailOptions
) => {
  const resolvedFrom = (options.from ?? getDefaultFrom(env)).trim();
  const senderEmail = extractEmailAddress(resolvedFrom);

  const sesRegion =
    readEnvValue(env, ["SES_REGION", "AWS_REGION"], ["SES_REGION", "AWS_REGION"]) ??
    DEFAULT_AWS_REGION;
  const sesAccessKey = readEnvValue(
    env,
    ["AWS_SES_ACCESS_KEY_ID"],
    ["AWS_SES_ACCESS_KEY_ID"]
  );
  const sesSecretKey = readEnvValue(
    env,
    ["AWS_SES_SECRET_ACCESS_KEY"],
    ["AWS_SES_SECRET_ACCESS_KEY"]
  );
  const sesSessionToken = readEnvValue(
    env,
    ["AWS_SESSION_TOKEN"],
    ["AWS_SESSION_TOKEN"]
  );
  if (!sesRegion || !sesAccessKey || !sesSecretKey) {
    console.warn("Configuração do AWS SES ausente. Email não será enviado.");
    return false;
  }

  if (!isValidEmailAddress(senderEmail)) {
    console.warn(
      "Remetente inválido para envio via SES. Valor recebido:",
      resolvedFrom
    );
    return false;
  }

  try {
    const client = new SESv2Client({
      region: sesRegion,
      credentials: {
        accessKeyId: sesAccessKey,
        secretAccessKey: sesSecretKey,
        ...(sesSessionToken ? { sessionToken: sesSessionToken } : {})
      }
    });
    const command = new SendEmailCommand({
      FromEmailAddress: senderEmail,
      Destination: {
        ToAddresses: [extractEmailAddress(options.to)]
      },
      Content: {
        Simple: {
          Subject: { Data: options.subject, Charset: "UTF-8" },
          Body: {
            Html: { Data: options.html, Charset: "UTF-8" }
          }
        }
      }
    });
    await client.send(command);
    return true;
  } catch (error) {
    console.error("Falha ao enviar email via AWS SES:", error);
    return false;
  }
};

export const buildDrawCompletedEmail = ({
  groupTitle,
  groupUrl,
  revealDate,
  participantName,
}: Omit<DrawEmailOptions, "to">) => {
  const friendlyDate = revealDate
    ? new Date(revealDate).toLocaleDateString("pt-BR", { dateStyle: "long" })
    : null;
  return renderTemplate(drawCompletedTemplate, {
    groupTitle,
    greetingName: participantName ? ` ${participantName}` : "",
    dateLine: friendlyDate
      ? `📅 <strong>Data de revelação prevista:</strong> ${friendlyDate}`
      : "📅 A data de revelação será definida em breve. Fique de olho!",
    groupUrl,
    headerImageUrl: resolveHeaderImageUrl(groupUrl)
  });
};

export const sendDrawCompletedEmail = async (
  env: EmailEnv | null | undefined,
  options: DrawEmailOptions
) => {
  const html = buildDrawCompletedEmail(options);
  return sendEmail(env, {
    to: formatRecipientAddress(options.to, options.participantName),
    subject: `🎁 O sorteio do grupo ${options.groupTitle} foi concluído`,
    html,
  });
};

export const buildWelcomeEmail = ({
  name,
  dashboardUrl,
}: Omit<WelcomeEmailOptions, "to">) => {
  return renderTemplate(welcomeTemplate, {
    headingName: name ? `, ${name}` : "",
    greetingName: name ? ` ${name}` : "",
    dashboardUrl,
    headerImageUrl: resolveHeaderImageUrl(dashboardUrl)
  });
};

export const sendWelcomeEmail = async (
  env: EmailEnv | null | undefined,
  options: WelcomeEmailOptions
) => {
  const html = buildWelcomeEmail(options);
  return sendEmail(env, {
    to: formatRecipientAddress(options.to, options.name),
    subject: "🎉 Bem-vindo ao Feliz Natal!",
    html,
  });
};

const buildInviteEmail = ({
  groupTitle,
  inviteLink,
  inviterName,
  groupOwner,
}: InviteEmailOptions) => {
  return renderTemplate(inviteTemplate, {
    groupTitle,
    greetingName: inviterName ? ` ${inviterName}` : "",
    groupOwner: groupOwner ?? inviterName ?? "Alguém",
    inviteLink,
    headerImageUrl: resolveHeaderImageUrl(inviteLink)
  });
};

export const sendInviteEmail = async (
  env: EmailEnv | null | undefined,
  options: InviteEmailOptions
) => {
  const html = buildInviteEmail(options);
  return sendEmail(env, {
    to: options.to,
    subject: `🎄 Você foi convidado para o grupo ${options.groupTitle}`,
    html,
  });
};

const buildGroupCreatedEmail = ({
  groupTitle,
  groupUrl,
  ownerName,
}: Omit<GroupCreatedEmailOptions, "to">) => {
  return renderTemplate(groupCreatedTemplate, {
    groupTitle,
    greetingName: ownerName ? ` ${ownerName}` : "",
    groupUrl,
    headerImageUrl: resolveHeaderImageUrl(groupUrl)
  });
};

export const sendGroupCreatedEmail = async (
  env: EmailEnv | null | undefined,
  options: GroupCreatedEmailOptions
) => {
  const html = buildGroupCreatedEmail(options);
  return sendEmail(env, {
    to: formatRecipientAddress(options.to, options.ownerName),
    subject: `✅ Grupo ${options.groupTitle} criado com sucesso`,
    html,
  });
};

const buildAddedToGroupEmail = ({
  groupTitle,
  groupUrl,
  inviteLink,
  participantName,
  groupOwner,
}: Omit<AddedToGroupEmailOptions, "to">) => {
  return renderTemplate(addedToGroupTemplate, {
    groupTitle,
    greetingName: participantName ? ` ${participantName}` : "",
    groupOwner: groupOwner ?? "Alguém",
    accessLink: inviteLink ?? groupUrl,
    accessLabel: inviteLink ? "Aceitar convite" : "Ver grupo",
    headerImageUrl: resolveHeaderImageUrl(inviteLink ?? groupUrl)
  });
};

export const sendAddedToGroupEmail = async (
  env: EmailEnv | null | undefined,
  options: AddedToGroupEmailOptions
) => {
  const html = buildAddedToGroupEmail(options);
  return sendEmail(env, {
    to: formatRecipientAddress(options.to, options.participantName),
    subject: `🎄 Você foi adicionado ao grupo ${options.groupTitle}`,
    html,
  });
};
