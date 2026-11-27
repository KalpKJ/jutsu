import type { Element } from '../jutsu.ts'

/**
 * Sounds made on the spot with the Web Audio API, so there are no audio files:
 * a dry tock for each seal, and a short sound for each kind of jutsu.
 */

let ctx: AudioContext | null = null

/** Browsers only allow audio after a click, so call this from one. */
export function unlockAudio() {
  ctx ??= new AudioContext()
  if (ctx.state === 'suspended') void ctx.resume()
}

function noise(seconds: number) {
  const c = ctx!
  const buffer = c.createBuffer(1, Math.ceil(c.sampleRate * seconds), c.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  const source = c.createBufferSource()
  source.buffer = buffer
  return source
}

function envelope(peak: number, attack: number, release: number, at = ctx!.currentTime) {
  const g = ctx!.createGain()
  g.gain.setValueAtTime(0.0001, at)
  g.gain.exponentialRampToValueAtTime(peak, at + attack)
  g.gain.exponentialRampToValueAtTime(0.0001, at + attack + release)
  return g
}

function filtered(type: BiquadFilterType, from: number, to: number, seconds: number, peak: number, q = 1) {
  const c = ctx!
  const src = noise(seconds)
  const f = c.createBiquadFilter()
  f.type = type
  f.Q.value = q
  f.frequency.setValueAtTime(from, c.currentTime)
  f.frequency.exponentialRampToValueAtTime(to, c.currentTime + seconds)
  const g = envelope(peak, 0.02, seconds)
  src.connect(f).connect(g).connect(c.destination)
  src.start()
}

export function playSeal() {
  if (!ctx) return
  const c = ctx
  const osc = c.createOscillator()
  osc.type = 'triangle'
  osc.frequency.setValueAtTime(520, c.currentTime)
  osc.frequency.exponentialRampToValueAtTime(260, c.currentTime + 0.08)
  osc.connect(envelope(0.25, 0.005, 0.1)).connect(c.destination)
  osc.start()
  osc.stop(c.currentTime + 0.15)
  filtered('highpass', 3000, 2000, 0.05, 0.12)
}

export function playCast(element: Element) {
  if (!ctx) return
  const c = ctx
  // A low thump under every cast.
  const thump = c.createOscillator()
  thump.frequency.setValueAtTime(110, c.currentTime)
  thump.frequency.exponentialRampToValueAtTime(40, c.currentTime + 0.35)
  thump.connect(envelope(0.5, 0.01, 0.4)).connect(c.destination)
  thump.start()
  thump.stop(c.currentTime + 0.5)

  if (element === 'fire') filtered('lowpass', 300, 2400, 1.6, 0.5)
  if (element === 'water') filtered('bandpass', 400, 1600, 1.8, 0.45, 2)
  if (element === 'clone' || element === 'summon' || element === 'earth') filtered('lowpass', 1800, 200, 0.7, 0.55)
  if (element === 'seal') {
    const bell = c.createOscillator()
    bell.type = 'sine'
    bell.frequency.value = 196
    bell.connect(envelope(0.3, 0.02, 2.4)).connect(c.destination)
    bell.start()
    bell.stop(c.currentTime + 2.6)
  }
  if (element === 'lightning') {
    // Chidori's chirping crackle: short bright bursts, many of them.
    for (let i = 0; i < 26; i++) {
      const at = c.currentTime + i * 0.1 + Math.random() * 0.05
      const src = noise(0.06)
      const f = c.createBiquadFilter()
      f.type = 'bandpass'
      f.frequency.value = 2500 + Math.random() * 3500
      f.Q.value = 3
      src.connect(f).connect(envelope(0.35, 0.004, 0.05, at)).connect(c.destination)
      src.start(at)
    }
  }
}
