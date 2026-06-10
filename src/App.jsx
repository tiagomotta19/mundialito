import { useState } from 'react'
import { ThemeProvider, useTheme } from './components/ThemeContext'
import { LangProvider } from './i18n/LangContext'
import HomeScreen from './screens/HomeScreen'
import ModeScreen from './screens/ModeScreen'
import './App.css'

function AppShell() {
  const { theme } = useTheme()
  const [screen, setScreen] = useState('home')
  const [, setGameConfig] = useState(null)

  return (
    <div className={`theme-${theme} app-shell min-h-screen w-full max-w-[360px] flex flex-col`}>
      {screen === 'home' && <HomeScreen onPlay={() => setScreen('mode')} />}
      {screen === 'mode' && (
        <ModeScreen
          onBack={() => setScreen('home')}
          onContinue={(config) => setGameConfig(config)}
        />
      )}
    </div>
  )
}

function App() {
  return (
    <ThemeProvider>
      <LangProvider>
        <AppShell />
      </LangProvider>
    </ThemeProvider>
  )
}

export default App
