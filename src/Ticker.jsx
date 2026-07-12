import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

export default function Ticker() {
  const [messages, setMessages] = useState([])
  const [bgColor, setBgColor] = useState('rgba(79,140,255,0.08)')
  const [textColor, setTextColor] = useState('rgba(180,210,255,0.85)')

  useEffect(() => {
    fetchTickerData()
    fetchColors()
    const sub = supabase.channel('ticker-updates')
      .on('postgres', { event: '*', schema: 'public', table: 'ticker_messages' }, fetchTickerData)
      .subscribe()
    return () => supabase.removeChannel(sub)
  }, [])

  const fetchTickerData = async () => {
    const { data: manualData } = await supabase
      .from('ticker_messages')
      .select('message')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })

    let manualMsgs = manualData ? manualData.map(m => m.message) : []

    const today = new Date()
    const todayDayOfWeek = today.getDay()
    const dateString = today.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase()

    const { data: eventsData } = await supabase
      .from('events')
      .select('title, venue, event_type, event_date, recurring_weekly')
      .eq('status', 'approved')

    const todaysEvents = (eventsData || []).filter(e => {
      const rawDate = e.event_date
      const safeDateStr = rawDate.includes('Z') || rawDate.includes('+') ? rawDate : rawDate + 'Z'
      const eDate = new Date(safeDateStr)
      if (e.recurring_weekly) return eDate.getDay() === todayDayOfWeek
      return eDate.getFullYear() === today.getFullYear() &&
             eDate.getMonth() === today.getMonth() &&
             eDate.getDate() === today.getDate()
    })

    const grouped = { 'KARAOKE': [], 'LIVE MUSIC': [], 'OPEN MIC': [], 'TRIVIA': [], 'OTHER': [] }
    todaysEvents.forEach(ev => {
      const raw = ev.event_type ? ev.event_type.toUpperCase() : 'GENERAL'
      let bucket = 'OTHER'
      if (raw.includes('KARAOKE')) bucket = 'KARAOKE'
      else if (raw.includes('LIVE MUSIC')) bucket = 'LIVE MUSIC'
      else if (raw.includes('OPEN MIC')) bucket = 'OPEN MIC'
      else if (raw.includes('TRIVIA')) bucket = 'TRIVIA'
      if (!grouped[bucket].includes(ev.venue)) grouped[bucket].push(ev.venue)
    })

    let autoString = `WHAT'S BOPPIN' — ${dateString}`
    const typeStrings = []
    const order = ['KARAOKE', 'LIVE MUSIC', 'OPEN MIC', 'TRIVIA', 'OTHER']
    order.forEach(bucket => {
      if (grouped[bucket].length > 0) {
        typeStrings.push(`${bucket}: ${grouped[bucket].join(' · ')}`)
      }
    })
    if (typeStrings.length > 0) autoString += `  ·  ${typeStrings.join('  ·  ')}`

    setMessages([autoString, ...manualMsgs])
  }

  const fetchColors = async () => {
    const { data } = await supabase.from('app_config').select('*').in('config_key', ['ticker_bg_color', 'ticker_text_color'])
    if (data) {
      data.forEach(c => {
        if (c.config_key === 'ticker_bg_color') setBgColor(c.config_value)
        if (c.config_key === 'ticker_text_color') setTextColor(c.config_value)
      })
    }
  }

  if (messages.length === 0) return null

  const tickerText = messages.join('   ·   ')
  const scrollSpeed = Math.max(tickerText.length * 0.15, 10)

  return (
    <div
      className="w-full overflow-hidden pointer-events-none"
      style={{
        backgroundColor: bgColor,
        color: textColor,
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      <div
        className="whitespace-nowrap animate-ticker inline-block py-1.5"
        style={{ animationDuration: `${scrollSpeed}s`, fontSize: 11, fontFamily: 'Inter, sans-serif', fontWeight: 600, letterSpacing: '0.06em' }}
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
