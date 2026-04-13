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

    const { count } = await supabase.from('connections').select('*', { count: 'exact', head: true }).eq('following_id', session.user.id).eq('status', 'friend')
    setFriendsCount(count || 0)

    const { data: postData } = await supabase.from('posts').select('*').eq('author_id', session.user.id).order('created_at', { ascending: false })
    if (postData) setPosts(postData)
  }

  const handlePostSubmit = async () => {
    if (!newPostText.trim()) return
    const newPost = { author_id: session.user.id, content: newPostText, likes: 0, comments: 0 }
    const { error } = await supabase.from('posts').insert([newPost])
    if (!error) { setNewPostText(''); fetchProfileData(); }
  }

  if (!profile) return <div className="p-10 text-center text-blue-400 font-bold uppercase tracking-widest animate-pulse">Loading Identity...</div>

  const latestPost = posts.length > 0 ? posts[0] : null
  const gradientClass = profile.bg_gradient ? GRADIENTS[profile.bg_gradient] : GRADIENTS['deep-space']
  const dynamicSecondary = profile.secondary_color || '#9333ea'
  const showKaraokeFeatures = ['Singer', 'Host', 'Admin'].includes(profile.account_type)

  return (
    <>
      <div className={`fixed inset-0 z-0 pointer-events-none ${gradientClass} transition-colors duration-1000`}></div>
      
      <div className="max-w-2xl mx-auto p-4 animate-fade-in relative z-10 pb-32 space-y-8">
        
        <ProfileHeader 
            profile={profile} 
            latestPost={latestPost} 
            friendsCount={friendsCount} 
            onEditTheme={() => setIsEditingTheme(true)} 
        />

        {isEditingTheme && <ThemeEditorModal session={session} profile={profile} onClose={() => setIsEditingTheme(false)} onUpdate={setProfile} />}

        {profile.account_type === 'Host' && <HostTracker session={session} />}

        {/* POST FEED COMPOSER */}
        <div className="bg-[#090812]/80 border-2 rounded-3xl p-6 relative overflow-hidden transition-all duration-300" style={{ borderColor: dynamicSecondary, boxShadow: `0 0 25px ${dynamicSecondary}33, inset 0 0 10px ${dynamicSecondary}22` }}>
            <h3 className="text-3xl font-['Bebas_Neue'] tracking-widest mb-6 text-white" style={{ textShadow: `0 0 15px ${dynamicSecondary}, 0 0 25px ${dynamicSecondary}` }}>My Updates</h3>
            <div className="flex gap-2 mb-6 relative z-10">
                <input type="text" value={newPostText} onChange={(e) => setNewPostText(e.target.value)} placeholder="What's your vibe today?" className="flex-1 bg-black/60 border border-gray-700 text-white rounded-full py-3 px-5 focus:outline-none text-sm backdrop-blur-sm focus:border-white transition-colors" />
                <button onClick={handlePostSubmit} className="text-white px-6 py-3 rounded-full text-xs font-bold uppercase tracking-widest transition-all shadow-lg" style={{ backgroundColor: dynamicSecondary, boxShadow: `0 0 15px ${dynamicSecondary}66` }}>Post</button>
            </div>
        </div>

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