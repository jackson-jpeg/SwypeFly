// ─── Toast Notification Store ────────────────────────────────────────────────

import { create } from 'zustand';
import { animation } from '../constants/theme';

export type ToastType = 'success' | 'error' | 'info';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  action?: { label: string; onPress: () => void };
}

interface ToastState {
  toasts: Toast[];
  addToast: (message: string, type: ToastType, action?: Toast['action']) => void;
  removeToast: (id: string) => void;
}

let _id = 0;

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  addToast: (message, type, action) => {
    const id = String(++_id);
    set((state) => ({
      toasts: [...state.toasts, { id, message, type, action }],
    }));
    // Auto-dismiss after duration
    setTimeout(() => {
      set((state) => ({
        toasts: state.toasts.filter((t) => t.id !== id),
      }));
    }, action ? animation.toastDuration * 2 : animation.toastDuration);
  },
  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),
}));

// ─── Convenience helpers ─────────────────────────────────────────────────────

export function showToast(message: string, action?: Toast['action']) {
  useToastStore.getState().addToast(message, 'info', action);
}

export function showSuccess(message: string) {
  useToastStore.getState().addToast(message, 'success');
}

export function showError(message: string) {
  useToastStore.getState().addToast(message, 'error');
}

export function showUndoToast(message: string, onUndo: () => void) {
  useToastStore.getState().addToast(message, 'info', { label: 'Undo', onPress: onUndo });
}
