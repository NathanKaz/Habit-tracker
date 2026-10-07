import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'

interface ValueInputProps {
  value: number
  target: number
  disabled?: boolean
  ariaLabel: string
  className?: string
  style?: CSSProperties
  onCommit: (value: number) => void
}

export function ValueInput({
  value,
  target,
  disabled = false,
  ariaLabel,
  className,
  style,
  onCommit,
}: ValueInputProps): ReactNode {
  const [text, setText] = useState(() => String(value))
  useEffect(() => setText(String(value)), [value])

  function commit(): void {
    const parsed = Number.parseInt(text, 10)
    const next = Number.isFinite(parsed) ? Math.min(target * 100, Math.max(0, parsed)) : value
    setText(String(next))
    if (next !== value) onCommit(next)
  }

  return (
    <input
      className={className}
      style={style}
      type="number"
      inputMode="numeric"
      min={0}
      max={target * 100}
      value={text}
      disabled={disabled}
      aria-label={ariaLabel}
      onChange={(event) => setText(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur()
        if (event.key === 'Escape') {
          setText(String(value))
          event.currentTarget.blur()
        }
      }}
    />
  )
}
