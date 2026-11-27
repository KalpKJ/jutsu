/**
 * Pre- and post-processing for the YOLOX-Nano hand-seal detector, ported from
 * the Python reference in Kazuhito00/NARUTO-HandSignDetection. No DOM or
 * ONNX code here, so it runs in a worker and in unit tests alike.
 */

export const INPUT_SIZE = 416
/**
 * The model has 16 class slots. The reference maps slot n to labels[n + 1] in
 * a list whose first row is "None", so slots 0–14 are Rat … Mizunoe (SIGNS)
 * and slot 15 has no label; detections in it are dropped.
 */
export const CLASS_COUNT = 16
export const LABELLED_CLASSES = 15
const STRIDES = [8, 16, 32]
/** YOLOX pads the letterbox with this grey. */
export const PAD = 114

export interface Detection {
  /** Index into SIGNS. */
  classIndex: number
  score: number
  /** Box in source-image pixels: x1, y1, x2, y2. */
  box: [number, number, number, number]
  /** The box's three most likely classes, best first, scored like `score`. */
  top: { classIndex: number; score: number }[]
}

/** Scale that fits the source inside the square input without distortion. */
export function letterboxRatio(width: number, height: number, size = INPUT_SIZE): number {
  return Math.min(size / height, size / width)
}

/**
 * RGBA pixels of a size×size letterboxed frame → the model's input:
 * channels first, BGR order (the reference reads frames with OpenCV), 0–255.
 */
export function toTensor(rgba: Uint8ClampedArray, size = INPUT_SIZE): Float32Array {
  const plane = size * size
  const out = new Float32Array(3 * plane)
  for (let i = 0; i < plane; i++) {
    out[i] = rgba[i * 4 + 2] // blue
    out[plane + i] = rgba[i * 4 + 1] // green
    out[2 * plane + i] = rgba[i * 4] // red
  }
  return out
}

function iou(a: Detection['box'], b: Detection['box']): number {
  // The reference adds 1 to widths and heights, as OpenCV-era code did.
  const w = Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0]) + 1)
  const h = Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]) + 1)
  const inter = w * h
  const area = (r: Detection['box']) => (r[2] - r[0] + 1) * (r[3] - r[1] + 1)
  return inter / (area(a) + area(b) - inter)
}

/** Greedy non-maximum suppression, highest score first. */
export function nms(detections: Detection[], threshold: number): Detection[] {
  const sorted = [...detections].sort((a, b) => b.score - a.score)
  const kept: Detection[] = []
  for (const d of sorted) {
    if (kept.every((k) => iou(k.box, d.box) <= threshold)) kept.push(d)
  }
  return kept
}

/**
 * Raw model output [1, 3549, 5 + classes] → detections in source pixels.
 * Each row is cx, cy, w, h relative to its grid cell, then objectness and
 * one probability per class. Like the reference, a box's score is
 * objectness × its best class, and NMS ignores class.
 */
export function decode(
  output: Float32Array,
  ratio: number,
  sourceWidth: number,
  sourceHeight: number,
  { scoreThreshold = 0.1, nmsThreshold = 0.45, classes = CLASS_COUNT, size = INPUT_SIZE } = {},
): Detection[] {
  const stride = 5 + classes
  const candidates: Detection[] = []
  let row = 0
  for (const s of STRIDES) {
    const cells = size / s
    for (let gy = 0; gy < cells; gy++) {
      for (let gx = 0; gx < cells; gx++, row++) {
        const o = row * stride
        const objectness = output[o + 4]
        if (objectness < scoreThreshold) continue
        let best = 0
        for (let c = 1; c < classes; c++) if (output[o + 5 + c] > output[o + 5 + best]) best = c
        const score = objectness * output[o + 5 + best]
        if (score < scoreThreshold) continue
        const cx = (output[o] + gx) * s
        const cy = (output[o + 1] + gy) * s
        const w = Math.exp(output[o + 2]) * s
        const h = Math.exp(output[o + 3]) * s
        const top = Array.from({ length: LABELLED_CLASSES }, (_, c) => ({ classIndex: c, score: objectness * output[o + 5 + c] }))
          .sort((a, b) => b.score - a.score)
          .slice(0, 3)
        candidates.push({
          classIndex: best,
          score,
          top,
          box: [
            Math.max(0, (cx - w / 2) / ratio),
            Math.max(0, (cy - h / 2) / ratio),
            Math.min(sourceWidth, (cx + w / 2) / ratio),
            Math.min(sourceHeight, (cy + h / 2) / ratio),
          ],
        })
      }
    }
  }
  return nms(candidates, nmsThreshold).filter((d) => d.classIndex < LABELLED_CLASSES)
}

/** Rows the model outputs for a square input: one per grid cell at each stride. */
export function rowCount(size = INPUT_SIZE): number {
  return STRIDES.reduce((sum, s) => sum + (size / s) ** 2, 0)
}
