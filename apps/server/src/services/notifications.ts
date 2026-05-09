import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { createAdminClient } from "@maietek/db"
import { logger } from "../utils/logger"

const TELEGRAM_API_BASE = "https://api.telegram.org"
const TELEGRAM_TIMEOUT_MS = 5000
const TELEGRAM_MESSAGE_LIMIT = 3900

type TelegramChannel =
  | "chat"
  | "wishes"
  | "monitoring"
  | "security"
  | "presence"
  | "default"

type TelegramEventNotificationInput = {
  channel?: TelegramChannel
  title: string
  lines?: Array<string | null | undefined>
  path?: string
}

type ChatMessageNotificationInput = {
  recipientId: string
  messagePreview: string
  senderName: string
}

type ProfileRole = "dom" | "sub" | "unassigned"

type UserOnlineNotificationInput = {
  userId: string
  userName: string
  userRole?: ProfileRole
}

type AccountSecurityNotificationInput = {
  userId: string
  userName?: string | null
  userRole?: ProfileRole | null
  changes: Array<"email" | "password">
}

type ProfileSummaryRow = {
  full_name: string | null
  role: ProfileRole | null
}

let envFileCache: Record<string, string> | null = null

const channelChatIdKeys: Record<TelegramChannel, string[]> = {
  chat: ["TELEGRAM_CHAT_NOTIFICATIONS_CHAT_ID"],
  wishes: ["TELEGRAM_WISHES_CHAT_ID"],
  monitoring: ["TELEGRAM_MONITORING_CHAT_ID"],
  security: ["TELEGRAM_SECURITY_CHAT_ID"],
  presence: ["TELEGRAM_PRESENCE_CHAT_ID"],
  default: [],
}

function parseEnvValue(value: string) {
  const trimmed = value.trim()

  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).replace(/\\n/g, "\n")
  }

  return trimmed
}

function readEnvFile(filePath: string) {
  if (!existsSync(filePath)) return {}

  const values: Record<string, string> = {}
  const content = readFileSync(filePath, "utf8")

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith("#")) continue

    const separatorIndex = line.indexOf("=")
    if (separatorIndex === -1) continue

    const key = line.slice(0, separatorIndex).trim()
    if (!/^[A-Z0-9_]+$/.test(key)) continue

    values[key] = parseEnvValue(line.slice(separatorIndex + 1))
  }

  return values
}

function getEnvFileValues() {
  if (envFileCache) return envFileCache

  const cwd = process.cwd()
  const candidates = Array.from(
    new Set([
      path.resolve(cwd, "../../.env"),
      path.resolve(cwd, "../../.env.local"),
      path.resolve(cwd, ".env"),
      path.resolve(cwd, ".env.local"),
    ]),
  )

  envFileCache = candidates.reduce<Record<string, string>>(
    (values, filePath) => ({
      ...values,
      ...readEnvFile(filePath),
    }),
    {},
  )

  return envFileCache
}

function getEnvValue(key: string) {
  return process.env[key]?.trim() || getEnvFileValues()[key]?.trim()
}

function getAppUrl() {
  const appUrl = (
    getEnvValue("NEXT_PUBLIC_APP_URL") ||
    getEnvValue("NEXT_PUBLIC_SITE_URL") ||
    getEnvValue("WEB_URL") ||
    getEnvValue("SITE_URL")
  )?.trim()

  if (!appUrl) return null

  return appUrl.replace(/\/+$/, "")
}

function getAppPath(pathname: string) {
  const appUrl = getAppUrl()
  return appUrl ? `${appUrl}${pathname}` : pathname
}

function getTelegramConfig(channel: TelegramChannel = "default") {
  const botToken = getEnvValue("TELEGRAM_BOT_TOKEN")
  const chatId = [
    ...channelChatIdKeys[channel],
    "TELEGRAM_CHAT_ID",
    "TELEGRAM_DOM_CHAT_ID",
  ]
    .map((key) => getEnvValue(key))
    .find(Boolean)

  if (!botToken || !chatId) return null

  return { botToken, chatId }
}

function compactText(value: string | null | undefined, fallback: string) {
  const text = value?.trim().replace(/\s+/g, " ")
  return text || fallback
}

function truncateText(value: string, maxLength: number) {
  if (value.length <= maxLength) return value
  return `${value.slice(0, Math.max(0, maxLength - 1)).trim()}…`
}

async function getProfileSummary(userId: string) {
  const supabaseAdmin = createAdminClient()
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("full_name, role")
    .eq("id", userId)
    .maybeSingle()

  return data as ProfileSummaryRow | null
}

async function getProfileName(userId: string) {
  const profile = await getProfileSummary(userId)
  return compactText(profile?.full_name, "Uživatel")
}

async function sendTelegramMessage(channel: TelegramChannel, text: string) {
  const config = getTelegramConfig(channel)

  if (!config) {
    logger.warn("Telegram notification skipped", {
      channel,
      reason: "missing bot token or chat id",
    })
    return
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), TELEGRAM_TIMEOUT_MS)

  try {
    const response = await fetch(
      `${TELEGRAM_API_BASE}/bot${config.botToken}/sendMessage`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          chat_id: config.chatId,
          disable_web_page_preview: true,
          text: truncateText(text, TELEGRAM_MESSAGE_LIMIT),
        }),
        signal: controller.signal,
      },
    )

    if (!response.ok) {
      logger.error("Telegram notification failed", {
        channel,
        status: response.status,
      })
    }
  } catch (error) {
    logger.error("Telegram notification failed", {
      channel,
      error,
    })
  } finally {
    clearTimeout(timeout)
  }
}

export async function sendTelegramEventNotification(
  input: TelegramEventNotificationInput,
) {
  const channel = input.channel || "default"
  const eventUrl = input.path
    ? getAppPath(input.path.startsWith("/") ? input.path : `/${input.path}`)
    : null
  const lines = [
    input.title,
    ...(input.lines || []),
    eventUrl ? `Otevřít: ${eventUrl}` : null,
  ].filter(Boolean)

  await sendTelegramMessage(channel, lines.join("\n"))
}

export async function sendChatMessageTelegramNotification(
  input: ChatMessageNotificationInput,
) {
  const recipientName = await getProfileName(input.recipientId).catch(
    () => "Uživatel",
  )
  const preview = truncateText(
    compactText(input.messagePreview, "Nová zpráva."),
    500,
  )

  await sendTelegramEventNotification({
    channel: "chat",
    title: "Nová nepřečtená zpráva",
    lines: [
      `Od: ${compactText(input.senderName, "Uživatel")}`,
      `Pro: ${recipientName}`,
      `Zpráva: ${preview}`,
    ],
    path: "/chat",
  })
}

export async function sendUserOnlineTelegramNotification(
  input: UserOnlineNotificationInput,
) {
  if (input.userRole === "dom") return

  const now = new Date()
  // Formátování data: 12.04.2026
  const date = now.toLocaleDateString("cs-CZ", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })

  // Formátování času: 19:37
  const time = now.toLocaleTimeString("cs-CZ", {
    hour: "2-digit",
    minute: "2-digit",
  })

  await sendTelegramEventNotification({
    channel: "presence",
    title: "🟢 Uživatel je online",
    // lines: [`Uživatel: ${compactText(input.userName, "Uživatel")}`],
    lines: [`🗓️ ${date} (${time})`],
    // path: "/chat",
  })
}

export async function sendAccountSecurityTelegramNotification(
  input: AccountSecurityNotificationInput,
) {
  if (input.changes.length === 0) return

  const profile = await getProfileSummary(input.userId).catch(() => null)
  if (input.userRole === "dom" || profile?.role === "dom") return

  const userName = input.userName || compactText(profile?.full_name, "Uživatel")
  const labels = input.changes.map((change) =>
    change === "email" ? "email" : "heslo",
  )

  await sendTelegramEventNotification({
    channel: "security",
    title: "Změna účtu",
    lines: [
      `Uživatel: ${compactText(userName, "Uživatel")}`,
      `Změněno: ${labels.join(", ")}`,
    ],
  })
}

export async function sendTelegramNotification(
  userId: string,
  messagePreview: string,
  senderName: string,
) {
  await sendChatMessageTelegramNotification({
    recipientId: userId,
    messagePreview,
    senderName,
  })
}
