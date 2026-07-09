import { toast as sonnerToast } from 'sonner'

export function useToast() {
  return {
    success: (title: string, description?: string) =>
      sonnerToast.success(title, { description }),
    error: (title: string, description?: string) =>
      sonnerToast.error(title, { description }),
    info: (title: string, description?: string) =>
      sonnerToast(title, { description }),
    warning: (title: string, description?: string) =>
      sonnerToast.warning(title, { description }),
    loading: (title: string, description?: string) =>
      sonnerToast.loading(title, { description }),
    promise: sonnerToast.promise,
    dismiss: sonnerToast.dismiss,
    action: (title: string, action: { label: string; onClick: () => void }) =>
      sonnerToast(title, {
        action: { label: action.label, onClick: action.onClick },
      }),
  }
}
