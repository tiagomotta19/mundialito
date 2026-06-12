import { useEffect, useRef, useState } from 'react'
import { useTheme } from '../components/ThemeContext'
import { useLang } from '../i18n/LangContext'
import { pickGroup, getGroup, getTeamStrength, getGroupDifficulty } from '../engine/simulator'
import Flag from '../components/Flag'
import DeskHeader from '../components/DeskHeader'
import { useMediaQuery, DESK_QUERY } from '../components/useMediaQuery'

const GROUP_IDS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L']

const DIFFICULTY_COLOR = {
  hard: 'var(--color-danger)',
  balanced: 'var(--color-warn)',
  easy: 'var(--color-ok)',
}

// Faixa visual das barras de força (OVR médio típico fica entre ~62 e ~82)
const strengthPct = (strength) => Math.max(8, Math.min(100, ((strength - 62) / 20) * 100))

export default function GroupScreen({ gameConfig, onBack, onContinue }) {
  const { theme } = useTheme()
  const { t } = useLang()
  const isRetro = theme === 'retro'
  const isDesk = useMediaQuery(DESK_QUERY)

  // Força real do time do usuário: média de OVR dos 11, mesma conta dos adversários
  const userStrength = gameConfig?.players?.length
    ? Math.round(
        (gameConfig.players.reduce((sum, p) => sum + p.ovr, 0) / gameConfig.players.length) * 10
      ) / 10
    : null

  const [phase, setPhase] = useState('drawing') // drawing | landed | revealed
  const [activeIdx, setActiveIdx] = useState(0)
  const [groupId, setGroupId] = useState(null)
  const timersRef = useRef([])

  // Sorteio: o destaque percorre as fichas A-L desacelerando até parar no
  // grupo sorteado (cadeia única de timeouts — sem interval paralelo), ~1,5s
  useEffect(() => {
    const result = pickGroup()
    const targetIdx = GROUP_IDS.indexOf(result)
    const totalSteps = GROUP_IDS.length + targetIdx
    let step = 0

    const tick = () => {
      setActiveIdx(step % GROUP_IDS.length)
      if (step >= totalSteps) {
        setGroupId(result)
        setPhase('landed')
        timersRef.current.push(setTimeout(() => setPhase('revealed'), 750))
        return
      }
      const progress = step / totalSteps
      const delay = 38 + 130 * progress ** 3
      step++
      timersRef.current.push(setTimeout(tick, delay))
    }
    tick()

    return () => timersRef.current.forEach(clearTimeout)
  }, [])

  const group = groupId ? getGroup(groupId) : null
  const difficulty = group ? getGroupDifficulty(group.avg_strength) : null
  const rows = group
    ? group.teams.map((name) =>
        name === group.weakest
          ? { isUser: true, name: gameConfig?.teamName || t('your_team'), strength: userStrength }
          : { isUser: false, name, strength: getTeamStrength(name) }
      )
    : []

  // Blocos compartilhados entre os layouts mobile e desktop (só muda a escala)
  const drawingBlock = (phase === 'drawing' || phase === 'landed') && (
    <div className="flex-1 flex flex-col items-center justify-center gap-6">
      <div className={`grid grid-cols-4 w-full ${isDesk ? 'gap-3' : 'gap-2'}`}>
        {GROUP_IDS.map((id, i) => {
          const isLanded = phase === 'landed' && i === activeIdx
          const isActive = phase === 'drawing' && i === activeIdx
          return (
            <div
              key={id}
              className={`flex items-center justify-center font-bold border-2 transition-transform duration-100 ${
                isDesk ? 'h-16 text-2xl' : 'h-12 text-lg'
              } ${isActive ? 'scale-110' : ''} ${isLanded ? 'animate-reveal-pop' : ''}`}
                  style={{
                    borderColor: isLanded
                      ? 'var(--color-btn-primary-border)'
                      : isActive
                        ? 'var(--color-accent)'
                        : 'var(--color-border)',
                    background: isLanded
                      ? 'var(--color-btn-primary-bg)'
                      : isActive
                        ? 'var(--color-highlight-bg)'
                        : 'transparent',
                    color: isLanded
                      ? 'var(--color-btn-primary-text)'
                      : isActive
                        ? 'var(--color-accent)'
                        : 'var(--color-text-secondary)',
                    borderRadius: 'var(--radius)',
                  }}
                >
                  {id}
                </div>
              )
            })}
          </div>
          <span
            className={`text-sm animate-pulse ${isRetro ? 'uppercase' : ''}`}
            style={{ color: 'var(--color-text-secondary)' }}
          >
            {t('group_drawing')}
          </span>
        </div>
  )

  const revealedBlock = phase === 'revealed' && group && (
    <>
      {/* Grupo + dificuldade */}
      <div className="flex flex-col items-center gap-2 mb-5">
        <span
          className={`font-bold animate-reveal-pop ${isDesk ? 'text-6xl' : 'text-5xl'} ${isRetro ? 'uppercase' : ''}`}
          style={{ color: 'var(--color-accent)' }}
        >
          {t('group_label')} {groupId}
        </span>
            <span
              className={`text-xs font-bold px-2 py-1 border-2 animate-rise-in ${isRetro ? 'uppercase' : ''}`}
              style={{
                animationDelay: '150ms',
                color: DIFFICULTY_COLOR[difficulty],
                borderColor: DIFFICULTY_COLOR[difficulty],
                borderRadius: 'var(--radius)',
              }}
            >
              {t(`group_difficulty_${difficulty}`)}
            </span>
          </div>

          {/* Times do grupo */}
          <div className="flex flex-col gap-2 mb-3">
            {rows.map((row, i) => (
              <div
                key={row.name}
                className="flex items-center gap-2 p-2.5 border-2 animate-slide-in"
                style={{
                  animationDelay: `${200 + i * 150}ms`,
                  borderColor: row.isUser ? 'var(--color-btn-primary-border)' : 'var(--color-border)',
                  background: row.isUser ? 'var(--color-btn-primary-bg)' : 'transparent',
                  borderRadius: 'var(--radius)',
                }}
              >
                {row.isUser ? (
                  <span className="text-xl leading-none">🏳️</span>
                ) : (
                  <Flag team={row.name} width={26} />
                )}
                <span
                  className={`flex-1 text-sm font-bold ${isRetro ? 'uppercase' : ''}`}
                  style={{ color: row.isUser ? 'var(--color-btn-primary-text)' : 'var(--color-text)' }}
                >
                  {row.name}
                  {row.isUser && (
                    <span
                      className="ml-2 text-[10px] font-bold px-1.5 py-0.5 border align-middle"
                      style={{
                        borderColor: 'var(--color-btn-primary-text)',
                        color: 'var(--color-btn-primary-text)',
                        borderRadius: 'var(--radius)',
                      }}
                    >
                      {t('you_badge')}
                    </span>
                  )}
                </span>
                <div className="flex items-center gap-2">
                  <div
                    className="w-14 h-1.5 overflow-hidden rounded-full"
                    style={{ background: 'var(--color-highlight-bg)' }}
                  >
                    <div
                      className="h-full rounded-full animate-bar-grow"
                      style={{
                        animationDelay: `${400 + i * 150}ms`,
                        width: `${strengthPct(row.strength)}%`,
                        background: row.isUser ? 'var(--color-btn-primary-text)' : 'var(--color-accent)',
                      }}
                    />
                  </div>
                  <span
                    className="w-8 text-right text-sm font-bold"
                    style={{
                      color: row.isUser ? 'var(--color-btn-primary-text)' : 'var(--color-text-secondary)',
                    }}
                  >
                    {row.strength}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <p
            className="text-center text-xs animate-rise-in"
            style={{ animationDelay: '800ms', color: 'var(--color-text-muted)' }}
          >
            {t('group_replaces').replace('{team}', group.weakest)}
          </p>

      {!isDesk && <div className="flex-1" />}

      <button
        type="button"
        onClick={() => onContinue({ groupId })}
        className={`w-full py-3 font-bold border-2 animate-rise-in ${isDesk ? 'mt-4' : ''} ${isRetro ? 'uppercase' : ''}`}
        style={{
          animationDelay: '900ms',
          background: 'var(--color-btn-primary-bg)',
          color: 'var(--color-btn-primary-text)',
          borderColor: 'var(--color-btn-primary-border)',
          borderRadius: 'var(--radius)',
        }}
      >
        {t('btn_start_cup')}
      </button>
    </>
  )

  // ---------------------------------------------------------------------------
  // Layout desktop (>900px): sorteio e revelação centralizados em coluna única
  // sob o cabeçalho editorial
  // ---------------------------------------------------------------------------
  if (isDesk) {
    return (
      <div className="min-h-dvh w-full flex flex-col">
        <DeskHeader onBack={onBack} />
        <div className="flex-1 w-full max-w-[640px] mx-auto px-8 py-12 flex flex-col justify-center">
          {drawingBlock}
          {revealedBlock}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-dvh w-full px-4 py-3">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <button
          type="button"
          onClick={onBack}
          aria-label={t('back')}
          className="flex items-center justify-center w-8 h-8 border-2 text-lg leading-none"
          style={{ borderColor: 'var(--color-border)', borderRadius: 'var(--radius)' }}
        >
          ←
        </button>
        <h1 className={`text-lg font-bold ${isRetro ? 'uppercase' : ''}`}>{t('group_title')}</h1>
      </div>

      {drawingBlock}
      {revealedBlock}
    </div>
  )
}
