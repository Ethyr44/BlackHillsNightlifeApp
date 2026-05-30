import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

export default function Ticker() {
  const [messages, setMessages] = useState([])
  const [bgColor, setBgColor] = useState('rgba(0, 245, 255, 0.1)')
  const [textColor, setTextColor] = useState('#00f5ff')

  useEffect(() => {
    fetchTickerData()
    fetchColors()
    
    const sub = supabase.channel('ticker-updates')
      .on('postgres', { event: '*', schema: 'public', table: 'ticker_messages' }, fetchTickerData)
      .subscribe()

    return () => supabase.removeChannel(sub)
  }, [])

  const fetchTickerData = async () => {
    // 1. Fetch Manual Messages
    const { data: manualData } = await supabase
      .from('ticker_messages')
      .select('message')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })

    let manualMsgs = manualData ? manualData.map(m => m.message) : []

    // 2. Fetch all approved events
    const today = new Date()
    const todayDayOfWeek = today.getDay()
    const dateString = today.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase()

    const { data: eventsData } = await supabase
      .from('events')
      .select('title, venue, event_type, event_date, recurring_weekly')
      .eq('status', 'approved')

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

    // 3. STRICT BUCKETING: Group today's events into predefined categories
    const groupedEvents = {
        'KARAOKE': [],
        'LIVE MUSIC': [],
        'OPEN MIC': [],
        'TRIVIA': [],
        'OTHER': []
    }

    todaysEvents.forEach(ev => {
        const rawType = ev.event_type ? ev.event_type.toUpperCase() : 'GENERAL'
        
        // Determine which bucket this event falls into (funneling everything else to OTHER)
        let bucket = 'OTHER'
        if (rawType.includes('KARAOKE')) bucket = 'KARAOKE'
        else if (rawType.includes('LIVE MUSIC')) bucket = 'LIVE MUSIC'
        else if (rawType.includes('OPEN MIC')) bucket = 'OPEN MIC'
        else if (rawType.includes('TRIVIA')) bucket = 'TRIVIA'

        // Only add the venue if it isn't already listed in this specific bucket
        if (!groupedEvents[bucket].includes(ev.venue)) {
            groupedEvents[bucket].push(ev.venue)
        }
    })

    // 4. Construct the "What's Boppin!" Master String
    let autoString = `WHATS BOPPIN! | ${dateString}`
    
    // Build the string sequentially based on the buckets that actually have venues today
    const typeStrings = []
    const displayOrder = ['KARAOKE', 'LIVE MUSIC', 'OPEN MIC', 'TRIVIA', 'OTHER']
    
    displayOrder.forEach(bucket => {
        if (groupedEvents[bucket].length > 0) {
            // Joins the venues with your requested // separator
            typeStrings.push(`${bucket}: ${groupedEvents[bucket].join(' // ')}`)
        }
    })

    if (typeStrings.length > 0) {
        autoString += `   |   ${typeStrings.join('   |   ')}`
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
  const scrollSpeed = Math.max(tickerText.length * 0.15, 10) 

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
        <span>{tickerText}</span>
      </div>

      <style>{`
        @keyframes ticker-scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-ticker {
          animation: ticker-scroll linear infinite;
          padding-left: 100vw; 
        }
      `}</style>
    </div>
  )
}