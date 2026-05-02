import "server-only"

import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import type { WishStatus } from "@/types/wish"

const TELEGRAM_API_BASE = "https://api.telegram.org"
const TELEGRAM_TIMEOUT_MS = 5000
const TELEGRAM_MESSAGE_LIMIT = 3900

let envFileCache: Record<string, string> | null = null

const wishStatusLabel: Record<Exclude<WishStatus, "new">, string> = {
  noted: "Vzato na vědomí",
  planned: "Naplánováno",
  fulfilled: "Splněno",
  declined: "Zamítnuto",
}

type NewWishNotificationInput = {
  title: string
  description?: string | null
  creatorName?: string | null
}

type TaskCommentNotificationInput = {
  taskId?: string | null
  taskTitle: string
  comment: string
  actorName?: string | null
}

type TaskSubmittedNotificationInput = {
  taskId?: string | null
  taskTitle: string
  actorName?: string | null
  isResubmission?: boolean
}

type WishStatusChangedNotificationInput = {
  title: string
  status: Exclude<WishStatus, "new">
  actorName?: string | null
}

type TelegramNotificationChannel = "tasks" | "wishes"

const channelChatIdKeys: Record<TelegramNotificationChannel, string[]> = {
  tasks: ["TELEGRAM_TASKS_CHAT_ID", "TELEGRAM_TASK_NOTIFICATIONS_CHAT_ID"],
  wishes: ["TELEGRAM_WISHES_CHAT_ID"],
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

function getTelegramConfig(channel: TelegramNotificationChannel) {
  const botToken = getEnvValue("TELEGRAM_BOT_TOKEN")
  const chatId = [
    ...channelChatIdKeys[channel],
    "TELEGRAM_CHAT_ID",
    "TELEGRAM_DOM_CHAT_ID",
  ]
    .map((key) => getEnvValue(key))
    .find(Boolean)
    ?.trim()

  if (!botToken || !chatId) {
    return null
  }

  return { botToken, chatId }
}

function getAppUrl() {
  const appUrl = (
    getEnvValue("NEXT_PUBLIC_APP_URL") ||
    getEnvValue("NEXT_PUBLIC_SITE_URL") ||
    getEnvValue("WEB_URL") ||
    "http://localhost:3000"
  ).trim()

  return appUrl.replace(/\/+$/, "")
}

function compactText(value: string | null | undefined, fallback: string) {
  const text = value?.trim().replace(/\s+/g, " ")
  return text || fallback
}

function truncateText(value: string, maxLength: number) {
  if (value.length <= maxLength) return value
  return `${value.slice(0, Math.max(0, maxLength - 1)).trim()}…`
}

function getTaskUrl(taskId?: string | null) {
  const appUrl = getAppUrl()
  return taskId ? `${appUrl}/tasks/${taskId}` : `${appUrl}/tasks`
}

async function sendTelegramMessage(
  channel: TelegramNotificationChannel,
  text: string,
) {
  const config = getTelegramConfig(channel)

  if (!config) {
    console.warn(
      `[Telegram] ${channel} notification skipped: missing bot token or chat id.`,
    )
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
      console.error(
        `[Telegram] ${channel} notification failed:`,
        response.status,
      )
    }
  } catch (error) {
    console.error(
      `[Telegram] ${channel} notification failed:`,
      error instanceof Error ? error.message : "Unknown error",
    )
  } finally {
    clearTimeout(timeout)
  }
}

export async function sendNewWishNotification(input: NewWishNotificationInput) {
  const title = compactText(input.title, "Přání")
  const creator = compactText(input.creatorName, "SUB")
  const description = compactText(input.description, "")
  const wishUrl = `${getAppUrl()}/wishes`
  const lines = [
    "🙏 Nové přání",
    //`Od: ${creator}`,
    `Název: ${title}`,
    description ? `Popis: ${truncateText(description, 500)}` : null,
    `Otevřít: ${wishUrl}`,
  ].filter(Boolean)

  await sendTelegramMessage("wishes", lines.join("\n"))
}

export async function sendWishStatusChangedNotification(
  input: WishStatusChangedNotificationInput,
) {
  const title = compactText(input.title, "Přání")
  const actor = compactText(input.actorName, "DOM")
  const wishUrl = `${getAppUrl()}/wishes`
  const lines = [
    "🔁 Změna stavu přání",
    `DOM: ${actor}`,
    `Přání: ${title}`,
    `Nový stav: ${wishStatusLabel[input.status]}`,
    `Otevřít: ${wishUrl}`,
  ]

  await sendTelegramMessage("wishes", lines.join("\n"))
}

export async function sendTaskCommentNotification(
  input: TaskCommentNotificationInput,
) {
  const taskTitle = compactText(input.taskTitle, "Úkol")
  const actor = compactText(input.actorName, "SUB")
  const comment = truncateText(compactText(input.comment, "Komentář"), 700)
  const lines = [
    "💬 Nový komentář u úkolu",
    // `Od: ${actor}`,
    `Úkol: ${taskTitle}`,
    `Komentář: ${comment}`,
    `Otevřít: ${getTaskUrl(input.taskId)}`,
  ]

  await sendTelegramMessage("tasks", lines.join("\n"))
}

export async function sendTaskSubmittedNotification(
  input: TaskSubmittedNotificationInput,
) {
  const taskTitle = compactText(input.taskTitle, "Úkol")
  const actor = compactText(input.actorName, "SUB")
  const lines = [
    input.isResubmission
      ? "📝 Úkol znovu odevzdán"
      : "🗒️ Úkol odevzdán ke kontrole.",
    // `Od: ${actor}`,
    `Úkol: ${taskTitle}`,
    `Otevřít: ${getTaskUrl(input.taskId)}`,
  ]

  await sendTelegramMessage("tasks", lines.join("\n"))
}
