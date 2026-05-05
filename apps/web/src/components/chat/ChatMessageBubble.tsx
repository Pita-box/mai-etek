import { useState } from "react"
import { CheckCheck, Heart, Play, Reply, Trash2 } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { VoicePlayer } from "./VoicePlayer"
import { ChatMediaLightbox } from "./ChatMediaLightbox"
import { cn } from "@/lib/utils"
import type { ChatMessageItem } from "@/types/chat"

const timestampFormatter = new Intl.DateTimeFormat("cs-CZ", {
  hour: "2-digit",
  minute: "2-digit",
})

function getInitials(fullName: string) {
  return fullName
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase()
}

function getMessagePreview(message: NonNullable<ChatMessageItem["replyTo"]>) {
  if (message.text?.trim()) return message.text.trim()
  if (message.type === "image") return "Fotka"
  if (message.type === "video") return "Video"
  if (message.type === "voice") return "Hlasová zpráva"
  return "Zpráva"
}

type ChatMessageBubbleProps = {
  message: ChatMessageItem
  viewerRole?: "dom" | "sub" | "unassigned" | null
  onDelete?: () => void
  onToggleHeart?: () => Promise<void>
  onReply?: () => void
}

export function ChatMessageBubble({
  message,
  viewerRole,
  onDelete,
  onToggleHeart,
  onReply,
}: ChatMessageBubbleProps) {
  const isOwn = message.isOwnMessage
  const isDom = viewerRole === "dom"
  const [isDeleting, setIsDeleting] = useState(false)
  const [isReacting, setIsReacting] = useState(false)
  const [isLightboxOpen, setIsLightboxOpen] = useState(false)
  const heartReaction = message.reactions?.find((reaction) => reaction.emoji === "heart")
  const hasHeart = Boolean(heartReaction?.reactedByViewer)
  const heartCount = heartReaction?.count ?? 0

  const handleDelete = async () => {
    if (!onDelete || !confirm("Opravdu chcete smazat tuto zprávu?")) return
    setIsDeleting(true)
    try {
      await onDelete()
    } finally {
      setIsDeleting(false)
    }
  }

  const handleToggleHeart = async () => {
    if (!onToggleHeart) return
    setIsReacting(true)
    try {
      await onToggleHeart()
    } finally {
      setIsReacting(false)
    }
  }

  const renderMediaPreview = () => {
    if (!message.media) return null

    if (message.type === "voice") {
      return (
        <div className="mt-2 overflow-hidden rounded-xl border border-white/10 bg-black/40 p-2">
          <VoicePlayer src={message.media.url} isOwn={isOwn} />
        </div>
      )
    }

    if (message.type === "image" || message.type === "video") {
      const thumbnailSrc = message.media.thumbnailUrl || message.media.url

      return (
        <button
          type="button"
          onClick={() => setIsLightboxOpen(true)}
          className={cn(
            "mt-2 group/media relative block w-full cursor-pointer overflow-hidden rounded-xl border border-white/10 bg-black/40 focus:outline-none focus:ring-2 focus:ring-primary/60",
            message.type === "video" && "min-h-[160px]",
          )}
          aria-label={message.type === "video" ? "Otevřít video" : "Otevřít fotku"}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={thumbnailSrc}
            alt={message.type === "video" ? "Náhled videa" : "Náhled fotky"}
            className="max-h-[260px] w-full object-cover transition-transform duration-400 group-hover/media:scale-[1.02]"
            loading="lazy"
            onError={(event) => {
              if (message.type === "video") {
                event.currentTarget.style.display = "none"
              }
            }}
          />
          {message.type === "video" ? (
            <span className="absolute inset-0 flex items-center justify-center bg-black/20">
              <span className="flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-black/70 text-white backdrop-blur">
                <Play className="h-5 w-5 fill-current" />
              </span>
            </span>
          ) : null}
        </button>
      )
    }

    return (
      <div className="mt-2 overflow-hidden rounded-xl border border-white/10 bg-black/40 p-2.5 text-xs text-slate-300">
        <p className="font-medium text-slate-100">Mediální zpráva</p>
        <a
          href={message.media.url}
          target="_blank"
          rel="noreferrer"
          className="mt-1 inline-flex cursor-pointer items-center text-primary transition-colors hover:text-primary/80">
          Otevřít přílohu
        </a>
      </div>
    )
  }

  return (
    <>
      <div
        className={cn(
          "group flex items-end gap-2.5",
          isOwn && "flex-row-reverse",
        )}>
        <Avatar className="h-8 w-8 shrink-0 border border-white/10 bg-black/60">
          <AvatarFallback className="bg-primary/15 text-[10px] font-semibold text-primary">
            {getInitials(message.sender.fullName)}
          </AvatarFallback>
        </Avatar>

        <div
          className={cn(
            "max-w-[80%] space-y-1 sm:max-w-[70%]",
            isOwn && "items-end",
          )}>
          <div
            className={cn(
              "flex items-center gap-2 px-1",
              isOwn && "justify-end",
            )}>
            <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-slate-500">
              {message.sender.fullName}
            </span>
            {isDom && onDelete && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="invisible opacity-0 group-hover:visible group-hover:opacity-100 transition-all text-slate-500 hover:text-rose-400"
                title="Smazat zprávu"
                aria-label="Smazat zprávu">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div
            className={cn(
              "chat-bubble relative overflow-hidden rounded-2xl border px-3.5 py-2.5 text-sm leading-6 backdrop-blur-xl transition-colors duration-400",
              isOwn
                ? "border-primary/30 bg-[linear-gradient(180deg,rgba(191,23,65,0.28),rgba(190,18,60,0.14))] text-white"
                : "border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.07),rgba(255,255,255,0.035))] text-zinc-100",
            )}>
            {message.replyTo ? (
              <div className="mb-2 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs leading-5">
                <div className="flex items-center gap-1.5 font-semibold text-primary">
                  <Reply className="h-3.5 w-3.5" />
                  <span>{message.replyTo.sender.fullName}</span>
                </div>
                <p className="mt-0.5 line-clamp-2 break-words text-zinc-300">
                  {getMessagePreview(message.replyTo)}
                </p>
              </div>
            ) : null}

            {message.text ? (
              <p className="whitespace-pre-wrap break-words">{message.text}</p>
            ) : null}
            {renderMediaPreview()}

            {/* Timestamp + read receipt */}
            <div
              className={cn(
                "mt-1 flex items-center gap-1.5",
                isOwn ? "justify-end" : "justify-start",
              )}>
              <span className="text-[10px] text-slate-500/80">
                {timestampFormatter.format(new Date(message.createdAt))}
              </span>
              {isOwn && message.isRead && (
                <span className="flex items-center" title="Zobrazeno" aria-label="Zobrazeno">
                  <CheckCheck className="h-3.5 w-3.5 text-primary" />
                </span>
              )}
            </div>
          </div>

          <div
            className={cn(
              "flex items-center gap-1 px-1",
              isOwn ? "justify-end" : "justify-start",
            )}>
            {onReply ? (
              <button
                type="button"
                onClick={onReply}
                aria-label="Odpovědět na zprávu"
                className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-full border border-white/10 bg-black/30 px-2 text-[11px] text-slate-400 transition-all duration-400 hover:border-primary/30 hover:bg-primary/10 hover:text-primary"
                title="Odpovědět"
              >
                <Reply className="h-3.5 w-3.5" />
              </button>
            ) : null}
            {onToggleHeart ? (
              <button
                type="button"
                onClick={handleToggleHeart}
                disabled={isReacting}
                aria-label={hasHeart ? "Odebrat srdce" : "Dát srdce"}
                className={cn(
                  "inline-flex h-7 cursor-pointer items-center gap-1 rounded-full border px-2 text-[11px] transition-all duration-400 disabled:cursor-not-allowed disabled:opacity-60",
                  hasHeart
                    ? "border-primary/30 bg-primary/15 text-primary"
                    : "border-white/10 bg-black/30 text-slate-400 hover:border-primary/30 hover:bg-primary/10 hover:text-primary",
                )}
                title={hasHeart ? "Odebrat srdce" : "Dát srdce"}
              >
                <Heart className={cn("h-3.5 w-3.5", hasHeart && "fill-current")} />
                {heartCount > 0 ? <span>{heartCount}</span> : null}
              </button>
            ) : heartCount > 0 ? (
              <span className="inline-flex h-7 items-center gap-1 rounded-full border border-primary/30 bg-primary/15 px-2 text-[11px] text-primary">
                <Heart className={cn("h-3.5 w-3.5", hasHeart && "fill-current")} />
                {heartCount}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      {isLightboxOpen && message.media ? (
        <ChatMediaLightbox message={message} onClose={() => setIsLightboxOpen(false)} />
      ) : null}
    </>
  )
}
