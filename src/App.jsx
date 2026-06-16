import { useState } from 'react'
import { Analytics } from '@vercel/analytics/react'
import { ThemeProvider, useTheme } from './components/ThemeContext'
import { LangProvider } from './i18n/LangContext'
import { SoundProvider } from './audio/SoundContext'
import SoundToggle from './components/SoundToggle'
import HomeScreen from './screens/HomeScreen'
import ModeScreen from './screens/ModeScreen'
import DraftScreen from './screens/DraftScreen'
import GroupScreen from './screens/GroupScreen'
import CupScreen from './screens/CupScreen'
import './App.css'

// Moldura de largura por tela: o canvas temático ocupa a janela inteira;
// abaixo do breakpoint `desk` as telas ficam em 360px centralizados
// (mobile-first), e acima dele cada tela assume seu layout desktop.
function Frame({ children }) {
  return (
    <div className="w-full mx-auto flex-1 flex flex-col max-w-[360px] desk:max-w-none">
      {children}
    </div>
  )
}

function AppShell() {
  const { theme } = useTheme()
  const [screen, setScreen] = useState('home')
  const [gameConfig, setGameConfig] = useState(null)

  return (
    <div className={`theme-${theme} app-shell min-h-dvh w-full flex flex-col`}>
      {/* Toggle de som: nas telas de jogo o mobile usa este botão fixo; o
          desktop o exibe no DeskHeader (desk:hidden esconde este lá). A Home
          tem o seu próprio inline na barra de controles. */}
      {screen !== 'home' && (
        <SoundToggle className="desk:hidden fixed top-2 right-2 z-30" />
      )}
      {screen === 'home' && (
        <Frame>
          <HomeScreen onPlay={() => setScreen('mode')} />
        </Frame>
      )}
      {screen === 'mode' && (
        <Frame>
          <ModeScreen
            onBack={() => setScreen('home')}
            onContinue={(config) => {
              setGameConfig(config)
              setScreen('draft')
            }}
          />
        </Frame>
      )}
      {screen === 'draft' && (
        <Frame>
          <DraftScreen
            formation={gameConfig?.formation}
            mode={gameConfig?.mode}
            onBack={() => setScreen('mode')}
            onContinue={(draftInfo) => {
              setGameConfig((prev) => ({ ...prev, ...draftInfo }))
              setScreen('group')
            }}
          />
        </Frame>
      )}
      {screen === 'group' && (
        <Frame>
          <GroupScreen
            gameConfig={gameConfig}
            onBack={() => setScreen('draft')}
            onContinue={(groupInfo) => {
              setGameConfig((prev) => ({ ...prev, ...groupInfo }))
              setScreen('cup')
            }}
          />
        </Frame>
      )}
      {screen === 'cup' && (
        <Frame>
          <CupScreen
            gameConfig={gameConfig}
            onFinish={() => {
              setGameConfig(null)
              setScreen('home')
            }}
          />
        </Frame>
      )}
    </div>
  )
}

function App() {
  return (
    <ThemeProvider>
      <LangProvider>
        <SoundProvider>
          <AppShell />
          <Analytics />
        </SoundProvider>
      </LangProvider>
    </ThemeProvider>
  )
}

export default App
