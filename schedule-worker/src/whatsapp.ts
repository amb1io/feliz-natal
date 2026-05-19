type EnvSource = Record<string, unknown> | undefined;

type DrawCompletedWhatsAppOptions = {
  to: string;
  groupTitle: string;
  groupUrl: string;
  recipientName?: string | null;
  revealDate?: string | null;
  revealLocation?: string | null;
};

type TemplateComponentsMode = "none" | "body" | "header_body" | "body_button";

type WhatsAppCloudConfig = {
  accessToken?: string;
  phoneNumberId?: string;
  apiVersion: string;
  templateName?: string;
  templateLanguage: string;
  templateComponents: TemplateComponentsMode;
  includeHeaderImage: boolean;
  includeInviteButton: boolean;
  siteBaseUrl: string;
  headerImageUrl: string;
  defaultCountryCode: string;
};

type WhatsAppSendResponse = {
  contacts?: Array<{ wa_id?: string }>;
  messages?: Array<{ id?: string; message_status?: string }>;
  error?: { message?: string; type?: string; code?: number };
};

type TemplateTextParameter = { type: "text"; text: string; parameter_name?: string };
type TemplateImageParameter = { type: "image"; image: { link: string } };
type TemplateComponent =
  | { type: "header"; parameters: TemplateImageParameter[] }
  | { type: "body"; parameters: TemplateTextParameter[] }
  | {
      type: "button";
      sub_type: "url";
      index: string;
      parameters: TemplateTextParameter[];
    };

const readEnvValue = (env: EnvSource, keys: string[]) => {
  for (const key of keys) {
    const fromEnvObject =
      typeof env === "object" && env !== null
        ? (env as Record<string, unknown>)[key]
        : undefined;
    if (typeof fromEnvObject === "string" && fromEnvObject.trim()) {
      return fromEnvObject.trim();
    }
  }
  return undefined;
};

const parseComponentsMode = (value?: string): TemplateComponentsMode => {
  const normalized = value?.trim().toLowerCase();
  if (
    normalized === "none" ||
    normalized === "body" ||
    normalized === "header_body" ||
    normalized === "body_button"
  ) {
    return normalized;
  }
  return "body";
};

const buildDrawCompletedConfig = (env?: EnvSource): WhatsAppCloudConfig => ({
  accessToken: readEnvValue(env, ["WHATSAPP_ACCESS_TOKEN", "META_WHATSAPP_ACCESS_TOKEN"]),
  phoneNumberId: readEnvValue(env, ["WHATSAPP_PHONE_NUMBER_ID", "META_WHATSAPP_PHONE_NUMBER_ID"]),
  apiVersion: readEnvValue(env, ["WHATSAPP_API_VERSION"]) ?? "v25.0",
  templateName: readEnvValue(env, ["WHATSAPP_DRAW_TEMPLATE_NAME"]),
  templateLanguage: readEnvValue(env, ["WHATSAPP_DRAW_TEMPLATE_LANG"]) ?? "pt_BR",
  templateComponents: parseComponentsMode(
    readEnvValue(env, ["WHATSAPP_DRAW_TEMPLATE_COMPONENTS"])
  ),
  includeHeaderImage: readEnvValue(env, ["WHATSAPP_DRAW_INCLUDE_HEADER"]) === "true",
  includeInviteButton: readEnvValue(env, ["WHATSAPP_DRAW_INCLUDE_BUTTON"]) === "true",
  siteBaseUrl: readEnvValue(env, ["WHATSAPP_SITE_BASE_URL", "SITE_URL"]) ?? "https://feliz.natal.br",
  headerImageUrl:
    readEnvValue(env, ["WHATSAPP_HEADER_IMAGE_URL"]) ??
    `${readEnvValue(env, ["WHATSAPP_SITE_BASE_URL", "SITE_URL"]) ?? "https://feliz.natal.br"}/og-image-whatsapp.jpg`,
  defaultCountryCode: readEnvValue(env, ["WHATSAPP_DEFAULT_COUNTRY_CODE"]) ?? "55",
});

const isConfigured = (config: WhatsAppCloudConfig) =>
  Boolean(config.accessToken && config.phoneNumberId && config.templateName);

const normalizeWhatsAppPhone = (value: string, defaultCountryCode = "55") => {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return null;

  if (trimmed.startsWith("+") || digits.length > 11) return digits;
  if (digits.startsWith(defaultCountryCode)) return digits;

  return `${defaultCountryCode}${digits}`;
};

const buildInviteButtonSuffix = (url: string, siteBaseUrl: string) => {
  try {
    const targetUrl = new URL(url);
    const baseUrl = new URL(siteBaseUrl.endsWith("/") ? siteBaseUrl : `${siteBaseUrl}/`);
    if (targetUrl.origin === baseUrl.origin) {
      return `${targetUrl.pathname.replace(/^\//, "")}${targetUrl.search}`;
    }
    return `${targetUrl.pathname.replace(/^\//, "")}${targetUrl.search}`;
  } catch {
    return url;
  }
};

const textParam = (text: string, parameterName?: string): TemplateTextParameter => {
  const parameter: TemplateTextParameter = { type: "text", text };
  if (parameterName) parameter.parameter_name = parameterName;
  return parameter;
};

const buildTemplateComponents = (
  options: DrawCompletedWhatsAppOptions,
  config: WhatsAppCloudConfig
): TemplateComponent[] | undefined => {
  if (config.templateComponents === "none") return undefined;

  const recipientName = options.recipientName?.trim() || "Participante";
  const revealDateRaw = options.revealDate?.trim() ?? "";
  const revealDateValue = revealDateRaw ? new Date(revealDateRaw) : null;
  const revealDate =
    revealDateValue && !Number.isNaN(revealDateValue.getTime())
      ? revealDateValue.toLocaleDateString("pt-BR", { dateStyle: "long" })
      : "Data a confirmar";
  const revealLocation = options.revealLocation?.trim() || options.groupUrl;

  const components: TemplateComponent[] = [];
  const shouldIncludeHeader =
    config.templateComponents === "header_body" || config.includeHeaderImage;
  if (shouldIncludeHeader) {
    components.push({
      type: "header",
      parameters: [{ type: "image", image: { link: config.headerImageUrl } }],
    });
  }

  components.push({
    type: "body",
    parameters: [
      textParam(recipientName, "nome_da_pessoa"),
      textParam(revealDate, "data_revelacao"),
      textParam(revealLocation, "local_revelacao"),
    ],
  });

  const shouldIncludeButton =
    config.templateComponents === "body_button" || config.includeInviteButton;
  if (shouldIncludeButton) {
    components.push({
      type: "button",
      sub_type: "url",
      index: "0",
      parameters: [textParam(buildInviteButtonSuffix(options.groupUrl, config.siteBaseUrl))],
    });
  }

  return components;
};

export const sendDrawCompletedWhatsApp = async (
  env: EnvSource,
  options: DrawCompletedWhatsAppOptions
) => {
  const config = buildDrawCompletedConfig(env);
  if (!isConfigured(config)) {
    console.warn("[whatsapp-cloud] Credenciais ou template de sorteio nao configurados.");
    return false;
  }

  const recipient = normalizeWhatsAppPhone(options.to, config.defaultCountryCode);
  if (!recipient) {
    console.warn("[whatsapp-cloud] Telefone invalido para sorteio concluido:", options.to);
    return false;
  }

  const template: Record<string, unknown> = {
    name: config.templateName,
    language: { code: config.templateLanguage },
  };
  const components = buildTemplateComponents(options, config);
  if (components?.length) template.components = components;

  const url = `https://graph.facebook.com/${config.apiVersion}/${config.phoneNumberId}/messages`;
  const payload = {
    messaging_product: "whatsapp",
    to: recipient,
    type: "template",
    template,
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const responseText = await response.text();
    let parsedResponse: WhatsAppSendResponse | null = null;
    try {
      parsedResponse = responseText
        ? (JSON.parse(responseText) as WhatsAppSendResponse)
        : null;
    } catch {
      parsedResponse = null;
    }

    if (!response.ok) {
      console.error(
        "[whatsapp-cloud] Falha ao enviar template de sorteio concluido:",
        response.status,
        parsedResponse?.error?.code ?? "n/a",
        parsedResponse?.error?.message ?? responseText
      );
      return false;
    }

    console.info(
      "[whatsapp-cloud] Template de sorteio concluido aceito:",
      parsedResponse?.messages?.[0]?.id ?? "sem-wamid"
    );
    return true;
  } catch (error) {
    console.error("[whatsapp-cloud] Erro inesperado ao enviar sorteio concluido:", error);
    return false;
  }
};
