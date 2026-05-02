"use client"

import { useEffect, useRef } from "react"
import { Loader2, Search, Wifi, WifiOff, X } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"

type ChatHeaderProps = {
  partnerName?: string | null
  partnerLastOnlineAt?: string | null
  isPartnerOnline: boolean
  isConnected: boolean
  isTyping?: boolean
  typingUserName?: string | null
  isSearchOpen?: boolean
  searchQuery?: string
  searchResultCount?: number
  isSearching?: boolean
  searchError?: string | null
  onToggleSearch?: () => void
  onCloseSearch?: () => void
  onSearchQueryChange?: (value: string) => void
}

function getInitials(fullName: string) {
  return fullName
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase()
}

const lastOnlineFormatter = new Intl.DateTimeFormat("cs-CZ", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
})

const lastOnlineTodayFormatter = new Intl.DateTimeFormat("cs-CZ", {
  hour: "2-digit",
  minute: "2-digit",
})

function formatLastOnline(value?: string | null) {
  if (!value) return "Naposledy online neznámo"

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return "Naposledy online neznámo"
  }

  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const time = lastOnlineTodayFormatter.format(date)

  if (target.getTime() === today.getTime()) return `Naposledy online dnes v ${time}`
  if (target.getTime() === yesterday.getTime()) return `Naposledy online včera v ${time}`

  return `Naposledy online ${lastOnlineFormatter.format(date)}`
}

export function ChatHeader({
  partnerName = "Soukromá konverzace",
  partnerLastOnlineAt,
  isPartnerOnline,
  isConnected,
  isTyping,
  typingUserName,
  isSearchOpen = false,
  searchQuery = "",
  searchResultCount = 0,
  isSearching = false,
  searchError = null,
  onToggleSearch,
  onCloseSearch,
  onSearchQueryChange,
}: ChatHeaderProps) {
  const displayName = partnerName || "Soukromá konverzace"
  const searchInputRef = useRef<HTMLInputElement>(null)
  const trimmedSearchQuery = searchQuery.trim()

  useEffect(() => {
    if (isSearchOpen) {
      searchInputRef.current?.focus()
    }
  }, [isSearchOpen])

  return (
    <div className="border-b border-white/10 bg-black/20 px-6 py-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {partnerName && (
            <Avatar className="h-10 w-10 border border-white/10 bg-black/50">
              <AvatarFallback className="bg-primary/15 text-xs font-semibold text-primary">
                {getInitials(partnerName)}
              </AvatarFallback>
            </Avatar>
          )}
          <div className="min-w-0">
            <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-primary/80">
              Soukromý chat
            </p>
            <h2 className="uzivatel-online flex min-w-0 items-center gap-2 text-base font-semibold text-white">
              <div
                className={`h-2 w-2 rounded-full ${isPartnerOnline ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]" : "bg-slate-600"}`}
              />
              <span className="truncate">{displayName}</span>
              {!isPartnerOnline && (
                <span className="hidden shrink-0 text-xs font-normal text-zinc-500 md:inline">
                  {formatLastOnline(partnerLastOnlineAt)}
                </span>
              )}
              {isTyping && (
                <span className="ml-2 shrink-0 animate-pulse text-xs font-normal text-primary">
                  {typingUserName ? `${typingUserName} píše...` : "Píše..."}
                </span>
              )}
            </h2>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={onToggleSearch}
            className={cn(
              "inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-white/10 bg-black/30 text-zinc-300 transition-all duration-400 hover:border-primary/30 hover:bg-primary/10 hover:text-primary focus:outline-none focus:ring-2 focus:ring-primary/60",
              isSearchOpen && "border-primary/30 bg-primary/10 text-primary",
            )}
            aria-label={isSearchOpen ? "Zavřít hledání" : "Hledat zprávy"}
            title={isSearchOpen ? "Zavřít hledání" : "Hledat zprávy"}
          >
            <Search className="h-4 w-4" />
          </button>

          {/* Socket connection status */}
          <div
            className={`inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-black/30 px-3 py-1.5 text-[11px] font-medium ${
              isConnected ? "text-emerald-400" : "text-zinc-300"
            }`}>
            {isConnected ? (
              <Wifi className="h-3 w-3" />
            ) : (
              <WifiOff className="h-3 w-3" />
            )}
            <span className="hidden sm:inline">
              {isConnected ? "Připojeno" : "Obnovuji"}
            </span>
          </div>
        </div>
      </div>

      {isSearchOpen ? (
        <div className="mt-3 rounded-2xl border border-white/10 bg-black/40 px-3 py-2 backdrop-blur-xl">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 shrink-0 text-primary" />
            <input
              ref={searchInputRef}
              type="search"
              value={searchQuery}
              onChange={(event) => onSearchQueryChange?.(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") onCloseSearch?.()
              }}
              placeholder="Hledat zprávy"
              className="min-w-0 flex-1 rounded-xl bg-[color-mix(in_oklab,rgba(255,255,255,0.1)_80%,transparent)] px-2 py-1 text-sm text-white outline-none placeholder:text-zinc-500"
            />
            {isSearching ? (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />
            ) : searchQuery ? (
              <button
                type="button"
                onClick={() => onSearchQueryChange?.("")}
                className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border border-white/10 text-zinc-400 transition-all duration-400 hover:border-primary/30 hover:bg-primary/10 hover:text-primary"
                aria-label="Vymazat hledání"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>
          <div className="mt-1 px-6 text-[11px] text-zinc-500">
            {searchError
              ? searchError
              : trimmedSearchQuery.length < 3
                ? "Zadej alespoň 3 znaky"
                : `${searchResultCount} ${searchResultCount === 1 ? "výsledek" : searchResultCount > 1 && searchResultCount < 5 ? "výsledky" : "výsledků"}`}
          </div>
        </div>
      ) : null}
    </div>
  )
}
