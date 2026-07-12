import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

export default function Leaderboard({ currentUser, onViewEntity }) {
  const [activeBoard, setActiveBoard] = useState('BHNL')
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeCrawlId, setActiveCrawlId] = useState(null)
  const [teamScores, setTeamScores] = useState([])

  useEffect(() => {
    supabase.from('active_tournaments').select('id').eq('status', 'active').maybeSingle()
      .then(({ data }) => { if (data) setActiveCrawlId(data.id) })
  }, [])

  useEffect(() => {
    async function fetchLeaderboard() {
      setLoading(true)

      if (activeBoard === 'CRAWL' && activeCrawlId) {
        const { data } = await supabase
          .from('tournament_history')
          .select('points_earned, profiles!inner(current_team)')
          .eq('tournament_id', activeCrawlId)
        if (data) {
          const totals = data.reduce((acc, row) => {
            const team = row.profiles.current_team || 'Unassigned'
            acc[team] = (acc[team] || 0) + row.points_earned
            return acc
          }, {})
          setTeamScores(
            Object.keys(totals)
              .map(team => ({ team_name: team, period_points: totals[team] }))
              .sort((a, b) => b.period_points - a.period_points)
          )
        }
        setLoading(false)
        return
      }

      const orderBy = activeBoard === 'BHNL' ? 'lifestyle_points' : 'league_monthly'
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .order(orderBy, { ascending: false, nullsFirst: false })
        .order('id', { ascending: true })
        .limit(100)

      if (data) {
        const seen = new Set()
        const unique = []
        for (const u of data) {
          if (!seen.has(u.id)) {
            seen.add(u.id)
            unique.push({ user_id: u.id, username: u.username, account_type: u.account_type, profile_pic: u.profile_pic, period_points: u[orderBy] || 0 })
            if (unique.length === 20) break
          }
        }
        setUsers(unique)
      } else {
        setUsers([])
      }
      setLoading(false)
    }

    if (activeBoard !== 'Trivia') fetchLeaderboard()
    else { setUsers([]); setLoading(false) }
  }, [activeBoard, activeCrawlId])

  const TABS = ['BHNL', 'KSocial', 'Trivia', ...(activeCrawlId ? ['CRAWL'] : [])]

  const RANK_STYLES = [
    { bg: 'rgba(245,197,66,0.12)', border: 'rgba(245,197,66,0.3)', numColor: '#f5c542', glow: '0 0 12px rgba(245,197,66,0.3)', medal: '🥇' },
    { bg: 'rgba(180,190,210,0.08)', border: 'rgba(180,190,210,0.2)', numColor: 'rgba(200,210,230,0.7)', glow: 'none', medal: '🥈' },
    { bg: 'rgba(200,140,80,0.08)', border: 'rgba(200,140,80,0.2)', numColor: '#cd7c3a', glow: 'none', medal: '🥉' },
  ]

  return (
    <div className="max-w-2xl mx-auto animate-fade-in-up pb-32">

      {/* Sticky header */}
      <div
        className="sticky top-0 px-4 pt-6 pb-4 z-40"
        style={{
          background: 'rgba(7,13,26,0.85)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <h2
          className="text-2xl font-bold text-white mb-4"
          style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
        >
          Rankings
        </h2>

        {/* Tab pills */}
        <div
          className="flex gap-1.5 p-1 rounded-xl overflow-x-auto"
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.07)',
            scrollbarWidth: 'none',
          }}
        >
          {TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveBoard(tab)}
              className="flex-1 min-w-[72px] py-2 px-3 rounded-lg text-[11px] font-semibold uppercase tracking-wider transition-all duration-150"
              style={{
                fontFamily: 'Inter, sans-serif',
                ...(activeBoard === tab
                  ? {
                      background: 'linear-gradient(135deg, #4f8cff, #2463d4)',
                      color: '#fff',
                      boxShadow: '0 2px 12px rgba(79,140,255,0.35)',
                    }
                  : {
                      color: 'rgba(255,255,255,0.35)',
                    }),
              }}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pt-4 space-y-2">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-[#4f8cff]/20 border-t-[#4f8cff] rounded-full animate-spin" />
          </div>
        ) : activeBoard === 'CRAWL' ? (
          teamScores.length === 0 ? (
            <EmptyState label="No points scored yet." />
          ) : (
            teamScores.map((team, i) => (
              <div
                key={team.team_name}
                className="flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all duration-150"
                style={{
                  background: i < 3 ? RANK_STYLES[i].bg : 'rgba(255,255,255,0.025)',
                  border: `1px solid ${i < 3 ? RANK_STYLES[i].border : 'rgba(255,255,255,0.06)'}`,
                  boxShadow: i < 3 ? RANK_STYLES[i].glow : 'none',
                }}
              >
                <span className="text-lg w-6 text-center">{i < 3 ? RANK_STYLES[i].medal : <span className="text-xs font-bold text-white/20" style={{ fontFamily: 'Inter, sans-serif' }}>#{i + 1}</span>}</span>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-white/80" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                    Team {team.team_name}
                  </p>
                </div>
                <span
                  className="text-lg font-bold"
                  style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", color: i < 3 ? RANK_STYLES[i].numColor : 'rgba(255,255,255,0.55)' }}
                >
                  {team.period_points}
                </span>
              </div>
            ))
          )
        ) : users.length === 0 ? (
          <EmptyState label="No rankings yet." />
        ) : (
          users.map((user, i) => {
            const isMe = currentUser?.username === user.username
            const rank = RANK_STYLES[i]
            return (
              <div
                key={user.user_id}
                className="flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-150"
                style={{
                  background: isMe
                    ? 'rgba(245,197,66,0.08)'
                    : i < 3 ? rank.bg : 'rgba(255,255,255,0.025)',
                  border: `1px solid ${isMe ? 'rgba(245,197,66,0.25)' : i < 3 ? rank.border : 'rgba(255,255,255,0.06)'}`,
                  boxShadow: isMe ? '0 0 16px rgba(245,197,66,0.12)' : 'none',
                }}
              >
                {/* Rank */}
                <div className="w-7 text-center flex-shrink-0">
                  {i < 3
                    ? <span className="text-base">{rank.medal}</span>
                    : <span className="text-xs font-bold text-white/25" style={{ fontFamily: 'Inter, sans-serif' }}>#{i + 1}</span>
                  }
                </div>

                {/* Avatar */}
                <img
                  src={user.profile_pic || `https://api.dicebear.com/7.x/shapes/svg?seed=${encodeURIComponent(user.username)}`}
                  alt={user.username}
                  loading="lazy" decoding="async"
                  onClick={() => onViewEntity(user.username)}
                  className="w-9 h-9 rounded-full object-cover flex-shrink-0 cursor-pointer transition-transform hover:scale-105"
                  style={{ border: `2px solid ${isMe ? 'rgba(245,197,66,0.5)' : i < 3 ? rank.border : 'rgba(255,255,255,0.1)'}` }}
                  referrerPolicy="no-referrer"
                  onError={e => { e.target.onerror = null; e.target.src = `https://api.dicebear.com/7.x/shapes/svg?seed=${encodeURIComponent(user.username)}` }}
                />

                {/* Name + badge */}
                <div className="flex-1 min-w-0">
                  <button
                    onClick={() => onViewEntity(user.username)}
                    className="text-sm font-semibold text-left truncate block transition-colors hover:text-[#4f8cff]"
                    style={{ color: isMe ? '#f5c542' : 'rgba(255,255,255,0.85)', fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                  >
                    {user.username}
                    {isMe && <span className="ml-1.5 text-[9px] font-semibold uppercase tracking-wider text-[#f5c542]/60" style={{ fontFamily: 'Inter, sans-serif' }}>You</span>}
                  </button>
                  <span
                    className="text-[9px] font-semibold uppercase tracking-wider text-white/25"
                    style={{ fontFamily: 'Inter, sans-serif' }}
                  >
                    {user.account_type}
                  </span>
                </div>

                {/* Points */}
                <div className="text-right flex-shrink-0">
                  <span
                    className="text-base font-bold"
                    style={{
                      fontFamily: "'Plus Jakarta Sans', sans-serif",
                      color: isMe ? '#f5c542' : i < 3 ? rank.numColor : 'rgba(255,255,255,0.6)',
                    }}
                  >
                    {user.period_points.toLocaleString()}
                  </span>
                  <span className="block text-[9px] text-white/20 font-medium" style={{ fontFamily: 'Inter, sans-serif' }}>pts</span>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

function EmptyState({ label }) {
  return (
    <div className="py-16 text-center">
      <div className="w-12 h-12 rounded-2xl bg-white/[0.04] flex items-center justify-center mx-auto mb-4">
        <svg className="w-6 h-6 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
        </svg>
      </div>
      <p className="text-sm text-white/30 font-medium" style={{ fontFamily: 'Inter, sans-serif' }}>{label}</p>
    </div>
  )
}
