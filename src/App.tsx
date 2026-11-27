import { useCallback, useEffect, useRef, useState } from 'react'
import { JUTSU, type Element, type Jutsu } from './jutsu.ts'
import { PHOTO_SCORE, snapshot, usePhotos } from './photos.ts'
import SealGuide from './SealGuide.tsx'
import { DEFAULTS, initial, step, type State } from './sequence.ts'
import { isSeal, sign } from './signs.ts'
import { unlockAudio } from './stage/sound.ts'
import Stage, { type StageHandle } from './stage/Stage.tsx'
import { useDetector, type Reading } from './useDetector.ts'
import { useTheme } from './useTheme.ts'

const ELEMENT: Record<Element, string> = {
  fire: 'Fire',
  water: 'Water',
  lightning: 'Lightning',
  earth: 'Earth',
  summon: 'Summoning',
  clone: 'Clone',
  seal: 'Sealing',
}

type Tab = 'jutsu' | 'seals'

export default function App() {
  const [state, setState] = useState<State>(() => initial())
  const [sound, setSound] = useState(true)
  const [manga, setManga] = useState(true)
  const [tab, setTab] = useState<Tab>('jutsu')
  const [casts, setCasts] = useState(0)
  const [theme, toggleTheme] = useTheme()
  const stateRef = useRef(state)
  const stage = useRef<StageHandle>(null)
  const { photos, save, clear } = usePhotos()
  const photosRef = useRef(photos)
  photosRef.current = photos
  const videoRef = useRef<HTMLVideoElement | null>(null)

  const onReading = useCallback(
    (reading: Reading) => {
      // Keep the first clear look at each seal as its photo in the guide.
      if (isSeal(reading.sign) && reading.box && reading.score >= PHOTO_SCORE && !photosRef.current[reading.sign]) {
        const url = videoRef.current && snapshot(videoRef.current, reading.box)
        if (url) save(reading.sign, url)
      }
      const [next, events] = step(stateRef.current, { sign: reading.sign, score: reading.score }, performance.now())
      stateRef.current = next
      setState(next)
      for (const e of events) {
        if (e.type === 'seal') stage.current?.seal(reading.box)
        if (e.type === 'cast') {
          stage.current?.cast(e.jutsu, reading.box)
          setCasts((n) => n + 1)
        }
      }
    },
    [save],
  )

  const { video, status, modelReady, error, reading, start, stop } = useDetector(onReading)
  videoRef.current = video.current
  const running = status === 'running'

  const choose = (target: Jutsu | null) => {
    const next = initial(target)
    stateRef.current = next
    setState(next)
    // On a phone the list sits under the camera, so bring the camera back into view.
    if (matchMedia('(max-width: 60rem)').matches) {
      const still = matchMedia('(prefers-reduced-motion: reduce)').matches
      document.querySelector('.play')?.scrollIntoView({ behavior: still ? 'auto' : 'smooth', block: 'start' })
    }
  }

  const begin = () => {
    unlockAudio()
    void start()
  }

  // For checking effects without a camera: __jutsu.cast('chidori') in the console.
  useEffect(() => {
    ;(window as unknown as { __jutsu: unknown }).__jutsu = {
      cast: (id: string) => {
        const j = JUTSU.find((x) => x.id === id)
        if (j) stage.current?.cast(j, null)
      },
      seal: () => stage.current?.seal(null),
    }
  }, [])

  const holding = isSeal(state.candidate) ? state.candidate : null
  const charge = holding ? Math.min(1, state.streak / DEFAULTS.hold) : 0
  const target = state.target
  const next = target ? target.seals[state.progress] : null
  const guesses = reading.guesses.filter((g) => isSeal(g.sign))

  return (
    <div className="app">
      <header className="bar">
        <p className="wordmark">Jutsu</p>
        <div className="bar__controls">
          <button type="button" className="toggle" aria-pressed={sound} onClick={() => setSound((s) => !s)}>
            Sound {sound ? 'on' : 'off'}
          </button>
          <button type="button" className="toggle" aria-pressed={manga} onClick={() => setManga((m) => !m)}>
            Ink {manga ? 'on' : 'off'}
          </button>
          <button type="button" className="toggle" aria-pressed={theme === 'dark'} onClick={toggleTheme}>
            {theme === 'dark' ? 'Dark' : 'Light'} mode
          </button>
          {running && (
            <button type="button" className="toggle" onClick={stop}>
              Stop camera
            </button>
          )}
        </div>
      </header>

      <main className="workspace">
        <section className="play" aria-labelledby="play-title">
          <h1 id="play-title" className="visually-hidden">
            Make the seals, cast the jutsu
          </h1>
          <Stage ref={stage} video={video} running={running} sound={sound} manga={manga} theme={theme}>
            {running ? (
              <>
                <div className="hud hud--held" data-on={holding ? true : undefined}>
                  <span className="hud__label">Holding</span>
                  <span className="hud__seal">{holding ? sign(holding).name : 'Nothing yet'}</span>
                  <span className="charge" aria-hidden="true">
                    <span style={{ transform: `scaleX(${charge})` }} />
                  </span>
                </div>
                {!target && (
                  <ol className="chain" aria-label="Seals so far">
                    {state.chain.map((s, i) => (
                      <li key={`${s}-${i}`} className="chain__seal">
                        {sign(s).name}
                      </li>
                    ))}
                  </ol>
                )}
              </>
            ) : (
              <div className="cover">
                <p className="cover__line">Make the seals. Cast the jutsu.</p>
                <p className="cover__sub">Your camera becomes a manga panel. Get a sequence right and it goes off in colour.</p>
                <button type="button" className="primary" onClick={begin} disabled={status === 'starting'}>
                  {status === 'starting' ? 'Opening the camera' : 'Start the camera'}
                </button>
                <p className="cover__note" role="status">
                  {status === 'denied'
                    ? 'The camera is blocked. Allow it from the icon in the address bar, then try again.'
                    : status === 'unsupported'
                      ? 'This browser cannot open a camera.'
                      : status === 'failed'
                        ? `Something went wrong: ${error}`
                        : modelReady
                          ? 'Everything runs on this device. No video leaves it.'
                          : 'Loading the seal detector, a 3.6 MB model.'}
                </p>
              </div>
            )}
          </Stage>

          {/* What to do next, right under the picture. */}
          {target ? (
            <div className="track" aria-label={`${target.name}: seal ${state.progress + 1} of ${target.seals.length}`}>
              <div className="track__title">
                <span className="track__name">{target.name}</span>
                <button type="button" className="link" onClick={() => choose(null)}>
                  Back to free play
                </button>
              </div>
              <ol className="track__seals">
                {target.seals.map((s, i) => (
                  <li key={i} data-state={i < state.progress ? 'done' : i === state.progress ? 'next' : 'later'}>
                    {sign(s).name}
                  </li>
                ))}
              </ol>
            </div>
          ) : (
            <p className="track__free">
              Free play. Make any jutsu’s seals in order, or pick one to practise.
              {casts > 0 && ` ${casts} cast so far.`}
            </p>
          )}
          {running && (
            <p className="guesses" aria-live="off">
              {guesses.length > 0
                ? `The camera sees: ${guesses.map((g) => `${sign(g.sign).name} ${Math.round(g.score * 100)}%`).join(', ')}`
                : 'The camera sees no seal yet. Bring both hands into the middle of the panel.'}
              {reading.ms > 0 && ` Reading every ${Math.round(reading.ms)} ms.`}
            </p>
          )}
          {next && running && <p className="visually-hidden" aria-live="polite">Next seal: {sign(next).name}</p>}
        </section>

        <aside className="side" aria-label="Jutsu and seals">
          <div className="tabs" role="tablist" aria-label="Show">
            {(['jutsu', 'seals'] as const).map((t) => (
              <button
                key={t}
                id={`tab-${t}`}
                type="button"
                role="tab"
                aria-selected={tab === t}
                aria-controls={`panel-${t}`}
                tabIndex={tab === t ? 0 : -1}
                onClick={() => setTab(t)}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                    const other = t === 'jutsu' ? 'seals' : 'jutsu'
                    setTab(other)
                    document.getElementById(`tab-${other}`)?.focus()
                  }
                }}
              >
                {t === 'jutsu' ? 'Jutsu' : 'Seals'}
              </button>
            ))}
          </div>

          <div id="panel-jutsu" role="tabpanel" aria-labelledby="tab-jutsu" className="side__panel" hidden={tab !== 'jutsu'}>
            <button type="button" className="pick pick--free" aria-pressed={!target} onClick={() => choose(null)}>
              <span className="pick__name">Free play</span>
              <span className="pick__meta">Any jutsu, any time</span>
            </button>
            <ol className="picks">
              {JUTSU.map((j) => (
                <li key={j.id}>
                  <button type="button" className="pick" data-element={j.element} aria-pressed={target?.id === j.id} onClick={() => choose(j)}>
                    <span className="pick__name">{j.name}</span>
                    <span className="pick__meta">
                      {ELEMENT[j.element]}, {j.seals.length} seals
                    </span>
                    <span className="pick__note">{j.note}</span>
                  </button>
                </li>
              ))}
            </ol>
          </div>

          <div id="panel-seals" role="tabpanel" aria-labelledby="tab-seals" className="side__panel" hidden={tab !== 'seals'}>
            <SealGuide live={running && reading.score >= DEFAULTS.threshold ? reading.sign : null} photos={photos} onClear={clear} />
          </div>
        </aside>
      </main>

      <footer className="foot">
        <p>
          Seal detection: the YOLOX-Nano model from{' '}
          <a href="https://github.com/Kazuhito00/NARUTO-HandSignDetection">NARUTO-HandSignDetection</a> by Kazuhito
          Takahashi, MIT licence, running on your device. A fan project, not affiliated with Masashi Kishimoto, Shueisha
          or Studio Pierrot.
        </p>
      </footer>
    </div>
  )
}
