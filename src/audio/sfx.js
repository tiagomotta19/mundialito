// Motor de efeitos sonoros do Mundialito — Web Audio API pura, sem arquivos de
// áudio nem dependências. Cada som é sintetizado na hora a partir de
// osciladores e ruído filtrado. Dois timbres por momento: Retrô (ondas
// quadradas/chip, ataques secos) e Moderno (senoides/triângulos, ruído
// filtrado para apitos e torcida).
//
// No iOS, usar só a Web Audio API faz o som ser roteado pelo canal de toque:
// o interruptor físico de silêncio do aparelho já o silencia, sem código extra.

let ctx = null
let master = null

function getCtx() {
  if (typeof window === 'undefined') return null
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return null
    ctx = new AC()
  }
  if (ctx.state === 'suspended') ctx.resume()
  return ctx
}

function getMaster() {
  const c = getCtx()
  if (!c) return null
  if (!master) {
    master = c.createGain()
    master.gain.value = 0.5
    master.connect(c.destination)
  }
  return master
}

// Destrava o contexto após o primeiro gesto do usuário (exigência dos browsers)
export function unlockAudio() {
  getCtx()
}

// ---------------------------------------------------------------------------
// Blocos de síntese
// ---------------------------------------------------------------------------

// Nota com envelope ataque→decay exponencial; opção de glissando e vibrato.
function tone(c, dest, { freq, type = 'sine', start = 0, dur = 0.2, attack = 0.005, gain = 0.3, slideTo = null, vibrato = null }) {
  const t0 = c.currentTime + start
  const osc = c.createOscillator()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t0)
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur)

  const g = c.createGain()
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(gain, t0 + attack)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)

  osc.connect(g).connect(dest)
  osc.start(t0)
  osc.stop(t0 + dur + 0.03)

  if (vibrato) {
    const lfo = c.createOscillator()
    const lfoGain = c.createGain()
    lfo.frequency.value = vibrato.rate
    lfoGain.gain.value = vibrato.depth
    lfo.connect(lfoGain).connect(osc.frequency)
    lfo.start(t0)
    lfo.stop(t0 + dur + 0.03)
  }
}

// Ruído branco por filtro passa-banda — base de apito realista (Moderno).
function noise(c, dest, { start = 0, dur = 0.4, freq = 3200, q = 6, gain = 0.3, attack = 0.012, wobble = false }) {
  const t0 = c.currentTime + start
  const len = Math.ceil(c.sampleRate * dur)
  const buffer = c.createBuffer(1, len, c.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1

  const src = c.createBufferSource()
  src.buffer = buffer

  const bp = c.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.value = freq
  bp.Q.value = q

  const g = c.createGain()
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(gain, t0 + attack)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)

  src.connect(bp).connect(g).connect(dest)
  src.start(t0)
  src.stop(t0 + dur + 0.03)

  if (wobble) {
    const lfo = c.createOscillator()
    const lfoGain = c.createGain()
    lfo.frequency.value = 16
    lfoGain.gain.value = freq * 0.04
    lfo.connect(lfoGain).connect(bp.frequency)
    lfo.start(t0)
    lfo.stop(t0 + dur + 0.03)
  }
}

// Onda de torcida: ruído amarronzado por passa-baixa, sobe e some devagar.
function swell(c, dest, { start = 0, dur = 0.8, gain = 0.12 }) {
  const t0 = c.currentTime + start
  const len = Math.ceil(c.sampleRate * dur)
  const buffer = c.createBuffer(1, len, c.sampleRate)
  const data = buffer.getChannelData(0)
  let last = 0
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1
    last = (last + 0.02 * w) / 1.02
    data[i] = last * 3
  }

  const src = c.createBufferSource()
  src.buffer = buffer

  const lp = c.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = 900

  const g = c.createGain()
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(gain, t0 + dur * 0.4)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)

  src.connect(lp).connect(g).connect(dest)
  src.start(t0)
  src.stop(t0 + dur + 0.03)
}

// ---------------------------------------------------------------------------
// Apitos
// ---------------------------------------------------------------------------

function whistleRetro(c, d, count) {
  if (count === 1) {
    tone(c, d, { freq: 2800, type: 'square', dur: 0.42, gain: 0.16, attack: 0.008, vibrato: { rate: 18, depth: 150 } })
  } else {
    for (let i = 0; i < count; i++) {
      tone(c, d, { start: i * 0.21, freq: 2900, type: 'square', dur: 0.12, gain: 0.16, attack: 0.006, vibrato: { rate: 22, depth: 120 } })
    }
  }
}

function whistleModern(c, d, count) {
  if (count === 1) {
    noise(c, d, { dur: 0.45, freq: 3200, q: 8, gain: 0.22, attack: 0.02, wobble: true })
  } else {
    for (let i = 0; i < count; i++) {
      noise(c, d, { start: i * 0.2, dur: 0.13, freq: 3300, q: 9, gain: 0.22, attack: 0.012 })
    }
  }
}

// ---------------------------------------------------------------------------
// Registry — SOUNDS[nome][tema](ctx, dest, opts)
// ---------------------------------------------------------------------------

export const SOUNDS = {
  kickoff: {
    retro: (c, d) => whistleRetro(c, d, 1),
    moderno: (c, d) => whistleModern(c, d, 1),
  },

  fulltime: {
    retro: (c, d) => whistleRetro(c, d, 3),
    moderno: (c, d) => whistleModern(c, d, 3),
  },

  goal: {
    retro: (c, d) => {
      const notes = [660, 880, 1320]
      notes.forEach((f, i) => {
        tone(c, d, { start: i * 0.06, freq: f, type: 'square', dur: 0.09, gain: 0.16, attack: 0.004 })
        tone(c, d, { start: i * 0.06, freq: f * 1.5, type: 'square', dur: 0.09, gain: 0.06, attack: 0.004 })
      })
      tone(c, d, { start: 0.18, freq: 1320, type: 'square', dur: 0.5, gain: 0.16, attack: 0.005, vibrato: { rate: 12, depth: 30 } })
      tone(c, d, { start: 0.18, freq: 1980, type: 'square', dur: 0.5, gain: 0.05, attack: 0.005 })
    },
    moderno: (c, d) => {
      const notes = [523.25, 659.25, 783.99, 1046.5]
      notes.forEach((f, i) => tone(c, d, { start: i * 0.09, freq: f, type: 'triangle', dur: 0.5 - i * 0.05, gain: 0.2, attack: 0.006 }))
      tone(c, d, { start: 0.36, freq: 1046.5, type: 'triangle', dur: 0.6, gain: 0.16, attack: 0.01 })
      swell(c, d, { start: 0.05, dur: 0.8, gain: 0.12 })
    },
  },

  reelTick: {
    retro: (c, d) => tone(c, d, { freq: 1100, type: 'square', dur: 0.03, gain: 0.1, attack: 0.002 }),
    moderno: (c, d) => tone(c, d, { freq: 1200, type: 'sine', dur: 0.03, gain: 0.09, attack: 0.002 }),
  },

  reelLand: {
    retro: (c, d) => {
      tone(c, d, { freq: 988, type: 'square', dur: 0.08, gain: 0.16, attack: 0.004 })
      tone(c, d, { start: 0.08, freq: 1319, type: 'square', dur: 0.22, gain: 0.16, attack: 0.004, vibrato: { rate: 14, depth: 25 } })
    },
    moderno: (c, d) => {
      tone(c, d, { freq: 880, type: 'sine', dur: 0.1, gain: 0.18, attack: 0.005 })
      tone(c, d, { start: 0.09, freq: 1320, type: 'triangle', dur: 0.32, gain: 0.16, attack: 0.008 })
    },
  },

  place: {
    retro: (c, d, o = {}) => {
      const k = o.soft ? 0.55 : 1
      tone(c, d, { freq: 784, type: 'square', dur: 0.05, gain: 0.13 * k, attack: 0.003 })
      tone(c, d, { start: 0.05, freq: 1175, type: 'square', dur: 0.07, gain: 0.13 * k, attack: 0.003 })
    },
    moderno: (c, d, o = {}) => {
      const k = o.soft ? 0.55 : 1
      tone(c, d, { freq: 660, type: 'sine', dur: 0.07, gain: 0.15 * k, attack: 0.006 })
      tone(c, d, { start: 0.06, freq: 990, type: 'sine', dur: 0.1, gain: 0.13 * k, attack: 0.006 })
    },
  },

  qualified: {
    retro: (c, d) => {
      const notes = [523.25, 659.25, 783.99, 1046.5]
      notes.forEach((f, i) => tone(c, d, { start: i * 0.08, freq: f, type: 'square', dur: 0.12, gain: 0.15, attack: 0.004 }))
    },
    moderno: (c, d) => {
      const triad = [392, 493.88, 587.33]
      triad.forEach((f, i) => tone(c, d, { start: i * 0.1, freq: f, type: 'triangle', dur: 0.5 - i * 0.06, gain: 0.17, attack: 0.01 }))
      tone(c, d, { start: 0.2, freq: 587.33, type: 'triangle', dur: 0.55, gain: 0.14, attack: 0.015 })
      swell(c, d, { start: 0.05, dur: 0.6, gain: 0.08 })
    },
  },

  eliminated: {
    retro: (c, d) => {
      const notes = [392, 311, 262]
      notes.forEach((f, i) => tone(c, d, { start: i * 0.12, freq: f, type: 'square', dur: 0.16, gain: 0.14, attack: 0.005 }))
      tone(c, d, { start: 0.4, freq: 131, type: 'square', dur: 0.35, gain: 0.1, attack: 0.006, vibrato: { rate: 7, depth: 12 } })
    },
    moderno: (c, d) => {
      const notes = [440, 369.99, 293.66]
      notes.forEach((f, i) => tone(c, d, { start: i * 0.14, freq: f, type: 'triangle', dur: 0.3, gain: 0.15, attack: 0.012 }))
      tone(c, d, { start: 0.42, freq: 220, type: 'sine', dur: 0.5, gain: 0.12, attack: 0.02 })
    },
  },

  // Sting de avanço no mata-mata — vitória rápida, mais leve que a fanfarra
  advance: {
    retro: (c, d) => {
      const notes = [659.25, 880, 1174.66]
      notes.forEach((f, i) => tone(c, d, { start: i * 0.07, freq: f, type: 'square', dur: 0.11, gain: 0.15, attack: 0.004 }))
    },
    moderno: (c, d) => {
      const notes = [523.25, 783.99, 1046.5]
      notes.forEach((f, i) => tone(c, d, { start: i * 0.08, freq: f, type: 'triangle', dur: 0.28, gain: 0.16, attack: 0.008 }))
      swell(c, d, { start: 0.05, dur: 0.5, gain: 0.07 })
    },
  },

  // Fim de jornada sem o título (vice/eliminado na tela de resultado)
  defeat: {
    retro: (c, d) => {
      const notes = [440, 349.23, 262]
      notes.forEach((f, i) => tone(c, d, { start: i * 0.18, freq: f, type: 'square', dur: 0.22, gain: 0.13, attack: 0.006 }))
      tone(c, d, { start: 0.55, freq: 196, type: 'square', dur: 0.5, gain: 0.1, attack: 0.008, vibrato: { rate: 6, depth: 10 } })
    },
    moderno: (c, d) => {
      const notes = [392, 329.63, 261.63]
      notes.forEach((f, i) => tone(c, d, { start: i * 0.2, freq: f, type: 'triangle', dur: 0.45, gain: 0.13, attack: 0.02 }))
      swell(c, d, { start: 0.1, dur: 0.9, gain: 0.06 })
    },
  },

  champion: {
    retro: (c, d) => {
      const lead = [
        { f: 783.99, t: 0, dur: 0.1 },
        { f: 783.99, t: 0.1, dur: 0.1 },
        { f: 1046.5, t: 0.2, dur: 0.5 },
        { f: 1318.51, t: 0.55, dur: 0.7 },
      ]
      lead.forEach((n) => tone(c, d, { start: n.t, freq: n.f, type: 'square', dur: n.dur, gain: 0.15, attack: 0.005, vibrato: n.dur > 0.3 ? { rate: 12, depth: 25 } : null }))
      tone(c, d, { start: 0.2, freq: 659.25, type: 'square', dur: 0.5, gain: 0.07, attack: 0.005 })
      tone(c, d, { start: 0.55, freq: 880, type: 'square', dur: 0.7, gain: 0.07, attack: 0.005 })
      const shimmer = [1046.5, 1318.51, 1567.98, 2093]
      shimmer.forEach((f, i) => tone(c, d, { start: 1.2 + i * 0.05, freq: f, type: 'square', dur: 0.12, gain: 0.08, attack: 0.003 }))
    },
    moderno: (c, d) => {
      const arp = [523.25, 659.25, 783.99]
      arp.forEach((f, i) => tone(c, d, { start: i * 0.12, freq: f, type: 'triangle', dur: 0.3, gain: 0.16, attack: 0.006 }))
      const chord = [523.25, 659.25, 783.99, 1046.5]
      chord.forEach((f) => tone(c, d, { start: 0.42, freq: f, type: 'triangle', dur: 1.2, gain: 0.11, attack: 0.02 }))
      swell(c, d, { start: 0.2, dur: 1.4, gain: 0.16 })
    },
  },

  substitution: {
    retro: (c, d) => {
      tone(c, d, { freq: 880, type: 'square', dur: 0.08, gain: 0.12, slideTo: 660, attack: 0.003 })
      tone(c, d, { start: 0.02, freq: 440, type: 'square', dur: 0.1, gain: 0.1, slideTo: 660, attack: 0.003 })
    },
    moderno: (c, d) => {
      tone(c, d, { freq: 587.33, type: 'sine', dur: 0.12, gain: 0.14, slideTo: 440, attack: 0.006 })
      tone(c, d, { start: 0.04, freq: 440, type: 'sine', dur: 0.14, gain: 0.12, slideTo: 587.33, attack: 0.006 })
    },
  },

  // Confirmação ao ligar o som no toggle
  toggle: {
    retro: (c, d) => {
      tone(c, d, { freq: 880, type: 'square', dur: 0.05, gain: 0.12, attack: 0.003 })
      tone(c, d, { start: 0.05, freq: 1175, type: 'square', dur: 0.08, gain: 0.12, attack: 0.003 })
    },
    moderno: (c, d) => {
      tone(c, d, { freq: 660, type: 'sine', dur: 0.07, gain: 0.14, attack: 0.005 })
      tone(c, d, { start: 0.06, freq: 880, type: 'sine', dur: 0.1, gain: 0.12, attack: 0.005 })
    },
  },
}

export function playSound(name, theme = 'moderno', opts = {}) {
  const c = getCtx()
  if (!c) return
  const dest = getMaster()
  if (!dest) return
  const def = SOUNDS[name]
  if (!def) return
  const fn = def[theme] || def.moderno
  try {
    fn(c, dest, opts)
  } catch {
    /* navegador sem suporte ou contexto inválido — silencia */
  }
}
