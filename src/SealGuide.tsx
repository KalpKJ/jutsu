import { memo, useEffect, useState } from 'react'
import { pixelate, sheet } from './photos.ts'
import { isSeal, SIGNS, type SignId } from './signs.ts'

/**
 * Narutopedia shows the twelve basic seals together in one section, and the
 * clap in a section of its own.
 */
const REFERENCE = 'https://naruto.fandom.com/wiki/Hand_Seal'
const SECTION: Partial<Record<SignId, string>> = { clap: 'Clap_Hands' }

interface Props {
  /** The seal the detector sees right now. */
  live: SignId | null
  /** Snapshots of the user's own hands, saved the first time each seal is recognised. */
  photos: Partial<Record<SignId, string>>
  onClear: () => void
}

const SEALS = SIGNS.filter((s) => isSeal(s.id))

/**
 * Every seal the app knows. A card lights up while the detector sees its
 * seal, and keeps a photo of your hands once it has recognised it clearly,
 * so a full set of photos means every seal works for you.
 */
function SealGuide({ live, photos, onClear }: Props) {
  const done = SEALS.filter((s) => photos[s.id]).length
  const [pixel, setPixel] = useState(true)
  const [sprites, setSprites] = useState<Partial<Record<SignId, string>>>({})

  // Pixel versions of the photos, made once per photo.
  useEffect(() => {
    let live = true
    for (const s of SEALS) {
      const url = photos[s.id]
      if (!url || sprites[s.id]) continue
      void pixelate(url).then((sprite) => live && setSprites((all) => ({ ...all, [s.id]: sprite })))
    }
    return () => {
      live = false
    }
  }, [photos, sprites])

  const download = async (asPixels: boolean) => {
    const items = SEALS.flatMap((s) => (photos[s.id] ? [{ name: s.name, url: photos[s.id]! }] : []))
    const a = document.createElement('a')
    a.href = await sheet(items, asPixels)
    a.download = asPixels ? 'seals-pixel.png' : 'seals-photos.png'
    a.click()
  }

  return (
    <section className="guide" aria-labelledby="guide-title">
      <div className="guide__head">
        <h2 id="guide-title" className="visually-hidden">Seals</h2>
        <p className="guide__lead">
          {done} of {SEALS.length} recognised. A card lights up while the camera sees its seal and keeps a photo of your
          hands once it is sure.
        </p>
        {done > 0 && (
          <div className="guide__actions">
            <button type="button" className="toggle" aria-pressed={pixel} onClick={() => setPixel((p) => !p)}>
              Pixel art {pixel ? 'on' : 'off'}
            </button>
            <button type="button" className="quiet" onClick={() => void download(pixel)}>
              Download as one sheet
            </button>
            <button type="button" className="quiet" onClick={onClear}>
              Clear my photos
            </button>
          </div>
        )}
      </div>
      <ul className="guide__grid">
        {SEALS.map((s) => {
          const photo = photos[s.id]
          return (
            <li key={s.id} className="seal" data-live={live === s.id || undefined} data-done={photo ? true : undefined}>
              <div className="seal__picture">
                {photo ? (
                  <img
                    src={pixel && sprites[s.id] ? sprites[s.id] : photo}
                    data-pixel={(pixel && sprites[s.id]) || undefined}
                    alt={`Your hands making the ${s.name} seal`}
                  />
                ) : (
                  <span className="seal__empty">No photo yet</span>
                )}
              </div>
              <h3 className="seal__name">{s.name}</h3>
              <p className="seal__meta">
                {s.japanese && s.japanese !== s.name ? `${s.japanese}. ` : ''}
                {photo ? 'Recognised.' : 'Not seen yet.'}
              </p>
              <a href={`${REFERENCE}#${SECTION[s.id] ?? 'Basic_Hand_Seals'}`} target="_blank" rel="noreferrer">
                How to make it
              </a>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

export default memo(SealGuide)
