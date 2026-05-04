import type {
  MonitoringElementClickEvent,
  MonitoringFormActivityEvent,
} from "../shared/types"

type FormActivityKind = MonitoringFormActivityEvent["activityKind"]

const ELEMENT_HTML_MAX_LENGTH = 1600
const FORM_VALUE_MAX_LENGTH = 500
const DUPLICATE_WINDOW_MS = 250
const FORM_DUPLICATE_WINDOW_MS = 1000

let lastCapturedClick: { at: number; signature: string } | null = null
let lastCapturedFormActivity: { at: number; signature: string } | null = null

function createEventId() {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function getClickedElement(event: MouseEvent) {
  const pathElement = event
    .composedPath()
    .find((node): node is Element => node instanceof Element)
  const targetElement =
    event.target instanceof Element
      ? event.target
      : event.target instanceof Node
        ? event.target.parentElement
        : null
  const element = pathElement || targetElement

  if (!element) return null

  return (
    element.closest(
      "a, button, input, textarea, select, label, [role='button'], [onclick], [data-action], [data-testid]",
    ) || element
  )
}

function getElementHtml(element: Element) {
  const clone = element.cloneNode(true) as Element

  clone.querySelectorAll("script, style, noscript").forEach((node) => {
    node.remove()
  })
  clone.querySelectorAll("input, textarea").forEach((node) => {
    node.removeAttribute("value")
  })

  return clone.outerHTML
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, ELEMENT_HTML_MAX_LENGTH)
}

function getElementText(element: Element) {
  const text = element.textContent?.trim().replace(/\s+/g, " ")
  if (!text) return null
  return text.slice(0, 300)
}

function getElementHref(element: Element) {
  const anchor = element.closest("a")
  if (anchor instanceof HTMLAnchorElement) {
    return anchor.href || anchor.getAttribute("href") || null
  }

  const href = element.getAttribute("href")
  if (!href) return null

  try {
    return new URL(href, window.location.href).toString()
  } catch {
    return href
  }
}

function getFormElement(event: Event) {
  const pathElement = event
    .composedPath()
    .find((node): node is Element => node instanceof Element)
  const targetElement =
    event.target instanceof Element
      ? event.target
      : event.target instanceof Node
        ? event.target.parentElement
        : null
  const element = pathElement || targetElement

  if (!element) return null

  const field = element.closest("input, textarea, select, [contenteditable]")
  if (!field) return null
  if (field instanceof HTMLElement && field.isContentEditable) return field
  if (
    field instanceof HTMLInputElement ||
    field instanceof HTMLTextAreaElement ||
    field instanceof HTMLSelectElement
  ) {
    return field
  }

  return null
}

function getFieldLabel(element: Element) {
  if (element.id) {
    try {
      const label = document.querySelector(
        `label[for="${CSS.escape(element.id)}"]`,
      )
      const text = label?.textContent?.trim().replace(/\s+/g, " ")
      if (text) return text.slice(0, 200)
    } catch {
      // Ignore invalid selectors from unusual element ids.
    }
  }

  const parentLabel = element.closest("label")
  const parentLabelText = parentLabel?.textContent?.trim().replace(/\s+/g, " ")
  if (parentLabelText) return parentLabelText.slice(0, 200)

  const ariaLabel = element
    .getAttribute("aria-label")
    ?.trim()
    .replace(/\s+/g, " ")
  if (ariaLabel) return ariaLabel.slice(0, 200)

  const placeholder = element
    .getAttribute("placeholder")
    ?.trim()
    .replace(/\s+/g, " ")
  if (placeholder) return placeholder.slice(0, 200)

  return null
}

function getFieldName(element: Element) {
  const name =
    element.getAttribute("name") ||
    element.getAttribute("id") ||
    element.getAttribute("data-testid") ||
    null

  return name?.trim().replace(/\s+/g, " ").slice(0, 200) || null
}

function getFieldType(element: Element) {
  if (element instanceof HTMLInputElement) return element.type || "text"
  if (element instanceof HTMLTextAreaElement) return "textarea"
  if (element instanceof HTMLSelectElement) return "select"
  if (element instanceof HTMLElement && element.isContentEditable) {
    return "contenteditable"
  }

  return null
}

function isSensitiveField(element: Element) {
  const type = getFieldType(element)
  if (
    //type === "password" ||
    type === "email" ||
    type === "file" ||
    type === "hidden" ||
    type === "tel"
  ) {
    return true
  }

  const signature = [
    getFieldName(element),
    getFieldLabel(element),
    element.getAttribute("autocomplete"),
    element.getAttribute("inputmode"),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()

  return /password|passwd|pwd|heslo|secret|token|auth|bearer|otp|pin|credit|card|iban|ssn/.test(
    signature,
  )
}

function getFieldValue(element: Element): {
  length: number | null
  preview: string | null
  redacted: boolean
} {
  if (isSensitiveField(element)) {
    const length =
      element instanceof HTMLInputElement ||
      element instanceof HTMLTextAreaElement
        ? element.value.length
        : null

    return { length, preview: null, redacted: true }
  }

  if (element instanceof HTMLInputElement) {
    if (element.type === "checkbox" || element.type === "radio") {
      return {
        length: null,
        preview: element.checked ? "checked" : "unchecked",
        redacted: false,
      }
    }

    const value = element.value.trim().replace(/\s+/g, " ")
    return {
      length: element.value.length,
      preview: value ? value.slice(0, FORM_VALUE_MAX_LENGTH) : null,
      redacted: false,
    }
  }

  if (element instanceof HTMLTextAreaElement) {
    const value = element.value.trim().replace(/\s+/g, " ")
    return {
      length: element.value.length,
      preview: value ? value.slice(0, FORM_VALUE_MAX_LENGTH) : null,
      redacted: false,
    }
  }

  if (element instanceof HTMLSelectElement) {
    const value = Array.from(element.selectedOptions)
      .map((option) => option.textContent?.trim() || option.value)
      .filter(Boolean)
      .join(", ")
      .replace(/\s+/g, " ")

    return {
      length: value.length,
      preview: value ? value.slice(0, FORM_VALUE_MAX_LENGTH) : null,
      redacted: false,
    }
  }

  if (element instanceof HTMLElement && element.isContentEditable) {
    const value = element.textContent?.trim().replace(/\s+/g, " ") || ""
    return {
      length: element.textContent?.length || 0,
      preview: value ? value.slice(0, FORM_VALUE_MAX_LENGTH) : null,
      redacted: false,
    }
  }

  return { length: null, preview: null, redacted: false }
}

function captureElementClick(event: MouseEvent) {
  const element = getClickedElement(event)
  if (!element) return

  const elementHtml = getElementHtml(element)
  const signature = `${window.location.href}|${elementHtml}`
  const now = Date.now()

  if (
    lastCapturedClick?.signature === signature &&
    now - lastCapturedClick.at < DUPLICATE_WINDOW_MS
  ) {
    return
  }

  lastCapturedClick = { at: now, signature }

  const monitoringEvent: MonitoringElementClickEvent = {
    elementHtml,
    elementHref: getElementHref(element),
    elementTagName: element.tagName.toLowerCase(),
    elementText: getElementText(element),
    eventId: createEventId(),
    incognito: false,
    occurredAt: new Date().toISOString(),
    pageUrl: window.location.href,
    title: document.title || null,
    type: "element_click",
  }

  void chrome.runtime
    .sendMessage({
      event: monitoringEvent,
      type: "mmm:element-click",
    })
    .catch(() => null)
}

function captureFormActivity(event: Event, activityKind?: FormActivityKind) {
  const element = getFormElement(event)
  if (!element) return

  const resolvedActivityKind =
    activityKind || (event.type === "change" ? "change" : "blur")
  const value = getFieldValue(element)
  const elementHtml = getElementHtml(element)
  const signature = [
    window.location.href,
    resolvedActivityKind,
    elementHtml,
    value.preview,
    value.length,
    value.redacted,
  ].join("|")
  const now = Date.now()

  if (
    lastCapturedFormActivity?.signature === signature &&
    now - lastCapturedFormActivity.at < FORM_DUPLICATE_WINDOW_MS
  ) {
    return
  }

  lastCapturedFormActivity = { at: now, signature }

  const monitoringEvent: MonitoringFormActivityEvent = {
    activityKind: resolvedActivityKind,
    elementHtml,
    elementLabel: getFieldLabel(element),
    elementName: getFieldName(element),
    elementTagName: element.tagName.toLowerCase(),
    elementType: getFieldType(element),
    eventId: createEventId(),
    incognito: false,
    occurredAt: new Date().toISOString(),
    pageUrl: window.location.href,
    title: document.title || null,
    type: "form_activity",
    valueLength: value.length,
    valuePreview: value.preview,
    valueRedacted: value.redacted,
  }

  void chrome.runtime
    .sendMessage({
      event: monitoringEvent,
      type: "mmm:form-activity",
    })
    .catch(() => null)
}

function captureEnterFormActivity(event: KeyboardEvent) {
  if (event.key !== "Enter" || event.repeat || event.isComposing) return
  captureFormActivity(event, "enter")
}

document.addEventListener("pointerdown", captureElementClick, true)
document.addEventListener("click", captureElementClick, true)
document.addEventListener("change", captureFormActivity, true)
document.addEventListener("blur", captureFormActivity, true)
document.addEventListener("keydown", captureEnterFormActivity, true)
