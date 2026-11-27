import { useCallback, useEffect, useRef, useState } from 'react'
import type { Reply, Request } from './detector.worker.ts'
import { SIGNS, type SignId } from './signs.ts'
import type { Detection } from './yolox.ts'

export type Status = 'idle' | 'starting' | 'running' | 'denied' | 'unsupported' | 'failed'

export interface Reading {
  sign: SignId | null
  score: number
  /** The best box, as fractions of the frame so the overlay can scale it. */
  box: [number, number, number, number] | null
  /** Milliseconds the model took for this frame. */
  ms: number
  /** The detector's three best guesses for the hands, for the live readout. */
  guesses: { sign: SignId; score: number }[]
}

const EMPTY: Reading = { sign: null, score: 0, box: null, ms: 0, guesses: [] }

/**
 * Opens the camera and runs every frame it can through the detector worker.
 * A new frame is sent only when the last result is back, so a slow device
 * just gets fewer readings per second instead of a growing queue.
 */
export function useDetector(onReading: (reading: Reading) => void) {
  const video = useRef<HTMLVideoElement>(null)
  const [status, setStatus] = useState<Status>('idle')
  const [modelReady, setModelReady] = useState(false)
  const [error, setError] = useState('')
  const [reading, setReading] = useState<Reading>(EMPTY)
  const worker = useRef<Worker | null>(null)
  const stream = useRef<MediaStream | null>(null)
  const busy = useRef(false)
  const running = useRef(false)
  const listener = useRef(onReading)
  listener.current = onReading

  // Creates the worker and starts loading the model. Safe to call twice.
  const boot = useCallback(() => {
    if (worker.current) return
    const w = new Worker(new URL('./detector.worker.ts', import.meta.url), { type: 'module' })
    worker.current = w
    w.onmessage = (event: MessageEvent<Reply>) => {
      const reply = event.data
      if (reply.type === 'ready') setModelReady(true)
      if (reply.type === 'error') {
        setStatus('failed')
        setError(reply.message)
      }
      if (reply.type === 'result') {
        busy.current = false
        const best = reply.detections[0] as Detection | undefined
        const next: Reading = best
          ? {
              sign: SIGNS[best.classIndex].id,
              score: best.score,
              box: [
                best.box[0] / reply.width,
                best.box[1] / reply.height,
                best.box[2] / reply.width,
                best.box[3] / reply.height,
              ],
              ms: reply.ms,
              guesses: best.top.map((t) => ({ sign: SIGNS[t.classIndex].id, score: t.score })),
            }
          : { ...EMPTY, ms: reply.ms }
        setReading(next)
        listener.current(next)
      }
    }
    const modelUrl = new URL('models/yolox_nano.onnx', document.baseURI).href
    w.postMessage({ type: 'load', modelUrl } satisfies Request)
  }, [])

  // The model is 18 MB, so it starts loading once the page has painted and
  // gone idle, not in the middle of the first paint. Pressing start before
  // then boots it straight away.
  useEffect(() => {
    let idle = 0
    let timer = 0
    const schedule = () => {
      if (typeof requestIdleCallback === 'function') idle = requestIdleCallback(boot, { timeout: 3000 })
      else timer = window.setTimeout(boot, 1000)
    }
    if (document.readyState === 'complete') schedule()
    else window.addEventListener('load', schedule, { once: true })
    return () => {
      window.removeEventListener('load', schedule)
      if (idle) cancelIdleCallback(idle)
      clearTimeout(timer)
      worker.current?.terminate()
      worker.current = null
    }
  }, [boot])

  const loop = useCallback(async () => {
    if (!running.current) return
    const v = video.current
    if (v && v.readyState >= 2 && !busy.current && worker.current) {
      busy.current = true
      try {
        const frame = await createImageBitmap(v)
        worker.current.postMessage({ type: 'frame', frame } satisfies Request, [frame])
      } catch {
        busy.current = false
      }
    }
    requestAnimationFrame(loop)
  }, [])

  const start = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus('unsupported')
      return
    }
    boot()
    setStatus('starting')
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
        audio: false,
      })
      stream.current = s
      const v = video.current!
      v.srcObject = s
      await v.play()
      running.current = true
      setStatus('running')
      requestAnimationFrame(loop)
    } catch (e) {
      const denied = e instanceof DOMException && (e.name === 'NotAllowedError' || e.name === 'SecurityError')
      setStatus(denied ? 'denied' : 'failed')
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [boot, loop])

  const stop = useCallback(() => {
    running.current = false
    busy.current = false
    stream.current?.getTracks().forEach((t) => t.stop())
    stream.current = null
    if (video.current) video.current.srcObject = null
    setReading(EMPTY)
    setStatus('idle')
  }, [])

  useEffect(() => stop, [stop])

  return { video, status, modelReady, error, reading, start, stop }
}
