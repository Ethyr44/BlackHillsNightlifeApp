import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

export default function Ticker() {
  const [messages, setMessages] = useState([])
  const [bgColor, setBgColor] = useState('rgba(0, 245, 255, 0.1)')
  const [textColor, setTextColor] = useState('#00f5ff')

  useEffect(() => {
    fetchTickerData()
    fetchColors()
    
    // Listen for Admins changing the messages in real-time
    const sub = supabase.channel('ticker-updates')
      .on('postgres', { event: '*', schema: 'public', table: 'ticker_messages' }, fetchTickerData)
      .subscribe()

    return () => supabase.removeChannel(sub)
  }, [])

  const fetchTickerData = async () => {
    // 1. Fetch Manual Messages from Admin Panel
    const { data: manualData } = await supabase
      .from('ticker_messages')
      .select('message')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })

    let manualMsgs = manualData ? manualData.map(m => m.message) : []

    // 2. Fetch TODAY'S Events
    const startOfDay = new Date()
    startOfDay.setHours(0, 0, 0, 0)
    
    const endOfDay = new Date()
    endOfDay.setHours(23, 59, 59, 999)

    const { data: eventsData } = await supabase
      .from('events')
      .select('title, venue, event_type')
      .eq('status', 'approved')
      .gte('event_date', startOfDay.toISOString())
      .lte('event_date', endOfDay.toISOString())

    // 3. Group events by type (e.g., Karaoke, Trivia)
    const groupedEvents = {}
    if (eventsData) {
        eventsData.forEach(ev => {
            const type = ev.event_type ? ev.event_type.toUpperCase() : 'EVENT'
            if (!groupedEvents[type]) groupedEvents[type] = []
            
            // Only add the venue if it isn't already in the list for this type
            if (!groupedEvents[type].includes(ev.venue)) {
                groupedEvents[type].push(ev.venue)
            }
        })
    }

    // 4. Format the automated string (e.g. "KARAOKE TODAY: Cheers, The Iron Phnx")
    const autoMsgs = Object.entries(groupedEvents).map(([type, venues]) => {
        return `${type} TODAY: ${venues.join(', ')}`
    })

    // Combine Automated Events + Manual Admin Messages
    const combined = [...autoMsgs, ...manualMsgs]
    
    // Fallback if absolutely nothing is happening and no manual messages exist
    if (combined.length === 0) combined.push("WELCOME TO BLACK HILLS NIGHTLIFE")

    setMessages(combined)
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
  const scrollSpeed = Math.max(tickerText.length * 0.15, 10) // 0.15s per char, minimum 10 seconds

  return (
    <div 
      className="w-full border-b overflow-hidden backdrop-blur-md pointer-events-none z-40 text-[10px] sm:text-xs font-bold uppercase tracking-widest py-2"
      style={{ backgroundColor: bgColor, color: textColor, borderColor: textColor }}
    >
      <div 
         className="whitespace-nowrap animate-ticker inline-block"
         style={{ animationDuration: `${scrollSpeed}s` }} 
      >
        <span className="mr-8">{tickerText}</span>
        {/* We duplicate the text once so the scrolling loop is perfectly seamless */}
        <span>{tickerText}</span>
      </div>

      <style>{`
        @keyframes ticker-scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-ticker {
          animation: ticker-scroll linear infinite;
          padding-left: 100vw; /* Ensures it starts off screen initially */
        }
      `}</style>
    </div>
  )
}