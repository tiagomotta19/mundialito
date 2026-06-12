import { useState } from 'react'
import { useTheme } from '../components/ThemeContext'
import { useLang } from '../i18n/LangContext'
import MatchPlay from '../components/MatchPlay'
import GroupTable from '../components/GroupTable'
import DeskHeader from '../components/DeskHeader'
import { useMediaQuery, DESK_QUERY } from '../components/useMediaQuery'

export default function GroupStageScreen({ groupId, matches, table, qualified, mode, userFormation, teamName, onComplete }) {
  const { theme } = useTheme()
  const { t } = useLang()
  const isRetro = theme === 'retro'
  const isDesk = useMediaQuery(DESK_QUERY)

  const [idx, setIdx] = useState(0)
  const [view, setView] = useState('match') // match | table

  if (view === 'match') {
    const isLast = idx === matches.length - 1
    const matchEl = (
      <MatchPlay
        key={idx}
        match={matches[idx]}
        mode={mode}
        userFormation={userFormation}
        teamName={teamName}
        stageLabel={`${t('stage_group')} · ${t('round_label').replace('{n}', idx + 1)}`}
        continueLabel={isLast ? t('btn_view_table') : t('btn_next_match')}
        onContinue={() => (isLast ? setView('table') : setIdx(idx + 1))}
      />
    )
    // No desktop o MatchPlay traz o próprio cabeçalho e ocupa a tela toda
    if (isDesk) return matchEl
    return <div className="flex flex-col h-dvh w-full px-4 py-3">{matchEl}</div>
  }

  const statusBanner = (
    <p
      className={`text-center text-sm font-bold px-3 py-2 border-2 animate-rise-in ${isRetro ? 'uppercase' : ''}`}
      style={{
        animationDelay: '400ms',
        color: qualified ? 'var(--color-ok)' : 'var(--color-danger)',
        borderColor: qualified ? 'var(--color-ok)' : 'var(--color-danger)',
        borderRadius: 'var(--radius)',
      }}
    >
      {qualified ? `✅ ${t('qualified_msg')}` : `❌ ${t('eliminated_group_msg')}`}
    </p>
  )

  const continueButton = (
    <button
      type="button"
      onClick={onComplete}
      className={`w-full py-3 font-bold border-2 ${isRetro ? 'uppercase' : ''}`}
      style={{
        background: 'var(--color-btn-primary-bg)',
        color: 'var(--color-btn-primary-text)',
        borderColor: 'var(--color-btn-primary-border)',
        borderRadius: 'var(--radius)',
      }}
    >
      {qualified ? t('btn_continue') : t('btn_view_result')} →
    </button>
  )

  // ---------------------------------------------------------------------------
  // Tabela final do grupo — desktop: card central com cabeçalho editorial
  // ---------------------------------------------------------------------------
  if (isDesk) {
    return (
      <div className="min-h-dvh w-full flex flex-col">
        <DeskHeader
          right={
            <span
              className={`text-xs font-bold px-2.5 py-1 border-2 ${isRetro ? 'uppercase' : ''}`}
              style={{
                borderColor: 'var(--color-border)',
                color: 'var(--color-text-secondary)',
                borderRadius: 'var(--radius)',
              }}
            >
              {t('stage_group')}
            </span>
          }
        />

        <div className="flex-1 w-full max-w-[640px] mx-auto px-8 py-12 flex flex-col justify-center gap-6">
          <h1 className={`text-4xl font-black text-center ${isRetro ? 'uppercase' : ''}`}>
            {t('group_label')} {groupId}
          </h1>
          <GroupTable table={table} teamName={teamName} />
          {statusBanner}
          {continueButton}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-dvh w-full px-4 py-3">
      {/* Bloco centralizado verticalmente, como no desktop */}
      <div className="flex-1 flex flex-col justify-center gap-4">
        <h1 className={`text-center text-2xl font-black ${isRetro ? 'uppercase' : ''}`}>
          {t('group_label')} {groupId}
        </h1>

        <GroupTable table={table} teamName={teamName} />

        {statusBanner}
      </div>

      {continueButton}
    </div>
  )
}
