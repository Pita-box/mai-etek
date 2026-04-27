const URL_REGEX = /(https?:\/\/[^\s<]+)/gi;
const IMAGE_REGEX = /\.(png|jpe?g|gif|webp|svg)(\?.*)?$/i;
const VIDEO_REGEX = /\.(mp4|webm|ogg|mov)(\?.*)?$/i;

const ALLOWED_TAGS = new Set([
  'A',
  'B',
  'BR',
  'DIV',
  'EM',
  'FIGCAPTION',
  'FIGURE',
  'I',
  'IMG',
  'LI',
  'OL',
  'P',
  'SPAN',
  'STRONG',
  'U',
  'UL',
  'VIDEO',
]);

function escapeHtml(input: string) {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normalizeUrl(raw: string) {
  try {
    const url = new URL(raw);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

function isImageUrl(text: string) {
  const url = normalizeUrl(text.trim());
  return url && IMAGE_REGEX.test(url) ? url : null;
}

function isVideoUrl(text: string) {
  const url = normalizeUrl(text.trim());
  return url && VIDEO_REGEX.test(url) ? url : null;
}

function renderInlineText(text: string) {
  const escaped = escapeHtml(text);
  return escaped.replace(URL_REGEX, (match) => {
    const url = normalizeUrl(match);
    if (!url) return match;
    return `<a href="${url}" target="_blank" rel="noreferrer noopener" class="font-medium text-primary underline decoration-primary/50 underline-offset-4 break-all">${match}</a>`;
  });
}

function renderPlainTextAsHtml(input: string) {
  const lines = input.replace(/\r\n/g, '\n').split('\n');
  const html: string[] = [];
  let listType: 'ul' | 'ol' | null = null;

  const closeList = () => {
    if (listType) {
      html.push(`</${listType}>`);
      listType = null;
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) {
      closeList();
      continue;
    }

    const imageUrl = isImageUrl(line);
    if (imageUrl) {
      closeList();
      html.push(`<figure class="my-4 overflow-hidden rounded-2xl border border-white/10 bg-black/30"><img src="${imageUrl}" alt="Vložený obrázek" class="h-auto w-full object-cover" /></figure>`);
      continue;
    }

    const videoUrl = isVideoUrl(line);
    if (videoUrl) {
      closeList();
      html.push(`<figure class="my-4 overflow-hidden rounded-2xl border border-white/10 bg-black/30"><video controls preload="metadata" class="w-full" src="${videoUrl}"></video></figure>`);
      continue;
    }

    const unorderedMatch = rawLine.match(/^\s*[-*]\s+(.+)$/);
    if (unorderedMatch) {
      if (listType !== 'ul') {
        closeList();
        listType = 'ul';
        html.push('<ul class="my-3 list-disc space-y-2 pl-6">');
      }
      html.push(`<li>${renderInlineText(unorderedMatch[1])}</li>`);
      continue;
    }

    const orderedMatch = rawLine.match(/^\s*\d+[.)]\s+(.+)$/);
    if (orderedMatch) {
      if (listType !== 'ol') {
        closeList();
        listType = 'ol';
        html.push('<ol class="my-3 list-decimal space-y-2 pl-6">');
      }
      html.push(`<li>${renderInlineText(orderedMatch[1])}</li>`);
      continue;
    }

    closeList();
    html.push(`<p class="my-3 leading-7 text-zinc-200">${renderInlineText(rawLine)}</p>`);
  }

  closeList();
  return html.join('');
}

function sanitizeNode(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return renderInlineText(node.textContent || '');
  }

  if (!(node instanceof HTMLElement)) {
    return '';
  }

  const tagName = node.tagName.toUpperCase();
  if (!ALLOWED_TAGS.has(tagName)) {
    return Array.from(node.childNodes).map(sanitizeNode).join('');
  }

  if (tagName === 'BR') {
    return '<br />';
  }

  if (tagName === 'A') {
    const href = normalizeUrl(node.getAttribute('href') || '');
    const children = Array.from(node.childNodes).map(sanitizeNode).join('') || escapeHtml(node.textContent || href || '');
    if (!href) {
      return children;
    }
    return `<a href="${href}" target="_blank" rel="noreferrer noopener" class="font-medium text-primary underline decoration-primary/50 underline-offset-4 break-all">${children}</a>`;
  }

  if (tagName === 'IMG') {
    const src = normalizeUrl(node.getAttribute('src') || '');
    if (!src || !IMAGE_REGEX.test(src)) return '';
    const alt = escapeHtml(node.getAttribute('alt') || 'Vložený obrázek');
    return `<figure class="my-4 overflow-hidden rounded-2xl border border-white/10 bg-black/30"><img src="${src}" alt="${alt}" class="h-auto w-full object-cover" /></figure>`;
  }

  if (tagName === 'VIDEO') {
    const src = normalizeUrl(node.getAttribute('src') || '');
    if (!src || !VIDEO_REGEX.test(src)) return '';
    return `<figure class="my-4 overflow-hidden rounded-2xl border border-white/10 bg-black/30"><video controls preload="metadata" class="w-full" src="${src}"></video></figure>`;
  }

  const children = Array.from(node.childNodes).map(sanitizeNode).join('');

  if (tagName === 'DIV' || tagName === 'P') {
    if (!children.trim()) {
      return '';
    }
    return `<p class="my-3 leading-7 text-zinc-200">${children}</p>`;
  }

  if (tagName === 'UL') {
    return `<ul class="my-3 list-disc space-y-2 pl-6">${children}</ul>`;
  }

  if (tagName === 'OL') {
    return `<ol class="my-3 list-decimal space-y-2 pl-6">${children}</ol>`;
  }

  if (tagName === 'LI') {
    return `<li>${children}</li>`;
  }

  if (tagName === 'FIGURE') {
    return children;
  }

  if (tagName === 'SPAN') {
    return children;
  }

  const normalizedTag = tagName.toLowerCase();
  return `<${normalizedTag}>${children}</${normalizedTag}>`;
}

export function sanitizeRichTextHtml(input: string) {
  const trimmed = input.trim();
  if (!trimmed) return '';

  if (typeof window === 'undefined') {
    return trimmed.includes('<') ? trimmed : renderPlainTextAsHtml(trimmed);
  }

  if (!trimmed.includes('<')) {
    return renderPlainTextAsHtml(trimmed);
  }

  const parser = new DOMParser();
  const document = parser.parseFromString(trimmed, 'text/html');
  return Array.from(document.body.childNodes).map(sanitizeNode).join('');
}

export function richTextToHtml(input: string) {
  return sanitizeRichTextHtml(input);
}

export function htmlToPlainText(input: string) {
  if (!input.trim()) return '';

  if (typeof window === 'undefined') {
    return input.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  }

  const parser = new DOMParser();
  const document = parser.parseFromString(input, 'text/html');
  return document.body.textContent?.replace(/\s+/g, ' ').trim() || '';
}

export function hasRichTextContent(input: string | null | undefined) {
  return Boolean(htmlToPlainText(input || ''));
}
