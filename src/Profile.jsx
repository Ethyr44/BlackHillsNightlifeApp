import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import ThemeEditorModal from './ThemeEditorModal'
import Setlist from './Setlist'
import Repertoire from './Repertoire'

const GRADIENTS = {
  'deep-space': 'bg-gradient-to-b from-slate-900 via-[#090812] to-black',
  'cyber-dusk': 'bg-gradient-to-b from-purple-900/40 via-[#090812] to-black',
  'toxic-glow': 'bg-gradient-to-b from-green-900/30 via-[#090812] to-black',
  'blood-moon': 'bg-gradient-to-b from-red-900/30 via-[#090812] to-black',
  'golden-hour': 'bg-gradient-to-b from-orange-900/30 via-[#090812] to-black',
  'abyss': 'bg-black'
}

export default function Profile({ session }) {
  const [profile, setProfile] = useState(null)
  
  const [isEditingTheme, setIsEditingTheme] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [themeColors, setThemeColors] = useState({ primary: '#3b82f6', secondary: '#9333ea', accent: '#10b981' })
  const [currentSlide, setCurrentSlide] = useState(0)

  const [posts, setPosts] = useState([])
  const [newPostText, setNewPostText] = useState('')
  
  const [friendsCount, setFriendsCount] = useState(0)

  // Host Event Tracker State
  const [hostEvents, setHostEvents] = useState([])
  const [reqTitle, setReqTitle] = useState('')
  const [reqVenue, setReqVenue] = useState('')
  const [reqDate, setReqDate] = useState('')

  useEffect(() => {
    fetchProfileData()
  }, [session])

  const fetchProfileData = async () => {
    const { data: pData } = await supabase.from('profiles').select('*').eq('id', session.user.id).single()
    if (pData) {
        setProfile(pData)
        setThemeColors({ primary: pData.primary_color || '#3b82f6', secondary: pData.secondary_color || '#9333ea', accent: pData.accent_color || '#10b981' })
        
        // Fetch Host Events if applicable
        if (pData.account_type === 'Host') {
            const { data: eData } = await supabase.from('events').select('*').eq('host_id', session.user.id).order('event_date', { ascending: false })
            if (eData) setHostEvents(eData)
        }
    }

    // Get REAL Friends count
    const { count } = await supabase.from('connections').select('*', { count: 'exact', head: true }).eq('following_id', session.user.id)
    setFriendsCount(count || 0)

    const { data: postData } = await supabase.from('posts').select('*').eq('author_id', session.user.id).order('created_at', { ascending: false })
    if (postData) setPosts(postData)
  }

  useEffect(() => {
    if (profile?.slideshow_urls && profile.slideshow_urls.length > 1) {
      const timer = setInterval(() => setCurrentSlide((prev) => (prev + 1) % profile.slideshow_urls.length), 5000)
      return () => clearInterval(timer)
    }
  }, [profile?.slideshow_urls])

  const handlePostSubmit = async () => {
    if (!newPostText.trim()) return
    const newPost = { author_id: session.user.id, content: newPostText, likes: 0, comments: 0 }
    const { error } = await supabase.from('posts').insert([newPost])
    if (!error) { setNewPostText(''); fetchProfileData(); }
  }

  const submitEventRequest = async () => {
      if (!reqTitle || !reqDate || !reqVenue) return alert("Fill all fields to request an event.")
      const { error } = await supabase.from('events').insert([{
          title: reqTitle, venue: reqVenue, event_date: reqDate, host_id: session.user.id, status: 'pending', event_type: 'Karaoke'
      }])
      if (!error) {
          alert("Event Request Submitted for Admin Approval!")
          setReqTitle(''); setReqVenue(''); setReqDate('');
          fetchProfileData()
      }
  }

  if (!profile) return <div className="p-10 text-center text-blue-400 font-bold uppercase tracking-widest animate-pulse">Loading Identity...</div>

  const latestPost = posts.length > 0 ? posts[0] : null;
  const dynamicPrimary = profile.primary_color || '#3b82f6'
  const dynamicSecondary = profile.secondary_color || '#9333ea'
  const dynamicAccent = profile.accent_color || '#10b981'
  const gradientClass = profile.bg_gradient ? GRADIENTS[profile.bg_gradient] : GRADIENTS['deep-space']

  // Determines if they get Karaoke features
  const showKaraokeFeatures = ['Singer', 'Host', 'Admin'].includes(profile.account_type)

  return (
    <>
      <div className={`fixed inset-0 z-[-1] ${gradientClass} transition-colors duration-1000`}></div>
      
      <div className="max-w-2xl mx-auto p-4 animate-fade-in relative pb-32 space-y-8">
        
        {/* 1. NEON HEADER */}
        <div className="rounded-3xl p-8 flex flex-col items-center text-center relative overflow-hidden mb-2 border-2 transition-all duration-500"
             style={{ backgroundColor: '#090812', borderColor: dynamicPrimary, boxShadow: `0 0 40px ${dynamicPrimary}44, inset 0 0 30px ${dynamicPrimary}44` }}>
          
          {profile.slideshow_urls && profile.slideshow_urls.length > 0 ? (
              profile.slideshow_urls.map((url, idx) => (
                  <div key={idx} className={`absolute inset-0 bg-cover bg-center transition-opacity duration-1000 ease-in-out ${idx === currentSlide ? 'opacity-40' : 'opacity-0'}`} style={{ backgroundImage: `url(${url})` }} />
              ))
          ) : (
              <div className="absolute inset-0 opacity-20" style={{ background: `linear-gradient(135deg, ${dynamicPrimary}, ${dynamicSecondary})` }} />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#090812] via-[#090812]/50 to-transparent"></div>

          <img src={profile.profile_pic || `https://api.dicebear.com/7.x/shapes/svg?seed=${profile.username}`} 
               className="w-36 h-36 rounded-full border-4 bg-black z-10 object-cover shadow-2xl relative" 
               style={{ borderColor: dynamicPrimary, boxShadow: `0 0 25px ${dynamicPrimary}88` }} alt="Profile" />
          
          <h2 className="text-5xl font-['Bebas_Neue'] tracking-wider mt-6 z-10 text-white relative flex items-center gap-3 justify-center" style={{ textShadow: `0 0 15px ${dynamicPrimary}, 0 0 30px ${dynamicPrimary}` }}>
              {profile.username}
              {profile.zodiac_sign && <span className="text-2xl" title={profile.zodiac_sign}>{profile.zodiac_sign.split(' ')[0]}</span>}
          </h2>
          
          <div className="bg-black/50 border border-white/10 px-4 py-1 rounded-full relative z-10 backdrop-blur-md mt-1 mb-4">
              <span className="text-[10px] font-bold text-gray-300 uppercase tracking-widest">{profile.account_type} Account</span>
          </div>

          <div className="bg-black/50 border border-white/10 px-4 py-3 rounded-xl w-full max-w-sm relative z-10 backdrop-blur-md">
              <p className="text-gray-200 text-xs sm:text-sm italic font-medium break-words">
                {latestPost ? `"${latestPost.content}"` : "No status set. Broadcast a vibe below!"}
              </p>
          </div>

          <div className="flex gap-4 sm:gap-6 mt-6 pt-6 border-t border-white/10 w-full justify-center relative z-10">
            <div className="text-center">
              <span className="block text-2xl font-['Bebas_Neue'] text-white" style={{ textShadow: `0 0 10px ${dynamicPrimary}` }}>{friendsCount}</span>
              <span className="text-[10px] text-gray-300 uppercase tracking-widest font-bold">Friends</span>
            </div>
            <div className="text-center">
              <span className="block text-2xl font-['Bebas_Neue'] text-white" style={{ textShadow: `0 0 10px ${dynamicSecondary}` }}>{profile.lifestyle_points || 0}</span>
              <span className="text-[10px] text-gray-300 uppercase tracking-widest font-bold">PTS</span>
            </div>
          </div>

          <button onClick={() => setIsEditingTheme(true)} className="mt-6 px-8 py-3 rounded-full text-xs font-bold uppercase tracking-widest text-white transition-all relative z-10"
                  style={{ background: `linear-gradient(135deg, ${dynamicPrimary}, ${dynamicSecondary})`, boxShadow: `0 0 20px ${dynamicSecondary}66` }}>
              ✨ Customize Theme
          </button>
        </div>

        {isEditingTheme && <ThemeEditorModal session={session} profile={profile} onClose={() => setIsEditingTheme(false)} onUpdate={(updatedProfile) => setProfile(updatedProfile)} />}

        {/* HOST EVENT TRACKER */}
        {profile.account_type === 'Host' && (
            <div className="bg-gray-900 border-2 border-orange-500/30 rounded-3xl p-6 relative overflow-hidden transition-all duration-300 shadow-[0_0_20px_rgba(255,140,66,0.15)]">
                <h3 className="text-3xl font-['Bebas_Neue'] tracking-widest mb-6 text-orange-400" style={{ textShadow: `0 0 15px rgba(255,140,66,0.5)` }}>
                    Event Tracker & Requests
                </h3>
                
                <div className="bg-black/50 p-4 rounded-2xl border border-gray-800 mb-6">
                    <h4 className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-3">Request New Event</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                        <input type="text" value={reqTitle} onChange={e => setReqTitle(e.target.value)} placeholder="Event Title" className="bg-black border border-gray-700 text-white rounded-lg p-2 text-xs focus:border-orange-500 outline-none" />
                        <input type="text" value={reqVenue} onChange={e => setReqVenue(e.target.value)} placeholder="Venue Name" className="bg-black border border-gray-700 text-white rounded-lg p-2 text-xs focus:border-orange-500 outline-none" />
                        <input type="datetime-local" value={reqDate} onChange={e => setReqDate(e.target.value)} className="bg-black border border-gray-700 text-white rounded-lg p-2 text-xs focus:border-orange-500 outline-none" />
                    </div>
                    <button onClick={submitEventRequest} className="w-full bg-orange-600/20 text-orange-400 border border-orange-500/50 py-2 rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-orange-600 hover:text-black transition-colors">
                        Submit for Approval
                    </button>
                </div>

                <div className="space-y-3">
                    <h4 className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">My Events</h4>
                    {hostEvents.length === 0 && <p className="text-xs text-gray-500 italic">No events found.</p>}
                    {hostEvents.map(ev => (
                        <div key={ev.id} className="bg-black/60 border border-gray-800 p-3 rounded-xl flex justify-between items-center">
                            <div>
                                <p className="text-white font-bold text-sm">{ev.title}</p>
                                <p className="text-gray-400 text-xs uppercase tracking-widest mt-0.5">{new Date(ev.event_date).toLocaleDateString()} @ {ev.venue}</p>
                            </div>
                            <span className={`text-[9px] px-2 py-1 rounded font-bold uppercase tracking-widest ${ev.status === 'pending' ? 'bg-yellow-900/30 text-yellow-500 border border-yellow-500/30' : 'bg-green-900/30 text-green-400 border border-green-500/30'}`}>
                                {ev.status}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        )}

        {/* POST FEED */}
        <div className="bg-[#090812]/80 border-2 rounded-3xl p-6 relative overflow-hidden transition-all duration-300" style={{ borderColor: dynamicSecondary, boxShadow: `0 0 25px ${dynamicSecondary}33, inset 0 0 10px ${dynamicSecondary}22` }}>
            <h3 className="text-3xl font-['Bebas_Neue'] tracking-widest mb-6 text-white" style={{ textShadow: `0 0 15px ${dynamicSecondary}, 0 0 25px ${dynamicSecondary}` }}>My Updates</h3>
            <div className="flex gap-2 mb-6 relative z-10">
                <input type="text" value={newPostText} onChange={(e) => setNewPostText(e.target.value)} placeholder="What's your vibe today?" className="flex-1 bg-black/60 border border-gray-700 text-white rounded-full py-3 px-5 focus:outline-none text-sm backdrop-blur-sm focus:border-white transition-colors" />
                <button onClick={handlePostSubmit} className="text-white px-6 py-3 rounded-full text-xs font-bold uppercase tracking-widest transition-all shadow-lg" style={{ backgroundColor: dynamicSecondary, boxShadow: `0 0 15px ${dynamicSecondary}66` }}>Post</button>
            </div>
        </div>

        {showKaraokeFeatures && (
            <>
              <Setlist session={session} />
              <Repertoire userId={session.user.id} isOwner={true} canSuggest={false} />
            </>
        )}
      </div>
    </>
  )
}