import { JUTSU, type Jutsu } from './jutsu.ts'
import { isSeal, type SealId, type SignId } from './signs.ts'

/**
 * Turns per-frame guesses into seals, then seals into jutsu.
 *
 * A seal counts once the detector has seen it for `hold` frames in a row at
 * or above `threshold`, which filters out the half-formed shapes between two
 * seals. The same seal is not counted twice in a row; you have to change
 * seals. After `timeout` ms without a new seal the chain starts over.
 *
 * Free mode casts any jutsu whose seals end the chain. Guided mode waits for
 * the next seal of one chosen jutsu and ignores any other seal, so a wrong
 * guess never costs progress.
 */

export interface Options {
  hold: number
  threshold: number
  timeout: number
}

export const DEFAULTS: Options = { hold: 3, threshold: 0.6, timeout: 4000 }

export interface Frame {
  sign: SignId | null
  score: number
}

export interface State {
  /** Seal currently being held and for how many frames. */
  candidate: SignId | null
  streak: number
  /** Seals counted so far in this chain. */
  chain: SealId[]
  lastSealAt: number
  /** Guided mode: the jutsu being practised and how far along it is. */
  target: Jutsu | null
  progress: number
}

export type Event =
  | { type: 'seal'; seal: SealId }
  | { type: 'cast'; jutsu: Jutsu }
  | { type: 'reset' }

export function initial(target: Jutsu | null = null): State {
  return { candidate: null, streak: 0, chain: [], lastSealAt: 0, target, progress: 0 }
}

/** The jutsu (longest first) whose seals are the end of the chain. */
export function match(chain: SealId[], list: Jutsu[] = JUTSU): Jutsu | null {
  let found: Jutsu | null = null
  for (const j of list) {
    const n = j.seals.length
    if (n > chain.length) continue
    if (j.seals.every((s, i) => chain[chain.length - n + i] === s)) {
      if (!found || n > found.seals.length) found = j
    }
  }
  return found
}

export function step(state: State, frame: Frame, now: number, options: Options = DEFAULTS): [State, Event[]] {
  const events: Event[] = []
  let next = { ...state }

  // Let the chain go stale. Guided mode keeps its progress: practising is slow.
  if (!next.target && next.chain.length > 0 && now - next.lastSealAt > options.timeout) {
    next = { ...next, chain: [] }
    events.push({ type: 'reset' })
  }

  const seen = frame.sign && frame.score >= options.threshold ? frame.sign : null
  if (seen !== next.candidate) {
    next.candidate = seen
    next.streak = seen ? 1 : 0
  } else if (seen) {
    next.streak += 1
  }

  // Exactly when the hold is reached, so holding a seal longer does nothing more.
  if (!isSeal(seen) || next.streak !== options.hold) return [next, events]
  const seal: SealId = seen
  if (next.chain[next.chain.length - 1] === seal) return [next, events]

  next.lastSealAt = now
  if (next.target) {
    if (seal !== next.target.seals[next.progress]) return [next, events]
    next.chain = [...next.chain, seal]
    next.progress += 1
    events.push({ type: 'seal', seal })
    if (next.progress === next.target.seals.length) {
      events.push({ type: 'cast', jutsu: next.target })
      next.chain = []
      next.progress = 0
    }
    return [next, events]
  }

  next.chain = [...next.chain, seal]
  events.push({ type: 'seal', seal })
  const cast = match(next.chain)
  if (cast) {
    events.push({ type: 'cast', jutsu: cast })
    next.chain = []
  }
  return [next, events]
}
