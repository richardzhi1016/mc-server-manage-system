import { AlertTriangle } from "lucide-react"
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
  confirmText = "确认",
  cancelText = "取消",
  variant = "danger",
}: ConfirmModalProps) {
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
            {cancelText}
          </Button>
          <Button
            variant={variant === "danger" ? "destructive" : variant === "warning" ? "default" : "default"}
            onClick={() => {
              onConfirm()
              onClose()
            }}
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
