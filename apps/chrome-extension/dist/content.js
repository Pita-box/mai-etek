/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	// The require scope
/******/ 	var __webpack_require__ = {};
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/make namespace object */
/******/ 	(() => {
/******/ 		// define __esModule on exports
/******/ 		__webpack_require__.r = (exports) => {
/******/ 			if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 				Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 			}
/******/ 			Object.defineProperty(exports, '__esModule', { value: true });
/******/ 		};
/******/ 	})();
/******/ 	
/************************************************************************/
var __webpack_exports__ = {};
/*!******************************!*\
  !*** ./src/content/index.ts ***!
  \******************************/
__webpack_require__.r(__webpack_exports__);
const ELEMENT_HTML_MAX_LENGTH = 1600;
const FORM_VALUE_MAX_LENGTH = 500;
const DUPLICATE_WINDOW_MS = 250;
const FORM_DUPLICATE_WINDOW_MS = 1000;
let lastCapturedClick = null;
let lastCapturedFormActivity = null;
function createEventId() {
    if (typeof crypto.randomUUID === "function")
        return crypto.randomUUID();
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
function getClickedElement(event) {
    const pathElement = event
        .composedPath()
        .find((node) => node instanceof Element);
    const targetElement = event.target instanceof Element
        ? event.target
        : event.target instanceof Node
            ? event.target.parentElement
            : null;
    const element = pathElement || targetElement;
    if (!element)
        return null;
    return (element.closest("a, button, input, textarea, select, label, [role='button'], [onclick], [data-action], [data-testid]") || element);
}
function getElementHtml(element) {
    const clone = element.cloneNode(true);
    clone.querySelectorAll("script, style, noscript").forEach((node) => {
        node.remove();
    });
    clone.querySelectorAll("input, textarea").forEach((node) => {
        node.removeAttribute("value");
    });
    return clone.outerHTML
        .trim()
        .replace(/\s+/g, " ")
        .slice(0, ELEMENT_HTML_MAX_LENGTH);
}
function getElementText(element) {
    const text = element.textContent?.trim().replace(/\s+/g, " ");
    if (!text)
        return null;
    return text.slice(0, 300);
}
function getElementHref(element) {
    const anchor = element.closest("a");
    if (anchor instanceof HTMLAnchorElement) {
        return anchor.href || anchor.getAttribute("href") || null;
    }
    const href = element.getAttribute("href");
    if (!href)
        return null;
    try {
        return new URL(href, window.location.href).toString();
    }
    catch {
        return href;
    }
}
function getFormElement(event) {
    const pathElement = event
        .composedPath()
        .find((node) => node instanceof Element);
    const targetElement = event.target instanceof Element
        ? event.target
        : event.target instanceof Node
            ? event.target.parentElement
            : null;
    const element = pathElement || targetElement;
    if (!element)
        return null;
    const field = element.closest("input, textarea, select, [contenteditable]");
    if (!field)
        return null;
    if (field instanceof HTMLElement && field.isContentEditable)
        return field;
    if (field instanceof HTMLInputElement ||
        field instanceof HTMLTextAreaElement ||
        field instanceof HTMLSelectElement) {
        return field;
    }
    return null;
}
function getFieldLabel(element) {
    if (element.id) {
        try {
            const label = document.querySelector(`label[for="${CSS.escape(element.id)}"]`);
            const text = label?.textContent?.trim().replace(/\s+/g, " ");
            if (text)
                return text.slice(0, 200);
        }
        catch {
            // Ignore invalid selectors from unusual element ids.
        }
    }
    const parentLabel = element.closest("label");
    const parentLabelText = parentLabel?.textContent?.trim().replace(/\s+/g, " ");
    if (parentLabelText)
        return parentLabelText.slice(0, 200);
    const ariaLabel = element
        .getAttribute("aria-label")
        ?.trim()
        .replace(/\s+/g, " ");
    if (ariaLabel)
        return ariaLabel.slice(0, 200);
    const placeholder = element
        .getAttribute("placeholder")
        ?.trim()
        .replace(/\s+/g, " ");
    if (placeholder)
        return placeholder.slice(0, 200);
    return null;
}
function getFieldName(element) {
    const name = element.getAttribute("name") ||
        element.getAttribute("id") ||
        element.getAttribute("data-testid") ||
        null;
    return name?.trim().replace(/\s+/g, " ").slice(0, 200) || null;
}
function getFieldType(element) {
    if (element instanceof HTMLInputElement)
        return element.type || "text";
    if (element instanceof HTMLTextAreaElement)
        return "textarea";
    if (element instanceof HTMLSelectElement)
        return "select";
    if (element instanceof HTMLElement && element.isContentEditable) {
        return "contenteditable";
    }
    return null;
}
function isSensitiveField(element) {
    const type = getFieldType(element);
    if (
    //type === "password" ||
    type === "email" ||
        type === "file" ||
        type === "hidden" ||
        type === "tel") {
        return true;
    }
    const signature = [
        getFieldName(element),
        getFieldLabel(element),
        element.getAttribute("autocomplete"),
        element.getAttribute("inputmode"),
    ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
    return /password|passwd|pwd|heslo|secret|token|auth|bearer|otp|pin|credit|card|iban|ssn/.test(signature);
}
function getFieldValue(element) {
    if (isSensitiveField(element)) {
        const length = element instanceof HTMLInputElement ||
            element instanceof HTMLTextAreaElement
            ? element.value.length
            : null;
        return { length, preview: null, redacted: true };
    }
    if (element instanceof HTMLInputElement) {
        if (element.type === "checkbox" || element.type === "radio") {
            return {
                length: null,
                preview: element.checked ? "checked" : "unchecked",
                redacted: false,
            };
        }
        const value = element.value.trim().replace(/\s+/g, " ");
        return {
            length: element.value.length,
            preview: value ? value.slice(0, FORM_VALUE_MAX_LENGTH) : null,
            redacted: false,
        };
    }
    if (element instanceof HTMLTextAreaElement) {
        const value = element.value.trim().replace(/\s+/g, " ");
        return {
            length: element.value.length,
            preview: value ? value.slice(0, FORM_VALUE_MAX_LENGTH) : null,
            redacted: false,
        };
    }
    if (element instanceof HTMLSelectElement) {
        const value = Array.from(element.selectedOptions)
            .map((option) => option.textContent?.trim() || option.value)
            .filter(Boolean)
            .join(", ")
            .replace(/\s+/g, " ");
        return {
            length: value.length,
            preview: value ? value.slice(0, FORM_VALUE_MAX_LENGTH) : null,
            redacted: false,
        };
    }
    if (element instanceof HTMLElement && element.isContentEditable) {
        const value = element.textContent?.trim().replace(/\s+/g, " ") || "";
        return {
            length: element.textContent?.length || 0,
            preview: value ? value.slice(0, FORM_VALUE_MAX_LENGTH) : null,
            redacted: false,
        };
    }
    return { length: null, preview: null, redacted: false };
}
function captureElementClick(event) {
    const element = getClickedElement(event);
    if (!element)
        return;
    const elementHtml = getElementHtml(element);
    const signature = `${window.location.href}|${elementHtml}`;
    const now = Date.now();
    if (lastCapturedClick?.signature === signature &&
        now - lastCapturedClick.at < DUPLICATE_WINDOW_MS) {
        return;
    }
    lastCapturedClick = { at: now, signature };
    const monitoringEvent = {
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
    };
    void chrome.runtime
        .sendMessage({
        event: monitoringEvent,
        type: "mmm:element-click",
    })
        .catch(() => null);
}
function captureFormActivity(event, activityKind) {
    const element = getFormElement(event);
    if (!element)
        return;
    const resolvedActivityKind = activityKind || (event.type === "change" ? "change" : "blur");
    const value = getFieldValue(element);
    const elementHtml = getElementHtml(element);
    const signature = [
        window.location.href,
        resolvedActivityKind,
        elementHtml,
        value.preview,
        value.length,
        value.redacted,
    ].join("|");
    const now = Date.now();
    if (lastCapturedFormActivity?.signature === signature &&
        now - lastCapturedFormActivity.at < FORM_DUPLICATE_WINDOW_MS) {
        return;
    }
    lastCapturedFormActivity = { at: now, signature };
    const monitoringEvent = {
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
    };
    void chrome.runtime
        .sendMessage({
        event: monitoringEvent,
        type: "mmm:form-activity",
    })
        .catch(() => null);
}
function captureEnterFormActivity(event) {
    if (event.key !== "Enter" || event.repeat || event.isComposing)
        return;
    captureFormActivity(event, "enter");
}
document.addEventListener("pointerdown", captureElementClick, true);
document.addEventListener("click", captureElementClick, true);
document.addEventListener("change", captureFormActivity, true);
document.addEventListener("blur", captureFormActivity, true);
document.addEventListener("keydown", captureEnterFormActivity, true);


/******/ })()
;