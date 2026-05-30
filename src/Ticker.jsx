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

    // 2. Fetch all approved events to process recurring ones locally
    const today = new Date()
    const todayDayOfWeek = today.getDay()
    const dateString = today.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase()

    const { data: eventsData } = await supabase
      .from('events')
      .select('title, venue, event_type, event_date, recurring_weekly')
      .eq('status', 'approved')

    // Filter for TODAY using safe date parsing and recurring checks
    const todaysEvents = (eventsData || []).filter(e => {
        const rawDate = e.event_date;
        const safeDateStr = rawDate.includes('Z') || rawDate.includes('+') ? rawDate : rawDate + 'Z';
        const eDate = new Date(safeDateStr);

        if (e.recurring_weekly) {
            return eDate.getDay() === todayDayOfWeek;
        }
        
        return eDate.getFullYear() === today.getFullYear() &&
               eDate.getMonth() === today.getMonth() &&
               eDate.getDate() === today.getDate();
    })

    // 3. Group today's filtered events by type (e.g., Karaoke, Trivia)
    const groupedEvents = {}
    todaysEvents.forEach(ev => {
        const type = ev.event_type ? ev.event_type.toUpperCase() : 'EVENT'
        if (!groupedEvents[type]) groupedEvents[type] = []
        
        // Only add the venue if it isn't already in the list for this type
        if (!groupedEvents[type].includes(ev.venue)) {
            groupedEvents[type].push(ev.venue)
        }
    })

    // 4. Construct the "What's Boppin!" Master String
    let autoString = `WHATS BOPPIN! | ${dateString}`
    
    const eventTypes = Object.keys(groupedEvents)
    if (eventTypes.length > 0) {
        const typeStrings = eventTypes.map(type => `${type}: ${groupedEvents[type].join(', ')}`)
        autoString += ` | ${typeStrings.join(' | ')}`
    }

    // Combine Automated Events String + Manual Admin Messages
    const combined = [autoString, ...manualMsgs]

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