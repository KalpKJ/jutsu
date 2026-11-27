import { useCallback, useState } from 'react'
import type { SignId } from './signs.ts'

const KEY = 'jutsu:photos'
/** Only a clear, confident detection is worth keeping as a reference photo. */
export const PHOTO_SCORE = 0.85

type Photos = Partial<Record<SignId, string>>

function load(): Photos {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Photos
  } catch {
    return {}
  }
}

/**
 * Crops the detected hands out of the video frame, mirrored to match what the
 * user sees, as a small JPEG data URL.
 */
export function snapshot(video: HTMLVideoElement, box: [number, number, number, number], size = 240): string | null {
  const vw = video.videoWidth
  const vh = video.videoHeight
  if (!vw || !vh) return null
  // A little room around the hands, kept inside the frame.
  const pad = 0.12
  const x1 = Math.max(0, box[0] - pad * (box[2] - box[0])) * vw
  const y1 = Math.max(0, box[1] - pad * (box[3] - box[1])) * vh
  const x2 = Math.min(1, box[2] + pad * (box[2] - box[0])) * vw
  const y2 = Math.min(1, box[3] + pad * (box[3] - box[1])) * vh
  const w = x2 - x1
  const h = y2 - y1
  if (w < 8 || h < 8) return null
  const scale = size / Math.max(w, h)
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(w * scale)
  canvas.height = Math.round(h * scale)
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.translate(canvas.width, 0)
  ctx.scale(-1, 1)
  ctx.drawImage(video, x1, y1, w, h, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', 0.8)
}

/** The user's seal photos, kept in this browser only. */
export function usePhotos() {
  const [photos, setPhotos] = useState<Photos>(load)

  const save = useCallback((id: SignId, url: string) => {
    setPhotos((current) => {
      if (current[id]) return current
      const next = { ...current, [id]: url }
      try {
        localStorage.setItem(KEY, JSON.stringify(next))
      } catch {
        // Storage full or blocked: keep the photo for this visit only.
      }
      return next
    })
  }, [])

  const clear = useCallback(() => {
    localStorage.removeItem(KEY)
    setPhotos({})
  }, [])

  return { photos, save, clear }
}

/**
 * Turns a seal photo into pixel art: a small grid, colours stepped down to a
 * few levels per channel and pushed a little brighter, like a game sprite.
 */
export function pixelate(url: string, grid = 36, levels = 5): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = grid
      canvas.height = grid
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      if (!ctx) return reject(new Error('no canvas'))
      // Square crop from the middle, so every seal fills its tile the same way.
      const side = Math.min(img.width, img.height)
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, grid, grid)
      const data = ctx.getImageData(0, 0, grid, grid)
      const step = 255 / (levels - 1)
      for (let i = 0; i < data.data.length; i += 4) {
        for (let c = 0; c < 3; c++) {
          const v = Math.min(255, (data.data[i + c] - 128) * 1.25 + 140)
          data.data[i + c] = Math.round(v / step) * step
        }
      }
      ctx.putImageData(data, 0, 0)
      resolve(canvas.toDataURL('image/png'))
    }
    img.onerror = reject
    img.src = url
  })
}

/** All the seal pictures on one sheet, named, for use as a drawing reference. */
export async function sheet(items: { name: string; url: string }[], pixel: boolean): Promise<string> {
  const tile = 256
  const label = 40
  const cols = 4
  const rows = Math.ceil(items.length / cols)
  const canvas = document.createElement('canvas')
  canvas.width = cols * tile
  canvas.height = rows * (tile + label)
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#f7f7f9'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.imageSmoothingEnabled = !pixel
  ctx.fillStyle = '#111'
  ctx.font = '700 22px "Zen Kaku Gothic New", system-ui, sans-serif'
  for (const [i, item] of items.entries()) {
    const img = new Image()
    img.src = pixel ? await pixelate(item.url) : item.url
    await img.decode()
    const x = (i % cols) * tile
    const y = Math.floor(i / cols) * (tile + label)
    const side = Math.min(img.width, img.height)
    ctx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, x, y, tile, tile)
    ctx.fillText(item.name, x + 10, y + tile + 28)
  }
  return canvas.toDataURL('image/png')
}
