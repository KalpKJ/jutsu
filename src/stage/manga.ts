/**
 * Draws the camera feed as a manga panel with WebGL2: solid ink in the
 * shadows, paper in the highlights, a rotated screentone of dots for the
 * mid-tones, and ink lines along edges. `ink` blends between the plain feed
 * (0) and the drawing (1), which is how a jutsu brings the colour back.
 */

const VERTEX = `#version 300 es
in vec2 aPos;
out vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  vUv.y = 1.0 - vUv.y;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`

const FRAGMENT = `#version 300 es
precision highp float;
uniform sampler2D uVideo;
uniform vec2 uTexel;      // 1 / video size
uniform vec2 uScale;      // cover-fit: how much of the video the panel shows
uniform float uDot;       // screentone cell, in device pixels
uniform float uInk;       // 0 = colour feed, 1 = manga
uniform float uFlash;     // white impact frame
uniform float uClones;    // ghost copies for the clone jutsu
uniform vec3 uTint;
uniform float uTintAmount;
uniform vec3 uPaper;
uniform vec3 uInkColour;
in vec2 vUv;
out vec4 outColour;

vec3 feed(vec2 uv) {
  // Mirror, so it moves like a mirror; cover-fit into the panel.
  vec2 p = (uv - 0.5) * uScale + 0.5;
  return texture(uVideo, vec2(1.0 - p.x, p.y)).rgb;
}

float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }

void main() {
  vec3 colour = feed(vUv);
  if (uClones > 0.0) {
    // Two more of you, either side, a step behind.
    vec3 left = feed(vUv + vec2(0.24, 0.0));
    vec3 right = feed(vUv - vec2(0.24, 0.0));
    colour = mix(colour, max(colour, left * 0.92), 0.55 * uClones);
    colour = mix(colour, max(colour, right * 0.92), 0.55 * uClones);
  }

  float l = smoothstep(0.06, 0.92, luma(colour));

  // Edges: Sobel on brightness, a few texels apart so lines read at panel size.
  vec2 t = uTexel * uScale * 1.5;
  float tl = luma(feed(vUv + vec2(-t.x, -t.y))), tc = luma(feed(vUv + vec2(0.0, -t.y))), tr = luma(feed(vUv + vec2(t.x, -t.y)));
  float ml = luma(feed(vUv + vec2(-t.x, 0.0))), mr = luma(feed(vUv + vec2(t.x, 0.0)));
  float bl = luma(feed(vUv + vec2(-t.x, t.y))), bc = luma(feed(vUv + vec2(0.0, t.y))), br = luma(feed(vUv + vec2(t.x, t.y)));
  float gx = -tl - 2.0 * ml - bl + tr + 2.0 * mr + br;
  float gy = -tl - 2.0 * tc - tr + bl + 2.0 * bc + br;
  float edge = smoothstep(0.28, 0.5, length(vec2(gx, gy)));

  // Screentone: a 45-degree dot grid, dots growing as the tone darkens.
  vec2 p = gl_FragCoord.xy / uDot;
  p = mat2(0.7071, -0.7071, 0.7071, 0.7071) * p;
  float d = length(fract(p) - 0.5);
  float radius = sqrt(clamp(1.0 - l, 0.0, 1.0)) * 0.62;
  float tone = 1.0 - smoothstep(radius - 0.06, radius + 0.06, d);

  float ink = l < 0.2 ? 1.0 : l > 0.8 ? 0.0 : tone;
  ink = max(ink, edge);
  vec3 manga = mix(uPaper, uInkColour, ink);

  vec3 result = mix(colour, manga, uInk);
  result = mix(result, result * uTint * 1.35, uTintAmount);
  result = mix(result, vec3(1.0), uFlash);
  outColour = vec4(result, 1.0);
}`

export interface MangaUniforms {
  ink: number
  flash: number
  clones: number
  tint: [number, number, number]
  tintAmount: number
}

function compile(gl: WebGL2RenderingContext, type: number, source: string) {
  const shader = gl.createShader(type)!
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) ?? 'shader failed')
  return shader
}

export function createMangaRenderer(canvas: HTMLCanvasElement, paper: [number, number, number], inkColour: [number, number, number]) {
  const gl = canvas.getContext('webgl2', { alpha: false, antialias: false, preserveDrawingBuffer: false })
  if (!gl) return null

  const program = gl.createProgram()!
  gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERTEX))
  gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAGMENT))
  gl.linkProgram(program)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) ?? 'link failed')
  gl.useProgram(program)

  const buffer = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
  const aPos = gl.getAttribLocation(program, 'aPos')
  gl.enableVertexAttribArray(aPos)
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0)

  const texture = gl.createTexture()
  gl.bindTexture(gl.TEXTURE_2D, texture)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)

  const u = (name: string) => gl.getUniformLocation(program, name)
  const loc = {
    texel: u('uTexel'), scale: u('uScale'), dot: u('uDot'), ink: u('uInk'), flash: u('uFlash'),
    clones: u('uClones'), tint: u('uTint'), tintAmount: u('uTintAmount'),
  }
  gl.uniform3fv(u('uPaper'), paper)
  gl.uniform3fv(u('uInkColour'), inkColour)

  return {
    draw(video: HTMLVideoElement, uniforms: MangaUniforms) {
      const vw = video.videoWidth
      const vh = video.videoHeight
      if (!vw || !vh) return
      const { width, height } = canvas
      gl.viewport(0, 0, width, height)
      gl.bindTexture(gl.TEXTURE_2D, texture)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, video)
      // Cover-fit: show the middle of the video at the panel's aspect ratio.
      const panel = width / height
      const source = vw / vh
      gl.uniform2f(loc.scale, panel < source ? panel / source : 1, panel < source ? 1 : source / panel)
      gl.uniform2f(loc.texel, 1 / vw, 1 / vh)
      gl.uniform1f(loc.dot, Math.max(4, Math.round(width / 160)))
      gl.uniform1f(loc.ink, uniforms.ink)
      gl.uniform1f(loc.flash, uniforms.flash)
      gl.uniform1f(loc.clones, uniforms.clones)
      gl.uniform3fv(loc.tint, uniforms.tint)
      gl.uniform1f(loc.tintAmount, uniforms.tintAmount)
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    },
    dispose() {
      gl.deleteTexture(texture)
      gl.deleteBuffer(buffer)
      gl.deleteProgram(program)
    },
  }
}

export type MangaRenderer = NonNullable<ReturnType<typeof createMangaRenderer>>
