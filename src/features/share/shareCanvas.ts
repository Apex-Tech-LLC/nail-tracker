import { shareOrDownload, type ShareOutcome } from '../backup/backupFormat.ts'
import {
  layoutShare,
  SHARE_WIDTH,
  type Measure,
  type ShareDrawItem,
  type ShareLayoutInput,
  type ShareTextRole,
} from './shareLayout.ts'

/** A string with Vietnamese letters, so document.fonts.load pulls that subset too. */
const VIETNAMESE_SAMPLE = 'Bảng lương Nguyễn Tiền mặt'
const FONT_FAMILY = '"Be Vietnam Pro", sans-serif'

interface SharePalette {
  background: string
  text: string
  secondary: string
  border: string
  brand: string
  brandSoft: string
}

async function loadShareFonts(): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) return
  await Promise.all(
    [400, 500, 600, 700].map((weight) =>
      document.fonts.load(`${weight} 40px ${FONT_FAMILY}`, VIETNAMESE_SAMPLE),
    ),
  )
}

function sharePalette(): SharePalette {
  const styles = getComputedStyle(document.documentElement)
  const read = (name: string, fallback: string): string =>
    styles.getPropertyValue(name).trim() || fallback
  return {
    background: read('--surface', '#ffffff'),
    text: read('--text', '#1d1822'),
    secondary: read('--text-secondary', '#5d5566'),
    border: read('--border-strong', '#d6ccdb'),
    brand: read('--brand-600', '#a3164d'),
    brandSoft: read('--brand-200', '#eaa6c0'),
  }
}

function textColor(role: ShareTextRole, palette: SharePalette): string {
  switch (role) {
    case 'title':
    case 'heading':
    case 'label':
    case 'amount':
      return palette.text
    case 'titleSub':
    case 'headingSub':
    case 'sub':
    case 'barLabel':
    case 'footer':
      return palette.secondary
  }
}

function paintItem(
  context: CanvasRenderingContext2D,
  item: ShareDrawItem,
  palette: SharePalette,
): void {
  if (item.kind === 'text') {
    context.font = item.font
    context.fillStyle = textColor(item.role, palette)
    context.textAlign = item.align
    context.textBaseline = 'top'
    context.fillText(item.text, item.x, item.y)
    return
  }
  if (item.kind === 'rule') {
    context.fillStyle = item.thickness >= 3 ? palette.text : palette.border
    context.fillRect(item.x, item.y, item.width, item.thickness)
    return
  }
  context.fillStyle = item.current ? palette.brand : palette.brandSoft
  context.fillRect(item.x, item.y, item.width, item.height)
}

function canvasToPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('The picture could not be made'))
    }, 'image/png')
  })
}

/**
 * Draws one picture on a canvas 1080 pixels wide (as tall as its content)
 * and hands the PNG to the phone's share sheet or a download. Nothing leaves
 * the phone: the canvas is in memory and the file goes to the sheet.
 */
export async function sharePicture(
  input: ShareLayoutInput,
  fileName: string,
  title: string,
): Promise<ShareOutcome> {
  await loadShareFonts()

  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')
  if (!context) throw new Error('This browser cannot draw the picture')

  const measure: Measure = (text, font) => {
    context.font = font
    return context.measureText(text).width
  }
  const layout = layoutShare(input, measure)

  canvas.width = SHARE_WIDTH
  canvas.height = layout.height
  const palette = sharePalette()
  context.fillStyle = palette.background
  context.fillRect(0, 0, canvas.width, canvas.height)
  for (const item of layout.items) paintItem(context, item, palette)

  const blob = await canvasToPng(canvas)
  return shareOrDownload(new File([blob], fileName, { type: 'image/png' }), title)
}
