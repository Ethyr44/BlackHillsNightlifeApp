import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

export default function Leaderboard({ currentUser, onViewEntity }) {
  const [activeBoard, setActiveBoard] = useState('BHNL') // 'BHNL', 'KSocial', 'Trivia', 'CRAWL'
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)

  // 🟢 NEW: Crawl Specific States
  const [activeCrawlId, setActiveCrawlId] = useState(null)
  const [teamScores, setTeamScores] = useState([])

  // 🟢 NEW: Check if a Karaoke Crawl is running
  useEffect(() => {
    supabase.from('active_tournaments').select('id').eq('status', 'active').maybeSingle()
        .then(({data}) => { if (data) setActiveCrawlId(data.id) })
  }, [])

  useEffect(() => {
    async function fetchLeaderboard() {
      setLoading(true)
      
      // 🟢 NEW: If viewing the Crawl, aggregate the Team Scores
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

              const sortedTeams = Object.keys(totals)
                  .map(team => ({ team_name: team, period_points: totals[team] }))
                  .sort((a, b) => b.period_points - a.period_points)
              
              setTeamScores(sortedTeams)
          }
          setLoading(false)
          return // Stops the function so it doesn't run the normal user fetch
      }

      // 🔵 ORIGINAL: Standard Leaderboard Logic
      let orderBy = activeBoard === 'BHNL' ? 'lifestyle_points' : 'league_monthly'
      
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order(orderBy, { ascending: false, nullsFirst: false })
        .order('id', { ascending: true }) // 🟢 Secondary sort ensures ties are always stable
        .limit(100) // 🟢 Request extra rows so we can safely deduplicate
      
      if (!error && data) {
          const seenIds = new Set()
          const uniqueUsers = []
          
          for (const u of data) {
              if (!seenIds.has(u.id)) {
                  seenIds.add(u.id)
                  uniqueUsers.push({
                      user_id: u.id,
                      username: u.username,
                      account_type: u.account_type,
                      profile_pic: u.profile_pic,
                      period_points: u[orderBy] || 0
                  })
                  if (uniqueUsers.length === 20) break; // Keep strictly 20 unique users
              }
          }
          setUsers(uniqueUsers)
      } else {
          setUsers([])
      }
      setLoading(false)
    }
    
    if (activeBoard !== 'Trivia') fetchLeaderboard()
    else { setUsers([]); setLoading(false); }
  }, [activeBoard, activeCrawlId]) // Added activeCrawlId to dependencies

  return (
    <div className="max-w-2xl mx-auto animate-fade-in pb-32">
      <div className="p-4 pt-6 sticky top-[68px] sm:top-[76px] bg-[#030712]/95 backdrop-blur-xl z-40 border-b border-gray-800 shadow-xl">
         <h2 className="text-5xl font-['Bebas_Neue'] text-white tracking-wider" style={{ textShadow: '0 0 15px rgba(255,255,255,0.2)' }}>
            THE RANKINGS
         </h2>
         
         <div className="flex gap-2 mt-4 bg-gray-900 p-1.5 rounded-xl border border-gray-800 shadow-inner overflow-x-auto hide-scrollbar">
            {/* 🔵 ORIGINAL TABS */}
            {['BHNL', 'KSocial', 'Trivia'].map(tab => (
               <button 
                 key={tab} 
                 onClick={() => setActiveBoard(tab)}
                 className={`flex-1 min-w-[80px] py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${
                    activeBoard === tab 
                    ? 'bg-blue-600 text-white shadow-[0_0_15px_rgba(59,130,246,0.5)]' 
                    : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800'
                 }`}
               >
                 {tab}
               </button>
            ))}

            {/* 🟢 NEW: Dynamic Crawl Tab */}
            {activeCrawlId && (
                <button 
                    onClick={() => setActiveBoard('CRAWL')}
                    className={`flex-1 min-w-[80px] py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${
                        activeBoard === 'CRAWL' 
                        ? 'bg-purple-600 text-white shadow-[0_0_15px_rgba(147,51,234,0.5)]' 
                        : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800'
                    }`}
                >
                    CRAWL
                </button>
            )}
         </div>
      </div>

      <div className="p-4">
        {loading ? (
            <div className="flex justify-center p-10">
                <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
        ) : activeBoard === 'CRAWL' ? (
            // 🟢 NEW: Crawl Team Rankings UI
            <div className="space-y-4">
                {teamScores.length === 0 && <p className="text-center text-gray-500 text-xs py-10 font-bold uppercase tracking-widest">No points scored yet.</p>}
                {teamScores.map((team, index) => (
                    <div key={team.team_name} className={`flex items-center p-4 rounded-3xl border-2 transition-colors ${index === 0 ? 'bg-yellow-900/20 border-yellow-500 shadow-[0_0_20px_rgba(234,179,8,0.2)]' : 'bg-[#090812] border-gray-800'}`}>
                        <div className="w-10 text-2xl font-['Bebas_Neue'] text-gray-500">{index + 1}</div>
                        <div className="flex-1">
                            <h4 className={`font-bold text-xl leading-tight ${index === 0 ? 'text-yellow-400' : 'text-white'}`}>Team {team.team_name}</h4>
                            <span className="text-[10px] font-bold text-purple-500 uppercase tracking-widest bg-purple-900/20 px-2 py-0.5 rounded border border-purple-500/20">Crawl Team</span>
                        </div>
                        <div className="text-right">
                            <span className={`font-['Bebas_Neue'] text-4xl ${index === 0 ? 'text-yellow-400' : 'text-purple-400'}`} style={{ textShadow: index === 0 ? '0 0 10px rgba(234,179,8,0.8)' : '0 0 5px rgba(168,85,247,0.5)' }}>
                                {team.period_points}
                            </span>
                            <span className="block text-[10px] uppercase text-gray-500 font-bold tracking-widest mt-1">Total Pts</span>
                        </div>
                    </div>
                ))}
            </div>
        ) : users.length === 0 ? (
            <div className="text-center p-10 border border-dashed border-gray-800 rounded-3xl">
                <p className="text-gray-500 font-bold uppercase tracking-widest text-sm">Leaderboard Empty</p>
                <p className="text-gray-600 text-xs mt-2">Rankings will update as points are earned.</p>
            </div>
        ) : (
            // 🔵 ORIGINAL: Standard User Rankings UI
            <div className="space-y-4">
              {users.map((user, index) => {
                  const isTop3 = index < 3
                  const isMe = currentUser?.username === user.username
                  
                  return (
                    <div key={user.user_id} className={`flex items-center p-4 rounded-3xl border-2 transition-colors ${isMe ? 'bg-yellow-900/10 border-yellow-500/50' : 'bg-[#090812] border-gray-800 hover:border-gray-600'}`}>
                      <div className="w-10 text-2xl font-['Bebas_Neue'] text-gray-500">{index + 1}</div>
                      <img 
                        src={user.profile_pic || `https://api.dicebear.com/7.x/shapes/svg?seed=${encodeURIComponent(user.username)}`} 
                        alt={user.username} 
                        onClick={() => onViewEntity(user.username)}
                        className={`w-12 h-12 rounded-full border-2 ${isMe ? 'border-yellow-400' : isTop3 ? 'border-blue-500' : 'border-gray-700'} object-cover bg-black cursor-pointer hover:border-blue-400 transition-colors`} 
                        referrerPolicy="no-referrer" 
                        onError={(e) => { e.target.onerror = null; e.target.src = `https://api.dicebear.com/7.x/shapes/svg?seed=${encodeURIComponent(user.username)}` }} 
                      />
                      <div className="flex-1 ml-4">
                        <h4 onClick={() => onViewEntity(user.username)} className={`font-bold text-lg leading-tight cursor-pointer transition-colors ${isMe ? 'text-yellow-400' : 'text-white hover:text-blue-400'}`}>
                            {user.username} {isMe && <span className="text-[10px] ml-1 text-yellow-500">(You)</span>}
                        </h4>
                        <span className="text-[10px] font-bold text-blue-500 uppercase tracking-widest bg-blue-900/20 px-2 py-0.5 rounded border border-blue-500/20">{user.account_type}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-['Bebas_Neue'] text-3xl text-blue-400" style={{ textShadow: '0 0 5px rgba(59,130,246,0.5)' }}>
                            {user.period_points}
                        </span>
                        <span className="block text-[10px] uppercase text-gray-500 font-bold tracking-widest mt-1">Pts</span>
                      </div>
                    </div>
                  )
              })}
            </div>
        )}
      </div>
    </div>
  )
}