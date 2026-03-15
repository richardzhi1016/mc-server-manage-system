import { useState } from "react"
import { useTranslation } from "react-i18next"
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
  const { t } = useTranslation('players')
  const { t: tc } = useTranslation('common')
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
    <Modal open={open} onClose={handleClose} title={t('ban.title', { username })} size="md">
      <div className="space-y-4">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {t('ban.reasonLabel')}
        </p>
        <Input
          placeholder={t('ban.placeholder')}
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
            {tc('actions.cancel')}
          </Button>
          <Button onClick={handleConfirm} disabled={!reason.trim()}>
            {t('ban.continue')}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
