import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

export default function AdminEconomy() {
  const [pointValues, setPointValues] = useState([])
  const [users, setUsers] = useState([])
  const [searchUser, setSearchUser] = useState('')
  const [editingUser, setEditingUser] = useState(null)
  
  // Streamlined to only the active metrics
  const [editLife, setEditLife] = useState(0)
  const [editLeagueScore, setEditLeagueScore] = useState(0) 

  useEffect(() => { fetchData() }, [])

  const fetchData = async () => {
    const { data: pv } = await supabase.from('point_values').select('*').order('action_name')
    if (pv) setPointValues(pv)
  }

  const updateGlobalValue = async (action_name, field, newValue) => {
    await supabase.from('point_values').update({ [field]: parseInt(newValue) || 0 }).eq('action_name', action_name)
    fetchData()
  }

  const searchForUser = async () => {
      if(!searchUser) return alert("Enter a username to search")
      
      const { data } = await supabase.from('profiles').select('id, username, account_type, lifestyle_points, league_monthly').ilike('username', `%${searchUser}%`).limit(5)
      
      if (data) setUsers(data)
  }

  const saveUserPoints = async () => {
      await supabase.from('profiles').update({
          lifestyle_points: editLife, 
          league_monthly: editLeagueScore
      }).eq('id', editingUser.id)
      
      setEditingUser(null)
      searchForUser()
  }

  const openEditor = (u) => {
      setEditingUser(u); 
      setEditLife(u.lifestyle_points || 0); 
      setEditLeagueScore(u.league_monthly || 0);
  }

  // 🟢 THE FIX: Correctly targets all rows and explicitly handles errors
  const resetMonthlyLeaderboard = async () => {
      if(window.confirm(`Are you SURE you want to reset the Monthly Leaderboard to zero for everyone?`)) {
          const { error } = await supabase
              .from('profiles')
              .update({ league_monthly: 0 })
              .not('id', 'is', null) 
          
          if(!error) {
              alert(`Success: Monthly Leaderboard has been reset.`)
              if (searchUser) searchForUser() // Refresh the user search list to show zeros
          } else {
              console.error("Leaderboard Reset Error:", error)
              alert(`Action Failed: ${error.message} (You may need to update your RLS Policies for the profiles table)`)
          }
      }
  }

  return (
    <div className="space-y-8 animate-fade-in">
        
      {/* GLOBAL VALUES */}
      <div className="bg-gray-900 p-6 rounded-xl border border-gray-800">
        <h3 className="text-2xl font-['Bebas_Neue'] text-blue-400 mb-4 tracking-wider">Global Point Values</h3>
        <p className="text-xs text-gray-400 mb-6">Edit how much actions are worth across the entire platform. Changes take effect instantly.</p>
        
        <div className="space-y-3">
            <div className="grid grid-cols-4 gap-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest pb-2 border-b border-gray-800">
                <div className="col-span-2">Action / Description</div>
                <div className="text-center">Lifestyle Reward</div>
                <div className="text-center">League Reward</div>
            </div>
            {pointValues.map(pv => (
                <div key={pv.action_name} className="grid grid-cols-4 gap-4 items-center bg-black/40 p-3 rounded-lg border border-gray-800">
                    <div className="col-span-2">
                        <div className="text-white font-bold text-sm">{pv.action_name}</div>
                        <div className="text-gray-500 text-[10px]">{pv.description}</div>
                    </div>
                    <input type="number" value={pv.lifestyle_reward} onChange={e => updateGlobalValue(pv.action_name, 'lifestyle_reward', e.target.value)} className="bg-black border border-gray-700 text-white text-center rounded p-2 text-sm focus:border-blue-500 outline-none" />
                    <input type="number" value={pv.league_reward} onChange={e => updateGlobalValue(pv.action_name, 'league_reward', e.target.value)} className="bg-black border border-gray-700 text-white text-center rounded p-2 text-sm focus:border-blue-500 outline-none" />
                </div>
            ))}
        </div>
      </div>

      {/* 🟢 THE FIX: Only one Season Reset Button */}
      <div className="bg-gray-900 p-6 rounded-xl border border-gray-800">
         <h3 className="text-2xl font-['Bebas_Neue'] text-red-400 mb-4 tracking-wider">Season Resets</h3>
         <p className="text-xs text-gray-400 mb-6">Manually clear the active leaderboard. This action cannot be undone.</p>
         <button onClick={resetMonthlyLeaderboard} className="w-full bg-red-900/20 border border-red-500/50 text-red-400 py-4 rounded-xl uppercase font-bold text-sm hover:bg-red-500 hover:text-white transition-all">
             Reset Monthly Leaderboard to 0
         </button>
      </div>

      {/* USER BANK EDITOR */}
      <div className="bg-gray-900 p-6 rounded-xl border border-gray-800">
        <h3 className="text-2xl font-['Bebas_Neue'] text-green-400 mb-4 tracking-wider">Edit User Bank</h3>
        
        <div className="flex gap-2 mb-6">
            <input type="text" value={searchUser} onChange={e => setSearchUser(e.target.value)} placeholder="Search Username..." className="flex-1 bg-black border border-gray-700 text-white rounded p-3 text-sm focus:border-green-500 outline-none" />
            <button onClick={searchForUser} className="bg-green-600 hover:bg-green-500 text-white font-bold px-6 rounded uppercase tracking-widest text-xs">Search</button>
        </div>

        {editingUser ? (
            <div className="bg-black/50 p-4 rounded-xl border border-green-500/30">
                <div className="flex justify-between items-center mb-4">
                    <span className="text-white font-bold text-lg">Editing: {editingUser.username}</span>
                    <span className="text-[10px] bg-gray-800 px-2 py-1 rounded text-gray-400 uppercase tracking-widest">{editingUser.account_type}</span>
                </div>
                
                <div className="grid grid-cols-2 gap-4 mb-6">
                    <div>
                        <label className="block text-[10px] text-gray-500 uppercase tracking-widest mb-1">Lifestyle Pts</label>
                        <input type="number" value={editLife} onChange={e => setEditLife(e.target.value)} className="w-full bg-black border border-gray-700 text-white rounded p-2 text-center" />
                    </div>
                    <div>
                        <label className="block text-[10px] text-gray-500 uppercase tracking-widest mb-1">League Score (Monthly)</label>
                        <input type="number" value={editLeagueScore} onChange={e => setEditLeagueScore(e.target.value)} className="w-full bg-black border border-gray-700 text-white rounded p-2 text-center" />
                    </div>
                </div>

                <div className="flex gap-2">
                    <button onClick={saveUserPoints} className="flex-1 bg-green-600 hover:bg-green-500 text-white py-3 rounded-lg text-xs font-bold uppercase tracking-widest transition-colors">Save Changes</button>
                    <button onClick={() => setEditingUser(null)} className="px-6 border border-gray-700 text-gray-400 hover:text-white rounded-lg text-xs font-bold uppercase transition-colors">Cancel</button>
                </div>
            </div>
        ) : (
            <div className="space-y-2">
                {users.map(u => (
                    <div key={u.id} className="flex justify-between items-center bg-black/40 p-3 rounded-lg border border-gray-800 hover:border-gray-600">
                        <div>
                            <div className="text-white font-bold">{u.username}</div>
                            <div className="text-xs text-gray-500">Life: {u.lifestyle_points||0} | League: {u.league_monthly||0}</div>
                        </div>
                        <button onClick={() => openEditor(u)} className="bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded text-xs font-bold uppercase tracking-widest">Edit</button>
                    </div>
                ))}
            </div>
        )}
      </div>
    </div>
  )
}