import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import ThemeEditorModal from './ThemeEditorModal'
import Setlist from './Setlist'
import Repertoire from './Repertoire'
import ProfileHeader from './ProfileHeader'
import HostTracker from './HostTracker'

const GRADIENTS = {
  'deep-space': 'bg-gradient-to-b from-slate-900/60 via-[#090812]/60 to-black/60 backdrop-blur-md',
  'cyber-dusk': 'bg-gradient-to-b from-purple-900/40 via-[#090812]/60 to-black/60 backdrop-blur-md',
  'toxic-glow': 'bg-gradient-to-b from-green-900/30 via-[#090812]/60 to-black/60 backdrop-blur-md',
  'blood-moon': 'bg-gradient-to-b from-red-900/30 via-[#090812]/60 to-black/60 backdrop-blur-md',
  'golden-hour': 'bg-gradient-to-b from-orange-900/30 via-[#090812]/60 to-black/60 backdrop-blur-md',
  'abyss': 'bg-black/60 backdrop-blur-md'
}

export default function Profile({ session }) {
  const [profile, setProfile] = useState(null)
  const [isEditingTheme, setIsEditingTheme] = useState(false)
  const [posts, setPosts] = useState([])
  const [newPostText, setNewPostText] = useState('')
  const [friendsCount, setFriendsCount] = useState(0)
  const [setlistTrigger, setSetlistTrigger] = useState(0)
  
  // Ranks & Categories
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
    // 1. Get Profile
    const { data: pData } = await supabase.from('profiles').select('*').eq('id', session.user.id).single()
    if (pData) setProfile(pData)

    // 2. Get Friends
    const { count } = await supabase.from('connections').select('*', { count: 'exact', head: true })
        .eq('target_id', session.user.id).eq('connection_type', 'friend')
    setFriendsCount(count || 0)

    // 3. Get Posts
    const { data: postData } = await supabase.from('posts').select('*').eq('author_id', session.user.id).order('created_at', { ascending: false })
    if (postData) setPosts(postData)

    // 4. Calculate Ranks
    const { data: allProfiles } = await supabase.from('profiles').select('id, lifestyle_points, league_monthly')
    if (allProfiles) {
       const sortedBhnl = [...allProfiles].sort((a,b) => (b.lifestyle_points || 0) - (a.lifestyle_points || 0))
       const sortedKsocial = [...allProfiles].sort((a,b) => (b.league_monthly || 0) - (a.league_monthly || 0))
       
       const bIndex = sortedBhnl.findIndex(p => p.id === session.user.id)
       const kIndex = sortedKsocial.findIndex(p => p.id === session.user.id)
       
       setBhnlRank(bIndex !== -1 ? `#${bIndex + 1}` : '#--')
       setKsocialRank(kIndex !== -1 ? `#${kIndex + 1}` : '#--')
    }

    // 5. Get Categories for Editing
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

  if (!profile) return <div className="p-10 text-center text-blue-400 font-bold uppercase tracking-widest animate-pulse">Loading Identity...</div>

  const latestPost = posts.length > 0 ? posts[0] : null
  const gradientClass = profile.bg_gradient ? GRADIENTS[profile.bg_gradient] : GRADIENTS['deep-space']
  const dynamicSecondary = profile.secondary_color || '#9333ea'
  
  const showKaraokeFeatures = ['Regular', 'Singer', 'Host', 'Admin'].includes(profile.account_type)

  return (
    <>
      <div className={`fixed inset-0 z-0 pointer-events-none ${gradientClass} transition-colors duration-1000`}></div>
      
      <div className="max-w-2xl mx-auto p-4 animate-fade-in relative z-10 pb-32 space-y-8">
        
        {/* 🟢 THE RANK HUD OVERLAY */}
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

            {/* ProfileHeader naturally handles lifestyle_points, but we will label it L$ in the UI */}
            <ProfileHeader 
                profile={profile} 
                latestPost={latestPost} 
                friendsCount={friendsCount} 
                onEditTheme={() => setIsEditingTheme(true)} 
            />
        </div>

        {isEditingTheme && <ThemeEditorModal session={session} profile={profile} onClose={() => setIsEditingTheme(false)} onUpdate={setProfile} />}

        {/* POST FEED COMPOSER */}
        <div className="bg-[#090812]/80 border-2 rounded-3xl p-6 relative overflow-hidden transition-all duration-300" style={{ borderColor: dynamicSecondary, boxShadow: `0 0 25px ${dynamicSecondary}33, inset 0 0 10px ${dynamicSecondary}22` }}>
            <h3 className="text-3xl font-['Bebas_Neue'] tracking-widest mb-6 text-white" style={{ textShadow: `0 0 15px ${dynamicSecondary}, 0 0 25px ${dynamicSecondary}` }}>My Updates</h3>
            <div className="flex gap-2 mb-6 relative z-10">
                <input type="text" value={newPostText} onChange={(e) => setNewPostText(e.target.value)} placeholder="What's your vibe today?" className="flex-1 bg-black/60 border border-gray-700 text-white rounded-full py-3 px-5 focus:outline-none text-sm backdrop-blur-sm focus:border-white transition-colors" />
                <button onClick={handlePostSubmit} className="text-white px-6 py-3 rounded-full text-xs font-bold uppercase tracking-widest transition-all shadow-lg" style={{ backgroundColor: dynamicSecondary, boxShadow: `0 0 15px ${dynamicSecondary}66` }}>Post</button>
            </div>
        </div>

        {/* 🟢 CATEGORY PREFERENCES */}
        <div className="bg-black/40 border border-gray-800 rounded-3xl p-6">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-2xl font-['Bebas_Neue'] text-gray-300 tracking-widest">My Vibe</h3>
                <button onClick={() => setIsEditingPrefs(!isEditingPrefs)} className="text-xs font-bold text-blue-400 uppercase tracking-widest bg-blue-900/20 px-3 py-1.5 rounded-lg border border-blue-500/30">
                    {isEditingPrefs ? 'Done' : 'Edit Preferences'}
                </button>
            </div>
            
            <div className="space-y-4">
                {/* Events */}
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
                        {!isEditingPrefs && (!profile.pref_events || profile.pref_events.length === 0) && <span className="text-xs text-gray-600">None selected.</span>}
                    </div>
                </div>
                {/* Venues */}
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
                        {!isEditingPrefs && (!profile.pref_venues || profile.pref_venues.length === 0) && <span className="text-xs text-gray-600">None selected.</span>}
                    </div>
                </div>
                {/* Genres */}
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
                        {!isEditingPrefs && (!profile.pref_genres || profile.pref_genres.length === 0) && <span className="text-xs text-gray-600">None selected.</span>}
                    </div>
                </div>
            </div>
        </div>

        {profile.account_type === 'Host' && <HostTracker session={session} />}

        {showKaraokeFeatures && (
            <>
              <Setlist session={session} trigger={setlistTrigger} setTrigger={setSetlistTrigger} />
              <Repertoire userId={session.user.id} isOwner={true} canSuggest={false} trigger={setlistTrigger} setTrigger={setSetlistTrigger} />
            </>
        )}
      </div>
    </>
  )
}