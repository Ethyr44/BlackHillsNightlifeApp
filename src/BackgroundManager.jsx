import { memo, useState, useEffect } from 'react'
import Moonshower from './backgrounds/Moonshower'

const BackgroundManager = memo(function BackgroundManager() {
  const [themeMode, setThemeMode] = useState(() => localStorage.getItem('bhnl_theme_mode') || 'dark')

  useEffect(() => {
    const handleThemeChange = (e) => {
      const next = e?.detail || localStorage.getItem('bhnl_theme_mode') || 'dark'
      setThemeMode(next)
    }
    window.addEventListener('bhnl-theme-change', handleThemeChange)
    window.addEventListener('storage', handleThemeChange)
    return () => {
      window.removeEventListener('bhnl-theme-change', handleThemeChange)
      window.removeEventListener('storage', handleThemeChange)
    }
  }, [])

  // In Light Mode, completely unmount Moonshower and render a warm Black Hills sunset gradient backdrop
  if (themeMode === 'light') {
    return (
      <div
        className="fixed inset-0 z-0 pointer-events-none overflow-hidden transition-colors duration-300"
        style={{
          background:
            'radial-gradient(circle at 50% 14%, rgba(255, 224, 150, 0.55) 0%, transparent 48%), ' +
            'radial-gradient(circle at 85% 78%, rgba(214, 118, 178, 0.35) 0%, transparent 55%), ' +
            'linear-gradient(165deg, #f5b971 0%, #f2916b 34%, #e57a93 68%, #b388d9 100%)',
        }}
      />
    )
  }

  return (
    <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
      <Moonshower />
    </div>
  )
})

export default BackgroundManager
