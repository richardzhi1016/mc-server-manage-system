import type { RetentionData } from '@/types/api'

interface Props {
  data: RetentionData | null
}

export function PlayerRetention({ data }: Props) {
  if (!data) {
    return <p className="text-mrinth-muted text-sm text-center py-8">数据积累中，玩家活动后将显示统计</p>
  }
  if (data.sample_size === 0) {
    return <p className="text-mrinth-muted text-sm text-center py-8">样本量不足，暂无留存率数据</p>
  }
  return (
    <div className="text-center py-4">
      <h3 className="font-semibold text-mrinth-text mb-4">7 日新玩家留存率</h3>
      <div className="text-5xl font-bold text-mrinth-green">{data.retention_pct}%</div>
      <p className="text-mrinth-muted text-sm mt-2">样本量：{data.sample_size} 名新玩家（近 30 天首次登录）</p>
    </div>
  )
}
