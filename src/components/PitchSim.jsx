import { useEffect, useMemo, useRef, useState } from 'react'
import { useTheme } from './ThemeContext'
import { PitchLines } from './FieldPitch'
import { FORMATION_LAYOUTS } from './formationLayouts'
import { USER_TEAM_NAME } from '../engine/cup'

// ---------------------------------------------------------------------------
// Campinho animado (Modo Clássico) — encenação do resultado pré-calculado.
// A bola é a protagonista: está sempre nos pés de alguém (conduzida), em voo
// entre dois pontos (passe/chute, uma única transição CSS) ou morta (rede,
// centro). Todo o movimento dos 22 deriva dela: bloco tático que compacta ou
// abre, pressão de dois homens, arrancada coreografada nos gols conhecidos.
// ---------------------------------------------------------------------------

const SIM_TICK = 300
const OPP_TICKS = 8 // janela (em ticks) de encenação antes de um gol conhecido
const CELEBRATE_TICKS = 9
const RESET_TICKS = 5
const CARD_TICKS = 4
const GOL_TICKS = 5
const INTERCEPT_PROB = 0.2
const BACKPASS_PROB = 0.18
const PASS_MIN = 8
const PASS_MAX = 42
const LOFT_DIST = 25
const PASS_EASE = 'cubic-bezier(0.3, 0.65, 0.4, 1)'

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))
const other = (team) => (team === 'home' ? 'away' : 'home')

export default function PitchSim({ match, minute, finished, userFormation, durationMs = 16000 }) {
  const { theme } = useTheme()
  const isRetro = theme === 'retro'
  const maxMinute = match.extraTime ? 120 : 90
  const minPerTick = (maxMinute * SIM_TICK) / durationMs

  const setup = useMemo(() => {
    const layoutFor = (name) =>
      FORMATION_LAYOUTS[name === USER_TEAM_NAME ? userFormation : '4-3-3'] || FORMATION_LAYOUTS['4-3-3']
    const base = {
      home: layoutFor(match.homeName).map((p) => ({ x: p.x, y: p.y })),
      away: layoutFor(match.awayName).map((p) => ({ x: 105 - p.x, y: p.y })),
    }
    // Linha de frente (3 mais adiantados): candidatos a marcador e dupla da
    // saída de bola
    const frontOf = (team) =>
      base[team]
        .map((p, i) => ({ i, r: team === 'home' ? p.x : 105 - p.x }))
        .filter((e) => e.i !== 0)
        .sort((a, b) => b.r - a.r)
        .slice(0, 3)
        .map((e) => e.i)
    // Deriva orgânica por jogador (substitui o ruído uniforme por tick)
    const waves = (n) =>
      Array.from({ length: n }, () => ({ f: 0.35 + Math.random() * 0.4, p: Math.random() * Math.PI * 2 }))
    return {
      base,
      front: { home: frontOf('home'), away: frontOf('away') },
      wave: { home: waves(base.home.length), away: waves(base.away.length) },
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [dots, setDots] = useState(() => {
    const home = setup.base.home.map((p) => ({ ...p }))
    // Dupla mais adiantada já posicionada para a saída de bola inicial
    home[setup.front.home[0]] = { x: 51.3, y: 33 }
    home[setup.front.home[1]] = { x: 47.5, y: 38 }
    return {
      home,
      away: setup.base.away.map((p) => ({ ...p })),
      ball: { x: 52.5, y: 34, ms: SIM_TICK, ease: 'linear' },
      fx: { rings: [], card: null, flashKey: null, gol: false, hopSide: null, loft: null, glow: false },
    }
  })
  const posRef = useRef(dots)

  const simRef = useRef(null)
  if (simRef.current == null) {
    simRef.current = {
      t: 0,
      mode: 'play', // play | celebrate | reset | card
      modeTicks: 0,
      possession: 'home',
      carrierIdx: setup.front.home[0],
      carryTicks: 3,
      forceBack: true, // primeiro passe da saída vai para trás
      flight: null, // { to, ms, ticksLeft, receiver, intercept, shot, side }
      justLaunched: null,
      ballDead: null,
      ballDeadMs: SIM_TICK,
      seenGoals: 0,
      seenCards: 0,
      opportunity: null,
      scorerFor: -1,
      scorerIdx: null,
      celebSide: null,
      corner: null,
      celebOffsets: null,
      card: null,
      cardSide: null,
      dive: null,
      rings: [],
      fxKey: 0,
      flashKey: null,
      golTicks: 0,
      loft: null,
    }
  }

  const minuteRef = useRef(0)
  useEffect(() => {
    minuteRef.current = minute
  }, [minute])
  const goalsRef = useRef(
    match.events.filter((e) => e.type === 'goal').sort((a, b) => a.minute - b.minute)
  )
  const cardsRef = useRef(
    match.events.filter((e) => e.type === 'yellow').sort((a, b) => a.minute - b.minute)
  )

  useEffect(() => {
    if (finished) return
    const id = setInterval(() => {
      const sim = simRef.current
      const P = posRef.current
      const m = minuteRef.current
      const goals = goalsRef.current
      const cards = cardsRef.current
      const ballNow = P.ball
      sim.t++

      // Envelhece efeitos one-shot
      sim.rings = sim.rings.filter((r) => --r.ttl > 0)
      if (sim.golTicks > 0) sim.golTicks--
      if (sim.dive && --sim.dive.ticks <= 0) sim.dive = null

      const nearestIdx = (team, pt) => {
        let best = -1
        let bd = Infinity
        P[team].forEach((p, i) => {
          if (i === 0) return // goleiro nunca vira dono da bola
          const dd = Math.hypot(p.x - pt.x, p.y - pt.y)
          if (dd < bd) {
            bd = dd
            best = i
          }
        })
        return best
      }

      const launchFlight = (to, opts = {}) => {
        const d = Math.hypot(to.x - ballNow.x, to.y - ballNow.y)
        const shot = opts.shot != null
        const ms = shot ? 330 : clamp(260 + d * 9, 240, 950)
        const lofted = !shot && d > LOFT_DIST
        sim.flight = {
          to,
          ms,
          // Chute alinha a chegada com a transição; passe sobra um instante
          // de domínio nos pés do recebedor
          ticksLeft: Math.max(1, shot ? Math.round(ms / SIM_TICK) : Math.ceil(ms / SIM_TICK)),
          receiver: opts.receiver || null,
          intercept: !!opts.intercept,
          shot: opts.shot ?? null,
          side: sim.possession,
        }
        sim.loft = lofted ? { key: ++sim.fxKey, ms } : null
        sim.justLaunched = { x: to.x, y: to.y, ms, ease: shot ? 'linear' : PASS_EASE }
        sim.carrierIdx = null
        sim.ballDead = null
      }

      const shoot = () => {
        const team = sim.possession
        const to = { x: team === 'home' ? 104 : 1, y: 31 + Math.random() * 6 }
        sim.dive = { side: other(team), y: to.y, ticks: 3 }
        launchFlight(to, { shot: sim.seenGoals })
      }

      const choosePass = (team, carrier, rCar, ticksToGoal) => {
        const opp = sim.opportunity === team
        if (opp && sim.carrierIdx === sim.scorerIdx) {
          sim.carryTicks = 1 // o marcador conduz até a finalização
          return
        }
        const rOfP = (p) => (team === 'home' ? p.x : 105 - p.x)
        const cands = []
        P[team].forEach((p, i) => {
          if (i === 0 || i === sim.carrierIdx) return
          const dd = Math.hypot(p.x - carrier.x, p.y - carrier.y)
          if (dd < PASS_MIN || dd > PASS_MAX) return
          cands.push({ i, p, d: dd, gain: rOfP(p) - rCar })
        })
        let pick = null
        if (opp && ticksToGoal <= 5) {
          pick = { i: sim.scorerIdx, p: P[team][sim.scorerIdx] } // bola no marcador
        } else if (!cands.length) {
          sim.carryTicks = 1
          return
        } else if (opp) {
          pick = cands.reduce((a, b) => (b.gain > a.gain ? b : a))
        } else if (sim.forceBack || Math.random() < BACKPASS_PROB) {
          sim.forceBack = false
          const back = cands.filter((c) => c.gain < -2)
          pick = back.length
            ? back.sort((a, b) => a.d - b.d)[0]
            : cands.reduce((a, b) => (b.gain > a.gain ? b : a))
        } else {
          let bs = -Infinity
          cands.forEach((c) => {
            const s = c.gain + Math.random() * 14
            if (s > bs) {
              bs = s
              pick = c
            }
          })
        }
        const dir = team === 'home' ? 1 : -1
        const to = { x: clamp(pick.p.x + dir * 1.5, 1, 104), y: pick.p.y }
        if (!opp && Math.random() < INTERCEPT_PROB) {
          // Passe lido: um defensor fecha a linha e fica com a bola
          const def = other(team)
          const mid = { x: (carrier.x + to.x) / 2, y: (carrier.y + to.y) / 2 }
          const di = nearestIdx(def, mid)
          launchFlight(
            { x: P[def][di].x, y: P[def][di].y },
            { receiver: { team: def, idx: di }, intercept: true }
          )
        } else {
          launchFlight(to, { receiver: { team, idx: pick.i } })
        }
      }

      // 1) Bola em voo: progride e resolve a chegada
      if (sim.flight && --sim.flight.ticksLeft <= 0) {
        const f = sim.flight
        sim.flight = null
        sim.loft = null
        if (f.shot != null) {
          // GOL — flash, letreiro (retrô) e celebração
          sim.seenGoals = f.shot + 1
          sim.mode = 'celebrate'
          sim.modeTicks = CELEBRATE_TICKS
          sim.celebSide = f.side
          sim.possession = other(f.side) // quem sofreu sai jogando
          sim.flashKey = (sim.flashKey ?? 0) + 1
          sim.golTicks = GOL_TICKS
          sim.ballDead = { x: f.to.x, y: f.to.y }
          sim.ballDeadMs = SIM_TICK
          const scorer = P[f.side][sim.scorerIdx]
          sim.corner = { x: f.side === 'home' ? 100 : 5, y: scorer.y < 34 ? 5 : 63 }
          sim.celebOffsets = P[f.side].map(() => {
            const a = Math.random() * Math.PI * 2
            const rr = 2.5 + Math.random() * 3
            return { dx: Math.cos(a) * rr, dy: Math.sin(a) * rr }
          })
          sim.opportunity = null
        } else {
          // Passe chega: recebedor vira o novo dono
          if (f.intercept) {
            sim.rings.push({ x: f.to.x, y: f.to.y, key: ++sim.fxKey, ttl: 2 })
          }
          sim.possession = f.receiver.team
          sim.carrierIdx = f.receiver.idx
          sim.carryTicks = 2 + Math.floor(Math.random() * 3)
        }
      }

      // 2) Relógio dos modos coreografados
      if (sim.mode === 'celebrate') {
        // Encurta a festa se outro gol já está na fila
        const due = goals[sim.seenGoals] && goals[sim.seenGoals].minute <= m
        if (due && sim.modeTicks > 3) sim.modeTicks = 3
        if (--sim.modeTicks <= 0) {
          sim.mode = 'reset'
          sim.modeTicks = RESET_TICKS
          sim.ballDead = { x: 52.5, y: 34 }
          sim.ballDeadMs = 800 // bola volta ao centro num movimento longo
        }
      } else if (sim.mode === 'reset') {
        if (--sim.modeTicks <= 0) {
          sim.mode = 'play'
          sim.carrierIdx = setup.front[sim.possession][0]
          sim.carryTicks = 2
          sim.forceBack = true
          sim.ballDead = null
          sim.celebSide = null
        }
      } else if (sim.mode === 'card') {
        if (--sim.modeTicks <= 0) {
          sim.mode = 'play'
          sim.card = null
          sim.possession = other(sim.cardSide) // falta: bola muda de lado
          sim.carrierIdx = nearestIdx(sim.possession, ballNow)
          sim.carryTicks = 2
          sim.ballDead = null
        }
      }

      // 3) Oportunidade: janela de encenação antes de um gol conhecido
      sim.opportunity = null
      const nextGoal = goals[sim.seenGoals]
      let ticksToGoal = Infinity
      if (sim.mode === 'play' && nextGoal) {
        ticksToGoal = (nextGoal.minute - m) / minPerTick
        if (ticksToGoal <= OPP_TICKS) {
          sim.opportunity = nextGoal.side
          if (sim.scorerFor !== sim.seenGoals) {
            sim.scorerFor = sim.seenGoals
            const front = setup.front[nextGoal.side]
            sim.scorerIdx = front[Math.floor(Math.random() * front.length)]
          }
        }
      }

      // 4) Cartão amarelo: pausa encenada (nunca dentro da janela de gol)
      const nextCard = cards[sim.seenCards]
      if (sim.mode === 'play' && !sim.flight && !sim.opportunity && nextCard && nextCard.minute <= m) {
        sim.seenCards++
        sim.mode = 'card'
        sim.modeTicks = CARD_TICKS
        sim.cardSide = nextCard.side
        const idx = nearestIdx(nextCard.side, ballNow)
        sim.card = { x: P[nextCard.side][idx].x, y: P[nextCard.side][idx].y }
        sim.ballDead = { x: ballNow.x, y: ballNow.y }
        sim.ballDeadMs = SIM_TICK
        sim.carrierIdx = null
      }

      // 5) Decisões do dono da bola
      if (sim.mode === 'play' && !sim.flight) {
        if (sim.carrierIdx == null) {
          sim.carrierIdx = nearestIdx(sim.possession, ballNow)
          sim.carryTicks = 2
          sim.ballDead = null
        }
        const team = sim.possession
        if (sim.opportunity && sim.opportunity !== team) {
          // Virada de jogo: o lado que vai marcar rouba a bola
          const side = sim.opportunity
          const idx = nearestIdx(side, ballNow)
          launchFlight(
            { x: P[side][idx].x, y: P[side][idx].y },
            { receiver: { team: side, idx }, intercept: true }
          )
        } else {
          const carrier = P[team][sim.carrierIdx]
          const rCar = team === 'home' ? carrier.x : 105 - carrier.x
          const isScorer = sim.opportunity === team && sim.carrierIdx === sim.scorerIdx
          const overdue = nextGoal && nextGoal.minute <= m
          if (isScorer && (ticksToGoal <= 2.5 || rCar > 80)) {
            shoot()
          } else if (sim.opportunity === team && overdue) {
            // Atrasado em relação ao placar: bola direto no marcador
            const sp = P[team][sim.scorerIdx]
            launchFlight({ x: sp.x, y: sp.y }, { receiver: { team, idx: sim.scorerIdx } })
          } else if (--sim.carryTicks <= 0) {
            choosePass(team, carrier, rCar, ticksToGoal)
          }
        }
      }

      // 6) Movimento dos 22: alvos por estado + integração com deriva suave
      const moveTeam = (team) => {
        const dir = team === 'home' ? 1 : -1
        const gx = team === 'home' ? 0 : 105
        const base = setup.base[team]
        const cur = P[team]
        const defending = sim.mode === 'play' && team !== sim.possession
        // Pressão coordenada: só o par mais próximo sai do bloco
        let pressIdx = -1
        let coverIdx = -1
        if (defending) {
          const sorted = cur
            .map((p, i) => ({ i, d: Math.hypot(p.x - ballNow.x, p.y - ballNow.y) }))
            .filter((e) => e.i !== 0)
            .sort((a, b) => a.d - b.d)
          if (sorted[0] && sorted[0].d < 28) pressIdx = sorted[0].i
          if (sorted[1] && sorted[1].d < 34) coverIdx = sorted[1].i
        }
        const rball = team === 'home' ? ballNow.x : 105 - ballNow.x

        return cur.map((p, i) => {
          const b = base[i]
          let tx = b.x
          let ty = b.y
          let k
          if (sim.mode === 'celebrate') {
            if (team === sim.celebSide) {
              if (i === sim.scorerIdx) {
                tx = sim.corner.x
                ty = sim.corner.y
                k = 0.5 // arrancada para a bandeirinha
              } else if (i === 0) {
                tx = gx + dir * 22
                ty = 34
                k = 0.12 // goleiro festeja de longe
              } else {
                const off = sim.celebOffsets[i]
                tx = sim.corner.x - dir * 4 + off.dx
                ty = sim.corner.y + (34 - sim.corner.y) * 0.2 + off.dy
                k = 0.38 // abraço no marcador
              }
            } else {
              k = 0.07 // quem sofreu volta cabisbaixo...
              const [f0, f1] = setup.front[team]
              if (i === f0) {
                tx = 52.5 - dir * 1.2
                ty = 33
                k = 0.18 // ...menos a dupla que vai dar a saída
              } else if (i === f1) {
                tx = 52.5 - dir * 5
                ty = 38
                k = 0.18
              }
            }
          } else if (sim.mode === 'reset') {
            k = team === sim.possession ? 0.3 : 0.35
            if (team === sim.possession) {
              const [f0, f1] = setup.front[team]
              if (i === f0) {
                tx = 52.5 - dir * 1.2
                ty = 33
              } else if (i === f1) {
                tx = 52.5 - dir * 5
                ty = 38
              }
            }
          } else if (sim.mode === 'card') {
            tx = p.x
            ty = p.y
            k = 0 // jogo parado
          } else {
            const attacking = team === sim.possession
            const rb = team === 'home' ? b.x : 105 - b.x
            const isReceiver =
              sim.flight && sim.flight.receiver && sim.flight.receiver.team === team && sim.flight.receiver.idx === i
            if (i === 0) {
              if (sim.dive && sim.dive.side === team) {
                tx = b.x
                ty = sim.dive.y
                k = 0.55 // mergulho no chute
              } else {
                tx = b.x
                ty = 34 + clamp((ballNow.y - 34) * 0.25, -5, 5)
                k = 0.25
              }
            } else if (isReceiver) {
              tx = sim.flight.to.x
              ty = sim.flight.to.y
              k = 0.4 // vai ao encontro do passe
            } else if (attacking && i === sim.carrierIdx) {
              tx = p.x + dir * 7
              ty = p.y + (b.y - p.y) * 0.25
              k = sim.opportunity === team ? 0.4 : 0.32 // conduz
            } else if (attacking) {
              if (sim.opportunity === team && i === sim.scorerIdx) {
                tx = gx + dir * 86
                ty = 34 + (b.y - 34) * 0.3
                k = 0.45 // marcador ataca a área
              } else {
                // Bloco ofensivo: sobe com a bola e abre o campo
                const rt = clamp(rb + 7 + clamp((rball - 30) * 0.15, 0, 10), 5, 96)
                tx = gx + dir * rt
                ty = 34 + (b.y - 34) * 1.12 + clamp((ballNow.y - 34) * 0.12, -4, 4)
                k = sim.opportunity === team ? 0.4 : 0.3
              }
            } else if (i === pressIdx) {
              tx = ballNow.x + (gx - ballNow.x) * 0.04
              ty = ballNow.y
              k = 0.42 // pressiona o dono da bola
            } else if (i === coverIdx) {
              const dx = gx - ballNow.x
              const dy = 34 - ballNow.y
              const len = Math.hypot(dx, dy) || 1
              tx = ballNow.x + (dx / len) * 7
              ty = ballNow.y + (dy / len) * 7
              k = 0.38 // cobre a sombra do pressionador
            } else {
              // Bloco defensivo: compacta, recua e inclina para o lado da bola
              const rt = clamp(10 + (rb - 10) * 0.62 + clamp((rball - 52.5) * 0.25, -10, 8), 5, 96)
              tx = gx + dir * rt
              ty = 34 + (b.y - 34) * 0.78 + clamp((ballNow.y - 34) * 0.3, -7, 7)
              k = 0.28
            }
          }
          const w = setup.wave[team][i]
          const wave = Math.sin(sim.t * w.f + w.p) * (i === 0 ? 0.3 : 0.8)
          return {
            x: clamp(p.x + (tx - p.x) * k, 1.5, 103.5),
            y: clamp(p.y + (ty + wave - p.y) * k, 2.5, 65.5),
          }
        })
      }

      const home = moveTeam('home')
      const away = moveTeam('away')

      // 7) Bola: lançada agora, em voo (alvo fixo), morta ou nos pés do dono
      let ball = P.ball
      if (sim.justLaunched) {
        ball = sim.justLaunched
        sim.justLaunched = null
      } else if (sim.flight) {
        // Em voo: a transição já está a caminho do alvo
      } else if (sim.ballDead) {
        ball = { x: sim.ballDead.x, y: sim.ballDead.y, ms: sim.ballDeadMs, ease: 'linear' }
      } else if (sim.carrierIdx != null) {
        const dir = sim.possession === 'home' ? 1 : -1
        const c = (sim.possession === 'home' ? home : away)[sim.carrierIdx]
        ball = { x: clamp(c.x + dir * 1.6, 0.8, 104.2), y: c.y, ms: SIM_TICK, ease: 'linear' }
      }

      const snap = {
        home,
        away,
        ball,
        fx: {
          rings: sim.rings.map((r) => ({ x: r.x, y: r.y, key: r.key })),
          card: sim.mode === 'card' ? sim.card : null,
          flashKey: sim.flashKey,
          gol: sim.golTicks > 0,
          hopSide: sim.mode === 'celebrate' ? sim.celebSide : null,
          loft: sim.loft,
          glow: !!sim.opportunity,
        },
      }
      posRef.current = snap
      setDots(snap)
    }, SIM_TICK)
    return () => clearInterval(id)
  }, [finished, setup, minPerTick])

  const homeColor =
    match.homeName === USER_TEAM_NAME ? 'var(--color-player-user)' : 'var(--color-player-opponent)'
  const awayColor =
    match.awayName === USER_TEAM_NAME ? 'var(--color-player-user)' : 'var(--color-player-opponent)'
  const { fx } = dots

  // Wrapper posiciona (left/top + translate); o miolo anima transform sem
  // conflitar com o deslocamento
  const dot = (p, color, key, hop, i) => (
    <span
      key={key}
      className="absolute -translate-x-1/2 -translate-y-1/2"
      style={{
        left: `${(p.x / 105) * 100}%`,
        top: `${(p.y / 68) * 100}%`,
        width: '3.5%',
        aspectRatio: '1 / 1',
        transition: `left ${SIM_TICK}ms linear, top ${SIM_TICK}ms linear`,
      }}
    >
      <span
        className={`block w-full h-full rounded-full ${hop ? 'animate-celebrate-hop' : ''}`}
        style={{
          background: color,
          border: '1px solid rgba(0, 0, 0, 0.35)',
          animationDelay: hop ? `${(i * 87) % 400}ms` : undefined,
        }}
      />
    </span>
  )

  return (
    <div
      className="relative w-full aspect-[105/68] border-2 overflow-hidden shrink-0"
      style={{ borderColor: 'var(--color-border)', borderRadius: 'var(--radius)' }}
    >
      <div className="absolute inset-0 field-stripes" />
      <PitchLines />

      {/* Brilho de pressão crescente durante a janela de oportunidade */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          boxShadow: 'inset 0 0 24px var(--color-accent)',
          opacity: fx.glow ? 0.6 : 0,
          transition: 'opacity 500ms ease',
        }}
      />

      {dots.home.map((p, i) => dot(p, homeColor, `h${i}`, fx.hopSide === 'home', i))}
      {dots.away.map((p, i) => dot(p, awayColor, `a${i}`, fx.hopSide === 'away', i))}

      {/* Anel de bola roubada */}
      {fx.rings.map((r) => (
        <span
          key={r.key}
          className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none"
          style={{
            left: `${(r.x / 105) * 100}%`,
            top: `${(r.y / 68) * 100}%`,
            width: '6%',
            aspectRatio: '1 / 1',
          }}
        >
          <span
            className="block w-full h-full rounded-full animate-steal-ring"
            style={{ border: '2px solid rgba(255, 255, 255, 0.9)' }}
          />
        </span>
      ))}

      {/* Bola: transição com duração/easing do voo atual */}
      <span
        className="absolute -translate-x-1/2 -translate-y-1/2 z-10"
        style={{
          left: `${(dots.ball.x / 105) * 100}%`,
          top: `${(dots.ball.y / 68) * 100}%`,
          width: '2.2%',
          aspectRatio: '1 / 1',
          transition: `left ${dots.ball.ms}ms ${dots.ball.ease}, top ${dots.ball.ms}ms ${dots.ball.ease}`,
        }}
      >
        <span
          key={fx.loft ? fx.loft.key : 'b'}
          className="block w-full h-full rounded-full"
          style={{
            background: 'var(--color-ball)',
            boxShadow: '0 0 3px rgba(0, 0, 0, 0.5)',
            animation: fx.loft ? `ball-loft ${fx.loft.ms}ms ease-out` : undefined,
          }}
        />
      </span>

      {/* Cartão amarelo encenado */}
      {fx.card && (
        <span
          className="absolute -translate-x-1/2 -translate-y-full animate-blink text-lg z-20"
          style={{
            left: `${(fx.card.x / 105) * 100}%`,
            top: `${(fx.card.y / 68) * 100}%`,
            animationDuration: '0.4s',
          }}
        >
          🟨
        </span>
      )}

      {/* Flash de gol */}
      {fx.flashKey != null && (
        <div
          key={fx.flashKey}
          className="absolute inset-0 animate-pitch-flash pointer-events-none z-10"
          style={{ background: '#ffffff' }}
        />
      )}

      {/* Letreiro de GOL! — só no retrô, mesma receita do attract mode da home */}
      {isRetro && fx.gol && (
        <span
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-5xl font-black animate-blink z-20"
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
    </div>
  )
}
