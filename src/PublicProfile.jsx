import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

const GRADIENTS = {
  'deep-space': 'bg-gradient-to-b from-slate-900 via-[#090812] to-black',
  'cyber-dusk': 'bg-gradient-to-b from-purple-900/40 via-[#090812] to-black',
  'toxic-glow': 'bg-gradient-to-b from-green-900/30 via-[#090812] to-black',
  'blood-moon': 'bg-gradient-to-b from-red-900/30 via-[#090812] to-black',
  'golden-hour': 'bg-gradient-to-b from-orange-900/30 via-[#090812] to-black',
  'abyss': 'bg-black'
}

export default function PublicProfile({ entity, onClose, currentUser, forceAccess }) {
  const [accessLevel, setAccessLevel] = useState('public') 
  const [followersCount, setFollowersCount] = useState(0)
  const [isConnection, setIsConnection] = useState(false) // Tracks if we already follow/friend them
  const [isLoading, setIsLoading] = useState(true)
  const [currentSlide, setCurrentSlide] = useState(0)
  const [recentPost, setRecentPost] = useState(null)

  const isPage = 'page_type' in entity
  const isAdmin = currentUser?.account_type === 'Admin'

  const dynamicPrimary = entity.primary_color || (isPage ? '#00f5ff' : '#3b82f6')
  const dynamicSecondary = entity.secondary_color || (isPage ? '#b347ff' : '#9333ea')
  const dynamicAccent = entity.accent_color || (isPage ? '#ff2d78' : '#10b981')

  useEffect(() => {
    async function fetchProfileData() {
      // 1. Get Total Connections Count
      const { count } = await supabase.from('connections')
        .select('*', { count: 'exact', head: true })
        .eq('following_id', entity.id)
        .eq('status', isPage ? 'following' : 'friend') 
      
      setFollowersCount(count || 0)

      // 2. Check if the Current User is connected to this entity
      const { data: existingConnection } = await supabase.from('connections')
        .select('id, status')
        .eq('follower_id', currentUser.id)
        .eq('following_id', entity.id)
        .maybeSingle()

      setIsConnection(!!existingConnection)

      // 3. Set Access Levels based on REAL data
      if (isPage) {
          setAccessLevel('public')
      } else {
          // Fetch User's Actual Recent Post
          const { data: posts } = await supabase.from('posts')
            .select('*')
            .or(`author_id.eq.${entity.id},user_id.eq.${entity.id}`)
            .order('created_at', { ascending: false })
            .limit(1)
          
          if (posts && posts.length > 0) setRecentPost(posts[0])

          // The Real Privacy Lock
          if (isAdmin || forceAccess || (existingConnection && existingConnection.status === 'friend')) {
              setAccessLevel('friend')
          } else {
              setAccessLevel('public')
          }
      }
      setIsLoading(false)
    }
    fetchProfileData()
  }, [entity.id, currentUser.id, isPage, isAdmin, forceAccess])

  useEffect(() => {
    if (entity?.slideshow_urls && entity.slideshow_urls.length > 1) {
      const timer = setInterval(() => setCurrentSlide((prev) => (prev + 1) % entity.slideshow_urls.length), 5000)
      return () => clearInterval(timer)
    }
  }, [entity?.slideshow_urls])

  // THE FIX: Smart Toggle that handles both Follows and Unfollows
  const handleConnectionToggle = async () => {
      const statusType = isPage ? 'following' : 'friend'

      if (isConnection) {
          // Unfollow / Remove Friend
          await supabase.from('connections').delete()
              .eq('follower_id', currentUser.id)
              .eq('following_id', entity.id)
          
          setFollowersCount(prev => Math.max(0, prev - 1))
          setIsConnection(false)
          if (!isPage && !isAdmin && !forceAccess) setAccessLevel('public')
      } else {
          // Follow / Add Friend
          await supabase.from('connections').insert({ 
              follower_id: currentUser.id, 
              following_id: entity.id, 
              status: statusType 
          })
          
          // THE NEW TRIGGER (Only give points for following a Page/Venue, not a user)
          if (isPage) {
             await supabase.rpc('trigger_reward', { target_user_id: currentUser.id, action_slug: 'follow_venue' })
          }
          
          setFollowersCount(prev => prev + 1)
          setIsConnection(true)
          if (!isPage) setAccessLevel('friend')
      }
  }

  if (isLoading) return <div className="flex justify-center py-20"><div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div></div>

  const gradientClass = entity.bg_gradient ? GRADIENTS[entity.bg_gradient] : GRADIENTS['deep-space']

  return (
    <>
      <div className={`fixed inset-0 z-0 pointer-events-none ${gradientClass} transition-colors duration-1000`}></div>
      
      <div className="max-w-2xl mx-auto p-4 animate-fade-in relative z-10 pb-32 space-y-8">
        <button onClick={onClose} className="mb-2 text-xs font-bold uppercase tracking-widest text-gray-500 hover:text-white flex items-center gap-2">← Back to Directory</button>

        <div className="rounded-3xl p-8 flex flex-col items-center text-center relative overflow-hidden mb-2 border-2 transition-all duration-500" style={{ backgroundColor: '#090812', borderColor: dynamicPrimary, boxShadow: `0 0 40px ${dynamicPrimary}44, inset 0 0 30px ${dynamicPrimary}44` }}>
          {entity.slideshow_urls && entity.slideshow_urls.length > 0 ? (
              entity.slideshow_urls.map((url, idx) => (
                  <div key={idx} className={`absolute inset-0 bg-cover bg-center transition-opacity duration-1000 ease-in-out ${idx === currentSlide ? 'opacity-40' : 'opacity-0'}`} style={{ backgroundImage: `url(${url})` }} />
              ))
          ) : (
              <div className="absolute inset-0 opacity-20" style={{ background: `linear-gradient(135deg, ${dynamicPrimary}, ${dynamicSecondary})` }} />
          )}
          
          <div className="absolute inset-0 bg-gradient-to-t from-[#090812] via-[#090812]/50 to-transparent"></div>

          <img src={entity.profile_pic || `https://api.dicebear.com/7.x/shapes/svg?seed=${isPage ? entity.name : entity.username}`} className="w-36 h-36 rounded-full border-4 bg-black z-10 object-cover shadow-2xl relative" style={{ borderColor: dynamicPrimary, boxShadow: `0 0 25px ${dynamicPrimary}88` }} alt="Profile" />
          
          <h2 className="text-5xl font-['Bebas_Neue'] tracking-wider mt-6 z-10 text-white relative flex items-center gap-3 justify-center" style={{ textShadow: `0 0 15px ${dynamicPrimary}, 0 0 30px ${dynamicPrimary}` }}>
              {isPage ? entity.name : entity.username} 
              {!isPage && entity.zodiac_sign && <span className="text-2xl" title={entity.zodiac_sign}>{entity.zodiac_sign.split(' ')[0]}</span>}
          </h2>
          
          <p className="text-sm text-gray-300 uppercase tracking-widest font-bold mb-6 z-10 relative drop-shadow-md">
              {isPage ? `Official ${entity.page_type}` : (entity.full_name || "BHNL Member")}
          </p>

          {/* THE FIX: Added League Points for all non-page users */}
          <div className="flex gap-4 sm:gap-6 pt-4 border-t border-white/10 w-full justify-center relative z-10">
            <div className="text-center">
              <span className="block text-2xl font-['Bebas_Neue'] text-white" style={{ textShadow: `0 0 10px ${dynamicPrimary}` }}>{followersCount}</span>
              <span className="text-[10px] text-gray-300 uppercase tracking-widest font-bold">{isPage ? 'Followers' : 'Friends'}</span>
            </div>
            {!isPage && (
                <>
                  <div className="text-center">
                    <span className="block text-2xl font-['Bebas_Neue'] text-white" style={{ textShadow: `0 0 10px ${dynamicSecondary}` }}>{entity.lifestyle_points || 0}</span>
                    <span className="text-[10px] text-gray-300 uppercase tracking-widest font-bold">Life Pts</span>
                  </div>
                  <div className="text-center">
                    <span className="block text-2xl font-['Bebas_Neue'] text-white" style={{ textShadow: `0 0 10px ${dynamicAccent}` }}>{entity.league_all_time || 0}</span>
                    <span className="text-[10px] text-gray-300 uppercase tracking-widest font-bold">League</span>
                  </div>
                </>
            )}
          </div>

          {/* DYNAMIC SMART BUTTON */}
          <button onClick={handleConnectionToggle} className={`mt-6 px-8 py-3 rounded-full text-xs font-bold uppercase tracking-widest transition-all relative z-10 ${isConnection ? 'bg-transparent border border-white/30 text-gray-300 hover:text-white hover:border-red-500 hover:bg-red-500/20' : 'text-white'}`} style={!isConnection ? { background: `linear-gradient(135deg, ${dynamicPrimary}, ${dynamicSecondary})`, boxShadow: `0 0 20px ${dynamicSecondary}66` } : {}}>
              {isConnection ? (isPage ? '✓ Following' : '✓ Friends') : (isPage ? `+ Follow ${entity.page_type}` : '+ Add Friend')}
          </button>
        </div>

        {/* ... The rest of the page layout remains exactly the same! ... */}
        {isPage && (
            <div className="bg-[#090812]/80 border-2 rounded-3xl p-6 relative overflow-hidden transition-all duration-300" style={{ borderColor: dynamicSecondary, boxShadow: `0 0 25px ${dynamicSecondary}33, inset 0 0 10px ${dynamicSecondary}22` }}>
                <h3 className="text-2xl font-['Bebas_Neue'] tracking-widest mb-6 text-white" style={{ textShadow: `0 0 15px ${dynamicSecondary}` }}>About this {entity.page_type}</h3>
                <div className="space-y-4 relative z-10">
                    {entity.address && <div className="bg-black/50 p-4 rounded-2xl border border-gray-800 flex items-center gap-4"><span className="text-2xl">📍</span><div><span className="block text-[10px] text-gray-500 font-bold uppercase tracking-widest">Location</span><span className="text-white text-sm">{entity.address}</span></div></div>}
                    {entity.cost && <div className="bg-black/50 p-4 rounded-2xl border border-gray-800 flex items-center gap-4"><span className="text-2xl">💵</span><div><span className="block text-[10px] text-gray-500 font-bold uppercase tracking-widest">Price Guide</span><span className="text-white text-sm">{entity.cost}</span></div></div>}
                </div>
            </div>
        )}

        {!isPage && (
            <>
              {accessLevel === 'friend' ? (
                  <div className="space-y-6 animate-fade-in">
                      <div className="bg-[#090812]/80 border-2 rounded-3xl p-6 relative overflow-hidden transition-all duration-300" style={{ borderColor: dynamicAccent, boxShadow: `0 0 25px ${dynamicAccent}33, inset 0 0 10px ${dynamicAccent}22` }}>
                          <h3 className="text-2xl font-['Bebas_Neue'] tracking-widest mb-6 text-white flex items-center gap-3" style={{ textShadow: `0 0 15px ${dynamicAccent}` }}>
                              <span>🤝</span> Verified Friend Details
                          </h3>
                          <div className="grid grid-cols-2 gap-4 relative z-10">
                              <div className="bg-black/50 border border-gray-800 rounded-xl p-4">
                                  <span className="text-[9px] text-gray-500 font-bold uppercase tracking-widest block mb-1">Full Name</span>
                                  <p className="text-sm text-white">{entity.full_name || "Hidden"}</p>
                              </div>
                              <div className="bg-black/50 border border-gray-800 rounded-xl p-4">
                                  <span className="text-[9px] text-gray-500 font-bold uppercase tracking-widest block mb-1">Current Check-In</span>
                                  <p className="text-sm text-gray-500 italic">Not checked in anywhere.</p>
                              </div>
                          </div>
                      </div>
                  </div>
              ) : (
                  <div className="text-center p-10 bg-[#090812]/80 border-2 border-gray-800 rounded-3xl relative z-10">
                      <div className="text-4xl mb-3 opacity-50">🔒</div>
                      <p className="text-gray-400 font-bold tracking-widest uppercase text-sm mb-2">Private Profile</p>
                      <p className="text-gray-500 text-[10px] uppercase tracking-widest">Add as a friend to view setlists and details.</p>
                  </div>
              )}
            </>
        )}
      </div>
    </>
  )
}