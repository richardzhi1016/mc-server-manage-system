import { useState } from "react"
import { Modal } from "./Modal"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"

interface BanReasonModalProps {
  open: boolean
  onClose: () => void
  username: string
  onConfirm: (reason: string) => void
}

export function BanReasonModal({ open, onClose, username, onConfirm }: BanReasonModalProps) {
  const [reason, setReason] = useState("")

  const handleConfirm = () => {
    if (reason.trim()) {
      onConfirm(reason.trim())
      setReason("")
      onClose()
    }
  }

  const handleClose = () => {
    setReason("")
    onClose()
  }

  return (
    <Modal open={open} onClose={handleClose} title={`封禁玩家 ${username}`} size="md">
      <div className="space-y-4">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          请输入封禁原因，这将记录到服务器日志中。
        </p>
        <Input
          placeholder="输入封禁原因..."
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && reason.trim()) {
              handleConfirm()
            }
          }}
          autoFocus
        />
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={handleClose}>
            取消
          </Button>
          <Button onClick={handleConfirm} disabled={!reason.trim()}>
            继续
          </Button>
        </div>
      </div>
    </Modal>
  )
}
