import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import ThemeEditorModal from './ThemeEditorModal'
import Setlist from './Setlist'
import Repertoire from './Repertoire'
import ProfileHeader from './ProfileHeader'
import HostTracker from './HostTracker'
import ProfileVenue from './ProfileVenue'
import ProfileHost from './ProfileHost'
import ProfilePerformer from './ProfilePerformer'
import SongBook from './Songbook'
import { GRADIENTS } from './themeConstants'

const GEM_STATS = {
    'Quartz': { mult: 2, uses: 1, color: 'text-pink-300' },
    'Amethyst': { mult: 2, uses: 2, color: 'text-purple-400' },
    'Jade': { mult: 3, uses: 1, color: 'text-emerald-400' },
    'Emerald': { mult: 3, uses: 2, color: 'text-green-500' },
    'Sapphire': { mult: 4, uses: 1, color: 'text-blue-500' },
    'Ruby': { mult: 2, uses: 5, color: 'text-red-500' },
    'Diamond': { mult: 4, uses: 4, color: 'text-cyan-300' },
}

export default function Profile({ session }) {
  const currentUser = session?.user;
  const [profile, setProfile] = useState(null)
  const [isEditingTheme, setIsEditingTheme] = useState(false)
  const [showInventory, setShowInventory] = useState(false)
  const [posts, setPosts] = useState([])
  const [newPostText, setNewPostText] = useState('')
  const [friendsCount, setFriendsCount] = useState(0)
  const [setlistTrigger, setSetlistTrigger] = useState(0)
  
  const [bhnlRank, setBhnlRank] = useState('#--')
  const [ksocialRank, setKsocialRank] = useState('#--')
  const [systemOptions, setSystemOptions] = useState({ venues: [], events: [], genres: [] })
  const [isEditingPrefs, setIsEditingPrefs] = useState(false)

  useEffect(() => {
    if (!session) return
    fetchProfileData()

    const pointListener = supabase.channel('profile-points')
      .on('postgres', { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${session.user.id}` }, 
      (payload) => setProfile(payload.new)
    ).subscribe()

    return () => supabase.removeChannel(pointListener)
  }, [session])

  const fetchProfileData = async () => {
    const { data: pData } = await supabase.from('profiles').select('*').eq('id', session.user.id).single()
    if (pData) setProfile(pData)

    const { count } = await supabase.from('connections').select('*', { count: 'exact', head: true })
        .eq('target_id', session.user.id).eq('connection_type', 'friend')
    setFriendsCount(count || 0)

    const { data: postData } = await supabase.from('posts').select('*').eq('author_id', session.user.id).order('created_at', { ascending: false })
    if (postData) setPosts(postData)

    const { data: allProfiles } = await supabase.from('profiles').select('id, lifestyle_points, league_monthly')
    if (allProfiles) {
       const sortedBhnl = [...allProfiles].sort((a,b) => (b.lifestyle_points || 0) - (a.lifestyle_points || 0))
       const sortedKsocial = [...allProfiles].sort((a,b) => (b.league_monthly || 0) - (a.league_monthly || 0))
       
       const bIndex = sortedBhnl.findIndex(p => p.id === session.user.id)
       const kIndex = sortedKsocial.findIndex(p => p.id === session.user.id)
       
       setBhnlRank(bIndex !== -1 ? `#${bIndex + 1}` : '#--')
       setKsocialRank(kIndex !== -1 ? `#${kIndex + 1}` : '#--')
    }

    const { data: sysData } = await supabase.from('system_categories').select('*')
    if (sysData) {
        setSystemOptions({
            events: sysData.filter(d => d.category_type === 'event').map(d => d.name),
            venues: sysData.filter(d => d.category_type === 'venue').map(d => d.name),
            genres: sysData.filter(d => d.category_type === 'genre').map(d => d.name)
        })
    }
  }

  const handlePostSubmit = async () => {
    if (!newPostText.trim()) return
    const newPost = { author_id: session.user.id, content: newPostText, likes: 0, comments: 0 }
    const { error } = await supabase.from('posts').insert([newPost])
    if (!error) { setNewPostText(''); fetchProfileData(); }
  }

  const handleUpdatePrefs = async (type, item) => {
    let current = profile[`pref_${type}`] || []
    if (current.includes(item)) current = current.filter(i => i !== item)
    else current = [...current, item]

    await supabase.from('profiles').update({ [`pref_${type}`]: current }).eq('id', session.user.id)
    setProfile(prev => ({ ...prev, [`pref_${type}`]: current }))
  }

  const consumeGem = async (gemName) => {
      if (profile.multiplier_uses_left > 0) {
          return alert(`You already have an active ${profile.active_multiplier}x Multiplier! Exhaust it before activating another gem.`)
      }
      
      const stats = GEM_STATS[gemName]
      const currentGems = profile.inv_gems || {}
      if (!currentGems[gemName] || currentGems[gemName] < 1) return

      currentGems[gemName] -= 1

      await supabase.from('profiles').update({
          inv_gems: currentGems,
          active_multiplier: stats.mult,
          multiplier_uses_left: stats.uses
      }).eq('id', session.user.id)

      alert(`${gemName} Activated! Your next ${stats.uses} actions will be multiplied by ${stats.mult}x!`)
      fetchProfileData()
  }

  if (!profile) return <div className="p-10 text-center text-blue-400 font-bold uppercase tracking-widest animate-pulse">Loading Identity...</div>

  const latestPost = posts.length > 0 ? posts[0] : null
  const gradientClass = profile.bg_gradient ? GRADIENTS[profile.bg_gradient] : GRADIENTS['deep-space']
  const dynamicSecondary = profile.secondary_color || '#9333ea'
  const showKaraokeFeatures = ['Regular', 'Singer', 'Host', 'Admin'].includes(profile.account_type)

  const gems = profile.inv_gems || {}
  const items = profile.inv_items || {}

  return (
    <>
      <div className="max-w-2xl mx-auto p-4 animate-fade-in relative z-10 pb-32 space-y-6">
        
        <div className="relative pt-8">
            <div className="absolute top-0 left-0 right-0 flex justify-center gap-[100px] sm:gap-[130px] z-20 pointer-events-none">
                <div className="bg-black/80 backdrop-blur border border-blue-500/50 rounded-lg px-3 py-1 text-center shadow-[0_0_10px_rgba(59,130,246,0.3)]">
                    <span className="block text-[8px] text-blue-400 font-bold uppercase tracking-widest leading-none mb-1">BHNL Rank</span>
                    <span className="font-['Bebas_Neue'] text-xl text-white leading-none">{bhnlRank}</span>
                </div>
                <div className="bg-black/80 backdrop-blur border border-[#00f5ff]/50 rounded-lg px-3 py-1 text-center shadow-[0_0_10px_rgba(0,245,255,0.3)]">
                    <span className="block text-[8px] text-[#00f5ff] font-bold uppercase tracking-widest leading-none mb-1">KSocial Rank</span>
                    <span className="font-['Bebas_Neue'] text-xl text-white leading-none">{ksocialRank}</span>
                </div>
            </div>

            <ProfileHeader profile={profile} latestPost={latestPost} friendsCount={friendsCount} onEditTheme={() => setIsEditingTheme(true)} />
        </div>

        {/* 🟢 THE INVENTORY BUTTON */}
        <button 
            onClick={() => setShowInventory(true)} 
            className="w-full bg-black/80 backdrop-blur-md border border-green-500/50 hover:border-green-400 text-green-400 py-3.5 rounded-xl font-bold uppercase tracking-widest transition-all shadow-[0_0_15px_rgba(34,197,94,0.2)] flex items-center justify-center gap-2"
        >
            <span className="text-xl">🎒</span> Open Inventory & Wallet
        </button>

        {isEditingTheme && <ThemeEditorModal session={session} profile={profile} onClose={() => setIsEditingTheme(false)} onUpdate={setProfile} />}

        {/* POST FEED COMPOSER */}
        <div className="bg-[#090812]/80 border-2 rounded-3xl p-6 relative overflow-hidden transition-all duration-300" style={{ borderColor: dynamicSecondary, boxShadow: `0 0 25px ${dynamicSecondary}33, inset 0 0 10px ${dynamicSecondary}22` }}>
            <h3 className="text-3xl font-['Bebas_Neue'] tracking-widest mb-6 text-white" style={{ textShadow: `0 0 15px ${dynamicSecondary}, 0 0 25px ${dynamicSecondary}` }}>My Updates</h3>
            <div className="flex gap-2 mb-6 relative z-10">
                <input type="text" value={newPostText} onChange={(e) => setNewPostText(e.target.value)} placeholder="What's your vibe today?" className="flex-1 bg-black/60 border border-gray-700 text-white rounded-full py-3 px-5 focus:outline-none text-sm backdrop-blur-sm focus:border-white transition-colors" />
                <button onClick={handlePostSubmit} className="text-white px-6 py-3 rounded-full text-xs font-bold uppercase tracking-widest transition-all shadow-lg" style={{ backgroundColor: dynamicSecondary, boxShadow: `0 0 15px ${dynamicSecondary}66` }}>Post</button>
            </div>
        </div>

        {/* CATEGORY PREFERENCES */}
        <div className="bg-black/40 border border-gray-800 rounded-3xl p-6">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-2xl font-['Bebas_Neue'] text-gray-300 tracking-widest">My Vibe</h3>
                <button onClick={() => setIsEditingPrefs(!isEditingPrefs)} className="text-xs font-bold text-blue-400 uppercase tracking-widest bg-blue-900/20 px-3 py-1.5 rounded-lg border border-blue-500/30">
                    {isEditingPrefs ? 'Done' : 'Edit Preferences'}
                </button>
            </div>
            
            <div className="space-y-4">
                <div>
                    <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest block mb-2">Event Styles</span>
                    <div className="flex flex-wrap gap-2">
                        {(isEditingPrefs ? systemOptions.events : (profile.pref_events || [])).map(item => {
                            const isSelected = (profile.pref_events || []).includes(item)
                            if (!isEditingPrefs && !isSelected) return null
                            return (
                                <button key={item} onClick={() => isEditingPrefs && handleUpdatePrefs('events', item)} className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border transition-colors ${isSelected ? 'bg-cyan-900/30 border-cyan-500 text-cyan-300' : 'bg-gray-900 border-gray-800 text-gray-500'}`}>
                                    {item}
                                </button>
                            )
                        })}
                    </div>
                </div>
                <div>
                    <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest block mb-2">Venue Styles</span>
                    <div className="flex flex-wrap gap-2">
                        {(isEditingPrefs ? systemOptions.venues : (profile.pref_venues || [])).map(item => {
                            const isSelected = (profile.pref_venues || []).includes(item)
                            if (!isEditingPrefs && !isSelected) return null
                            return (
                                <button key={item} onClick={() => isEditingPrefs && handleUpdatePrefs('venues', item)} className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border transition-colors ${isSelected ? 'bg-purple-900/30 border-purple-500 text-purple-300' : 'bg-gray-900 border-gray-800 text-gray-500'}`}>
                                    {item}
                                </button>
                            )
                        })}
                    </div>
                </div>
                <div>
                    <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest block mb-2">Music Genres</span>
                    <div className="flex flex-wrap gap-2">
                        {(isEditingPrefs ? systemOptions.genres : (profile.pref_genres || [])).map(item => {
                            const isSelected = (profile.pref_genres || []).includes(item)
                            if (!isEditingPrefs && !isSelected) return null
                            return (
                                <button key={item} onClick={() => isEditingPrefs && handleUpdatePrefs('genres', item)} className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border transition-colors ${isSelected ? 'bg-[#ff2d78]/20 border-[#ff2d78] text-[#ff2d78]' : 'bg-gray-900 border-gray-800 text-gray-500'}`}>
                                    {item}
                                </button>
                            )
                        })}
                    </div>
                </div>
            </div>
        </div>

        {/* 🟢 DYNAMIC ROLE DASHBOARDS */}
        {profile.account_type === 'Venue' ? (
            <div className="mt-8 pt-8 border-t border-gray-800">
                <ProfileVenue profile={profile} isOwner={true} onViewEntity={null} />
            </div>
        ) : profile.account_type === 'Performer' ? (
            <div className="mt-8 pt-8 border-t border-gray-800">
                <ProfilePerformer profile={profile} isOwner={true} onViewEntity={null} />
            </div>
        ) : profile.account_type === 'Host' ? (
            <div className="mt-8 pt-8 border-t border-gray-800">
                <ProfileHost profile={profile} isOwner={true} onViewEntity={null} />
                <div className="mt-6">
                    <HostTracker session={session} />
                </div>
            </div>
        ) : (
            <>
                {/* SECTION 2: KARAOKE FEATURES */}
                {showKaraokeFeatures && (
                    <div className="mt-6 animate-fade-in space-y-6">
                        
                        {/* 1. Setlist Top */}
                        <Setlist session={session} isOwner={true} />

                        {/* 2. Suggest Song Middle */}
                        <div className="bg-[#090812] border-2 border-blue-900/30 rounded-3xl p-6 shadow-xl relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-600 to-purple-600"></div>
                            <SongBook currentUser={currentUser} profileUser={profile} isOwnProfile={true} embedded={true} />
                        </div>

                        {/* 3. Repertoire Bottom */}
                        <Repertoire userId={session.user.id} isOwner={true} canSuggest={false} trigger={setlistTrigger} setTrigger={setSetlistTrigger} />
                    </div>
                )}
            </>
        )}
      </div>

      {/* 🟢 THE INVENTORY & WALLET MODAL */}
      {showInventory && (
          <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 overflow-y-auto p-4 animate-fade-in">
              <div className="max-w-md mx-auto bg-[#090812] border-2 border-gray-800 rounded-3xl mt-10 p-6 shadow-[0_0_50px_rgba(34,197,94,0.1)] mb-20">
                  <div className="flex justify-between items-start mb-6 border-b border-gray-800 pb-4">
                      <div>
                          <h2 className="text-4xl font-['Bebas_Neue'] tracking-widest text-white">Vault</h2>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Inventory & Assets</p>
                      </div>
                      <button onClick={() => setShowInventory(false)} className="text-gray-500 hover:text-white bg-gray-900 w-8 h-8 rounded-full flex items-center justify-center font-bold">✕</button>
                  </div>

                  {/* SECTION 6: ACTIVE MULTIPLIER (Dynamic) */}
                  {profile.multiplier_uses_left > 0 && (
                      <div className="bg-green-900/20 border border-green-500/50 p-4 rounded-xl mb-6 shadow-[0_0_15px_rgba(34,197,94,0.2)] animate-pulse">
                          <h4 className="text-green-400 font-bold uppercase tracking-widest text-xs flex justify-between">
                              <span>Active Bonus: {profile.active_multiplier}x Pts</span>
                              <span>{profile.multiplier_uses_left} Uses Left</span>
                          </h4>
                      </div>
                  )}

                  {/* SECTION 1 & 2: CURRENCY */}
                  <div className="grid grid-cols-2 gap-4 mb-6">
                      <div className="bg-black border border-blue-900/50 p-4 rounded-xl text-center shadow-inner">
                          <span className="block text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">Lifestyle Points</span>
                          <span className="text-3xl font-['Bebas_Neue'] text-blue-400">{profile.lifestyle_points || 0} L$</span>
                      </div>
                      <div className="bg-black border border-green-900/50 p-4 rounded-xl text-center shadow-inner">
                          <span className="block text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">Available USD</span>
                          <span className="text-3xl font-['Bebas_Neue'] text-green-400">${profile.cur_usd || '0.00'}</span>
                      </div>
                  </div>

                  {/* SECTION 3: WALLET / KEYS */}
                  <div className="mb-6">
                      <div className="flex justify-between items-center mb-3 border-b border-gray-800 pb-1">
                          <h4 className="text-xs text-gray-500 font-bold uppercase tracking-widest">Wallet & Keys</h4>
                          {/* 🟢 NEW: Visit Shop Button */}
                          <button onClick={() => window.location.search = '?tab=Shop'} className="text-[10px] text-blue-400 hover:text-blue-300 font-bold uppercase tracking-widest transition-colors flex items-center gap-1 bg-blue-900/20 px-2 py-1 rounded">
                              Visit Shop <span>↗</span>
                          </button>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                          <div className="bg-amber-900/20 border border-amber-900/50 p-3 rounded-xl text-center">
                              <span className="block text-2xl mb-1">🪵</span>
                              <span className="block text-amber-500 font-bold">{profile.cur_wood || 0}</span>
                              <span className="block text-[8px] uppercase tracking-widest text-amber-700 font-bold">Wood</span>
                          </div>
                          <div className="bg-slate-800/30 border border-slate-700 p-3 rounded-xl text-center">
                              <span className="block text-2xl mb-1">🪨</span>
                              <span className="block text-slate-400 font-bold">{profile.cur_stone || 0}</span>
                              <span className="block text-[8px] uppercase tracking-widest text-slate-500 font-bold">Stone</span>
                          </div>
                          <div className="bg-gray-800/50 border border-gray-600 p-3 rounded-xl text-center">
                              <span className="block text-2xl mb-1">⛓️</span>
                              <span className="block text-gray-300 font-bold">{profile.cur_iron || 0}</span>
                              <span className="block text-[8px] uppercase tracking-widest text-gray-500 font-bold">Iron</span>
                          </div>
                      </div>
                  </div>

                  {/* SECTION 4: GEMS */}
                  <div className="mb-6">
                      <h4 className="text-xs text-gray-500 font-bold uppercase tracking-widest mb-3 border-b border-gray-800 pb-1">Rare Gems</h4>
                      {Object.keys(gems).length === 0 ? (
                          <p className="text-gray-600 text-[10px] font-bold uppercase tracking-widest text-center py-4 bg-black rounded-xl">No gems acquired yet.</p>
                      ) : (
                          <div className="grid grid-cols-2 gap-3">
                              {Object.entries(gems).map(([gemName, amount]) => {
                                  if (amount < 1) return null;
                                  const stats = GEM_STATS[gemName]
                                  return (
                                      <div key={gemName} className="bg-black border border-gray-800 p-3 rounded-xl flex flex-col justify-between">
                                          <div className="flex justify-between items-start mb-2">
                                              <span className={`font-bold ${stats?.color || 'text-white'}`}>{gemName}</span>
                                              <span className="text-xs bg-gray-800 px-2 py-0.5 rounded text-white font-bold">x{amount}</span>
                                          </div>
                                          <span className="text-[9px] text-gray-500 font-bold uppercase tracking-widest mb-3">Boost: {stats?.mult}x ({stats?.uses} Uses)</span>
                                          <button onClick={() => consumeGem(gemName)} className="w-full bg-gray-900 hover:bg-gray-800 border border-gray-700 text-xs text-white font-bold uppercase tracking-widest py-1.5 rounded transition-colors">
                                              Consume
                                          </button>
                                      </div>
                                  )
                              })}
                          </div>
                      )}
                  </div>

                  {/* SECTION 5: ITEMS */}
                  <div>
                      <h4 className="text-xs text-gray-500 font-bold uppercase tracking-widest mb-3 border-b border-gray-800 pb-1">Equipment & Items</h4>
                      {Object.keys(items).length === 0 ? (
                          <p className="text-gray-600 text-[10px] font-bold uppercase tracking-widest text-center py-4 bg-black rounded-xl">No items acquired yet.</p>
                      ) : (
                          <div className="space-y-2">
                              {Object.entries(items).map(([itemName, amount]) => {
                                  if (amount < 1) return null;
                                  return (
                                      <div key={itemName} className="bg-black border border-gray-800 px-4 py-3 rounded-xl flex justify-between items-center">
                                          <span className="text-white font-bold text-sm">{itemName}</span>
                                          <span className="text-xs bg-gray-800 px-2 py-1 rounded text-gray-400 font-bold uppercase tracking-widest">Qty: {amount}</span>
                                      </div>
                                  )
                              })}
                          </div>
                      )}
                  </div>
              </div>
          </div>
      )}
    </>
  )
}