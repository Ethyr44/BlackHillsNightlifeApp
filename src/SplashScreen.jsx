import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

export default function SplashScreen({ username, phase, onComplete }) {
  const [fadeState, setFadeState] = useState('opacity-100');
  const [greeting, setGreeting] = useState("What's Boppin,");
  const [animateIn, setAnimateIn] = useState(false);

  useEffect(() => {
    // 1. Fetch the custom Admin greeting
    const fetchGreeting = async () => {
      const { data } = await supabase
        .from('app_config')
        .select('config_value')
        .eq('config_key', 'splash_greeting')
        .single();
      if (data?.config_value) setGreeting(data.config_value);
    };
    fetchGreeting();

    // 2. Trigger entry animations
    setTimeout(() => setAnimateIn(true), 100);

    // 3. Handle the self-destruct fade out
    const fadeTimer = setTimeout(() => setFadeState('opacity-0'), 2500);
    const completeTimer = setTimeout(() => onComplete(), 3000);
    
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(completeTimer);
    };
  }, [onComplete]);

  // THE 7-PHASE DYNAMIC VISUAL ENGINE
  const themeMap = {
    Morning: { bg: 'bg-gradient-to-b from-indigo-900 via-pink-700 to-orange-300', text: 'text-white drop-shadow-md', b1: 'fill-indigo-950', b2: 'fill-indigo-900', b3: 'fill-indigo-800', celestial: 'bg-yellow-100 shadow-[0_0_40px_rgba(254,240,138,0.8)]', pos: 'bottom-[40%] left-[20%]' },
    Day: { bg: 'bg-gradient-to-b from-blue-500 to-cyan-300', text: 'text-white drop-shadow-lg', b1: 'fill-slate-800', b2: 'fill-slate-700', b3: 'fill-slate-600', celestial: 'bg-yellow-200 shadow-[0_0_50px_rgba(253,224,71,1)]', pos: 'top-[20%] left-[30%]' },
    Noon: { bg: 'bg-gradient-to-b from-blue-600 to-blue-300', text: 'text-white drop-shadow-lg', b1: 'fill-slate-800', b2: 'fill-slate-700', b3: 'fill-slate-600', celestial: 'bg-yellow-300 shadow-[0_0_60px_rgba(253,224,71,1)]', pos: 'top-[10%] left-[50%] -translate-x-1/2' },
    Afternoon: { bg: 'bg-gradient-to-b from-blue-500 via-orange-300 to-orange-200', text: 'text-white drop-shadow-lg', b1: 'fill-slate-800', b2: 'fill-slate-700', b3: 'fill-slate-600', celestial: 'bg-orange-200 shadow-[0_0_50px_rgba(253,186,116,1)]', pos: 'top-[30%] right-[30%]' },
    Evening: { bg: 'bg-gradient-to-b from-indigo-800 via-purple-600 to-orange-500', text: 'text-white drop-shadow-md', b1: 'fill-gray-900', b2: 'fill-gray-800', b3: 'fill-gray-700', celestial: 'bg-orange-400 shadow-[0_0_40px_rgba(249,115,22,1)]', pos: 'bottom-[40%] right-[15%]' },
    Night: { bg: 'bg-gradient-to-b from-[#090812] via-purple-900/50 to-blue-900/50', text: 'text-blue-200 drop-shadow-[0_0_10px_rgba(59,130,246,0.5)]', b1: 'fill-black', b2: 'fill-[#0d1326]', b3: 'fill-[#171e36]', celestial: 'bg-gray-100 shadow-[0_0_30px_rgba(255,255,255,0.8)]', pos: 'top-[20%] right-[20%]' },
    Midnight: { bg: 'bg-[#090812]', text: 'text-cyan-400 drop-shadow-[0_0_15px_rgba(0,245,255,0.8)]', b1: 'fill-black', b2: 'fill-[#050505]', b3: 'fill-[#0a0a0a]', celestial: 'bg-gray-200 shadow-[0_0_40px_rgba(255,255,255,0.6)]', pos: 'top-[10%] left-[50%] -translate-x-1/2' }
  };

  // Fallback to Midnight if phase is somehow undefined
  const currentTheme = themeMap[phase] || themeMap['Midnight'];
  const isDark = phase === 'Night' || phase === 'Midnight';

  // The Master Skyline Path
  const skylinePath = "M0,200 L0,100 L100,100 L100,60 L180,60 L180,130 L260,130 L260,80 L350,80 L350,150 L420,150 L420,70 L500,70 L500,110 L580,110 L580,50 L660,50 L660,140 L750,140 L750,90 L850,90 L850,120 L920,120 L920,60 L1000,60 L1000,200 Z";

  return (
    <div className={`fixed inset-0 flex flex-col items-center justify-center z-[9999] overflow-hidden transition-opacity duration-700 ease-in-out ${fadeState} ${currentTheme.bg}`}>
      
      {/* CELESTIAL BODY (Sun/Moon) */}
      <div 
        className={`absolute w-16 h-16 sm:w-24 sm:h-24 rounded-full transition-all duration-[2000ms] ease-out ${currentTheme.celestial} ${currentTheme.pos}`}
        style={{ transform: animateIn ? 'translateY(0)' : 'translateY(50px)', opacity: animateIn ? 1 : 0 }}
      >
        {/* Adds moon craters if it's night */}
        {isDark && (
           <>
              <div className="absolute top-[20%] left-[25%] w-3 h-3 bg-black/10 rounded-full"></div>
              <div className="absolute top-[45%] left-[60%] w-4 h-4 bg-black/10 rounded-full"></div>
              <div className="absolute bottom-[20%] left-[40%] w-2 h-2 bg-black/10 rounded-full"></div>
           </>
        )}
      </div>

      {/* CITYSCAPE */}
      <div className="absolute bottom-0 w-full h-[40%] min-h-[250px] pointer-events-none">
        
        {/* Layer 3: Far Background */}
        <svg viewBox="0 0 1000 200" preserveAspectRatio="none" className="absolute bottom-0 w-full h-full opacity-60 scale-y-125 origin-bottom">
          <path d={skylinePath} className={`${currentTheme.b3} transition-colors duration-1000`} />
        </svg>

        {/* Layer 2: Midground */}
        <svg viewBox="0 0 1000 200" preserveAspectRatio="none" className="absolute bottom-0 w-full h-[90%] opacity-80 scale-x-[-1] scale-y-110 origin-bottom">
          <path d={skylinePath} className={`${currentTheme.b2} transition-colors duration-1000`} />
        </svg>

        {/* Layer 1: Foreground */}
        <svg viewBox="0 0 1000 200" preserveAspectRatio="none" className="absolute bottom-0 w-full h-[75%] origin-bottom">
          <path d={skylinePath} className={`${currentTheme.b1} transition-colors duration-1000`} />
        </svg>

        {/* GLOWING NEON WINDOWS (Only visible at Night/Midnight) */}
        {isDark && (
            <div className={`absolute bottom-0 w-full h-full transition-opacity duration-1000 delay-500 ${animateIn ? 'opacity-100' : 'opacity-0'}`}>
                {/* Randomly scattered windows matching the grid flow */}
                <div className="absolute bottom-[25%] left-[8%] w-1.5 h-3 bg-cyan-400 shadow-[0_0_8px_#22d3ee]"></div>
                <div className="absolute bottom-[45%] left-[15%] w-1.5 h-3 bg-pink-500 shadow-[0_0_8px_#ec4899]"></div>
                <div className="absolute bottom-[30%] left-[22%] w-1 h-3 bg-blue-400 shadow-[0_0_8px_#60a5fa]"></div>
                <div className="absolute bottom-[50%] left-[35%] w-2 h-2 bg-yellow-300 shadow-[0_0_8px_#fde047]"></div>
                <div className="absolute bottom-[20%] left-[45%] w-1.5 h-4 bg-purple-500 shadow-[0_0_8px_#a855f7]"></div>
                <div className="absolute bottom-[60%] left-[52%] w-1 h-3 bg-cyan-400 shadow-[0_0_8px_#22d3ee]"></div>
                <div className="absolute bottom-[35%] left-[65%] w-1.5 h-3 bg-pink-500 shadow-[0_0_8px_#ec4899]"></div>
                <div className="absolute bottom-[40%] right-[25%] w-1.5 h-3 bg-blue-400 shadow-[0_0_8px_#60a5fa]"></div>
                <div className="absolute bottom-[55%] right-[15%] w-2 h-2 bg-yellow-300 shadow-[0_0_8px_#fde047]"></div>
                <div className="absolute bottom-[30%] right-[8%] w-1.5 h-4 bg-purple-500 shadow-[0_0_8px_#a855f7]"></div>
            </div>
        )}
      </div>

      {/* FOREGROUND TEXT / GREETING */}
      <div 
        className="relative z-10 text-center flex flex-col items-center justify-center -mt-20 transition-all duration-1000 ease-out"
        style={{ transform: animateIn ? 'scale(1)' : 'scale(0.9)', opacity: animateIn ? 1 : 0 }}
      >
        <h1 className={`text-2xl sm:text-3xl font-bold tracking-[0.2em] uppercase mb-2 ${currentTheme.text} transition-colors duration-1000`}>
            {greeting}
        </h1>
        <h2 className={`text-6xl sm:text-7xl font-['Bebas_Neue'] tracking-widest ${currentTheme.text} transition-colors duration-1000`}>
            {username || 'GUEST'}
        </h2>

        {/* Loading Bar */}
        <div className="flex items-center gap-3 mt-8 bg-black/30 backdrop-blur-sm px-4 py-2 rounded-full border border-white/10">
          <div className={`w-2 h-2 rounded-full animate-ping ${isDark ? 'bg-cyan-400' : 'bg-white'}`}></div>
          <span className={`text-[10px] font-bold uppercase tracking-widest ${isDark ? 'text-cyan-200' : 'text-white/80'}`}>
            Connecting to {phase} Scene...
          </span>
        </div>
      </div>

    </div>
  );
}