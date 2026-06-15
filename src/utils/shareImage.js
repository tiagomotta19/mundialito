import { FORMATION_LAYOUTS } from '../components/formationLayouts'

// Gera um PNG 9:16 (1080×1920, formato Stories) com o resultado da campanha:
// wordmark MUNDIALITO, veredito, placar do último jogo, campinho com o time +
// OVRs, histórico da campanha e a URL. Desenhado à mão no canvas (sem
// dependências) lendo as cores do tema vigente. Assíncrono porque carrega a
// bandeira do adversário do flagcdn (emoji de bandeira não renderiza no Windows).
const W = 1080
const H = 1920
const SITE_URL = 'mundialito26pro.vercel.app'

function lastName(name) {
  return name.split(' ').pop()
}

// Reduz o tamanho da fonte até o texto caber em maxWidth (o verdito pode ser
// longo: "CAMPEÃO DO MUNDO", "16-AVOS DE FINAL"). Devolve o tamanho usado.
function fitFont(ctx, text, weight, maxWidth, startPx) {
  let size = startPx
  ctx.font = `${weight} ${size}px system-ui, sans-serif`
  while (ctx.measureText(text).width > maxWidth && size > 12) {
    size -= 2
    ctx.font = `${weight} ${size}px system-ui, sans-serif`
  }
  return size
}

// Texto com espaçamento entre letras (tracking), centralizado em cx
function drawTracked(ctx, str, cx, y, tracking) {
  const prev = ctx.textAlign
  ctx.textAlign = 'left'
  let total = 0
  for (const ch of str) total += ctx.measureText(ch).width + tracking
  total -= tracking
  let x = cx - total / 2
  for (const ch of str) {
    ctx.fillText(ch, x, y)
    x += ctx.measureText(ch).width + tracking
  }
  ctx.textAlign = prev
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
  forca,
  stats,
  lastScore,
  themeEl,
  strengthLabel = 'FORÇA',
  ctaLabel = 'Monte o seu',
}) {
  const css = getComputedStyle(themeEl || document.querySelector('.app-shell') || document.documentElement)
  const c = (name) => css.getPropertyValue(name).trim() || '#000'

  const bg = c('--color-bg')
  const text = c('--color-text')
  const textSec = c('--color-text-secondary')
  const accent = c('--color-accent')
  const danger = c('--color-danger') || accent
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

  // ----- Topo: marca discreta + fase em destaque + nome do time com força -----
  // Assinatura MUNDIALITO espaçada e secundária
  ctx.fillStyle = textSec
  ctx.font = '800 34px system-ui, sans-serif'
  drawTracked(ctx, 'MUNDIALITO', W / 2, 100, 8)

  // Veredito (campeão ou fase): protagonista, com auto-ajuste de tamanho
  const verdict = resultLabel.toUpperCase()
  ctx.fillStyle = champion ? accent : text
  fitFont(ctx, verdict, '900', W - 120, 104)
  ctx.fillText(verdict, W / 2, 215)

  // Nome do time + badge de Força na mesma linha (grupo centralizado)
  if (teamName) {
    const rowY = 285
    ctx.font = '700 44px system-ui, sans-serif'
    const nameW = ctx.measureText(teamName).width

    const hasForca = forca != null
    const badgeText = hasForca ? `${strengthLabel} ${forca}` : ''
    ctx.font = '800 30px system-ui, sans-serif'
    const badgeTextW = hasForca ? ctx.measureText(badgeText).width : 0
    const badgePadX = 22
    const badgeW = hasForca ? badgeTextW + badgePadX * 2 : 0
    const badgeH = 50
    const gap = hasForca ? 20 : 0
    const groupW = nameW + gap + badgeW
    let gx = (W - groupW) / 2

    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = text
    ctx.font = '700 44px system-ui, sans-serif'
    ctx.fillText(teamName, gx, rowY)
    gx += nameW + gap

    if (hasForca) {
      ctx.fillStyle = accent
      roundRect(ctx, gx, rowY - badgeH / 2, badgeW, badgeH, 25)
      ctx.fill()
      ctx.fillStyle = bg
      ctx.font = '800 30px system-ui, sans-serif'
      ctx.fillText(badgeText, gx + badgePadX, rowY + 1)
    }

    ctx.textAlign = 'center'
    ctx.textBaseline = 'alphabetic'
  }

  // ----- Placar do último jogo -----
  // "Time  2 × 1  Adversário [bandeira]" — centralizado, com o placar em destaque
  if (lastScore) {
    const scoreY = 360
    const nameFont = '700 36px system-ui, sans-serif'
    const scoreFont = '800 46px system-ui, sans-serif'
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

  // ----- Campinho vertical (viewBox 68×105) -----
  const pitchW = 640
  const pitchH = pitchW * (105 / 68)
  const pitchX = (W - pitchW) / 2
  const pitchY = 405

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
  const dotR = 32
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

  // ----- Quadro da campanha (abaixo do campo) — 2 linhas × 3 colunas -----
  // Cores por significado: pos = accent, neg = danger, neutral = text
  const items = stats || []
  if (items.length) {
    const boxX = 80
    const boxW = W - 160
    const boxY = pitchY + pitchH + 38
    const cols = 3
    const rows = Math.ceil(items.length / cols)
    const cellW = boxW / cols
    const cellH = 140
    const boxH = cellH * rows

    ctx.strokeStyle = border
    ctx.lineWidth = 2
    roundRect(ctx, boxX, boxY, boxW, boxH, 16)
    ctx.stroke()

    // Divisórias internas (linha horizontal entre as fileiras + verticais)
    ctx.beginPath()
    for (let r = 1; r < rows; r++) {
      ctx.moveTo(boxX, boxY + cellH * r)
      ctx.lineTo(boxX + boxW, boxY + cellH * r)
    }
    for (let col = 1; col < cols; col++) {
      ctx.moveTo(boxX + cellW * col, boxY + 18)
      ctx.lineTo(boxX + cellW * col, boxY + boxH - 18)
    }
    ctx.stroke()

    const toneColor = (tone) => (tone === 'pos' ? accent : tone === 'neg' ? danger : text)
    items.forEach((item, i) => {
      const col = i % cols
      const row = Math.floor(i / cols)
      const cx = boxX + cellW * col + cellW / 2
      const cy = boxY + cellH * row + 66
      ctx.fillStyle = toneColor(item.tone)
      ctx.font = '900 64px system-ui, sans-serif'
      ctx.fillText(String(item.value), cx, cy)
      ctx.fillStyle = textSec
      ctx.font = '600 26px system-ui, sans-serif'
      ctx.fillText(item.label, cx, cy + 42)
    })
  }

  // ----- Rodapé como CTA (pílula): "Monte o seu · site" -----
  const ctaText = `${ctaLabel}  ·  ${SITE_URL}`
  ctx.font = '800 36px system-ui, sans-serif'
  const ctaTextW = ctx.measureText(ctaText).width
  const ctaW = ctaTextW + 80
  const ctaH = 84
  const ctaX = (W - ctaW) / 2
  const ctaY = H - 180
  ctx.fillStyle = accent
  roundRect(ctx, ctaX, ctaY, ctaW, ctaH, ctaH / 2)
  ctx.fill()
  ctx.fillStyle = bg
  ctx.textBaseline = 'middle'
  ctx.fillText(ctaText, W / 2, ctaY + ctaH / 2 + 2)
  ctx.textBaseline = 'alphabetic'

  return canvas
}

function canvasToBlob(canvas) {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
}

// Download direto do PNG (comportamento de fallback no desktop / browsers sem
// Web Share API)
function downloadBlob(blob) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'mundialito.png'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function downloadShareImage(opts) {
  const canvas = await generateShareImage(opts)
  const blob = await canvasToBlob(canvas)
  if (!blob) return

  // Mobile com Web Share API: abre o sheet nativo do sistema (WhatsApp,
  // Instagram, etc.). Precisa do canShare com o arquivo — nem todo browser que
  // tem share() suporta compartilhar arquivos.
  const file = new File([blob], 'mundialito.png', { type: 'image/png' })
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      // Link vai DENTRO do texto (e não no campo `url`): com arquivo anexado o
      // WhatsApp mantém imagem + legenda, mas costuma descartar `url`.
      const caption = opts.shareCaption || 'Jogue agora o Mundialito!'
      await navigator.share({
        files: [file],
        title: 'Mundialito',
        text: `${caption} https://${SITE_URL}`,
      })
      return
    } catch (err) {
      // Usuário cancelou o sheet → não faz nada; qualquer outra falha cai no
      // download como rede de segurança.
      if (err && err.name === 'AbortError') return
    }
  }

  // Fallback: download direto do PNG
  downloadBlob(blob)
}
