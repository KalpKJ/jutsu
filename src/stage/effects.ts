import type { Element } from '../jutsu.ts'

/**
 * The jutsu effects, drawn on a 2D canvas over the camera panel. Every effect
 * starts at the hands (where the last seal was seen) and runs on its own
 * clock; `step` advances and draws them all and reports whether any are left.
 * Positions are in canvas pixels, sizes scale with the panel.
 */

type Rgb = [number, number, number]

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  max: number
  size: number
  grow: number
  colour: Rgb
  alpha: number
  /** Light adds up (fire, lightning, water); smoke and ink cover. */
  blend: 'add' | 'cover'
  drag: number
  rise: number
}

interface Effect {
  element: Element | 'seal-lock'
  x: number
  y: number
  age: number
  duration: number
  scale: number
  bolts: [number, number][][]
  nextBolt: number
}

const FIRE: Rgb[] = [[255, 214, 120], [255, 150, 40], [240, 90, 20], [200, 40, 10], [150, 24, 8]]
const WATER: Rgb[] = [[230, 250, 255], [120, 214, 245], [40, 150, 220], [20, 90, 170]]
const SMOKE: Rgb[] = [[248, 248, 246], [226, 226, 224], [200, 200, 198]]
const EARTH: Rgb[] = [[150, 110, 70], [110, 80, 50], [190, 150, 100]]
const LIGHTNING: Rgb = [200, 230, 255]

const pick = <T,>(list: T[]) => list[Math.floor(Math.random() * list.length)]
const rand = (a: number, b: number) => a + Math.random() * (b - a)

/** A jagged bolt from (x1, y1) to (x2, y2), by midpoint displacement. */
function bolt(x1: number, y1: number, x2: number, y2: number, spread: number, depth = 5): [number, number][] {
  if (depth === 0) return [[x1, y1], [x2, y2]]
  const mx = (x1 + x2) / 2 + rand(-spread, spread)
  const my = (y1 + y2) / 2 + rand(-spread, spread)
  const a = bolt(x1, y1, mx, my, spread / 2, depth - 1)
  const b = bolt(mx, my, x2, y2, spread / 2, depth - 1)
  return [...a, ...b.slice(1)]
}

export function createEffects() {
  const effects: Effect[] = []
  const particles: Particle[] = []

  function emit(p: Partial<Particle> & Pick<Particle, 'x' | 'y' | 'colour'>) {
    // A ceiling, so a slow device never drowns in particles.
    if (particles.length > 2400) return
    particles.push({
      vx: 0, vy: 0, life: 0, max: 1, size: 8, grow: 0, alpha: 1, blend: 'add', drag: 0.98, rise: 0,
      ...p,
    })
  }

  /** Start an effect at a point on the canvas; `scale` is the panel's short side. */
  function cast(element: Effect['element'], x: number, y: number, scale: number) {
    const duration = element === 'seal-lock' ? 0.6 : element === 'seal' ? 3.6 : 3
    effects.push({ element, x, y, age: 0, duration, scale, bolts: [], nextBolt: 0 })
    const s = scale

    if (element === 'seal-lock') {
      // A splash of ink where the seal was made.
      for (let i = 0; i < 26; i++) {
        const a = rand(0, Math.PI * 2)
        const v = rand(0.4, 1.6) * s
        emit({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, max: rand(0.25, 0.5), size: rand(0.006, 0.02) * s, colour: [20, 20, 22], blend: 'cover', drag: 0.86 })
      }
    }
    if (element === 'clone' || element === 'summon' || element === 'earth') {
      // The puff of smoke every summoning and clone appears in.
      for (let i = 0; i < 70; i++) {
        const a = rand(0, Math.PI * 2)
        const v = rand(0.15, 0.9) * s
        emit({
          x: x + rand(-0.05, 0.05) * s, y: y + rand(-0.05, 0.05) * s,
          vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.7,
          max: rand(1.2, 2.2), size: rand(0.05, 0.11) * s, grow: 0.12 * s, colour: pick(SMOKE),
          alpha: 0.85, blend: 'cover', drag: 0.94, rise: -0.04 * s,
        })
      }
    }
    if (element === 'earth') {
      for (let i = 0; i < 40; i++) {
        const a = rand(-Math.PI, 0)
        const v = rand(0.6, 1.6) * s
        emit({ x, y: y + 0.1 * s, vx: Math.cos(a) * v, vy: Math.sin(a) * v, max: rand(0.8, 1.4), size: rand(0.01, 0.025) * s, colour: pick(EARTH), blend: 'cover', drag: 0.99, rise: 1.6 * s })
      }
    }
  }

  function update(e: Effect, dt: number) {
    const s = e.scale
    const t = e.age / e.duration
    if (e.element === 'fire' && t < 0.75) {
      // The fireball swells from the hands and rolls out, shedding flame.
      const radius = (0.08 + 0.55 * Math.min(1, t * 1.4)) * s
      const count = Math.round(1400 * dt)
      for (let i = 0; i < count; i++) {
        const a = rand(0, Math.PI * 2)
        const r = rand(0, radius)
        emit({
          x: e.x + Math.cos(a) * r, y: e.y - t * 0.25 * s + Math.sin(a) * r * 0.8,
          vx: rand(-0.1, 0.1) * s, vy: rand(-0.5, -0.15) * s,
          max: rand(0.4, 0.9), size: rand(0.04, 0.11) * s, grow: -0.03 * s, colour: pick(FIRE), alpha: 0.32, drag: 0.96, rise: -0.25 * s,
        })
      }
    }
    if (e.element === 'water' && t < 0.8) {
      // A spiral of water climbing around the hands.
      const count = Math.round(900 * dt)
      for (let i = 0; i < count; i++) {
        const a = e.age * 9 + rand(0, Math.PI * 2)
        const r = (0.16 + 0.3 * t) * s
        emit({
          x: e.x + Math.cos(a) * r, y: e.y + 0.25 * s - e.age * 0.25 * s + Math.sin(a) * r * 0.35,
          vx: -Math.sin(a) * 0.6 * s, vy: rand(-0.9, -0.3) * s,
          max: rand(0.5, 1.1), size: rand(0.012, 0.04) * s, colour: pick(WATER), alpha: 0.45, drag: 0.97, rise: 0.9 * s,
        })
      }
    }
    if (e.element === 'lightning') {
      e.nextBolt -= dt
      if (e.nextBolt <= 0 && t < 0.9) {
        // Chidori: a ball of light at the hands throwing short arcs.
        e.bolts = Array.from({ length: 12 }, () => {
          const a = rand(0, Math.PI * 2)
          const len = rand(0.18, 0.5) * s
          return bolt(e.x, e.y, e.x + Math.cos(a) * len, e.y + Math.sin(a) * len, len * 0.35)
        })
        e.nextBolt = 0.06
        for (let i = 0; i < 12; i++) {
          const a = rand(0, Math.PI * 2)
          const v = rand(0.4, 1.4) * s
          emit({ x: e.x, y: e.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, max: rand(0.15, 0.35), size: rand(0.004, 0.01) * s, colour: LIGHTNING, drag: 0.9 })
        }
      }
    }
  }

  function drawEffect(ctx: CanvasRenderingContext2D, e: Effect, reduced: boolean) {
    const s = e.scale
    const t = e.age / e.duration
    const fade = Math.min(1, (1 - t) * 4)
    if (e.element === 'lightning' && t < 0.9) {
      ctx.globalCompositeOperation = 'lighter'
      const glow = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, 0.26 * s)
      glow.addColorStop(0, `rgba(255,255,255,${0.95 * fade})`)
      glow.addColorStop(0.3, `rgba(150,200,255,${0.6 * fade})`)
      glow.addColorStop(1, 'rgba(60,120,255,0)')
      ctx.fillStyle = glow
      ctx.beginPath()
      ctx.arc(e.x, e.y, 0.26 * s, 0, Math.PI * 2)
      ctx.fill()
      if (!reduced) {
        for (const path of e.bolts) {
          for (const [width, colour] of [[0.02 * s, 'rgba(110,160,255,0.3)'], [0.006 * s, 'rgba(235,245,255,0.95)']] as const) {
            ctx.strokeStyle = colour
            ctx.lineWidth = width
            ctx.lineJoin = 'round'
            ctx.beginPath()
            path.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)))
            ctx.stroke()
          }
        }
      }
    }
    if (e.element === 'fire' && t < 0.85) {
      ctx.globalCompositeOperation = 'lighter'
      const r = (0.1 + 0.6 * Math.min(1, t * 1.4)) * s
      const cy = e.y - t * 0.25 * s
      const core = ctx.createRadialGradient(e.x, cy, 0, e.x, cy, r)
      core.addColorStop(0, `rgba(255,236,180,${0.75 * fade})`)
      core.addColorStop(0.4, `rgba(255,120,30,${0.4 * fade})`)
      core.addColorStop(1, 'rgba(200,40,10,0)')
      ctx.fillStyle = core
      ctx.beginPath()
      ctx.arc(e.x, cy, r, 0, Math.PI * 2)
      ctx.fill()
    }
    if (e.element === 'water' && t < 0.9) {
      ctx.globalCompositeOperation = 'source-over'
      for (let k = 0; k < 3; k++) {
        const rt = (t * 2 + k / 3) % 1
        ctx.strokeStyle = `rgba(160,225,255,${(1 - rt) * 0.7 * fade})`
        ctx.lineWidth = 0.008 * s
        ctx.beginPath()
        ctx.ellipse(e.x, e.y + 0.25 * s, rt * 0.5 * s, rt * 0.14 * s, 0, 0, Math.PI * 2)
        ctx.stroke()
      }
    }
    if (e.element === 'seal') {
      // A sealing formula: rings, spokes and a spiral turning around the hands.
      ctx.globalCompositeOperation = 'source-over'
      const grow = Math.min(1, t * 3)
      const R = 0.42 * s * grow
      ctx.save()
      ctx.translate(e.x, e.y)
      ctx.rotate(reduced ? 0 : e.age * 0.6)
      ctx.globalAlpha = fade
      ctx.strokeStyle = 'rgba(28,10,12,0.92)'
      ctx.lineWidth = 0.008 * s
      for (const f of [1, 0.78, 0.5]) {
        ctx.beginPath()
        ctx.arc(0, 0, R * f, 0, Math.PI * 2)
        ctx.stroke()
      }
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2
        ctx.beginPath()
        ctx.moveTo(Math.cos(a) * R * 0.5, Math.sin(a) * R * 0.5)
        ctx.lineTo(Math.cos(a) * R * (i % 2 ? 0.78 : 1), Math.sin(a) * R * (i % 2 ? 0.78 : 1))
        ctx.stroke()
      }
      ctx.strokeStyle = 'rgba(196,30,36,0.9)'
      ctx.lineWidth = 0.012 * s
      ctx.beginPath()
      for (let a = 0; a < Math.PI * 6; a += 0.1) {
        const r = (a / (Math.PI * 6)) * R * 0.45
        if (a) ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r)
        else ctx.moveTo(0, 0)
      }
      ctx.stroke()
      ctx.restore()
      ctx.globalAlpha = 1
    }
  }

  /** Advance everything by dt seconds and draw it. Returns false when idle. */
  function step(ctx: CanvasRenderingContext2D, dt: number, reduced: boolean): boolean {
    const { width, height } = ctx.canvas
    ctx.clearRect(0, 0, width, height)

    for (const e of effects) {
      e.age += dt
      if (!reduced) update(e, dt)
    }
    for (let i = effects.length - 1; i >= 0; i--) if (effects[i].age >= effects[i].duration) effects.splice(i, 1)

    // Cover first (smoke, ink), light on top (fire, water, lightning).
    for (const pass of ['cover', 'add'] as const) {
      ctx.globalCompositeOperation = pass === 'add' ? 'lighter' : 'source-over'
      for (const p of particles) {
        if (p.blend !== pass) continue
        const k = p.life / p.max
        const a = p.alpha * (1 - k) * (pass === 'cover' ? Math.min(1, (1 - k) * 2) : 1)
        if (a <= 0) continue
        ctx.fillStyle = `rgba(${p.colour[0]},${p.colour[1]},${p.colour[2]},${a})`
        ctx.beginPath()
        ctx.arc(p.x, p.y, Math.max(0.5, p.size + p.grow * p.life), 0, Math.PI * 2)
        ctx.fill()
      }
    }
    for (const e of effects) drawEffect(ctx, e, reduced)
    ctx.globalCompositeOperation = 'source-over'

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i]
      p.life += dt
      if (p.life >= p.max) {
        particles.splice(i, 1)
        continue
      }
      p.vx *= p.drag
      p.vy = p.vy * p.drag + p.rise * dt
      p.x += p.vx * dt
      p.y += p.vy * dt
    }
    return effects.length > 0 || particles.length > 0
  }

  return { cast, step }
}

export type Effects = ReturnType<typeof createEffects>
