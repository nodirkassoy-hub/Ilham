import { create } from 'zustand'

export interface Toast {
  id: string
  kind: 'success' | 'error' | 'info' | 'warning'
  title: string
  body?: string
}

interface ToastState {
  toasts: Toast[]
  push: (t: Omit<Toast, 'id'>) => void
  dismiss: (id: string) => void
}

export const useToast = create<ToastState>((set) => ({
  toasts: [],
  push: (t) => {
    const id = Math.random().toString(36).slice(2)
    set((s) => ({ toasts: [...s.toasts, { ...t, id }].slice(-4) }))
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })), t.kind === 'error' ? 6500 : 4200)
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),
}))

export const toast = {
  success: (title: string, body?: string) => useToast.getState().push({ kind: 'success', title, body }),
  error: (title: string, body?: string) => useToast.getState().push({ kind: 'error', title, body }),
  info: (title: string, body?: string) => useToast.getState().push({ kind: 'info', title, body }),
  warning: (title: string, body?: string) => useToast.getState().push({ kind: 'warning', title, body }),
}
