import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import { getBlackHillsDate } from './utils'

export default function Ticker() {
  const [messages, setMessages] = useState([])
  const [bgColor, setBgColor] = useState('rgba(79,140,255,0.08)')
  const [textColor, setTextColor] = useState('rgba(180,210,255,0.85)')

  useEffect(() => {
    // Initial fetch on mount
    fetchTickerData()
    fetchColors()
    
    // Listen for manual updates from the Admin Panel
    const sub = supabase.channel('ticker-updates')
      .on('postgres', { event: '*', schema: 'public', table: 'ticker_messages' }, fetchTickerData)
      .subscribe()

    // 30-minute interval (1,800,000 milliseconds) to keep weather and date fresh
    const weatherInterval = setInterval(() => {
      fetchTickerData()
    }, 1800000)

    // Cleanup both the subscription and the interval when the component unmounts
    return () => {
      supabase.removeChannel(sub)
      clearInterval(weatherInterval)
    }
  }, [])

  const fetchTickerData = async () => {
    const today = getBlackHillsDate()
    const startOfToday = new Date(today)
    startOfToday.setHours(0, 0, 0, 0)

    // 1. Fetch Manual Messages, Weather, Approved Events, Total Accounts, and Today's Active Visitors in parallel
    const [manualRes, weatherRes, eventsRes, totalUsersRes, activeTodayRes] = await Promise.all([
      supabase
        .from('ticker_messages')
        .select('message')
        .eq('is_active', true)
        .order('sort_order', { ascending: true }),
      fetch('https://api.open-meteo.com/v1/forecast?latitude=44.0805&longitude=-103.2310&current=temperature_2m&temperature_unit=fahrenheit').catch(() => null),
      supabase
        .from('events')
        .select('title, venue, event_type, event_date, recurring_weekly')
        .eq('status', 'approved'),
      supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true }),
      supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .gte('last_active', startOfToday.toISOString())
    ])

    let manualMsgs = manualRes?.data ? manualRes.data.map(m => m.message) : []
    const totalAccounts = totalUsersRes?.count ?? 0
    const visitedToday = Math.max(activeTodayRes?.count ?? 0, 1)

    // 2. Parse Live Weather Data (Rapid City)
    let weatherString = ''
    try {
      if (weatherRes && weatherRes.ok) {
        const weatherData = await weatherRes.json()
        const currentTemp = Math.round(weatherData.current.temperature_2m)
        weatherString = `🌡️ RAPID CITY: ${currentTemp}°F`
      }
    } catch (error) {
      console.error("Failed to fetch weather data for ticker", error)
    }

    // 3. Date Logic & Event Filtering (Anchored to Black Hills Time)
    const todayDayOfWeek = today.getDay()
    const dateString = today.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase()

    const eventsData = eventsRes?.data || []

    const todaysEvents = eventsData.filter(e => {
        const rawDate = e.event_date
        const safeDateStr = rawDate.includes('Z') || rawDate.includes('+') ? rawDate : rawDate + 'Z'
        const eDate = getBlackHillsDate(safeDateStr)
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

    // 4. Construct Final String
    let autoString = `WHAT'S BOPPIN' — ${dateString}`
    if (weatherString) {
        autoString += `   ·   ${weatherString}`
    }
    autoString += `   ·   👥 TOTAL ACCOUNTS: ${totalAccounts.toLocaleString()}   ·   🔥 VISITED TODAY: ${visitedToday.toLocaleString()}`
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
  const scrollSpeed = Math.max(tickerText.length * 0.20, 13.3)

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
        {/* Removed the duplicate span, leaving just one */}
        <span>{tickerText}</span>
      </div>
    </div>
  )
}
