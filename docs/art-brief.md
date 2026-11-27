# Art brief: effects and seals for Jutsu

> **Use the full animation guide instead:** https://claude.ai/artifact/822zrmKSoiAJtXF1n1Dn9V (a copy is in `docs/effects-guide.html`). It supersedes the effect timings below: work at 24 fps with holds, as the guide's charts show.

Everything here is for Procreate on iPad. Read "How the art is used" first; the specs follow from it.

## How the art is used

Each jutsu effect plays as a short **frame-by-frame animation at 12 frames per second**, the "on twos" timing most anime effects use. It is centred on the player's hands, drawn over the full-colour camera picture, and scaled to fit the panel.

So **animate, don't just draw.** A single drawing can only grow, shrink and fade in code, which looks cheap. Ten hand-drawn frames of a smoke puff look like the show. Static extras (single puffs, flame tongues, droplets) are still useful: the code scatters them as particles around the main animation.

## Canvas set-up (every effect file)

1. **New canvas: 1024 × 1024 px.** Tap the colour profile and choose **sRGB IEC61966-2.1**, not Display P3; P3 colours shift when they reach a browser.
2. **Animation Assist on:** Actions → Canvas → Animation Assist. In Settings: 12 frames per second, onion skin frames 2, onion skin opacity about 40%, colour secondary frames on, playback Loop.
3. **Drawing guide:** Actions → Canvas → Drawing guide → 2D grid, grid size 128 px. **The centre of the canvas (512, 512) is where the hands are.** Every frame grows out of that point, so keep it fixed.
4. **One frame = one layer.** If a frame needs several layers (line art, colour, shadow), put them in a **group**; Animation Assist treats a group as one frame.
5. **Leave about 60 px of empty margin** on every side. Nothing should touch the edge, or it will look cut off.
6. **Hide the background layer** before you export, so the PNGs are transparent.

## Style rules: anime effects

- **Cel shading:** one base colour, one shadow tone, one highlight. Hard edges. No airbrush on the shapes themselves.
- **Outlines:** smoke and water get an outline about 6 to 8 px thick, in a dark version of the fill rather than pure black. Fire usually has no outline; its shape comes from the colour bands.
- **Silhouette first.** Check each frame as a solid black shape (Alpha Lock, fill black, then undo). If you can't tell what it is as a silhouette, simplify it.
- **Timing, for a 10-frame burst:**
  - frames 1 to 2: small and tight (the wind-up)
  - frames 3 to 4: the biggest, slightly too big (the hit)
  - frames 5 to 7: holding and churning
  - frames 8 to 10: breaking into pieces that shrink and drift apart
- **Disappear by breaking up, not by fading.** Anime effects rarely fade out; they split into smaller pieces and shrink away. I can add a fade in code if needed.
- **No text and no Japanese characters** in any art.
- **Draw it yourself.** Watch the show for shape and timing, but don't trace frames. The art has to be your own for the site to be clean on copyright.

## Brushes (all built into Procreate)

| Job | Brush | Settings |
| --- | --- | --- |
| Line art | Inking → Studio Pen | size 6 to 10%, StreamLine about 40% |
| Even outlines | Inking → Technical Pen | |
| Flat colour | ColorDrop (drag the colour dot into a closed shape) | ColorDrop threshold 80 to 90%, so it doesn't leak |
| Shadows and highlights | Selection tool (Freehand) and fill, or Inking → Dry Ink for a slightly rough edge | paint on a **Clipping Mask** layer above the base, so it stays inside |
| Glow (optional) | Airbrushing → Soft Brush, 30 to 50% opacity | on its own layer named `glow`, so I can switch it on and off |
| Pixel art | Calligraphy → Monoline, 1 px | StreamLine 0 |

## The effects, most valuable first

### 1. Smoke: `smoke` (Summoning and Clone Jutsu)

- **Frames:** 10.
- **Palette:** base `#FFFFFF`, shadow `#DCE1E8`, deep shadow `#A9B2BF`, outline `#3A3F4A`.
- **Shape:** a cluster of round billows bursting out from the centre. At the peak it fills about 70% of the canvas. Then it splits into four to six smaller puffs that drift outward and shrink to nothing.
- **Extras:** three single static puffs of different sizes, as separate files (`puff_a.png`, `puff_b.png`, `puff_c.png`).

### 2. Fire: `fire` (Fireball, Phoenix Flower, Dragon Flame)

- **Frames:** 12.
- **Palette:** white-hot core `#FFF6D6`, yellow `#FFD24A`, orange `#FF8A1F`, red-orange `#E8441A`, dark red shadow `#9E1E0B`.
- **Shape:**
  - frames 1 to 3: a small ball swelling from the centre
  - frames 4 to 8: a huge rolling fireball, with flame tongues licking outward and upward; it reaches about 80% of the canvas
  - frames 9 to 12: breaking into separate tongues and sparks that rise and shrink
- **Colour bands:** layer the colours outside in: red at the edge, then orange, then yellow, then a small white core.
- **Extras:** five single flame tongues (`flame_a.png` to `flame_e.png`).

### 3. Water: `water` (Water Trumpet, Water Shark Bomb)

- **Frames:** 10.
- **Palette:** highlight `#F2FCFF`, light `#7FD6F7`, base `#2E9BDF`, shadow `#135FA8`, outline `#0E3F73`.
- **Shape:** a crown splash rising from just below the centre, droplets flung outward at the peak (frame 4), then the crown falls back and breaks into drops.
- **Highlight:** one white curved stripe on each larger shape.
- **Extras:** four single droplets (`drop_a.png` to `drop_d.png`).

### 4. Optional: Chidori sparks, `spark`

A small 6-frame loop of white-blue electric crackle, about 512 × 512, in `#FFFFFF`, `#CFE6FF` and `#6FA8FF`. The code already draws good lightning, so this only adds texture.

### 5. Optional: a hand-lettered "Jutsu" wordmark

Brush lettering, black on transparent, on a 2048 × 768 canvas, exported as one PNG.

## The seals in pixel art

The site already makes pixel sprites from **your own photos**. In the Seals section, turn **Pixel art on**, then use **Download as one sheet**. If you want hand-made sprites instead, use the photo sheet (Pixel art off) as a reference layer and draw over it.

- **Canvas:** 64 × 64 px for each seal.
- **Brush:** Calligraphy → Monoline at 1 px, StreamLine 0. Zoom in and place pixels one by one.
- **Keep pixels crisp:** when you move or scale anything, set Transform → Interpolation to **Nearest Neighbour**. Never use soft brushes.
- **Palette, 8 colours only:**

  | Use | Colour |
  | --- | --- |
  | Skin light | `#F6C9A3` |
  | Skin mid | `#E0A07A` |
  | Skin shadow | `#B86F4E` |
  | Hand outline | `#4A2B20` |
  | Sleeve | `#24304A` |
  | Sleeve light | `#3D5277` |
  | Highlight | `#FFF2E6` |
  | Background | transparent |

- **Outline:** a 1 px dark line around the outside of the hands.
- **The same framing for all 13:** hands centred, wrists at the bottom edge, same size.
- **File names:** `rat.png`, `ox.png`, `tiger.png`, `hare.png`, `dragon.png`, `snake.png`, `horse.png`, `ram.png`, `monkey.png`, `bird.png`, `dog.png`, `boar.png` and `clap.png`, each 64 × 64.

## Exporting and sending

1. Hide the background layer.
2. **For animations:** Share → **PNG Files** exports every layer (every frame) as its own numbered PNG. Check the numbering runs from the first frame to the last. Share → Animated PNG works too; I can split it.
3. **Naming:** `smoke_01.png` to `smoke_10.png`, `fire_01.png` to `fire_12.png`, `water_01.png` to `water_10.png`. Extras use the names given above.
4. Put everything in one folder in OneDrive (for example `Desktop/Projects/jutsu-art/`) and tell me. I'll turn them into sprite sheets and wire them in.

## Two checks before you export

- Play it in Animation Assist at 12 fps. If anything pops or jumps between frames, that frame needs work.
- Put a photo of yourself making a seal on a reference layer underneath. At its peak, the fireball should cover about your head and shoulders.
