import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

export default function SplashScreen({ onComplete, currentUser }) {
  const [greeting, setGreeting] = useState("What's Boppin,");

  useEffect(() => {
    // Fetch the custom greeting from App Config
    const fetchGreeting = async () => {
      const { data } = await supabase
        .from('app_config')
        .select('config_value')
        .eq('config_key', 'splash_greeting')
        .single();
      
      if (data?.config_value) setGreeting(data.config_value);
    };

    fetchGreeting();

    const timer = setTimeout(() => {
      onComplete();
    }, 2500);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className="fixed inset-0 bg-[#090812] flex flex-col items-center justify-center z-[9999] px-4">
      <div className="w-32 h-32 mb-8 relative animate-pulse-glow">
        <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-[0_0_15px_rgba(59,130,246,0.5)]">
          <path d="M20 80 L50 20 L80 80" fill="none" stroke="#3b82f6" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M35 50 L65 50" fill="none" stroke="#3b82f6" strokeWidth="4" strokeLinecap="round"/>
        </svg>
      </div>

      <div className="text-center space-y-2 animate-slide-up">
        {/* Restored Custom Greeting */}
        <h1 className="text-blue-400 text-xl font-bold uppercase tracking-widest">{greeting}</h1>
        <h2 className="text-white text-4xl font-['Bebas_Neue'] tracking-widest drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]">
            {currentUser?.username || 'GUEST'}
        </h2>
        <div className="flex items-center justify-center gap-2 mt-4 text-gray-500">
          <div className="w-2 h-2 rounded-full bg-blue-500 animate-ping"></div>
          <span className="text-[10px] font-bold uppercase tracking-widest">Establishing Secure Connection...</span>
        </div>
      </div>
    </div>
  );
}