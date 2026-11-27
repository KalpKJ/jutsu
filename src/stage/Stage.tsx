import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type ReactNode, type RefObject } from 'react'
import type { Element, Jutsu } from '../jutsu.ts'
import { createEffects } from './effects.ts'
import { createMangaRenderer, type MangaRenderer } from './manga.ts'
import { playCast, playSeal } from './sound.ts'

/** Normalised box of the hands in the unmirrored camera frame. */
export type Box = [number, number, number, number]

export interface StageHandle {
  seal: (box: Box | null) => void
  cast: (jutsu: Jutsu, box: Box | null) => void
}

interface Props {
  video: RefObject<HTMLVideoElement | null>
  running: boolean
  sound: boolean
  /** Draw the feed as ink (true) or leave it in colour. */
  manga: boolean
  /** Redraws the ink in the theme's manga colours when it changes. */
  theme: string
  children?: ReactNode
}

const TINT: Record<Element, [number, number, number]> = {
  fire: [1.15, 0.78, 0.55],
  water: [0.6, 0.9, 1.2],
  lightning: [0.75, 0.9, 1.25],
  earth: [1.05, 0.92, 0.75],
  summon: [1, 0.95, 0.85],
  clone: [1, 1, 1],
  seal: [1.1, 0.62, 0.66],
}

/** One OKLCH token as sRGB 0–1, painted through a 1-pixel canvas. */
function token(name: string): [number, number, number] {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  const c = document.createElement('canvas').getContext('2d', { willReadFrequently: true })
  if (!c || !value) return [1, 1, 1]
  c.fillStyle = value
  c.fillRect(0, 0, 1, 1)
  const [r, g, b] = c.getImageData(0, 0, 1, 1).data
  return [r / 255, g / 255, b / 255]
}

/** The manga sound effect lettered on the panel for each kind of jutsu. */
const SOUND_WORD: Record<Element, string> = {
  fire: 'FWOOSH!',
  water: 'SPLASH!',
  lightning: 'CHICHICHI!',
  earth: 'RUMBLE!',
  summon: 'POOF!',
  clone: 'POOF!',
  seal: 'THOOM!',
}

interface Lettering {
  id: number
  text: string
  x: number
  y: number
  tilt: number
  big: boolean
  element?: Element
}

const ease = (t: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3)

/**
 * The camera panel: the feed drawn as manga by WebGL, the jutsu effects on a
 * canvas above it, and the technique's name as a title card. A cast floods
 * the panel with colour for about three seconds, then the ink comes back.
 */
const Stage = forwardRef<StageHandle, Props>(function Stage({ video, running, sound, manga, theme, children }, ref) {
  const panel = useRef<HTMLDivElement>(null)
  const gl = useRef<HTMLCanvasElement>(null)
  const fx = useRef<HTMLCanvasElement>(null)
  const effects = useRef(createEffects())
  const renderer = useRef<MangaRenderer | null>(null)
  const castAt = useRef(-1e9)
  const castElement = useRef<Element>('fire')
  const lockAt = useRef(-1e9)
  const [title, setTitle] = useState<{ jutsu: Jutsu; id: number } | null>(null)
  const [letters, setLetters] = useState<Lettering[]>([])
  const [webgl, setWebgl] = useState(true)
  const soundOn = useRef(sound)
  soundOn.current = sound
  const mangaOn = useRef(manga)
  mangaOn.current = manga

  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches

  /** The hands' centre on the effects canvas, mirrored to match the picture. */
  const point = (box: Box | null) => {
    const c = fx.current!
    if (!box) return [c.width / 2, c.height * 0.6]
    return [(1 - (box[0] + box[2]) / 2) * c.width, ((box[1] + box[3]) / 2) * c.height]
  }

  /** Letter a sound effect beside the hands, as a percentage of the panel. */
  const letter = (text: string, box: Box | null, big: boolean, element?: Element) => {
    const c = fx.current
    if (!c) return
    const [x, y] = point(box)
    const id = performance.now() + Math.random()
    const side = big ? (x / c.width > 0.5 ? -0.22 : 0.22) : 0.08
    setLetters((list) => [
      ...list.slice(-4),
      {
        id, text, element, big,
        // Big words stay near the middle so long ones never run off the panel.
        x: big ? Math.min(66, Math.max(34, (x / c.width + side) * 100)) : Math.min(82, Math.max(18, (x / c.width + side) * 100)),
        y: Math.min(80, Math.max(22, (y / c.height - (big ? 0.12 : 0.1)) * 100)),
        tilt: (Math.random() - 0.5) * 24,
      },
    ])
  }

  useImperativeHandle(ref, () => ({
    seal(box) {
      if (!fx.current) return
      const [x, y] = point(box)
      effects.current.cast('seal-lock', x, y, Math.min(fx.current.width, fx.current.height))
      lockAt.current = performance.now()
      letter('TOK!', box, false)
      if (soundOn.current) playSeal()
    },
    cast(jutsu, box) {
      if (!fx.current) return
      const [x, y] = point(box)
      effects.current.cast(jutsu.element, x, y, Math.min(fx.current.width, fx.current.height))
      castAt.current = performance.now()
      castElement.current = jutsu.element
      setTitle({ jutsu, id: castAt.current })
      letter(SOUND_WORD[jutsu.element], box, true, jutsu.element)
      if (soundOn.current) playCast(jutsu.element)
    },
  }))

  // Keep both canvases at the panel's size in device pixels.
  useEffect(() => {
    const el = panel.current
    if (!el) return
    const resize = () => {
      const dpr = Math.min(devicePixelRatio, 2)
      const { width, height } = el.getBoundingClientRect()
      for (const c of [gl.current, fx.current]) {
        if (!c) continue
        c.width = Math.round(width * dpr)
        c.height = Math.round(height * dpr)
      }
    }
    const observer = new ResizeObserver(resize)
    observer.observe(el)
    resize()
    return () => observer.disconnect()
  }, [])

  // The WebGL panel is built when the camera starts, not with the page: there
  // is nothing to draw before then, and compiling the shader costs a moment.
  useEffect(() => {
    if (!running || !gl.current) return
    try {
      renderer.current = createMangaRenderer(gl.current, token('--manga-paper'), token('--manga-ink'))
    } catch {
      renderer.current = null
    }
    if (!renderer.current) setWebgl(false)
    return () => {
      renderer.current?.dispose()
      renderer.current = null
    }
  }, [theme, running])

  useEffect(() => {
    let frame = 0
    let last = performance.now()
    const loop = (now: number) => {
      frame = requestAnimationFrame(loop)
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const still = reduced()
      const since = (now - castAt.current) / 1000
      const element = castElement.current

      // Colour floods in on a cast and drains out again.
      const colour = since < 0.25 ? ease(since / 0.25) : since < 2.6 ? 1 : 1 - ease((since - 2.6) / 0.8)
      const ink = mangaOn.current ? 1 - colour : 0
      const flash = still ? 0 : Math.max(0, 1 - since / 0.12) * 0.9
      const clones = element === 'clone' && since < 3.2 ? Math.min(1, Math.max(0, (since - 0.35) * 3)) * (since > 2.6 ? 1 - (since - 2.6) / 0.6 : 1) : 0
      const v = video.current
      if (renderer.current && v && v.readyState >= 2) {
        renderer.current.draw(v, { ink, flash, clones, tint: TINT[element], tintAmount: 0.22 * colour })
      }

      // The panel jolts on impact, and twitches when a seal locks in.
      const el = panel.current
      if (el && !still) {
        const jolt = Math.max(0, 1 - since / 0.45) * 10 + Math.max(0, 1 - (now - lockAt.current) / 120) * 2
        el.style.transform = jolt > 0.1 ? `translate(${(Math.random() - 0.5) * jolt}px, ${(Math.random() - 0.5) * jolt}px)` : ''
      }

      const c = fx.current?.getContext('2d')
      if (c) {
        effects.current.step(c, dt, still)
        // Manga speed lines burst from the hands for the first half second.
        if (!still && since < 0.5) drawSpeedLines(c, 1 - since / 0.5)
      }
    }
    if (running) frame = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(frame)
      if (panel.current) panel.current.style.transform = ''
    }
  }, [running, video])

  return (
    <div className="stage" ref={panel} data-live={running || undefined} data-gl={(webgl && running) || undefined}>
      {/* The detector reads this video; WebGL draws it. Without WebGL it shows as is. */}
      <video ref={video} className="stage__video" playsInline muted />
      <canvas ref={gl} className="stage__feed" aria-hidden="true" hidden={!webgl || !running} />
      <canvas ref={fx} className="stage__fx" aria-hidden="true" />
      {title && (
        <div key={title.id} className="title-card" data-element={title.jutsu.element} role="status" onAnimationEnd={() => setTitle(null)}>
          <span className="title-card__name">{title.jutsu.name}</span>
        </div>
      )}
      {letters.map((l) => (
        <span
          key={l.id}
          className="lettering"
          data-big={l.big || undefined}
          data-element={l.element}
          aria-hidden="true"
          style={{ left: `${l.x}%`, top: `${l.y}%`, ['--tilt' as string]: `${l.tilt}deg`, ['--chars' as string]: l.text.length }}
          onAnimationEnd={() => setLetters((list) => list.filter((x) => x.id !== l.id))}
        >
          {l.text}
        </span>
      ))}
      {children}
    </div>
  )
})

function drawSpeedLines(ctx: CanvasRenderingContext2D, strength: number) {
  const { width: w, height: h } = ctx.canvas
  const cx = w / 2
  const cy = h / 2
  const outer = Math.hypot(w, h) / 2
  ctx.save()
  ctx.fillStyle = `rgba(14,14,16,${0.85 * strength})`
  for (let i = 0; i < 90; i++) {
    const a = Math.random() * Math.PI * 2
    const spread = 0.004 + Math.random() * 0.01
    const inner = outer * (0.45 + Math.random() * 0.25)
    ctx.beginPath()
    ctx.moveTo(cx + Math.cos(a - spread) * outer, cy + Math.sin(a - spread) * outer)
    ctx.lineTo(cx + Math.cos(a) * inner, cy + Math.sin(a) * inner)
    ctx.lineTo(cx + Math.cos(a + spread) * outer, cy + Math.sin(a + spread) * outer)
    ctx.fill()
  }
  ctx.restore()
}

export default Stage
