import { IconCopy, IconTrash } from '@tabler/icons-react'
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { createPortal } from 'react-dom'
import { Link, useLocation } from 'wouter'
import { paths } from '../../app/navigation.ts'
import { useSettings } from '../../app/settings.ts'
import { db, type Turn, type TurnService } from '../../db/schema.ts'
import { formatTime } from '../../domain/dates.ts'
import { formatUsdShort } from '../../domain/money.ts'
import { t, tf } from '../../lib/i18n.ts'
import { serviceColor } from '../../ui/serviceColor.ts'
import { dangerButton, secondaryButton } from '../../ui/styles.ts'
import { useToast } from '../../ui/useToast.ts'
import { saveCopyOfTurn } from './copyTurn.ts'
import { deleteTurn, restoreTurn } from './turnStore.ts'

interface Props {
  turn: Turn
  services: TurnService[]
  number: number | null
}

const OPEN_OFFSET = -152
const OPEN_AT = 60
const START_AFTER = 10
const LONG_PRESS_MS = 500
// A second tap on Copy this soon after the first is the same tap twice.
const COPY_COOLDOWN_MS = 1000

const clampOffset = (value: number) => Math.min(0, Math.max(OPEN_OFFSET, value))

// Only one row may be open: these belong to the open row.
let openRowToken: symbol | null = null
let closeOpenRow: (() => void) | null = null

/** One turn in a list. Shared by Today and History. */
export function TurnRow({ turn, services, number }: Props) {
  const { locale } = useSettings()
  const toast = useToast()
  const [, navigate] = useLocation()
  const [offset, setOffset] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)

  const wrapper = useRef<HTMLDivElement | null>(null)
  const firstSheetButton = useRef<HTMLButtonElement | null>(null)
  const token = useRef<symbol>(Symbol('turn-row'))
  const drag = useRef<{
    startX: number
    startY: number
    startOffset: number
    active: boolean
  } | null>(null)
  const press = useRef<{ timer: number; startX: number; startY: number } | null>(null)
  // A swipe or a long press must not also open the edit screen.
  const swallowClick = useRef(false)
  // A quick double tap on Copy must save one turn, not two.
  const copyBusy = useRef(false)

  const clearPress = useCallback(() => {
    if (press.current) {
      window.clearTimeout(press.current.timer)
      press.current = null
    }
  }, [])

  const closeSelf = useCallback(() => {
    setOffset(0)
    if (openRowToken === token.current) {
      openRowToken = null
      closeOpenRow = null
    }
  }, [])

  const openSelf = useCallback(() => {
    if (closeOpenRow) closeOpenRow()
    setOffset(OPEN_OFFSET)
    openRowToken = token.current
    closeOpenRow = closeSelf
  }, [closeSelf])

  // A row that leaves the screen must not stay the registered open row.
  useEffect(() => {
    return () => {
      clearPress()
      if (openRowToken === token.current) {
        openRowToken = null
        closeOpenRow = null
      }
    }
  }, [clearPress])

  // Tapping anywhere else, or scrolling, closes an open row.
  useEffect(() => {
    if (offset === 0) return

    function onDocumentPointerDown(event: globalThis.PointerEvent) {
      const target = event.target as Node | null
      if (target && wrapper.current?.contains(target)) return
      closeSelf()
    }
    function onScroll() {
      closeSelf()
    }

    document.addEventListener('pointerdown', onDocumentPointerDown, true)
    window.addEventListener('scroll', onScroll, true)
    return () => {
      document.removeEventListener('pointerdown', onDocumentPointerDown, true)
      window.removeEventListener('scroll', onScroll, true)
    }
  }, [offset, closeSelf])

  // The long-press sheet takes focus, closes on Escape, and sets focus on Copy.
  useEffect(() => {
    if (!sheetOpen) return
    firstSheetButton.current?.focus()

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        setSheetOpen(false)
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [sheetOpen])

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    swallowClick.current = false
    drag.current = {
      startX: event.clientX,
      startY: event.clientY,
      startOffset: offset,
      active: false,
    }
    clearPress()
    press.current = {
      timer: window.setTimeout(() => {
        press.current = null
        drag.current = null
        swallowClick.current = true
        setSheetOpen(true)
      }, LONG_PRESS_MS),
      startX: event.clientX,
      startY: event.clientY,
    }
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const pressState = press.current
    if (pressState) {
      const movedX = Math.abs(event.clientX - pressState.startX)
      const movedY = Math.abs(event.clientY - pressState.startY)
      if (movedX > START_AFTER || movedY > START_AFTER) clearPress()
    }

    const current = drag.current
    if (!current) return
    const dx = event.clientX - current.startX
    const dy = event.clientY - current.startY

    if (!current.active) {
      if (Math.abs(dx) <= START_AFTER) return
      if (Math.abs(dy) >= Math.abs(dx)) {
        drag.current = null
        return
      }
      current.active = true
      setDragging(true)
      event.currentTarget.setPointerCapture(event.pointerId)
    }

    setOffset(clampOffset(current.startOffset + dx))
  }

  function finishPointer(event: ReactPointerEvent<HTMLDivElement>) {
    clearPress()
    const current = drag.current
    drag.current = null
    if (!current?.active) return

    swallowClick.current = true
    setDragging(false)
    const finalOffset = clampOffset(current.startOffset + (event.clientX - current.startX))
    if (finalOffset <= -OPEN_AT) openSelf()
    else closeSelf()
  }

  function cancelPointer() {
    clearPress()
    const current = drag.current
    drag.current = null
    setDragging(false)
    if (current?.active) {
      swallowClick.current = true
      setOffset((value) => (value <= -OPEN_AT ? OPEN_OFFSET : 0))
    }
  }

  function onClickCapture(event: ReactMouseEvent<HTMLDivElement>) {
    if (swallowClick.current) {
      swallowClick.current = false
      event.preventDefault()
      event.stopPropagation()
      return
    }
    if (offset === 0) return

    // The visible copy button keeps working; anything else closes the row first.
    if ((event.target as HTMLElement).closest('[data-row-copy]')) return
    event.preventDefault()
    event.stopPropagation()
    closeSelf()
  }

  async function removeTurn() {
    setSheetOpen(false)
    closeSelf()
    const removed = await deleteTurn(db, turn.id)
    if (removed) {
      toast.show({
        message: t(locale, 'turnDeleted'),
        actions: [
          {
            label: t(locale, 'undo'),
            onClick: () => {
              void restoreTurn(db, removed)
            },
          },
        ],
      })
    }
  }

  /** One tap: save a copy dated now, then offer Undo and Edit. */
  async function copyNow() {
    setSheetOpen(false)
    closeSelf()
    if (copyBusy.current) return
    copyBusy.current = true
    let copied = null
    try {
      copied = await saveCopyOfTurn(turn.id, locale)
      if (!copied) return
      const newId = copied.id
      toast.show({
        message: tf(locale, 'copiedYouEarn', { amount: formatUsdShort(copied.earnedTotalCents) }),
        actions: [
          {
            label: t(locale, 'undo'),
            onClick: () => {
              void deleteTurn(db, newId)
            },
          },
          {
            label: t(locale, 'edit'),
            onClick: () => navigate(paths.edit(newId)),
          },
        ],
      })
    } finally {
      if (copied) {
        window.setTimeout(() => {
          copyBusy.current = false
        }, COPY_COOLDOWN_MS)
      } else {
        copyBusy.current = false
      }
    }
  }

  const names = services.map((service) => service.serviceNameSnapshot).join(' + ')
  const markName = services[0]?.serviceNameSnapshot ?? ''
  const tipCents = turn.cashTipCents + turn.cardTipCents
  const clientWord =
    turn.clientType === 'walkIn'
      ? t(locale, 'clientWalkIn')
      : turn.clientType === 'request'
        ? t(locale, 'clientRequest')
        : null
  const subline = [
    formatTime(turn.occurredAt, locale),
    `#${number ?? '\u2013'}`,
    clientWord,
  ]
    .filter(Boolean)
    .join(' \u00b7 ')
  const copyLabel = tf(locale, 'copyTurnNumber', { n: number === null ? '\u2013' : number })
  const open = offset === OPEN_OFFSET

  const sheet = (
    <div className="fixed inset-0 z-50" onClick={() => setSheetOpen(false)}>
      <div className="absolute inset-0 bg-black/20" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t(locale, 'turnActions')}
        className="absolute inset-x-4 bottom-4 flex flex-col gap-2 rounded-card border border-border bg-surface p-3"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          ref={firstSheetButton}
          type="button"
          className={secondaryButton}
          onClick={() => {
            void copyNow()
          }}
        >
          {t(locale, 'copy')}
        </button>
        <button
          type="button"
          className={secondaryButton}
          onClick={() => {
            setSheetOpen(false)
            navigate(paths.edit(turn.id))
          }}
        >
          {t(locale, 'edit')}
        </button>
        <button
          type="button"
          className={dangerButton}
          onClick={() => {
            void removeTurn()
          }}
        >
          {t(locale, 'delete')}
        </button>
        <button type="button" className={secondaryButton} onClick={() => setSheetOpen(false)}>
          {t(locale, 'cancel')}
        </button>
      </div>
    </div>
  )

  return (
    <>
      <div ref={wrapper} className="relative overflow-hidden">
        <div className="absolute inset-y-0 right-0 flex">
          <button
            type="button"
            aria-hidden={open ? undefined : true}
            tabIndex={open ? 0 : -1}
            onClick={() => {
              void copyNow()
            }}
            className="flex w-[76px] flex-col items-center justify-center gap-[3px] bg-inverse text-[12px] font-bold text-on-inverse"
          >
            <IconCopy size={20} aria-hidden="true" />
            {t(locale, 'copy')}
          </button>
          <button
            type="button"
            aria-hidden={open ? undefined : true}
            tabIndex={open ? 0 : -1}
            onClick={() => {
              void removeTurn()
            }}
            className="flex w-[76px] flex-col items-center justify-center gap-[3px] bg-[#c0392b] text-[12px] font-bold text-white"
          >
            <IconTrash size={20} aria-hidden="true" />
            {t(locale, 'delete')}
          </button>
        </div>

        <div
          className="relative flex min-h-[60px] touch-pan-y select-none items-center gap-3 bg-surface py-[11px] pl-3.5 pr-1.5"
          style={{
            transform: `translateX(${offset}px)`,
            transition: dragging ? 'none' : 'transform 200ms ease-out',
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={finishPointer}
          onPointerCancel={cancelPointer}
          onClickCapture={onClickCapture}
          onContextMenu={(event) => event.preventDefault()}
        >
          <Link
            data-testid="turn-row"
            href={paths.edit(turn.id)}
            draggable={false}
            className="flex min-h-11 min-w-0 flex-1 items-center gap-3"
          >
            <span
              aria-hidden="true"
              className="h-[34px] w-2.5 shrink-0 rounded-[5px]"
              style={{ backgroundColor: serviceColor(markName) }}
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px] font-semibold" data-testid="truncate-ok">
                {names}
              </span>
              <span className="mt-px block text-[13px] text-text-secondary">{subline}</span>
            </span>
          </Link>

          <div className="shrink-0 text-right">
            <p className="text-[16px] font-bold leading-tight">
              {formatUsdShort(turn.earnedTotalCents)}
            </p>
            {tipCents > 0 && (
              <p className="text-[12px] font-semibold text-positive-text">
                {tf(locale, 'tipInline', { amount: formatUsdShort(tipCents) })}
              </p>
            )}
          </div>

          <button
            type="button"
            data-row-copy
            aria-label={copyLabel}
            onClick={() => {
              void copyNow()
            }}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-control text-text-secondary"
          >
            <IconCopy size={20} aria-hidden="true" />
          </button>
        </div>
      </div>

      {sheetOpen && createPortal(sheet, document.body)}
    </>
  )
}
