"use client";

import { useCallback, useSyncExternalStore } from "react";

export type ToastType = "success" | "error" | "info";

export type ToastInput = {
  description?: string;
  duration?: number;
  id?: string;
  title: string;
  type?: ToastType;
};

export type ToastItem = Required<Pick<ToastInput, "id" | "title" | "type">> & {
  createdAt: number;
  description?: string;
  duration: number;
};

const MAX_TOASTS = 3;

const defaultDurations: Record<ToastType, number> = {
  error: 6000,
  info: 4500,
  success: 3500,
};

let toastItems: ToastItem[] = [];
const listeners = new Set<() => void>();

function createToastId() {
  return `toast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function emitChange() {
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return toastItems;
}

export function showToast(input: ToastInput) {
  const type = input.type || "info";
  const item: ToastItem = {
    createdAt: Date.now(),
    duration: input.duration ?? defaultDurations[type],
    id: input.id || createToastId(),
    title: input.title,
    type,
    ...(input.description ? { description: input.description } : {}),
  };

  toastItems = [
    item,
    ...toastItems.filter((toastItem) => toastItem.id !== item.id),
  ].slice(0, MAX_TOASTS);
  emitChange();

  return item.id;
}

export function dismissToast(id: string) {
  toastItems = toastItems.filter((toastItem) => toastItem.id !== id);
  emitChange();
}

export function clearToasts() {
  toastItems = [];
  emitChange();
}

export function useToastStore() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function useToast() {
  const toast = useCallback((input: ToastInput) => showToast(input), []);
  const success = useCallback(
    (title: string, description?: string, input?: Omit<ToastInput, "title" | "description" | "type">) =>
      showToast({ ...input, description, title, type: "success" }),
    [],
  );
  const error = useCallback(
    (title: string, description?: string, input?: Omit<ToastInput, "title" | "description" | "type">) =>
      showToast({ ...input, description, title, type: "error" }),
    [],
  );
  const info = useCallback(
    (title: string, description?: string, input?: Omit<ToastInput, "title" | "description" | "type">) =>
      showToast({ ...input, description, title, type: "info" }),
    [],
  );
  const dismiss = useCallback((id: string) => dismissToast(id), []);
  const clear = useCallback(() => clearToasts(), []);

  return {
    clear,
    dismiss,
    error,
    info,
    success,
    toast,
  };
}
