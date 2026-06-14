import { useEffect, useRef, useState } from 'react'
import { useTheme } from '../components/ThemeContext'
import { useLang } from '../i18n/LangContext'
import { LANGUAGES } from '../i18n/translations'
import { PitchLines } from '../components/FieldPitch'
import { useMediaQuery, DESK_QUERY } from '../components/useMediaQuery'
import PixSupport from '../components/PixSupport'

const PITCH_TICK = 320

// Formação compacta do kickabout decorativo: 5v5, GK + 2-2 (coordenadas 105×68)
const HOME_ANCHORS = [
  { x: 8, y: 34 },
  { x: 22, y: 18 },
  { x: 24, y: 50 },
  { x: 38, y: 26 },
  { x: 40, y: 46 },
]
const AWAY_ANCHORS = HOME_ANCHORS.map((p) => ({ x: 105 - p.x, y: 68 - p.y }))

// Sprite pixel art do voleio (inspiração: International Superstar Soccer/SNES).
// Cada frame é uma matriz de chars: K contorno/cabelo, S pele, Y camisa,
// B calção, W chuteira/meia. A bola é renderizada à parte (para poder voar).
const KICK_FRAMES = [
  // F0: preparação — de pé, braços abertos, olhando a bola alta
  [
    '....................',
    '.........KK.........',
    '.........SS.........',
    '........YYYY........',
    '.......SYYYYS.......',
    '......S.YYYY.S......',
    '........YYYY........',
    '.........BBB........',
    '........BB.BB.......',
    '........S...S.......',
    '........S...S.......',
    '........W...W.......',
    '....................',
    '....................',
  ],
  // F1: impulso — corpo invertido na horizontal, perna de chute subindo
  [
    '....................',
    '....................',
    '..............WW....',
    '.............SS.....',
    '.............SS.....',
    '...........BBB......',
    '.....YYYYYYBB.......',
    '....SYYYYYYY........',
    '....S...SS.SS.......',
    '........KK...W......',
    '........KK..........',
    '....................',
    '....................',
    '....................',
  ],
  // F2: contato — perna estendida na diagonal até a bola
  [
    '................WW..',
    '...............SS...',
    '..............SS....',
    '.............SS.....',
    '............BB......',
    '...........BBB......',
    '.....YYYYYYBB.......',
    '....SYYYYYYY........',
    '....S...SS..S.......',
    '........KK..W.......',
    '........KK..........',
    '....................',
    '....................',
    '....................',
  ],
]

const SPRITE_COLORS = {
  K: '#10260a',
  S: '#e8b890',
  Y: '#f0e040',
  B: '#3050c8',
  W: '#f5f5f5',
}

function KickSprite({ frame }) {
  return (
    <svg viewBox="0 0 20 14" shapeRendering="crispEdges" className="w-full h-full">
      {KICK_FRAMES[frame].flatMap((row, y) =>
        [...row].map((c, x) =>
          c === '.' ? null : (
            <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill={SPRITE_COLORS[c]} />
          )
        )
      )}
    </svg>
  )
}

// Campinho vivo: kickabout autônomo em loop (mesma receita do PitchSim do
// MatchPlay, sem placar). No Retrô os dots viram quadrados que pulam numa
// grade (frames de SNES) sob scanlines, e a cada ~9s o jogo pausa para o
// evento do voleio em pixel art com letreiro de GOL.
function LivePitch({ retro }) {
  const [dots, setDots] = useState(() => ({
    home: HOME_ANCHORS.map((p) => ({ ...p })),
    away: AWAY_ANCHORS.map((p) => ({ ...p })),
    ball: { x: 52.5, y: 34 },
  }))
  const [kick, setKick] = useState(null) // null | { frame, fly?, gol? }
  const kickRef = useRef(null)
  useEffect(() => {
    kickRef.current = kick
  }, [kick])
  const simRef = useRef({
    possession: 'home',
    ballTarget: { x: 62, y: 34 },
    targetTicks: 6,
    ticksToKick: 16,
  })
  const timersRef = useRef([])

  useEffect(() => {
    const runKick = () => {
      const push = (fn, ms) => timersRef.current.push(setTimeout(fn, ms))
      setKick({ frame: 0 })
      push(() => setKick({ frame: 1 }), 260)
      push(() => setKick({ frame: 2 }), 520)
      push(() => setKick({ frame: 2, fly: true }), 640)
      push(() => setKick({ frame: 2, fly: true, gol: true }), 1040)
      push(() => setKick(null), 2400)
    }

    const id = setInterval(() => {
      if (kickRef.current) return
      const sim = simRef.current

      if (retro && --sim.ticksToKick <= 0) {
        sim.ticksToKick = 26 + Math.floor(Math.random() * 8)
        runKick()
        return
      }

      setDots((prev) => {
        const dir = sim.possession === 'home' ? 1 : -1
        sim.targetTicks--
        const reached =
          Math.hypot(sim.ballTarget.x - prev.ball.x, sim.ballTarget.y - prev.ball.y) < 3
        if (sim.targetTicks <= 0 || reached) {
          sim.targetTicks = 4 + Math.floor(Math.random() * 3)
          // A bola progride no sentido do gol adversário; chegando perto da
          // área, a defesa recupera e o jogo vira para o outro lado
          const nextX = prev.ball.x + dir * (7 + Math.random() * 13)
          if (nextX > 96 || nextX < 9) {
            sim.possession = sim.possession === 'home' ? 'away' : 'home'
            sim.ballTarget = {
              x: prev.ball.x - dir * (10 + Math.random() * 8),
              y: 14 + Math.random() * 40,
            }
          } else {
            sim.ballTarget = {
              x: nextX,
              y: Math.max(8, Math.min(60, prev.ball.y + (Math.random() * 2 - 1) * 18)),
            }
          }
        }

        const move = (key, anchors) =>
          prev[key].map((p, i) => {
            const base = anchors[i]
            const isGK = i === 0
            const tdir = key === 'home' ? 1 : -1
            const attacking = sim.possession === key
            // O bloco inteiro acompanha a bola (linhas sobem e descem juntas);
            // o time com posse empurra para frente, o sem posse recua compacto
            let tx = base.x
            let ty = base.y
            let pullX = 0
            let pullY = 0
            if (!isGK) {
              tx = base.x + (prev.ball.x - 52.5) * 0.45 + (attacking ? 9 : -4) * tdir
              ty = base.y + (prev.ball.y - base.y) * 0.25
              const dist = Math.hypot(prev.ball.x - p.x, prev.ball.y - p.y)
              if (dist < 13) {
                pullX = (prev.ball.x - p.x) * 0.2
                pullY = (prev.ball.y - p.y) * 0.2
              }
            }
            const noise = isGK ? 0.6 : 1.6
            const nx = p.x + (tx - p.x) * 0.35 + pullX + (Math.random() * 2 - 1) * noise
            const ny = p.y + (ty - p.y) * 0.35 + pullY + (Math.random() * 2 - 1) * noise
            return { x: Math.max(2, Math.min(103, nx)), y: Math.max(3, Math.min(65, ny)) }
          })

        return {
          home: move('home', HOME_ANCHORS),
          away: move('away', AWAY_ANCHORS),
          ball: {
            x: prev.ball.x + (sim.ballTarget.x - prev.ball.x) * 0.3,
            y: prev.ball.y + (sim.ballTarget.y - prev.ball.y) * 0.3,
          },
        }
      })
    }, PITCH_TICK)

    const timers = timersRef.current
    return () => {
      clearInterval(id)
      timers.forEach(clearTimeout)
    }
  }, [retro])

  // Retrô: posições presas numa grade — os dots "pulam" de célula em célula
  const q = (v) => (retro ? Math.round(v / 2.5) * 2.5 : v)

  const dotEl = (p, color, key) => (
    <span
      key={key}
      className={`absolute -translate-x-1/2 -translate-y-1/2 ${retro ? '' : 'rounded-full'}`}
      style={{
        left: `${(q(p.x) / 105) * 100}%`,
        top: `${(q(p.y) / 68) * 100}%`,
        width: '4%',
        aspectRatio: '1 / 1',
        background: color,
        border: retro ? 'none' : '1px solid rgba(0, 0, 0, 0.35)',
        transition: retro ? 'none' : `left ${PITCH_TICK}ms linear, top ${PITCH_TICK}ms linear`,
      }}
    />
  )

  return (
    <div
      className="relative w-full aspect-[105/68] overflow-hidden border"
      style={{ borderColor: 'var(--color-border)', borderRadius: 'var(--radius)' }}
    >
      <div className="absolute inset-0 field-stripes" />
      <PitchLines />

      {dots.home.map((p, i) => dotEl(p, 'var(--color-player-user)', `h${i}`))}
      {dots.away.map((p, i) => dotEl(p, 'var(--color-player-opponent)', `a${i}`))}

      {!kick && (
        <span
          className={`absolute -translate-x-1/2 -translate-y-1/2 ${retro ? '' : 'rounded-full'}`}
          style={{
            left: `${(q(dots.ball.x) / 105) * 100}%`,
            top: `${(q(dots.ball.y) / 68) * 100}%`,
            width: '2.2%',
            aspectRatio: '1 / 1',
            background: 'var(--color-ball)',
            transition: retro ? 'none' : `left ${PITCH_TICK}ms linear, top ${PITCH_TICK}ms linear`,
          }}
        />
      )}

      {/* Evento do voleio (só Retrô) */}
      {kick && (
        <>
          <div
            className="absolute"
            style={{ left: '44%', top: '14%', width: '38%', aspectRatio: '20 / 14' }}
          >
            <KickSprite frame={kick.frame} />
          </div>
          <span
            className="absolute"
            style={{
              left: kick.fly ? '96%' : '76%',
              top: kick.fly ? '46%' : '12%',
              width: '3%',
              aspectRatio: '1 / 1',
              background: 'var(--color-ball)',
              transition: 'left 0.4s linear, top 0.4s linear',
            }}
          />
          {kick.gol && (
            <span
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-5xl font-black animate-blink"
              style={{
                color: 'var(--color-accent)',
                textShadow: '3px 3px 0 rgba(6, 18, 4, 0.85)',
                letterSpacing: '0.12em',
                animationDuration: '0.35s',
              }}
            >
              GOL!
            </span>
          )}
        </>
      )}

      {retro && <div className="pointer-events-none absolute inset-0 crt-scanlines" />}
    </div>
  )
}

export default function HomeScreen({ onPlay }) {
  const { theme, toggleTheme } = useTheme()
  const { lang, setLang, t } = useLang()
  const isRetro = theme === 'retro'
  const isDesk = useMediaQuery(DESK_QUERY)
  const [showPix, setShowPix] = useState(false)

  // Rodapé discreto: crédito ao 7a0 + link de apoio (abre o modal Pix)
  const footer = (
    <div
      className="flex flex-col items-center gap-1 text-center text-xs shrink-0"
      style={{ color: 'var(--color-text-secondary)' }}
    >
      <a
        href="https://7a0.com.br"
        target="_blank"
        rel="noopener noreferrer"
        className="hover:underline"
        style={{ color: 'inherit' }}
      >
        {t('inspired_by')}
      </a>
      <button
        type="button"
        onClick={() => setShowPix(true)}
        className="hover:underline"
        style={{ color: 'inherit' }}
      >
        {t('support_cta')}
      </button>
    </div>
  )

  const langSelect = (
    <select
      value={lang}
      onChange={(e) => setLang(e.target.value)}
      className="bg-transparent border px-2 py-1"
      style={{
        borderColor: 'var(--color-border)',
        color: 'var(--color-text-secondary)',
        borderRadius: 'var(--radius)',
      }}
    >
      {LANGUAGES.map((code) => (
        <option key={code} value={code} className="bg-[var(--color-bg)]">
          {code.toUpperCase()}
        </option>
      ))}
    </select>
  )

  const themeButton = (
    <button
      type="button"
      onClick={toggleTheme}
      className="border px-2 py-1"
      style={{
        borderColor: 'var(--color-border)',
        color: 'var(--color-text-secondary)',
        borderRadius: 'var(--radius)',
      }}
    >
      {isRetro ? t('theme_moderno') : t('theme_retro')} ⇄
    </button>
  )

  const steps = [t('step_1'), t('step_2'), t('step_3')]

  // Wordmark em cor única; no Retrô ganha sombra dura de tela de título de SNES
  const wordmarkShadow = (offset) =>
    isRetro ? { textShadow: `${offset}px ${offset}px 0 var(--color-btn-secondary-border)` } : undefined

  const playLabel = (
    <>
      {isRetro && <span className="animate-blink">▶ </span>}
      {t('btn_play')}
    </>
  )

  // ---------------------------------------------------------------------------
  // Layout desktop (>900px): hero central — wordmark gigante, campo vivo
  // maior, passos em três colunas e botão com respiro
  // ---------------------------------------------------------------------------
  if (isDesk) {
    return (
      <div className="min-h-dvh w-full flex flex-col">
        <div className="w-full max-w-[1280px] mx-auto px-8 pt-6 flex items-center justify-end gap-2 text-xs shrink-0">
          {langSelect}
          {themeButton}
        </div>

        <div className="flex-1 w-full max-w-[1280px] mx-auto px-8 pb-14 flex flex-col items-center justify-center gap-9">
          {/* Logo + tagline */}
          <div className="text-center">
            <h1
              className={`text-7xl font-black tracking-tight leading-none ${isRetro ? 'uppercase' : ''}`}
              style={wordmarkShadow(6)}
            >
              {t('app_name_1')}
              {t('app_name_2')}
            </h1>
            <p
              className={
                isRetro
                  ? 'mt-4 text-xs font-bold uppercase tracking-[0.28em]'
                  : 'mt-4 text-sm font-medium'
              }
              style={{ color: 'var(--color-text-secondary)' }}
            >
              {t('tagline')}
            </p>
          </div>

          {/* Campo vivo central */}
          <div className="w-full max-w-[720px]">
            <LivePitch retro={isRetro} />
          </div>

          {/* Como jogar em três colunas */}
          <div className="w-full max-w-[900px]">
            <h2
              className="text-[10px] font-bold uppercase tracking-[0.22em] text-center mb-4"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              {t('how_to')}
            </h2>
            <ol className="grid grid-cols-3 gap-6">
              {steps.map((step, i) => (
                <li
                  key={i}
                  className="flex flex-col items-center gap-3 p-5 border-2 text-center"
                  style={{ borderColor: 'var(--color-border)', borderRadius: 'var(--radius)' }}
                >
                  <span
                    className="flex items-center justify-center w-8 h-8 text-sm font-black border-2"
                    style={{ borderColor: 'var(--color-text)', borderRadius: 'var(--radius)' }}
                  >
                    {i + 1}
                  </span>
                  <span className="text-sm leading-snug" style={{ color: 'var(--color-text-secondary)' }}>
                    {step}
                  </span>
                </li>
              ))}
            </ol>
          </div>

          <button
            type="button"
            onClick={onPlay}
            className={`px-20 py-4 text-lg font-black border-2 ${isRetro ? 'uppercase' : ''}`}
            style={{
              background: 'var(--color-btn-primary-bg)',
              color: 'var(--color-btn-primary-text)',
              borderColor: 'var(--color-btn-primary-border)',
              borderRadius: 'var(--radius)',
            }}
          >
            {playLabel}
          </button>

          {footer}
        </div>

        {showPix && <PixSupport onClose={() => setShowPix(false)} />}
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // Layout mobile
  // ---------------------------------------------------------------------------
  return (
    <div className="flex flex-col h-dvh w-full px-4 py-3">
      {/* Topbar */}
      <div className="flex items-center justify-between text-xs mb-2">
        {langSelect}
        {themeButton}
      </div>

      {/* Logo, campo e passos: a folga vertical da tela vira espaçamento
          uniforme entre os blocos — o campo mantém proporção e largura fixas */}
      <div className="flex-1 min-h-0 flex flex-col justify-evenly">
        {/* Logo + tagline */}
        <div className="text-center py-2">
          <h1
            className={`text-5xl font-black tracking-tight ${isRetro ? 'uppercase' : ''}`}
            style={wordmarkShadow(4)}
          >
            {t('app_name_1')}
            {t('app_name_2')}
          </h1>
          <p className="mt-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            {t('tagline')}
          </p>
        </div>

        {/* Campo vivo: largura total até 400px, proporção 105×68 sempre */}
        <div className="w-full max-w-[400px] mx-auto py-2">
          <LivePitch retro={isRetro} />
        </div>

        {/* Como jogar */}
        <div className="text-base py-2">
          <h2 className={`mb-3 font-bold ${isRetro ? 'uppercase' : ''}`}>{t('how_to')}</h2>
          <ol className="space-y-3">
            {steps.map((step, i) => (
              <li key={i} className="flex gap-2.5">
                <span
                  className="shrink-0 flex items-center justify-center w-6 h-6 text-sm font-bold border"
                  style={{ borderColor: 'var(--color-border)', borderRadius: 'var(--radius)' }}
                >
                  {i + 1}
                </span>
                <span className="leading-snug" style={{ color: 'var(--color-text-secondary)' }}>
                  {step}
                </span>
              </li>
            ))}
          </ol>
        </div>
      </div>

      {/* Botão principal */}
      <button
        type="button"
        onClick={onPlay}
        className={`w-full mt-4 py-3 font-bold border-2 ${isRetro ? 'uppercase' : ''}`}
        style={{
          background: 'var(--color-btn-primary-bg)',
          color: 'var(--color-btn-primary-text)',
          borderColor: 'var(--color-btn-primary-border)',
          borderRadius: 'var(--radius)',
        }}
      >
        {playLabel}
      </button>

      <div className="mt-3">{footer}</div>

      {showPix && <PixSupport onClose={() => setShowPix(false)} />}
    </div>
  )
}
