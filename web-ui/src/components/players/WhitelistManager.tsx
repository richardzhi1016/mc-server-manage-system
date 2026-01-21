import { useState } from "react"
import { Plus, Trash2, Users } from "lucide-react"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Modal } from "./Modal"
import { ConfirmModal } from "./ConfirmModal"
import type { WhitelistEntry } from "@/types/api"

interface WhitelistManagerProps {
  whitelist: WhitelistEntry[]
  onAdd: (username: string) => void
  onRemove: (username: string) => void
}

export function WhitelistManager({ whitelist, onAdd, onRemove }: WhitelistManagerProps) {
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [newUsername, setNewUsername] = useState("")
  const [removeUsername, setRemoveUsername] = useState<string | null>(null)

  const handleAdd = () => {
    if (newUsername.trim()) {
      onAdd(newUsername.trim())
      setNewUsername("")
      setAddModalOpen(false)
    }
  }

  const handleRemove = () => {
    if (removeUsername) {
      onRemove(removeUsername)
      setRemoveUsername(null)
    }
  }

  return (
    <>
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <h3 className="font-medium text-gray-900 dark:text-white">白名单</h3>
          <Button variant="outline" size="sm" onClick={() => setAddModalOpen(true)}>
            <Plus className="w-4 h-4 mr-1" />
            添加玩家
          </Button>
        </div>

        {whitelist.length === 0 ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            <Users className="w-10 h-10 mx-auto mb-3 opacity-50" />
            <p>白名单为空</p>
            <p className="text-sm mt-1">点击"添加玩家"将玩家添加到白名单</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {whitelist.map((entry) => (
              <div
                key={entry.username}
                className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-750"
              >
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">{entry.username}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{entry.uuid}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                  onClick={() => setRemoveUsername(entry.username)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal open={addModalOpen} onClose={() => setAddModalOpen(false)} title="添加玩家到白名单" size="sm">
        <div className="space-y-4">
          <Input
            placeholder="输入玩家名称"
            value={newUsername}
            onChange={(e) => setNewUsername(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAdd()
            }}
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setAddModalOpen(false)}>
              取消
            </Button>
            <Button onClick={handleAdd} disabled={!newUsername.trim()}>
              添加
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmModal
        open={!!removeUsername}
        onClose={() => setRemoveUsername(null)}
        onConfirm={handleRemove}
        title="从白名单移除"
        message={`确定要将 "${removeUsername}" 从白名单中移除吗？`}
        confirmText="移除"
        variant="danger"
      />
    </>
  )
}
