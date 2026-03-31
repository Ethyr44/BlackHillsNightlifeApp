import { useState, useEffect } from 'react'

export default function SplashScreen({ username, onComplete }) {
  const [phase, setPhase] = useState('night')
  const [fadeState, setFadeState] = useState('opacity-100')

  useEffect(() => {
    // 1. Calculate the Time of Day
    const hour = new Date().getHours()
    if (hour >= 6 && hour < 10) setPhase('dawn')
    else if (hour >= 10 && hour < 17) setPhase('day')
    else if (hour >= 17 && hour < 20) setPhase('dusk')
    else setPhase('night')

    // 2. Start the self-destruct sequence (3 seconds total)
    const timer = setTimeout(() => {
      setFadeState('opacity-0 pointer-events-none') // Fade out and disable clicks
      setTimeout(onComplete, 1000) // Wait 1 second for the fade animation to finish before destroying the component
    }, 3000)

    return () => clearTimeout(timer)
  }, [onComplete])

  // The Dynamic Visual Engine
  const theme = {
    dawn: { bg: 'bg-gradient-to-b from-indigo-900 via-purple-600 to-orange-400', text: 'text-white drop-shadow-md', b1: 'fill-indigo-950', b2: 'fill-indigo-900', b3: 'fill-indigo-800' },
    day: { bg: 'bg-gradient-to-b from-blue-400 to-cyan-200', text: 'text-white drop-shadow-lg', b1: 'fill-slate-800', b2: 'fill-slate-700', b3: 'fill-slate-600' },
    dusk: { bg: 'bg-gradient-to-b from-orange-600 via-pink-600 to-purple-900', text: 'text-white drop-shadow-lg', b1: 'fill-gray-950', b2: 'fill-gray-900', b3: 'fill-gray-800' },
    night: { bg: 'bg-gradient-to-b from-slate-900 via-[#090812] to-black', text: 'text-blue-400 drop-shadow-[0_0_15px_rgba(59,130,246,0.8)]', b1: 'fill-black', b2: 'fill-gray-950', b3: 'fill-[#090812]' }
  }

  const currentTheme = theme[phase]

  return (
    <div className={`fixed inset-0 z-[500] flex flex-col items-center justify-center ${currentTheme.bg} transition-opacity duration-1000 ease-in-out ${fadeState}`}>
       
       {/* Celestial Bodies */}
       {phase === 'night' && <div className="absolute top-24 right-24 w-16 h-16 bg-blue-100 rounded-full blur-[2px] shadow-[0_0_40px_rgba(255,255,255,0.8)] animate-pulse"></div>}
       {phase === 'day' && <div className="absolute top-24 right-24 w-24 h-24 bg-yellow-300 rounded-full blur-[4px] shadow-[0_0_60px_rgba(253,224,71,0.8)]"></div>}

       {/* The Greeting */}
       <div className="z-10 text-center animate-fade-in -translate-y-16">
         <h1 className={`text-6xl sm:text-7xl font-['Bebas_Neue'] tracking-wider ${currentTheme.text} transition-colors duration-1000`}>
           What's Boppin,<br/>{username || 'Rapid City'}!
         </h1>
       </div>

       {/* SVG Parallax Cityscape */}
       <div className="absolute bottom-0 w-full h-[50vh] overflow-hidden flex items-end">
          {/* Layer 3: Back */}
          <svg className={`absolute bottom-0 w-[120%] h-[60%] -left-[10%] ${currentTheme.b3} opacity-50 animate-slide-up-slow`} viewBox="0 0 1000 200" preserveAspectRatio="none">
            <path d="M0,200 L0,150 L50,150 L50,100 L100,100 L100,130 L150,130 L150,80 L200,80 L200,160 L250,160 L250,90 L300,90 L300,120 L350,120 L350,60 L400,60 L400,140 L450,140 L450,70 L500,70 L500,110 L550,110 L550,50 L600,50 L600,150 L650,150 L650,90 L700,90 L700,130 L750,130 L750,70 L800,70 L800,160 L850,160 L850,100 L900,100 L900,140 L950,140 L950,80 L1000,80 L1000,200 Z" />
          </svg>
          {/* Layer 2: Mid */}
          <svg className={`absolute bottom-0 w-[110%] h-[50%] -left-[5%] ${currentTheme.b2} opacity-80 animate-slide-up-med`} viewBox="0 0 1000 200" preserveAspectRatio="none">
            <path d="M0,200 L0,120 L80,120 L80,70 L160,70 L160,140 L240,140 L240,90 L320,90 L320,110 L400,110 L400,60 L480,60 L480,150 L560,150 L560,80 L640,80 L640,130 L720,130 L720,50 L800,50 L800,110 L880,110 L880,70 L960,70 L960,140 L1000,140 L1000,200 Z" />
          </svg>
          {/* Layer 1: Front */}
          <svg className={`absolute bottom-0 w-full h-[40%] ${currentTheme.b1} animate-slide-up-fast`} viewBox="0 0 1000 200" preserveAspectRatio="none">
            <path d="M0,200 L0,100 L100,100 L100,60 L180,60 L180,130 L260,130 L260,80 L350,80 L350,150 L420,150 L420,70 L500,70 L500,110 L580,110 L580,50 L660,50 L660,140 L750,140 L750,90 L850,90 L850,120 L920,120 L920,60 L1000,60 L1000,200 Z" />
          </svg>

          {/* Glowing Windows for Night Mode */}
          {phase === 'night' && (
             <div className="absolute bottom-0 w-full h-[40%] animate-fade-in" style={{ animationDelay: '1s' }}>
                <div className="absolute bottom-10 left-[12%] w-1 h-3 bg-blue-400 shadow-[0_0_8px_#60a5fa]"></div>
                <div className="absolute bottom-20 left-[15%] w-1 h-3 bg-blue-400 shadow-[0_0_8px_#60a5fa]"></div>
                <div className="absolute bottom-16 left-[28%] w-1 h-3 bg-purple-400 shadow-[0_0_8px_#c084fc]"></div>
                <div className="absolute bottom-24 left-[45%] w-1 h-3 bg-blue-400 shadow-[0_0_8px_#60a5fa]"></div>
                <div className="absolute bottom-12 left-[52%] w-1 h-3 bg-pink-400 shadow-[0_0_8px_#f472b6]"></div>
                <div className="absolute bottom-28 left-[68%] w-1 h-3 bg-blue-400 shadow-[0_0_8px_#60a5fa]"></div>
                <div className="absolute bottom-16 left-[72%] w-1 h-3 bg-purple-400 shadow-[0_0_8px_#c084fc]"></div>
                <div className="absolute bottom-20 left-[88%] w-1 h-3 bg-cyan-400 shadow-[0_0_8px_#22d3ee]"></div>
             </div>
          )}
       </div>
    </div>
  )
}