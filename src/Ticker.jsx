import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

export default function Ticker() {
  const [messages, setMessages] = useState([])
  const [bgColor, setBgColor] = useState('rgba(0, 245, 255, 0.1)')
  const [textColor, setTextColor] = useState('#00f5ff')

  useEffect(() => {
    fetchMessages()
    fetchColors()
    
    // Listen for Admins changing the messages in real-time
    const sub = supabase.channel('ticker-updates')
      .on('postgres', { event: '*', schema: 'public', table: 'ticker_messages' }, fetchMessages)
      .subscribe()

    return () => supabase.removeChannel(sub)
  }, [])

  const fetchMessages = async () => {
    const { data } = await supabase
      .from('ticker_messages')
      .select('message')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
    
    if (data) setMessages(data.map(d => d.message))
  }

  const fetchColors = async () => {
    const { data } = await supabase.from('app_config').select('*').in('config_key', ['ticker_bg_color', 'ticker_text_color'])
    if (data) {
        data.forEach(config => {
            if (config.config_key === 'ticker_bg_color') setBgColor(config.config_value)
            if (config.config_key === 'ticker_text_color') setTextColor(config.config_value)
        })
    }
  }

  if (messages.length === 0) return null

  // Join all active messages with a bullet point separator
  const tickerText = messages.join('   •   ')

  return (
    // THE FIX: Removed "fixed", "left-0", "right-0", and the style tag. 
    // It is now a standard, static block element that will naturally stack in your layout.
    <div 
      className="w-full border-b overflow-hidden backdrop-blur-md pointer-events-none z-40 text-[10px] sm:text-xs font-bold uppercase tracking-widest py-2"
      style={{ backgroundColor: bgColor, color: textColor, borderColor: textColor }}
    >
      <div className="whitespace-nowrap animate-ticker inline-block">
        <span className="mr-8">{tickerText}</span>
        {/* We duplicate the text once so the scrolling loop is perfectly seamless */}
        <span>{tickerText}</span>
      </div>

      <style>{`
        @keyframes ticker {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-ticker {
          animation: ticker 20s linear infinite;
        }
      `}</style>
    </div>
  )
}