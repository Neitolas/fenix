import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
export default function Modal({
  children,
  labelledBy,
  onClose,
  compact = false,
}: {
  children: ReactNode
  labelledBy: string
  onClose: () => void
  compact?: boolean
}) {
  const ref = useRef<HTMLElement>(null)
  const close = useRef(onClose)
  useEffect(() => {
    close.current = onClose
  }, [onClose])
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const getFocusable = () =>
      Array.from(
        ref.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href]',
        ) || [],
      )
    getFocusable()[0]?.focus()
    const keydown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        close.current()
      }
      if (e.key === 'Tab') {
        const elements = getFocusable()
        const first = elements[0]
        const last = elements.at(-1)
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last?.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first?.focus()
        }
      }
    }
    const oldOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', keydown)
    return () => {
      document.removeEventListener('keydown', keydown)
      document.body.style.overflow = oldOverflow
      previous?.focus()
    }
  }, [])
  return (
    <div className="overlay">
      <section
        ref={ref}
        className={'dialog' + (compact ? ' compact' : '')}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
      >
        {children}
      </section>
    </div>
  )
}
