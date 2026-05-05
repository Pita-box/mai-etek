"use client"

import { useMemo, useState, useTransition } from "react"
import Image from "next/image"
import {
  Activity,
  Clock3,
  FileText,
  Image as ImageIcon,
  KeyRound,
  Loader2,
  MonitorCheck,
  Pencil,
  PlugZap,
  Radio,
  Search,
  ShieldX,
  Trash2,
} from "lucide-react"
import { useRouter } from "next/navigation"
import {
  createMonitoringPairingCode,
  deleteMonitoringDevice,
  deleteMonitoringEvent,
  renameMonitoringDevice,
  revokeMonitoringDevice,
} from "@/actions/monitoring"
import { EmptyState } from "@/components/shared/EmptyState"
import { useToast } from "@/components/shared/useToast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type {
  MonitoringData,
  MonitoringDevice,
  MonitoringFormActivity,
  MonitoringPairingCode,
  MonitoringScreenshot,
  MonitoringVisitedPage,
} from "@/types/monitoring"

type MonitoringClientProps = {
  data: MonitoringData
}

const MONITORING_TIMELINE_PAGE_SIZE = 30
const MONITORING_SCREENSHOT_BATCH_SIZE = 9
const FILTER_SELECT_CLASS =
  "h-11 rounded-2xl border border-white/10 bg-black/50 px-3 text-sm text-white outline-none transition focus:border-primary/60"

const dateFormatter = new Intl.DateTimeFormat("cs-CZ", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
})

const dayFormatter = new Intl.DateTimeFormat("cs-CZ", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
})

function formatDateTime(value: string | null | undefined) {
  if (!value) return "Zatím nikdy"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Neznámé"
  return dateFormatter.format(date)
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Neznámé datum"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Neznámé datum"
  return dayFormatter.format(date)
}

function formatDuration(value: number | null) {
  if (value === null) return "Probíhá"

  const totalSeconds = Math.max(0, Math.floor(value / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  if (minutes <= 0) return `${seconds} s`
  return `${minutes} min ${seconds.toString().padStart(2, "0")} s`
}

function getUrlHost(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return url
  }
}

function getUrlPreview(url: string, maxLength = 141) {
  if (url.length <= maxLength) return url
  return `${url.slice(0, maxLength - 3).trimEnd()}...`
}

function getHtmlPreview(html: string, maxLength = 600) {
  if (html.length <= maxLength) return html
  return `${html.slice(0, maxLength - 3).trimEnd()}...`
}

function normalizeSearchQuery(value: string) {
  return value.trim().toLocaleLowerCase("cs-CZ")
}

function matchesSearchQuery(
  query: string,
  values: Array<string | null | undefined>,
) {
  if (!query) return true

  return values.some((value) =>
    value?.toLocaleLowerCase("cs-CZ").includes(query),
  )
}

function formatBytes(value: number | null) {
  if (value === null) return "Neznámá velikost"
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} kB`
  return `${(value / 1024 / 1024).toFixed(1)} MB`
}

function groupVisitsByDate(visits: MonitoringVisitedPage[]) {
  const groups = new Map<string, MonitoringVisitedPage[]>()

  for (const visit of visits) {
    const date = formatDate(visit.occurredAt)
    groups.set(date, [...(groups.get(date) || []), visit])
  }

  return Array.from(groups, ([date, items]) => ({ date, items }))
}

function groupScreenshotsByDate(screenshots: MonitoringScreenshot[]) {
  const groups = new Map<string, MonitoringScreenshot[]>()

  for (const screenshot of screenshots) {
    const date = formatDate(screenshot.occurredAt)
    groups.set(date, [...(groups.get(date) || []), screenshot])
  }

  return Array.from(groups, ([date, items]) => ({ date, items }))
}

function groupFormActivitiesByDate(activities: MonitoringFormActivity[]) {
  const groups = new Map<string, MonitoringFormActivity[]>()

  for (const activity of activities) {
    const date = formatDate(activity.occurredAt)
    groups.set(date, [...(groups.get(date) || []), activity])
  }

  return Array.from(groups, ([date, items]) => ({ date, items }))
}

function getLatestSeenAt(devices: MonitoringDevice[]) {
  return devices
    .map((device) => device.lastSeenAt)
    .filter((value): value is string => Boolean(value))
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0]
}

function getSyncLabel(data: MonitoringData) {
  const activeDevices = data.devices.filter(
    (device) => device.isActive && !device.revokedAt,
  )
  if (activeDevices.some((device) => device.pendingItems > 0)) {
    return "Data čekají na odesílání"
  }

  return activeDevices.length > 0 ? "Připojeno" : "Čekám na heartbeat"
}

function getDeviceStatusLabel(device: MonitoringDevice) {
  if (device.revokedAt) return "Zneplatněno"
  return device.isActive ? "Aktivní" : "Neaktivní"
}

function getDeviceStatusClass(device: MonitoringDevice) {
  if (device.revokedAt) return "border-rose-400/25 bg-rose-500/10 text-rose-100"
  if (device.isActive) return "border-primary/50 bg-primary/15 text-white"
  return "border-white/10 bg-white/[0.04] text-zinc-300"
}

function getActivityKindLabel(kind: MonitoringFormActivity["activityKind"]) {
  if (kind === "enter") return "Enter"
  if (kind === "blur") return "Opuštění pole"
  return "Změna"
}

function isPendingPairingCode(code: MonitoringPairingCode) {
  return (
    !code.usedAt &&
    !code.revokedAt &&
    new Date(code.expiresAt).getTime() > Date.now()
  )
}

function VisitedWebTimeline({
  isPending,
  onDelete,
  visits,
}: {
  isPending: boolean
  onDelete: (eventId: string) => void
  visits: MonitoringVisitedPage[]
}) {
  const [currentPage, setCurrentPage] = useState(1)
  const [searchQuery, setSearchQuery] = useState("")
  const [eventTypeFilter, setEventTypeFilter] = useState<
    "all" | MonitoringVisitedPage["eventType"]
  >("all")
  const [privacyFilter, setPrivacyFilter] = useState<
    "all" | "normal" | "incognito"
  >("all")
  const normalizedSearchQuery = useMemo(
    () => normalizeSearchQuery(searchQuery),
    [searchQuery],
  )
  const filteredVisits = useMemo(
    () =>
      visits.filter((visit) => {
        const matchesType =
          eventTypeFilter === "all" || visit.eventType === eventTypeFilter
        const matchesPrivacy =
          privacyFilter === "all" ||
          (privacyFilter === "incognito" && visit.incognito) ||
          (privacyFilter === "normal" && !visit.incognito)

        return (
          matchesType &&
          matchesPrivacy &&
          matchesSearchQuery(normalizedSearchQuery, [
            visit.url,
            visit.title,
            visit.elementText,
            visit.elementHtml,
            visit.elementHref,
            visit.deviceName,
            visit.subName,
          ])
        )
      }),
    [eventTypeFilter, normalizedSearchQuery, privacyFilter, visits],
  )
  const totalPages = Math.max(
    1,
    Math.ceil(filteredVisits.length / MONITORING_TIMELINE_PAGE_SIZE),
  )
  const safePage = Math.min(currentPage, totalPages)
  const pageStart = (safePage - 1) * MONITORING_TIMELINE_PAGE_SIZE
  const pageEnd = pageStart + MONITORING_TIMELINE_PAGE_SIZE
  const visibleVisits = useMemo(
    () => filteredVisits.slice(pageStart, pageEnd),
    [filteredVisits, pageEnd, pageStart],
  )
  const visitGroups = useMemo(
    () => groupVisitsByDate(visibleVisits),
    [visibleVisits],
  )
  const renderPagination = (className: string) =>
    filteredVisits.length > 0 ? (
      <div
        className={`${className} flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.025] p-3 text-sm text-zinc-400 sm:flex-row sm:items-center sm:justify-between`}>
        <span>
          Zobrazeno {pageStart + 1}-{Math.min(pageEnd, filteredVisits.length)}{" "}
          z {filteredVisits.length}
        </span>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(Math.max(1, safePage - 1))}
            disabled={safePage <= 1 || isPending}
            className="border-white/10 bg-black/30 text-white hover:bg-white/10">
            Předchozí
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(Math.min(totalPages, safePage + 1))}
            disabled={safePage >= totalPages || isPending}
            className="border-white/10 bg-black/30 text-white hover:bg-white/10">
            Další
          </Button>
        </div>
      </div>
    ) : null

  return (
    <section className="min-w-0 overflow-hidden rounded-3xl border border-white/10 bg-black/30 p-5 lg:col-span-2">
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-xl font-semibold text-white">
            <Activity className="h-5 w-5 text-primary" />
            Navštívené weby
          </h2>
          <p className="mt-2 text-sm text-zinc-400">
            Chronologie z aktivních tabů a kliknutí, řazená od nejnovějších
            záznamů.
          </p>
        </div>
        <span className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">
          {filteredVisits.length === visits.length
            ? visits.length
            : `${filteredVisits.length}/${visits.length}`}
        </span>
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px_160px]">
        <div className="relative min-w-0">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <Input
            value={searchQuery}
            onChange={(event) => {
              setSearchQuery(event.target.value)
              setCurrentPage(1)
            }}
            placeholder="Hledat URL, titulek, HTML, zařízení..."
            className="h-11 rounded-2xl border-white/10 bg-black/40 pl-9 text-white placeholder:text-zinc-600"
          />
        </div>
        <select
          value={eventTypeFilter}
          onChange={(event) => {
            setEventTypeFilter(
              event.target.value as "all" | MonitoringVisitedPage["eventType"],
            )
            setCurrentPage(1)
          }}
          className={FILTER_SELECT_CLASS}>
          <option value="all">Všechny záznamy</option>
          <option value="page_visit">Jen návštěvy</option>
          <option value="element_click">Jen kliknutí</option>
        </select>
        <select
          value={privacyFilter}
          onChange={(event) => {
            setPrivacyFilter(
              event.target.value as "all" | "normal" | "incognito",
            )
            setCurrentPage(1)
          }}
          className={FILTER_SELECT_CLASS}>
          <option value="all">Všechny režimy</option>
          <option value="normal">Bez incognito</option>
          <option value="incognito">Incognito</option>
        </select>
      </div>

      {renderPagination("mt-5")}

      <div className="mt-5 grid min-w-0 gap-3">
        {visits.length === 0 ? (
          <EmptyState
            variant="compact"
            icon={Activity}
            title="Zatím nejsou synchronizované žádné záznamy."
            description="Jakmile MMM odešle návštěvy nebo kliknutí, objeví se tady."
          />
        ) : filteredVisits.length === 0 ? (
          <EmptyState
            variant="compact"
            icon={Search}
            title="Žádný záznam neodpovídá aktuálním filtrům."
            description="Uprav hledání, typ záznamu nebo režim prohlížení."
          />
        ) : (
          visitGroups.map((group) => (
            <div key={group.date} className="min-w-0">
              <p className="mt-2 text-sm font-semibold text-zinc-400">
                {group.date}
              </p>

              <div className="mt-2 grid min-w-0 gap-3">
                {group.items.map((visit) => (
                  <div
                    key={visit.id}
                    className="histoty-item min-w-0 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                    <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="history-left min-w-0 flex-1 overflow-hidden">
                        <p className="truncate text-base font-semibold text-white">
                          {visit.elementText || visit.title}
                        </p>
                        <p className="mt-1 truncate text-sm text-primary">
                          {getUrlHost(visit.url)}
                        </p>
                      </div>

                      <div className="flex shrink-0 flex-wrap gap-2 text-xs">
                        {visit.incognito ? (
                          <span className="rounded-full border border-amber-300/20 bg-amber-300/10 px-2.5 py-1 text-amber-100">
                            Incognito
                          </span>
                        ) : null}
                        {visit.eventType === "page_visit" ? (
                          <span className="rounded-full border border-white/10 bg-black/30 px-2.5 py-1 text-zinc-300">
                            {formatDuration(visit.durationMs)}
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <a
                      href={visit.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 block max-w-full break-all text-xs leading-5 text-zinc-500 transition hover:text-zinc-300">
                      {getUrlPreview(visit.url)}
                    </a>

                    {visit.eventType === "element_click" &&
                    visit.elementHtml ? (
                      <pre className="mt-3 max-h-28 overflow-auto whitespace-pre-wrap break-all rounded-2xl border border-white/10 bg-black/30 p-3 text-xs leading-5 text-zinc-300">
                        {getHtmlPreview(visit.elementHtml)}
                      </pre>
                    ) : null}

                    {visit.elementHref ? (
                      <a
                        href={visit.elementHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 block truncate text-xs text-primary transition hover:text-primary/80">
                        href: {getUrlPreview(visit.elementHref)}
                      </a>
                    ) : null}

                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-zinc-500">
                      <span>{formatDateTime(visit.occurredAt)}</span>
                      <span>•</span>
                      <span>{visit.deviceName}</span>
                      <span>•</span>
                      <span>{visit.subName}</span>
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={() => onDelete(visit.id)}
                        disabled={isPending}
                        className="ml-auto h-7 rounded-xl px-2 text-xs">
                        <Trash2 className="h-3.5 w-3.5" />
                        Smazat
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
      {renderPagination("mt-4")}
    </section>
  )
}

function FormActivityTimeline({
  activities,
  isPending,
  onDelete,
}: {
  activities: MonitoringFormActivity[]
  isPending: boolean
  onDelete: (eventId: string) => void
}) {
  const [currentPage, setCurrentPage] = useState(1)
  const [searchQuery, setSearchQuery] = useState("")
  const [activityKindFilter, setActivityKindFilter] = useState<
    "all" | MonitoringFormActivity["activityKind"]
  >("all")
  const [redactionFilter, setRedactionFilter] = useState<
    "all" | "visible" | "redacted"
  >("all")
  const [privacyFilter, setPrivacyFilter] = useState<
    "all" | "normal" | "incognito"
  >("all")
  const normalizedSearchQuery = useMemo(
    () => normalizeSearchQuery(searchQuery),
    [searchQuery],
  )
  const filteredActivities = useMemo(
    () =>
      activities.filter((activity) => {
        const matchesKind =
          activityKindFilter === "all" ||
          activity.activityKind === activityKindFilter
        const matchesRedaction =
          redactionFilter === "all" ||
          (redactionFilter === "redacted" && activity.valueRedacted) ||
          (redactionFilter === "visible" && !activity.valueRedacted)
        const matchesPrivacy =
          privacyFilter === "all" ||
          (privacyFilter === "incognito" && activity.incognito) ||
          (privacyFilter === "normal" && !activity.incognito)

        return (
          matchesKind &&
          matchesRedaction &&
          matchesPrivacy &&
          matchesSearchQuery(normalizedSearchQuery, [
            activity.url,
            activity.title,
            activity.elementHtml,
            activity.elementLabel,
            activity.elementName,
            activity.elementTagName,
            activity.elementType,
            activity.valuePreview,
            activity.deviceName,
            activity.subName,
          ])
        )
      }),
    [
      activities,
      activityKindFilter,
      normalizedSearchQuery,
      privacyFilter,
      redactionFilter,
    ],
  )
  const totalPages = Math.max(
    1,
    Math.ceil(filteredActivities.length / MONITORING_TIMELINE_PAGE_SIZE),
  )
  const safePage = Math.min(currentPage, totalPages)
  const pageStart = (safePage - 1) * MONITORING_TIMELINE_PAGE_SIZE
  const pageEnd = pageStart + MONITORING_TIMELINE_PAGE_SIZE
  const visibleActivities = useMemo(
    () => filteredActivities.slice(pageStart, pageEnd),
    [filteredActivities, pageEnd, pageStart],
  )
  const activityGroups = useMemo(
    () => groupFormActivitiesByDate(visibleActivities),
    [visibleActivities],
  )
  const renderPagination = (className: string) =>
    filteredActivities.length > 0 ? (
      <div
        className={`${className} flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.025] p-3 text-sm text-zinc-400 sm:flex-row sm:items-center sm:justify-between`}>
        <span>
          Zobrazeno {pageStart + 1}-
          {Math.min(pageEnd, filteredActivities.length)} z{" "}
          {filteredActivities.length}
        </span>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(Math.max(1, safePage - 1))}
            disabled={safePage <= 1 || isPending}
            className="border-white/10 bg-black/30 text-white hover:bg-white/10">
            Předchozí
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(Math.min(totalPages, safePage + 1))}
            disabled={safePage >= totalPages || isPending}
            className="border-white/10 bg-black/30 text-white hover:bg-white/10">
            Další
          </Button>
        </div>
      </div>
    ) : null

  return (
    <section className="min-w-0 overflow-hidden rounded-3xl border border-white/10 bg-black/30 p-5 lg:col-span-2">
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-xl font-semibold text-white">
            <FileText className="h-5 w-5 text-primary" />
            Formulářová aktivita
          </h2>
          <p className="mt-2 text-sm text-zinc-400">
            Změny ve formulářových polích, bez hesel a citlivých tokenů.
          </p>
        </div>
        <span className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">
          {filteredActivities.length === activities.length
            ? activities.length
            : `${filteredActivities.length}/${activities.length}`}
        </span>
      </div>

      <div className="mt-5 grid gap-3">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="relative min-w-0">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <Input
              value={searchQuery}
              onChange={(event) => {
                setSearchQuery(event.target.value)
                setCurrentPage(1)
              }}
              placeholder="Hledat pole, hodnotu, URL, HTML..."
              className="h-11 rounded-2xl border-white/10 bg-black/40 pl-9 text-white placeholder:text-zinc-600"
            />
          </div>
          <select
            value={activityKindFilter}
            onChange={(event) => {
              setActivityKindFilter(
                event.target.value as
                  | "all"
                  | MonitoringFormActivity["activityKind"],
              )
              setCurrentPage(1)
            }}
            className={FILTER_SELECT_CLASS}>
            <option value="all">Všechny akce</option>
            <option value="change">Změny</option>
            <option value="blur">Opuštění pole</option>
            <option value="enter">Enter</option>
          </select>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <select
            value={redactionFilter}
            onChange={(event) => {
              setRedactionFilter(
                event.target.value as "all" | "visible" | "redacted",
              )
              setCurrentPage(1)
            }}
            className={FILTER_SELECT_CLASS}>
            <option value="all">Všechny hodnoty</option>
            <option value="visible">Viditelné hodnoty</option>
            <option value="redacted">Skryté hodnoty</option>
          </select>
          <select
            value={privacyFilter}
            onChange={(event) => {
              setPrivacyFilter(
                event.target.value as "all" | "normal" | "incognito",
              )
              setCurrentPage(1)
            }}
            className={FILTER_SELECT_CLASS}>
            <option value="all">Všechny režimy</option>
            <option value="normal">Bez incognito</option>
            <option value="incognito">Incognito</option>
          </select>
        </div>
      </div>

      {renderPagination("mt-5")}

      <div className="mt-5 grid min-w-0 gap-3">
        {activities.length === 0 ? (
          <EmptyState
            variant="compact"
            icon={FileText}
            title="Zatím nejsou synchronizované žádné formulářové události."
            description="Záznamy z polí se zobrazí po další aktivitě spárované instalace."
          />
        ) : filteredActivities.length === 0 ? (
          <EmptyState
            variant="compact"
            icon={Search}
            title="Žádná formulářová událost neodpovídá aktuálním filtrům."
            description="Zkus jiné hledání, typ akce, režim nebo viditelnost hodnot."
          />
        ) : (
          activityGroups.map((group) => (
            <div key={group.date} className="min-w-0">
              <p className="mt-2 text-sm font-semibold text-zinc-400">
                {group.date}
              </p>

              <div className="mt-2 grid min-w-0 gap-3">
                {group.items.map((activity) => (
                  <div
                    key={activity.id}
                    className="min-w-0 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                    <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-base font-semibold text-white">
                          {activity.elementLabel ||
                            activity.elementName ||
                            activity.title}
                        </p>
                        <p className="mt-1 truncate text-sm text-primary">
                          {getUrlHost(activity.url)}
                        </p>
                      </div>

                      <div className="flex shrink-0 flex-wrap gap-2 text-xs">
                        {activity.incognito ? (
                          <span className="rounded-full border border-amber-300/20 bg-amber-300/10 px-2.5 py-1 text-amber-100">
                            Incognito
                          </span>
                        ) : null}
                        <span className="rounded-full border border-white/10 bg-black/30 px-2.5 py-1 text-zinc-300">
                          {activity.elementType ||
                            activity.elementTagName ||
                            "field"}
                        </span>
                        <span className="rounded-full border border-white/10 bg-black/30 px-2.5 py-1 text-zinc-300">
                          {getActivityKindLabel(activity.activityKind)}
                        </span>
                      </div>
                    </div>

                    <a
                      href={activity.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 block max-w-full break-all text-xs leading-5 text-zinc-500 transition hover:text-zinc-300">
                      {getUrlPreview(activity.url)}
                    </a>

                    <div className="mt-3 rounded-2xl border border-white/10 bg-black/30 p-3 text-sm text-zinc-300">
                      {activity.valueRedacted ? (
                        <span className="text-zinc-500">
                          Hodnota je skrytá kvůli citlivému typu pole.
                        </span>
                      ) : (
                        <span className="break-words">
                          {activity.valuePreview || "Bez hodnoty"}
                        </span>
                      )}
                      {activity.valueLength !== null ? (
                        <span className="ml-2 text-xs text-zinc-500">
                          ({activity.valueLength} znaků)
                        </span>
                      ) : null}
                    </div>

                    {activity.elementHtml ? (
                      <pre className="mt-3 max-h-28 overflow-auto whitespace-pre-wrap break-all rounded-2xl border border-white/10 bg-black/30 p-3 text-xs leading-5 text-zinc-300">
                        {getHtmlPreview(activity.elementHtml)}
                      </pre>
                    ) : null}

                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-zinc-500">
                      <span>{formatDateTime(activity.occurredAt)}</span>
                      <span>•</span>
                      <span>{activity.deviceName}</span>
                      <span>•</span>
                      <span>{activity.subName}</span>
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={() => onDelete(activity.id)}
                        disabled={isPending}
                        className="ml-auto h-7 rounded-xl px-2 text-xs">
                        <Trash2 className="h-3.5 w-3.5" />
                        Smazat
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {renderPagination("mt-4")}
    </section>
  )
}

function ScreenshotTimeline({
  isPending,
  onDelete,
  screenshots,
}: {
  isPending: boolean
  onDelete: (eventId: string) => void
  screenshots: MonitoringScreenshot[]
}) {
  const [visibleCount, setVisibleCount] = useState(MONITORING_SCREENSHOT_BATCH_SIZE)
  const visibleScreenshots = useMemo(
    () => screenshots.slice(0, visibleCount),
    [screenshots, visibleCount],
  )
  const screenshotGroups = useMemo(
    () => groupScreenshotsByDate(visibleScreenshots),
    [visibleScreenshots],
  )
  const canLoadMore = visibleCount < screenshots.length

  return (
    <section className="min-w-0 overflow-hidden rounded-3xl border border-white/10 bg-black/30 p-5 lg:col-span-4">
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-xl font-semibold text-white">
            <ImageIcon className="h-5 w-5 text-primary" />
            Snímky
          </h2>
          <p className="mt-2 text-sm text-zinc-400">
            JPEG snímky aktivního tabu uložené na Google Drive.
          </p>
        </div>
        <span className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">
          {screenshots.length}
        </span>
      </div>

      <div className="mt-5 grid min-w-0 gap-4">
        {screenshots.length === 0 ? (
          <EmptyState
            variant="compact"
            icon={ImageIcon}
            title="Zatím nejsou synchronizované žádné snímky."
            description="Nové snímky aktivního tabu se po synchronizaci zobrazí v této sekci."
          />
        ) : (
          screenshotGroups.map((group) => (
            <div key={group.date} className="min-w-0">
              <p className="text-sm font-semibold text-zinc-400">
                {group.date}
              </p>

              <div className="mt-2 grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {group.items.map((screenshot) => (
                  <article
                    key={screenshot.id}
                    className="min-w-0 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.035]">
                    <a
                      href={screenshot.imageUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="relative block aspect-video bg-black/40">
                      <Image
                        src={screenshot.thumbnailUrl}
                        alt={screenshot.title}
                        fill
                        sizes="(min-width: 1280px) 33vw, (min-width: 768px) 50vw, 100vw"
                        unoptimized
                        className="object-cover"
                        loading="lazy"
                      />
                    </a>

                    <div className="min-w-0 p-4">
                      <div className="flex min-w-0 items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-base font-semibold text-white">
                            {screenshot.title}
                          </p>
                          <p className="mt-1 truncate text-sm text-primary">
                            {getUrlHost(screenshot.url)}
                          </p>
                        </div>
                        {screenshot.incognito ? (
                          <span className="shrink-0 rounded-full border border-amber-300/20 bg-amber-300/10 px-2.5 py-1 text-xs text-amber-100">
                            Incognito
                          </span>
                        ) : null}
                      </div>

                      <a
                        href={screenshot.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 block max-w-full break-all text-xs leading-5 text-zinc-500 transition hover:text-zinc-300">
                        {getUrlPreview(screenshot.url)}
                      </a>

                      <div className="mt-3 flex flex-wrap gap-2 text-xs text-zinc-500">
                        <span>{formatDateTime(screenshot.occurredAt)}</span>
                        <span>•</span>
                        <span>{formatBytes(screenshot.sizeBytes)}</span>
                        <span>•</span>
                        <span>{screenshot.deviceName}</span>
                        <span>•</span>
                        <span>{screenshot.subName}</span>
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          onClick={() => onDelete(screenshot.id)}
                          disabled={isPending}
                          className="ml-auto h-7 rounded-xl px-2 text-xs"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Smazat
                        </Button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {canLoadMore ? (
        <div className="mt-5 flex justify-center">
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              setVisibleCount((count) =>
                Math.min(count + MONITORING_SCREENSHOT_BATCH_SIZE, screenshots.length),
              )
            }
            disabled={isPending}
            className="rounded-2xl border-white/10 bg-white/[0.04] text-white hover:bg-white/10"
          >
            Načíst další
          </Button>
        </div>
      ) : null}
    </section>
  )
}

export function MonitoringClient({ data }: MonitoringClientProps) {
  const router = useRouter()
  const toast = useToast()
  const initialActivePairingCode = data.pairingCodes.find(isPendingPairingCode)
  const [selectedSubId, setSelectedSubId] = useState(
    initialActivePairingCode?.subId || data.subAccounts[0]?.id || "",
  )
  const [generatedCode, setGeneratedCode] = useState<
    MonitoringData["generatedCode"]
  >(data.generatedCode)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const activeDevices = data.devices.filter(
    (device) => device.isActive && !device.revokedAt,
  )
  const latestSeenAt = getLatestSeenAt(data.devices)
  const syncLabel = getSyncLabel(data)

  const pendingPairingCodes = useMemo(() => {
    return data.pairingCodes.filter(isPendingPairingCode)
  }, [data.pairingCodes])

  const activePairingCode = pendingPairingCodes.find((code) => code.displayCode)
  const visiblePairingCode = generatedCode
    ? {
        code: generatedCode.code,
        expiresAt: generatedCode.expiresAt,
        label: "aktivní kód",
      }
    : activePairingCode?.displayCode
      ? {
          code: activePairingCode.displayCode,
          expiresAt: activePairingCode.expiresAt,
          label: "aktivní kód",
        }
      : null

  const createPairing = () => {
    setError(null)
    setMessage(null)
    const formData = new FormData()
    formData.set("sub_id", selectedSubId)

    startTransition(async () => {
      const result = await createMonitoringPairingCode(formData)
      if (result?.error) {
        setError(result.error)
        toast.error("Párovací kód se nepodařilo vytvořit.", result.error)
        return
      }

      if (!result?.code || !result.expiresAt) {
        const failureMessage = "Párovací kód se nepodařilo zobrazit."
        setError(failureMessage)
        toast.error("Párovací kód se nepodařilo vytvořit.", failureMessage)
        return
      }

      setGeneratedCode({
        code: result.code,
        expiresAt: result.expiresAt,
      })
      setMessage("Párovací kód byl vytvořen.")
      toast.success("Párovací kód byl vygenerován.")
      router.refresh()
    })
  }

  const renameDevice = (deviceId: string, formData: FormData) => {
    setError(null)
    setMessage(null)
    formData.set("device_id", deviceId)

    startTransition(async () => {
      const result = await renameMonitoringDevice(formData)
      if (result?.error) {
        setError(result.error)
        toast.error("Název zařízení se nepodařilo uložit.", result.error)
        return
      }

      setMessage("Název zařízení byl uložen.")
      toast.success("Název zařízení byl uložen.")
      router.refresh()
    })
  }

  const revokeDevice = (deviceId: string) => {
    if (!window.confirm("Zneplatnit tuto konkrétní instalaci extension?")) {
      return
    }

    setError(null)
    setMessage(null)
    const formData = new FormData()
    formData.set("device_id", deviceId)

    startTransition(async () => {
      const result = await revokeMonitoringDevice(formData)
      if (result?.error) {
        setError(result.error)
        toast.error("Extension se nepodařilo zneplatnit.", result.error)
        return
      }

      setMessage("Extension instalace byla zneplatněna.")
      toast.success("Extension instalace byla zneplatněna.")
      router.refresh()
    })
  }

  const deleteDevice = (deviceId: string) => {
    if (!window.confirm("Odebrat zneplatněnou instalaci ze seznamu?")) {
      return
    }

    setError(null)
    setMessage(null)
    const formData = new FormData()
    formData.set("device_id", deviceId)

    startTransition(async () => {
      const result = await deleteMonitoringDevice(formData)
      if (result?.error) {
        setError(result.error)
        toast.error("Instalaci se nepodařilo odebrat.", result.error)
        return
      }

      setMessage("Zneplatněná instalace byla odebrána.")
      toast.success("Zneplatněná instalace byla odebrána.")
      router.refresh()
    })
  }

  const deleteTimelineEvent = (eventId: string) => {
    if (!window.confirm("Smazat tuto monitoring položku z databáze?")) {
      return
    }

    setError(null)
    setMessage(null)
    const formData = new FormData()
    formData.set("event_id", eventId)

    startTransition(async () => {
      const result = await deleteMonitoringEvent(formData)
      if (result?.error) {
        setError(result.error)
        toast.error("Monitoring položku se nepodařilo smazat.", result.error)
        return
      }

      setMessage("Monitoring položka byla smazána.")
      toast.success("Monitoring položka byla smazána.")
      router.refresh()
    })
  }

  return (
    <div className="mx-auto max-w-[1500px] space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase text-primary">
            Phase 4
          </p>
          <h1 className="mt-2 flex items-center gap-3 text-4xl font-bold text-white">
            <MonitorCheck className="h-9 w-9 text-primary" />
            Monitoring
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">
            Párování MMM extension, stav instalací a heartbeat pro budoucí
            monitoring moduly.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-3xl border border-white/10 bg-black/30 px-5 py-4">
            <p className="text-2xl font-bold text-white">
              {activeDevices.length > 0 ? "Aktivní" : "Neaktivní"}
            </p>
            <p className="text-xs font-semibold uppercase text-zinc-500">
              stav extension
            </p>
          </div>
          <div className="rounded-3xl border border-white/10 bg-black/30 px-5 py-4">
            <p className="text-2xl font-bold text-white">{syncLabel}</p>
            <p className="text-xs font-semibold uppercase text-zinc-500">
              stav sync
            </p>
          </div>
          <div className="rounded-3xl border border-white/10 bg-black/30 px-5 py-4">
            <p className="text-2xl font-bold text-white">
              {data.devices.length}
            </p>
            <p className="text-xs font-semibold uppercase text-zinc-500">
              instalace
            </p>
          </div>
        </div>
      </div>

      {(error || message) && (
        <div
          role="status"
          className={`rounded-2xl border px-4 py-3 text-sm ${
            error
              ? "border-rose-400/20 bg-rose-500/10 text-rose-100"
              : "border-primary/25 bg-primary/10 text-white"
          }`}>
          {error || message}
        </div>
      )}

      <section className="rounded-3xl border border-white/10 bg-black/30 p-5">
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <h2 className="flex items-center gap-2 text-xl font-semibold text-white">
              <KeyRound className="h-5 w-5 text-primary" />
              Párovací kód
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
              Kód je jednorázový, platí 30 minut a je navázaný na vybraný SUB
              účet. Po spárování se zařízení objeví v seznamu instalací.
            </p>
          </div>

          <div className="space-y-3">
            <label className="block text-xs font-semibold uppercase text-zinc-500">
              SUB účet
            </label>
            <select
              value={selectedSubId}
              onChange={(event) => setSelectedSubId(event.target.value)}
              className="h-11 w-full rounded-2xl border border-white/10 bg-black/50 px-3 text-sm text-white outline-none transition focus:border-primary/60"
              disabled={data.subAccounts.length === 0 || isPending}>
              {data.subAccounts.length === 0 ? (
                <option value="">Žádný SUB účet</option>
              ) : (
                data.subAccounts.map((sub) => (
                  <option key={sub.id} value={sub.id}>
                    {sub.name}
                  </option>
                ))
              )}
            </select>
            <Button
              type="button"
              onClick={createPairing}
              disabled={!selectedSubId || isPending}
              className="h-11 w-full rounded-2xl bg-primary font-bold text-white hover:bg-primary/90">
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <PlugZap className="h-4 w-4" />
              )}
              Vygenerovat párovací kód
            </Button>
          </div>
        </div>

        {visiblePairingCode ? (
          <div className="mt-5 rounded-3xl border border-primary/30 bg-primary/10 p-5">
            <p className="text-xs font-semibold uppercase text-primary">
              {visiblePairingCode.label}
            </p>
            <p className="mt-2 font-mono text-4xl font-bold tracking-normal text-white">
              {visiblePairingCode.code}
            </p>
            <p className="mt-2 text-sm text-zinc-300">
              Platí do {formatDateTime(visiblePairingCode.expiresAt)}.
            </p>
          </div>
        ) : null}

        {pendingPairingCodes.length > 0 ? (
          <div className="mt-5 text-sm text-zinc-400">
            Aktivní nepoužité kódy: {pendingPairingCodes.length}
          </div>
        ) : null}
      </section>

      <section className="rounded-3xl border border-white/10 bg-black/30 p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-semibold text-white">
              <Radio className="h-5 w-5 text-primary" />
              Instalace MMM
            </h2>
            <p className="mt-2 text-sm text-zinc-400">
              Heartbeat každých {data.heartbeatIntervalMinutes} minut. Aktivní
              okno: {data.activeWindowMinutes} minut. Naposledy u počítače:{" "}
              {formatDateTime(latestSeenAt)}.
            </p>
          </div>
          {isPending ? (
            <span className="inline-flex items-center gap-2 text-sm text-primary">
              <Loader2 className="h-4 w-4 animate-spin" />
              Ukládám
            </span>
          ) : null}
        </div>

        <div className="mt-5 grid gap-4">
          {data.devices.length === 0 ? (
            <EmptyState
              variant="compact"
              icon={Radio}
              title="Zatím není spárovaná žádná instalace MMM."
              description="Vygeneruj párovací kód pro vybraný SUB účet a připoj konkrétní instalaci."
            />
          ) : (
            data.devices.map((device) => (
              <div
                key={device.id}
                className="rounded-3xl border border-white/10 bg-white/[0.035] p-4">
                <div className="grid gap-4 xl:grid-cols-[1.1fr_1fr_auto] xl:items-center">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full border px-3 py-1 text-xs font-semibold ${getDeviceStatusClass(device)}`}>
                        {getDeviceStatusLabel(device)}
                      </span>
                      <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-xs text-zinc-400">
                        {device.subName}
                      </span>
                    </div>
                    <form
                      action={(formData) => renameDevice(device.id, formData)}
                      className="mt-3 flex max-w-md gap-2">
                      <Input
                        name="name"
                        defaultValue={device.name}
                        className="h-11 rounded-2xl border-white/10 bg-black/40 text-white"
                        disabled={Boolean(device.revokedAt) || isPending}
                      />
                      <Button
                        type="submit"
                        variant="outline"
                        className="h-11 rounded-2xl border-white/10 bg-white/[0.04] text-white hover:bg-white/10"
                        disabled={Boolean(device.revokedAt) || isPending}>
                        <Pencil className="h-4 w-4" />
                        Uložit
                      </Button>
                    </form>
                  </div>

                  <div className="grid gap-2 text-sm text-zinc-400 sm:grid-cols-2">
                    <span>
                      Heartbeat:{" "}
                      <strong className="text-zinc-200">
                        {formatDateTime(device.lastHeartbeatAt)}
                      </strong>
                    </span>
                    <span>
                      Naposledy:{" "}
                      <strong className="text-zinc-200">
                        {formatDateTime(device.lastSeenAt)}
                      </strong>
                    </span>
                    <span>
                      Sync:{" "}
                      <strong className="text-zinc-200">
                        {device.pendingItems > 0
                          ? "Data čekají na odesílání"
                          : device.syncStatus === "revoked"
                            ? "Zneplatněno"
                            : "Připojeno"}
                      </strong>
                    </span>
                    <span>
                      Verze:{" "}
                      <strong className="text-zinc-200">
                        {device.extensionVersion || "Neznámá"}
                      </strong>
                    </span>
                  </div>

                  {device.revokedAt ? (
                    <Button
                      type="button"
                      variant="destructive"
                      onClick={() => deleteDevice(device.id)}
                      disabled={isPending}
                      className="h-11 rounded-2xl">
                      <Trash2 className="h-4 w-4" />
                      Odebrat
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="destructive"
                      onClick={() => revokeDevice(device.id)}
                      disabled={isPending}
                      className="h-11 rounded-2xl">
                      <ShieldX className="h-4 w-4" />
                      Zneplatnit extension
                    </Button>
                  )}
                </div>

                {device.lastError ? (
                  <p className="mt-3 rounded-2xl border border-rose-400/20 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
                    {device.lastError}
                  </p>
                ) : null}
              </div>
            ))
          )}
        </div>
      </section>

      <div className="grid min-w-0 gap-4 lg:grid-cols-4">
        <VisitedWebTimeline
          isPending={isPending}
          onDelete={deleteTimelineEvent}
          visits={data.visitedPages}
        />
        <FormActivityTimeline
          activities={data.formActivities}
          isPending={isPending}
          onDelete={deleteTimelineEvent}
        />
        <ScreenshotTimeline
          isPending={isPending}
          onDelete={deleteTimelineEvent}
          screenshots={data.screenshots}
        />
      </div>

      <section className="rounded-3xl border border-white/10 bg-black/30 p-5">
        <h2 className="flex items-center gap-2 text-xl font-semibold text-white">
          <Clock3 className="h-5 w-5 text-primary" />
          Stav scaffold fáze
        </h2>
        <div className="mt-4 flex flex-wrap gap-2 text-sm">
          {[
            "Pairing",
            "Heartbeat",
            "Více instalací",
            "DOM revoke",
            "Formulářová aktivita",
            "Snímky",
          ].map((item) => (
            <span
              key={item}
              className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-primary">
              {item}
            </span>
          ))}
        </div>
      </section>
    </div>
  )
}
