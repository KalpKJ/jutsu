import { readFileSync } from 'node:fs'
import * as ort from 'onnxruntime-node'
import { describe, expect, it } from 'vitest'
import { JUTSU } from './jutsu.ts'
import { DEFAULTS, initial, match, step, type Event, type Frame, type State } from './sequence.ts'
import { isSeal, SIGNS, type SignId } from './signs.ts'
import { CLASS_COUNT, LABELLED_CLASSES, decode, INPUT_SIZE, letterboxRatio, nms, PAD, rowCount, toTensor } from './yolox.ts'

const byId = (id: string) => JUTSU.find((j) => j.id === id)!

/** Feed seals as a user would: each held for `hold` frames, `gap` ms apart. */
function perform(seals: SignId[], start: State = initial(), gap = 500) {
  let state = start
  const events: Event[] = []
  let now = 1000
  for (const seal of seals) {
    for (let f = 0; f < DEFAULTS.hold; f++) {
      const frame: Frame = { sign: seal, score: 0.9 }
      const [next, ev] = step(state, frame, now)
      state = next
      events.push(...ev)
      now += 50
    }
    // A blur between seals.
    ;[state] = step(state, { sign: null, score: 0 }, now)
    now += gap
  }
  return { state, events, casts: events.flatMap((e) => (e.type === 'cast' ? [e.jutsu.id] : [])) }
}

describe('jutsu list', () => {
  it('uses only seals the model knows, never the same seal twice in a row', () => {
    const known = new Set<string>(SIGNS.map((s) => s.id))
    for (const j of JUTSU) {
      expect(j.seals.length).toBeGreaterThan(1)
      j.seals.forEach((s, i) => {
        expect(known.has(s)).toBe(true)
        expect(isSeal(s)).toBe(true)
        if (i > 0) expect(s, `${j.id} repeats ${s}`).not.toBe(j.seals[i - 1])
      })
    }
  })

  it('never asks for Mizunoe, which the app ignores', () => {
    for (const j of JUTSU) expect(j.seals).not.toContain('mizunoe')
  })

  it('never hides one jutsu inside another, so free mode cannot cast the wrong one midway', () => {
    for (const a of JUTSU) {
      for (const b of JUTSU) {
        if (a === b) continue
        expect(`,${b.seals.join(',')},`.includes(`,${a.seals.join(',')},`), `${a.id} inside ${b.id}`).toBe(false)
      }
    }
  })

  it('has unique ids', () => {
    expect(new Set(JUTSU.map((j) => j.id)).size).toBe(JUTSU.length)
  })
})

describe('sequence', () => {
  it('casts a jutsu from its seals', () => {
    expect(perform(['snake', 'ram', 'monkey', 'boar', 'horse', 'tiger']).casts).toEqual(['fireball'])
    expect(perform(['ox', 'hare', 'monkey']).casts).toEqual(['chidori'])
  })

  it('needs the seal held for several frames', () => {
    let state = initial()
    const events: Event[] = []
    for (let f = 0; f < DEFAULTS.hold - 1; f++) {
      const [next, ev] = step(state, { sign: 'ox', score: 0.95 }, 1000 + f * 50)
      state = next
      events.push(...ev)
    }
    expect(events).toEqual([])
    expect(state.chain).toEqual([])
  })

  it('ignores low-confidence frames, the unknown class and Mizunoe', () => {
    let state = initial()
    for (let f = 0; f < 10; f++) [state] = step(state, { sign: 'ox', score: 0.3 }, 1000 + f * 50)
    for (let f = 0; f < 10; f++) [state] = step(state, { sign: 'unknown', score: 0.99 }, 2000 + f * 50)
    for (let f = 0; f < 10; f++) [state] = step(state, { sign: 'mizunoe', score: 0.99 }, 3000 + f * 50)
    expect(state.chain).toEqual([])
  })

  it('counts a seal once however long it is held', () => {
    let state = initial()
    for (let f = 0; f < 30; f++) [state] = step(state, { sign: 'tiger', score: 0.9 }, 1000 + f * 50)
    expect(state.chain).toEqual(['tiger'])
  })

  it('starts over after a long pause', () => {
    const slow = perform(['ox', 'hare', 'monkey'], initial(), DEFAULTS.timeout + 500)
    expect(slow.casts).toEqual([])
    expect(slow.events.some((e) => e.type === 'reset')).toBe(true)
  })

  it('guided mode waits for the right seal and ignores wrong ones', () => {
    const target = byId('clone')
    const { state, casts } = perform(['ram', 'dog', 'snake', 'bird'], initial(target))
    expect(casts).toEqual([])
    expect(state.progress).toBe(2)
    expect(perform(['ram', 'dog', 'snake', 'tiger'], initial(target)).casts).toEqual(['clone'])
  })

  it('guided mode keeps progress through a long pause', () => {
    const { state } = perform(['ram', 'snake'], initial(byId('clone')), DEFAULTS.timeout * 3)
    expect(state.progress).toBe(2)
  })

  it('matches the longest jutsu ending the chain', () => {
    expect(match(['ram', 'snake', 'tiger'])?.id).toBe('clone')
    expect(match(['ox', 'tiger'])).toBeNull()
  })
})

describe('yolox decoding', () => {
  it('labels every class slot but the spare one', () => {
    expect(SIGNS).toHaveLength(LABELLED_CLASSES)
    expect(CLASS_COUNT).toBe(LABELLED_CLASSES + 1)
  })

  it('drops detections in the unlabelled slot', () => {
    const stride = 5 + CLASS_COUNT
    const out = new Float32Array(rowCount() * stride)
    out.set([0.5, 0.5, 1, 1, 0.9], 0)
    out[5 + 15] = 0.9
    expect(decode(out, 1, 416, 416)).toEqual([])
  })

  it('has one output row per grid cell', () => {
    expect(rowCount()).toBe(52 * 52 + 26 * 26 + 13 * 13)
  })

  it('letterboxes a 640×480 frame to fit 416', () => {
    expect(letterboxRatio(640, 480)).toBeCloseTo(0.65)
  })

  it('converts RGBA to planar BGR', () => {
    const rgba = new Uint8ClampedArray([10, 20, 30, 255, 40, 50, 60, 255, 0, 0, 0, 255, 0, 0, 0, 255])
    const t = toTensor(rgba, 2)
    expect(Array.from(t.slice(0, 2))).toEqual([30, 60]) // blue plane
    expect(Array.from(t.slice(4, 6))).toEqual([20, 50]) // green plane
    expect(Array.from(t.slice(8, 10))).toEqual([10, 40]) // red plane
  })

  it('decodes a box from its grid cell and stride', () => {
    const stride = 5 + CLASS_COUNT
    const out = new Float32Array(rowCount() * stride)
    // Cell (10, 20) at stride 8: centre offset 0.5, size exp(log 8)*8 = 64 px.
    const row = 20 * 52 + 10
    out.set([0.5, 0.5, Math.log(8), Math.log(8), 0.9], row * stride)
    out[row * stride + 5 + 2] = 0.8 // tiger
    const [d, ...rest] = decode(out, 1, 1000, 1000)
    expect(d.top[0]).toEqual({ classIndex: 2, score: d.score })
    expect(rest).toEqual([])
    expect(d.classIndex).toBe(2)
    expect(d.score).toBeCloseTo(0.72)
    expect(d.box.map((v) => Math.round(v))).toEqual([52, 132, 116, 196])
  })

  it('drops overlapping boxes, keeping the best', () => {
    const a = { classIndex: 0, score: 0.9, box: [0, 0, 100, 100] as [number, number, number, number], top: [] }
    const b = { classIndex: 1, score: 0.8, box: [5, 5, 105, 105] as [number, number, number, number], top: [] }
    const c = { classIndex: 2, score: 0.7, box: [300, 300, 400, 400] as [number, number, number, number], top: [] }
    expect(nms([b, c, a], 0.45)).toEqual([a, c])
  })

  it('runs the real model and finds nothing in a blank frame', async () => {
    const session = await ort.InferenceSession.create(readFileSync('public/models/yolox_nano.onnx'))
    const rgba = new Uint8ClampedArray(INPUT_SIZE * INPUT_SIZE * 4).fill(PAD)
    const input = new ort.Tensor('float32', toTensor(rgba), [1, 3, INPUT_SIZE, INPUT_SIZE])
    const result = await session.run({ [session.inputNames[0]]: input })
    const output = result[session.outputNames[0]]
    expect(output.dims).toEqual([1, rowCount(), 5 + CLASS_COUNT])
    const found = decode(output.data as Float32Array, 1, INPUT_SIZE, INPUT_SIZE, { scoreThreshold: 0.5 })
    expect(found).toEqual([])
  })
})
