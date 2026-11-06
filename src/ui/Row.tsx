interface RowProps {
  label: string
  value: string
  strong?: boolean
}

export function Row({ label, value, strong }: RowProps) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1">
      <span className="min-w-0 text-text-secondary">{label}</span>
      <span className={`shrink-0 tabular-nums${strong ? ' font-semibold' : ''}`}>{value}</span>
    </div>
  )
}
