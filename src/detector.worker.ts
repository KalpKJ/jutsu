/// <reference lib="webworker" />
// Runs the seal detector off the main thread so the camera view never stutters.
import * as ort from 'onnxruntime-web/wasm'
import { decode, INPUT_SIZE, letterboxRatio, PAD, toTensor, type Detection } from './yolox.ts'

export type Request = { type: 'load'; modelUrl: string } | { type: 'frame'; frame: ImageBitmap }
export type Reply =
  | { type: 'ready'; backend: string }
  | { type: 'error'; message: string }
  | { type: 'result'; detections: Detection[]; ms: number; width: number; height: number }

const canvas = new OffscreenCanvas(INPUT_SIZE, INPUT_SIZE)
const ctx = canvas.getContext('2d', { willReadFrequently: true })!
let session: ort.InferenceSession | null = null

const post = (reply: Reply) => postMessage(reply)

let loading: Promise<void> | null = null

async function load(modelUrl: string) {
  try {
    // GitHub Pages cannot send the headers threads need, so stay single-threaded.
    ort.env.wasm.numThreads = 1
    session = await ort.InferenceSession.create(modelUrl, { executionProviders: ['wasm'] })
    post({ type: 'ready', backend: 'wasm' })
  } catch (error) {
    post({ type: 'error', message: error instanceof Error ? error.message : String(error) })
  }
}

self.onmessage = async (event: MessageEvent<Request>) => {
  if (event.data.type === 'load') {
    loading ??= load(event.data.modelUrl)
    return
  }
  const { frame } = event.data
  await loading
  if (!session) {
    // Still reply, or the page would wait for this frame forever.
    post({ type: 'result', detections: [], ms: 0, width: frame.width, height: frame.height })
    frame.close()
    return
  }
  const started = performance.now()
  const { width, height } = frame
  const ratio = letterboxRatio(width, height)
  // Letterbox: grey square, frame scaled into the top-left corner, as the reference does.
  ctx.fillStyle = `rgb(${PAD}, ${PAD}, ${PAD})`
  ctx.fillRect(0, 0, INPUT_SIZE, INPUT_SIZE)
  ctx.drawImage(frame, 0, 0, Math.round(width * ratio), Math.round(height * ratio))
  frame.close()

  const pixels = ctx.getImageData(0, 0, INPUT_SIZE, INPUT_SIZE).data
  const input = new ort.Tensor('float32', toTensor(pixels), [1, 3, INPUT_SIZE, INPUT_SIZE])
  const output = await session.run({ [session.inputNames[0]]: input })
  const data = output[session.outputNames[0]].data as Float32Array
  const detections = decode(data, ratio, width, height, { scoreThreshold: 0.3 })
  post({ type: 'result', detections, ms: performance.now() - started, width, height })
}
