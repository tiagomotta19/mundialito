import { FORMATION_LAYOUTS } from '../components/formationLayouts'

// Gera um PNG 9:16 (1080×1920, formato Stories) com o resultado da campanha:
// wordmark MUNDIALITO, veredito, placar do último jogo, campinho com o time +
// OVRs, histórico da campanha e a URL. Desenhado à mão no canvas (sem
// dependências) lendo as cores do tema vigente. Assíncrono porque carrega a
// bandeira do adversário do flagcdn (emoji de bandeira não renderiza no Windows).
const W = 1080
const H = 1920
const SITE_URL = 'mundialito-theta.vercel.app'

function lastName(name) {
  return name.split(' ').pop()
}

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.arcTo(x + w, y, x + w, y + h, rr)
  ctx.arcTo(x + w, y + h, x, y + h, rr)
  ctx.arcTo(x, y + h, x, y, rr)
  ctx.arcTo(x, y, x + w, y, rr)
  ctx.closePath()
}

// Carrega uma imagem com CORS liberado (flagcdn responde com Access-Control-*),
// resolvendo null em caso de falha para não travar a geração.
function loadImage(url) {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = url
  })
}

export async function generateShareImage({
  slots,
  formation,
  champion,
  resultLabel,
  teamName,
  stats,
  lastScore,
  themeEl,
}) {
  const css = getComputedStyle(themeEl || document.querySelector('.app-shell') || document.documentElement)
  const c = (name) => css.getPropertyValue(name).trim() || '#000'

  const bg = c('--color-bg')
  const text = c('--color-text')
  const textSec = c('--color-text-secondary')
  const accent = c('--color-accent')
  const field = c('--color-field')
  const fieldStripe = c('--color-field-stripe')
  const fieldLine = c('--color-field-line') || 'rgba(255,255,255,0.4)'
  const playerColor = c('--color-player-user')
  const border = c('--color-border') || textSec

  // Pré-carrega a bandeira do adversário antes de desenhar
  const flagImg = lastScore?.oppCode
    ? await loadImage(`https://flagcdn.com/w80/${lastScore.oppCode}.png`)
    : null

  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')

  // Fundo
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)

  ctx.textAlign = 'center'

  // Hierarquia tipográfica: logo discreta no topo, veredito (fase) em
  // destaque intermediário, nome do time logo abaixo
  ctx.fillStyle = text
  ctx.font = '900 72px system-ui, sans-serif'
  ctx.fillText('MUNDIALITO', W / 2, 130)

  // Veredito (campeão ou fase alcançada)
  ctx.fillStyle = champion ? accent : text
  ctx.font = '800 60px system-ui, sans-serif'
  ctx.fillText(resultLabel.toUpperCase(), W / 2, 210)

  // Nome do time
  if (teamName) {
    ctx.fillStyle = textSec
    ctx.font = '700 38px system-ui, sans-serif'
    ctx.fillText(teamName, W / 2, 262)
  }

  // ----- Placar do último jogo (entre o nome do time e o campinho) -----
  // "Time  2 × 1  Adversário [bandeira]" — centralizado, com o placar em destaque
  if (lastScore) {
    const scoreY = 330
    const nameFont = '700 36px system-ui, sans-serif'
    const scoreFont = '800 44px system-ui, sans-serif'
    const scoreStr = ` ${lastScore.userGoals} × ${lastScore.oppGoals} `
    const flagH = 36
    const flagW = flagImg ? Math.round(flagH * (flagImg.width / flagImg.height)) : 0
    const flagGap = flagImg ? 12 : 0

    ctx.textBaseline = 'middle'
    ctx.textAlign = 'left'
    ctx.font = nameFont
    const teamW = ctx.measureText(lastScore.teamName).width
    const oppW = ctx.measureText(lastScore.oppName).width
    ctx.font = scoreFont
    const scoreW = ctx.measureText(scoreStr).width

    const total = teamW + scoreW + oppW + flagGap + flagW
    let x = (W - total) / 2

    ctx.fillStyle = text
    ctx.font = nameFont
    ctx.fillText(lastScore.teamName, x, scoreY)
    x += teamW
    ctx.fillStyle = accent
    ctx.font = scoreFont
    ctx.fillText(scoreStr, x, scoreY)
    x += scoreW
    ctx.fillStyle = text
    ctx.font = nameFont
    ctx.fillText(lastScore.oppName, x, scoreY)
    x += oppW + flagGap
    if (flagImg) ctx.drawImage(flagImg, x, scoreY - flagH / 2, flagW, flagH)

    ctx.textBaseline = 'alphabetic'
    ctx.textAlign = 'center'
  }

  // ----- Campinho vertical (viewBox 68×105) — reduzido para abrir espaço -----
  const pitchW = 680
  const pitchH = pitchW * (105 / 68)
  const pitchX = (W - pitchW) / 2
  const pitchY = 375

  // Faixas do gramado
  ctx.save()
  roundRect(ctx, pitchX, pitchY, pitchW, pitchH, 12)
  ctx.clip()
  ctx.fillStyle = field
  ctx.fillRect(pitchX, pitchY, pitchW, pitchH)
  ctx.fillStyle = fieldStripe
  const stripe = pitchH / 12
  for (let i = 0; i < 12; i += 2) {
    ctx.fillRect(pitchX, pitchY + i * stripe, pitchW, stripe)
  }

  // Linhas do campo (coordenadas do PitchLines vertical, viewBox 68×105)
  const sx = pitchW / 68
  const sy = pitchH / 105
  const px = (vx) => pitchX + vx * sx
  const py = (vy) => pitchY + vy * sy
  ctx.strokeStyle = fieldLine
  ctx.lineWidth = 3
  ctx.strokeRect(px(0.5), py(0.5), 67 * sx, 104 * sy)
  ctx.beginPath()
  ctx.moveTo(px(0), py(52.5))
  ctx.lineTo(px(68), py(52.5))
  ctx.stroke()
  ctx.beginPath()
  ctx.ellipse(px(34), py(52.5), 9.15 * sx, 9.15 * sy, 0, 0, Math.PI * 2)
  ctx.stroke()
  ctx.strokeRect(px(13.84), py(0.5), 40.32 * sx, 16.5 * sy)
  ctx.strokeRect(px(13.84), py(88), 40.32 * sx, 16.5 * sy)
  ctx.restore()

  // Jogadores: mesma transformação do FieldPitch vertical
  // left = slot.y/68 ; top = (105 - slot.x)/105
  const layout = FORMATION_LAYOUTS[formation] || FORMATION_LAYOUTS['4-3-3']
  const dotR = 33
  layout.forEach((slot, i) => {
    const player = slots[i]?.player
    const cx = pitchX + (slot.y / 68) * pitchW
    const cy = pitchY + ((105 - slot.x) / 105) * pitchH

    // Bolinha
    ctx.beginPath()
    ctx.arc(cx, cy, dotR, 0, Math.PI * 2)
    ctx.fillStyle = player ? playerColor : 'rgba(0,0,0,0.25)'
    ctx.fill()
    ctx.lineWidth = 4
    ctx.strokeStyle = border
    ctx.stroke()

    if (player) {
      // OVR no centro
      ctx.fillStyle = '#1a1a1a'
      ctx.font = '800 30px system-ui, sans-serif'
      ctx.textBaseline = 'middle'
      ctx.fillText(String(player.ovr), cx, cy + 2)
      ctx.textBaseline = 'alphabetic'

      // Sobrenome em etiqueta abaixo
      const name = lastName(player.name).toUpperCase()
      ctx.font = '700 24px system-ui, sans-serif'
      const tw = ctx.measureText(name).width
      const padX = 9
      const labelW = tw + padX * 2
      const labelH = 32
      const lx = cx - labelW / 2
      const ly = cy + dotR + 8
      ctx.fillStyle = bg
      roundRect(ctx, lx, ly, labelW, labelH, 6)
      ctx.fill()
      ctx.lineWidth = 2
      ctx.strokeStyle = border
      ctx.stroke()
      ctx.fillStyle = text
      ctx.textBaseline = 'middle'
      ctx.fillText(name, cx, ly + labelH / 2 + 1)
      ctx.textBaseline = 'alphabetic'
    }
  })

  // ----- Histórico da campanha (abaixo do campo) — 2 linhas × 3 colunas -----
  const items = stats || []
  if (items.length) {
    const statsTop = pitchY + pitchH + 78
    const cols = 3
    const colW = W / cols
    const rowGap = 125
    items.forEach((item, i) => {
      const col = i % cols
      const row = Math.floor(i / cols)
      const cx = colW * col + colW / 2
      const cy = statsTop + row * rowGap
      ctx.fillStyle = accent
      ctx.font = '900 60px system-ui, sans-serif'
      ctx.fillText(String(item.value), cx, cy)
      ctx.fillStyle = textSec
      ctx.font = '600 27px system-ui, sans-serif'
      ctx.fillText(item.label, cx, cy + 40)
    })
  }

  // URL no rodapé, com padding e separador — fora da área do campo
  ctx.strokeStyle = border
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(W / 2 - 200, H - 150)
  ctx.lineTo(W / 2 + 200, H - 150)
  ctx.stroke()
  ctx.fillStyle = accent
  ctx.font = '800 44px system-ui, sans-serif'
  ctx.fillText(SITE_URL, W / 2, H - 90)

  return canvas
}

export async function downloadShareImage(opts) {
  const canvas = await generateShareImage(opts)
  canvas.toBlob((blob) => {
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'mundialito.png'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }, 'image/png')
}
