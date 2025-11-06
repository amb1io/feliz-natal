type ResendEnv = {
  RESEND_API?: string;
  RESEND_API_KEY?: string;
  RESEND_FROM_EMAIL?: string;
  RESEND_FROM_NAME?: string;
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

const RESEND_ENDPOINT = "https://api.resend.com/emails";
const DEFAULT_FROM_EMAIL = "onboarding@resend.dev";
const DEFAULT_FROM_NAME = "Feliz Natal";

const readEnvValue = (
  env: ResendEnv | null | undefined,
  keys: string[],
  fallbackEnvKeys: string[] = []
) => {
  for (const key of keys) {
    const value = env?.[key as keyof ResendEnv];
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

const getApiKey = (env: ResendEnv | null | undefined) =>
  readEnvValue(
    env,
    ["RESEND_API", "RESEND_API_KEY"],
    ["RESEND_API", "RESEND_API_KEY"]
  );

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

const getDefaultFrom = (env: ResendEnv | null | undefined) => {
  const fromValue = readEnvValue(
    env,
    ["RESEND_FROM_EMAIL"],
    ["RESEND_FROM_EMAIL", "PUBLIC_RESEND_FROM_EMAIL"]
  );
  const fromNameValue = readEnvValue(
    env,
    ["RESEND_FROM_NAME"],
    ["RESEND_FROM_NAME", "PUBLIC_RESEND_FROM_NAME"]
  );

  if (fromValue) {
    const trimmed = fromValue.trim();
    if (trimmed.includes("<") && trimmed.includes(">")) {
      return trimmed;
    }
    if (isValidEmailAddress(trimmed)) {
      const name = fromNameValue
        ? sanitizeDisplayName(fromNameValue)
        : DEFAULT_FROM_NAME;
      return `${name} <${trimmed}>`;
    }
  }

  const name = fromNameValue
    ? sanitizeDisplayName(fromNameValue)
    : DEFAULT_FROM_NAME;
  return `${name} <${DEFAULT_FROM_EMAIL}>`;
};

const renderEmailShell = (title: string, content: string) => `<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8">
    <title>${title}</title>
  </head>
  <body style="margin:0;padding:0;background-color:#f6f7fb;font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#0f172a;">
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="padding:32px 0;">
      <tr>
        <td align="center">
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px;background:#ffffff;border-radius:16px;padding:32px 28px;box-shadow:0 16px 32px rgba(15,23,42,0.12);">
            <tr>
              <td>
                ${content}
              </td>
            </tr>
          </table>
          <p style="font-size:12px;color:#475569;margin-top:16px;">Feliz Natal • Plataforma de Amigo Secreto</p>
        </td>
      </tr>
    </table>
  </body>
</html>`;

const renderParagraph = (text: string) =>
  `<p style="font-size:15px;line-height:1.6;margin:0 0 16px;color:#334155;">${text}</p>`;

const renderButton = (href: string, label: string) =>
  `<p style="margin:28px 0;"><a href="${href}" style="display:inline-block;padding:14px 28px;border-radius:999px;background:linear-gradient(135deg,#38bdf8,#2563eb);color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;">${label}</a></p>`;

const renderGreeting = (name: string | null | undefined) =>
  `<p style="font-size:16px;line-height:1.6;margin:0 0 18px;color:#1e293b;font-weight:600;">Olá${
    name ? ` ${name}` : ""
  }!</p>`;

export const sendEmail = async (
  env: ResendEnv | null | undefined,
  options: SendEmailOptions
) => {
  const apiKey = getApiKey(env);
  if (!apiKey) {
    console.warn("Resend API key não configurada. Email não será enviado.");
    return false;
  }

  const resolvedFrom = (options.from ?? getDefaultFrom(env)).trim();
  if (
    !isValidEmailAddress(resolvedFrom) &&
    !(resolvedFrom.includes("<") && resolvedFrom.includes(">"))
  ) {
    console.warn(
      "Remetente inválido para envio via Resend. Valor recebido:",
      resolvedFrom
    );
    return false;
  }

  const payload = {
    from: resolvedFrom,
    to: options.to,
    subject: options.subject,
    html: options.html,
  };

  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(
        "Falha ao enviar email via Resend:",
        response.status,
        errorBody
      );
      return false;
    }

    return true;
  } catch (error) {
    console.error("Erro inesperado ao enviar email via Resend:", error);
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
  const content = [
    `<h1 style="font-size:22px;margin:0 0 18px;color:#0f172a;">O sorteio do grupo <span style="color:#2563eb;">${groupTitle}</span> foi realizado!</h1>`,
    renderGreeting(participantName),
    renderParagraph(
      "O seu amigo secreto já está disponível dentro da plataforma. Clique no botão abaixo para acessar o grupo, descobrir quem você tirou e começar a preparar a surpresa."
    ),
    friendlyDate
      ? renderParagraph(
          `📅 <strong>Data de revelação prevista:</strong> ${friendlyDate}`
        )
      : renderParagraph(
          "📅 A data de revelação será definida em breve. Fique de olho!"
        ),
    renderButton(groupUrl, "Ver meu amigo secreto"),
    renderParagraph(
      "Experimente enviar uma mensagem para o seu amigo secreto, compartilhar ideias de presente ou combinar detalhes especiais. Divirta-se!"
    ),
    renderParagraph("<strong>Equipe Feliz Natal</strong>"),
  ].join("");
  return renderEmailShell(`Sorteio concluído no grupo ${groupTitle}`, content);
};

export const sendDrawCompletedEmail = async (
  env: ResendEnv | null | undefined,
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
  const content = [
    `<h1 style="font-size:24px;margin:0 0 18px;color:#0f172a;">Bem-vindo${
      name ? `, ${name}` : ""
    }!</h1>`,
    renderGreeting(name),
    renderParagraph(
      "Estamos muito felizes em ter você com a gente. A plataforma Feliz Natal ajuda seu grupo de amigo secreto a organizar tudo com praticidade — participantes, sorteio, mensagens e muito mais."
    ),
    renderParagraph(
      "Para começar, acesse o painel e confira os grupos disponíveis ou aceite convites já enviados para você."
    ),
    renderButton(dashboardUrl, "Ir para o painel"),
    renderParagraph(
      "Se precisar de ajuda, basta responder a este email. Desejamos uma experiência incrível e cheia de presentes memoráveis! 🎄"
    ),
    renderParagraph("<strong>Equipe Feliz Natal</strong>"),
  ].join("");
  return renderEmailShell("Boas-vindas ao Feliz Natal", content);
};

export const sendWelcomeEmail = async (
  env: ResendEnv | null | undefined,
  options: WelcomeEmailOptions
) => {
  const html = buildWelcomeEmail(options);
  return sendEmail(env, {
    to: formatRecipientAddress(options.to, options.name),
    subject: "🎉 Bem-vindo ao Feliz Natal!",
    html,
  });
};
