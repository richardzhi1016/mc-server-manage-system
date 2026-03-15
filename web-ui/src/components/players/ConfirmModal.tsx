import { AlertTriangle } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Modal } from "./Modal"
import { Button } from "@/components/ui/Button"
import { cn } from "@/lib/utils"

interface ConfirmModalProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  variant?: "danger" | "warning" | "info"
}

export function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmText,
  cancelText,
  variant = "danger",
}: ConfirmModalProps) {
  const { t } = useTranslation('common')
  const resolvedConfirmText = confirmText ?? t('actions.confirm')
  const resolvedCancelText = cancelText ?? t('actions.cancel')
  const iconColor =
    variant === "danger" ? "text-red-500" : variant === "warning" ? "text-yellow-500" : "text-blue-500"

  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <AlertTriangle className={cn("w-6 h-6 flex-shrink-0", iconColor)} />
          <p className="text-sm text-gray-500 dark:text-gray-400">{message}</p>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            {resolvedCancelText}
          </Button>
          <Button
            variant={variant === "danger" ? "destructive" : variant === "warning" ? "default" : "default"}
            onClick={() => {
              onConfirm()
              onClose()
            }}
          >
            {resolvedConfirmText}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
