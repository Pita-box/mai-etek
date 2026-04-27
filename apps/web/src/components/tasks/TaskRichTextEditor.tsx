'use client';

import { useEffect, useMemo, useRef } from 'react';
import { Bold, Italic, Link as LinkIcon, List, ListOrdered, ImagePlus, Video } from 'lucide-react';
import { sanitizeRichTextHtml } from '@/lib/task-rich-text';

type TaskRichTextEditorProps = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
};

const toolbarButtonClassName =
  'inline-flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs font-semibold text-zinc-200 transition hover:border-primary/40 hover:text-white disabled:cursor-not-allowed disabled:opacity-40';

export function TaskRichTextEditor({ value, onChange, disabled = false }: TaskRichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const isSyncingRef = useRef(false);

  const normalizedValue = useMemo(() => sanitizeRichTextHtml(value), [value]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const isFocused = document.activeElement === editor;
    if (isFocused) {
      return;
    }

    if (editor.innerHTML !== normalizedValue) {
      isSyncingRef.current = true;
      editor.innerHTML = normalizedValue;
      isSyncingRef.current = false;
    }
  }, [normalizedValue]);

  const emitChange = () => {
    const editor = editorRef.current;
    if (!editor || isSyncingRef.current) return;
    onChange(sanitizeRichTextHtml(editor.innerHTML));
  };

  const normalizeEditorDom = () => {
    const editor = editorRef.current;
    if (!editor) return;

    const sanitized = sanitizeRichTextHtml(editor.innerHTML);
    if (editor.innerHTML !== sanitized) {
      isSyncingRef.current = true;
      editor.innerHTML = sanitized;
      isSyncingRef.current = false;
    }
  };

  const focusEditor = () => {
    requestAnimationFrame(() => {
      editorRef.current?.focus();
    });
  };

  const applyCommand = (command: 'bold' | 'italic' | 'insertUnorderedList' | 'insertOrderedList') => {
    if (disabled) return;
    editorRef.current?.focus();
    document.execCommand(command);
    emitChange();
    focusEditor();
  };

  const insertLink = () => {
    if (disabled) return;
    const href = window.prompt('Vlož URL odkazu');
    if (!href) return;
    editorRef.current?.focus();
    document.execCommand('createLink', false, href);
    emitChange();
    focusEditor();
  };

  const insertMedia = (kind: 'image' | 'video') => {
    if (disabled) return;
    const href = window.prompt(kind === 'image' ? 'Vlož URL obrázku' : 'Vlož URL videa');
    if (!href) return;

    const editor = editorRef.current;
    if (!editor) return;

    const safeUrl = href.trim();
    editor.focus();
    document.execCommand('insertHTML', false, kind === 'image' ? `<img src="${safeUrl}" alt="Vložený obrázek" />` : `<video controls preload="metadata" src="${safeUrl}"></video>`);
    emitChange();
    focusEditor();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 rounded-2xl border border-white/10 bg-white/[0.04] p-2">
        <button type="button" onClick={() => applyCommand('bold')} disabled={disabled} className={toolbarButtonClassName}>
          <Bold className="h-4 w-4" />
          Tučně
        </button>
        <button type="button" onClick={() => applyCommand('italic')} disabled={disabled} className={toolbarButtonClassName}>
          <Italic className="h-4 w-4" />
          Kurzíva
        </button>
        <button type="button" onClick={() => applyCommand('insertUnorderedList')} disabled={disabled} className={toolbarButtonClassName}>
          <List className="h-4 w-4" />
          Odrážky
        </button>
        <button type="button" onClick={() => applyCommand('insertOrderedList')} disabled={disabled} className={toolbarButtonClassName}>
          <ListOrdered className="h-4 w-4" />
          Číslování
        </button>
        <button type="button" onClick={insertLink} disabled={disabled} className={toolbarButtonClassName}>
          <LinkIcon className="h-4 w-4" />
          Odkaz
        </button>
        <button type="button" onClick={() => insertMedia('image')} disabled={disabled} className={toolbarButtonClassName}>
          <ImagePlus className="h-4 w-4" />
          Obrázek z URL
        </button>
        <button type="button" onClick={() => insertMedia('video')} disabled={disabled} className={toolbarButtonClassName}>
          <Video className="h-4 w-4" />
          Video z URL
        </button>
      </div>

      <div
        ref={editorRef}
        contentEditable={!disabled}
        suppressContentEditableWarning
        onInput={emitChange}
        onBlur={() => {
          emitChange();
          normalizeEditorDom();
        }}
        className="min-h-[20svh] w-full overflow-y-auto rounded-[1.5rem] border border-white/10 bg-black/40 px-4 py-4 text-sm leading-7 text-white focus:outline-none focus:ring-2 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-70 md:min-h-[30svh]"
        data-placeholder="Popiš detailně, jak jsi úkol splnil. Formátování se zobrazuje rovnou při psaní."
        aria-label="Textové odevzdání úkolu"
      />

      <p className="text-xs leading-6 text-zinc-500">
        Formátování vidíš rovnou při psaní. Odkazy, obrázky a přímá videa z URL se před uložením bezpečně pročistí.
      </p>
    </div>
  );
}
