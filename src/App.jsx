import { useState } from 'react'
import { ThemeProvider, useTheme } from './components/ThemeContext'
import { LangProvider } from './i18n/LangContext'
import HomeScreen from './screens/HomeScreen'
import './App.css'

function AppShell() {
  const { theme } = useTheme()
  const [screen, setScreen] = useState('home')

  return (
    <div className={`theme-${theme} app-shell min-h-screen w-full max-w-[360px] flex flex-col`}>
      {screen === 'home' && <HomeScreen onPlay={() => setScreen('mode')} />}
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
