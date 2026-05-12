import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import Setlist from './Setlist'
import Repertoire from './Repertoire'
import SongBook from './Songbook'
import ProfileVenue from './ProfileVenue'
import ProfileHost from './ProfileHost'
import ProfilePerformer from './ProfilePerformer'

const GRADIENTS = {
  'deep-space': 'bg-gradient-to-b from-slate-900/60 via-[#090812]/60 to-black/60 backdrop-blur-md',
  'cyber-dusk': 'bg-gradient-to-b from-purple-900/40 via-[#090812]/60 to-black/60 backdrop-blur-md',
  'toxic-glow': 'bg-gradient-to-b from-green-900/30 via-[#090812]/60 to-black/60 backdrop-blur-md',
  'blood-moon': 'bg-gradient-to-b from-red-900/30 via-[#090812]/60 to-black/60 backdrop-blur-md',
  'golden-hour': 'bg-gradient-to-b from-orange-900/30 via-[#090812]/60 to-black/60 backdrop-blur-md',
  'abyss': 'bg-black/60 backdrop-blur-md'
}

export default function PublicProfile({ entity, onClose, currentUser, onViewEntity }) {
  const [followersCount, setFollowersCount] = useState(0)
  const [isConnection, setIsConnection] = useState(false) 
  const [isLoading, setIsLoading] = useState(true)
  const [currentSlide, setCurrentSlide] = useState(0)
  const [recentPost, setRecentPost] = useState(null)
  const [setlistTrigger, setSetlistTrigger] = useState(0)

  const isPage = 'page_type' in entity

  const dynamicPrimary = entity.primary_color || (isPage ? '#00f5ff' : '#3b82f6')
  const dynamicSecondary = entity.secondary_color || (isPage ? '#b347ff' : '#9333ea')
  const dynamicAccent = entity.accent_color || (isPage ? '#ff2d78' : '#10b981')

  // 🟢 THE FIX: Allow 'Regular' users to show their karaoke catalogs to the public!
  const showKaraokeFeatures = !isPage && ['Regular', 'Singer', 'Host', 'Admin'].includes(entity.account_type)

  useEffect(() => {
    async function fetchProfileData() {
      const { count } = await supabase.from('connections')
        .select('*', { count: 'exact', head: true })
        .eq('target_id', entity.id) 
        .eq('connection_type', isPage ? 'following' : 'friend') 
      
      setFollowersCount(count || 0)

      const { data: existingConnection } = await supabase.from('connections')
        .select('id, connection_type')
        .eq('follower_id', currentUser.id)
        .eq('target_id', entity.id)
        .maybeSingle()

      setIsConnection(!!existingConnection)

      if (!isPage) {
          const { data: posts } = await supabase.from('posts')
            .select('*')
            .eq('author_id', entity.id)
            .order('created_at', { ascending: false })
            .limit(1)
          
          if (posts && posts.length > 0) setRecentPost(posts[0])
      }
      setIsLoading(false)
    }
    fetchProfileData()
  }, [entity.id, currentUser.id, isPage])

  useEffect(() => {
    if (entity?.slideshow_urls && entity.slideshow_urls.length > 1) {
      const timer = setInterval(() => setCurrentSlide((prev) => (prev + 1) % entity.slideshow_urls.length), 5000)
      return () => clearInterval(timer)
    }
  }, [entity?.slideshow_urls])

  const handleConnectionToggle = async () => {
      const statusType = isPage ? 'following' : 'friend'
      
      if (isConnection) {
          await supabase.from('connections').delete()
              .eq('follower_id', currentUser.id)
              .eq('target_id', entity.id)
          setFollowersCount(prev => Math.max(0, prev - 1))
          setIsConnection(false)
      } else {
          await supabase.from('connections').insert({
              follower_id: currentUser.id,
              target_id: entity.id,
              connection_type: statusType
          })
          
          if (isPage) {
              await supabase.rpc('trigger_reward', { target_user_id: currentUser.id, action_slug: 'follow_venue' })
          }
          setFollowersCount(prev => prev + 1)
          setIsConnection(true)
      }
  }

  if (isLoading) return <div className="p-10 text-center text-blue-400 font-bold uppercase tracking-widest animate-pulse">Decrypting Identity...</div>

  const gradientClass = entity.bg_gradient ? GRADIENTS[entity.bg_gradient] : GRADIENTS['deep-space']

  return (
    <>
      {entity.slideshow_urls && entity.slideshow_urls.length > 0 ? (
          entity.slideshow_urls.map((url, idx) => (
             <img key={idx} src={url} alt="Slideshow" referrerPolicy="no-referrer" className={`fixed inset-0 w-full h-full object-cover transition-opacity duration-1000 ease-in-out z-0 pointer-events-none opacity-30 ${idx === currentSlide ? 'opacity-30' : 'opacity-0'}`} />
          ))
      ) : (
          <div className={`fixed inset-0 z-0 pointer-events-none ${gradientClass} transition-colors duration-1000`}></div>
      )}
      
      <div className="max-w-2xl mx-auto p-4 animate-fade-in relative z-10 pb-32">
        <button onClick={onClose} className="mb-4 bg-gray-900/80 border border-gray-700 text-gray-400 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest hover:text-white transition-colors backdrop-blur-sm">
            ← Back to Directory
        </button>

        <div className="rounded-3xl p-8 flex flex-col items-center text-center relative overflow-hidden mb-8 border-2 shadow-2xl transition-all duration-500" style={{ backgroundColor: '#090812', borderColor: dynamicPrimary, boxShadow: `0 0 40px ${dynamicPrimary}44, inset 0 0 30px ${dynamicPrimary}44` }}>
            <img src={entity.profile_pic || `https://api.dicebear.com/7.x/bottts/svg?seed=${entity.name || entity.username}`} className="w-36 h-36 rounded-full border-4 bg-black object-cover relative z-10 shadow-2xl" style={{ borderColor: dynamicPrimary, boxShadow: `0 0 25px ${dynamicPrimary}88` }} alt="Profile" referrerPolicy="no-referrer" onError={(e) => { e.target.onerror = null; e.target.src = `https://api.dicebear.com/7.x/bottts/svg?seed=${entity.name || entity.username}` }} />
            
            <h2 className="text-5xl font-['Bebas_Neue'] tracking-wider mt-6 z-10 text-white relative" style={{ textShadow: `0 0 15px ${dynamicPrimary}, 0 0 30px ${dynamicPrimary}` }}>
                {entity.name || entity.username}
            </h2>

            <div className="bg-black/50 border border-white/10 px-4 py-1 rounded-full relative z-10 backdrop-blur-md mt-2 mb-4">
                <span className="text-[10px] font-bold text-gray-300 uppercase tracking-widest">{isPage ? 'Venue' : entity.account_type + ' Account'}</span>
            </div>

            {!isPage && recentPost && (
                <div className="bg-black/50 border border-white/10 px-4 py-3 rounded-xl w-full max-w-sm relative z-10 backdrop-blur-md mb-6">
                    <p className="text-gray-200 text-xs italic font-medium break-words">"{recentPost.content}"</p>
                </div>
            )}

            <div className="flex gap-6 mt-2 relative z-10">
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

            <button onClick={handleConnectionToggle} className="mt-8 px-8 py-3 rounded-full text-xs font-bold uppercase tracking-widest text-white transition-all relative z-10 shadow-lg" style={{ background: isConnection ? 'transparent' : `linear-gradient(135deg, ${dynamicPrimary}, ${dynamicSecondary})`, border: isConnection ? `2px solid ${dynamicPrimary}` : 'none' }}>
                {isConnection ? (isPage ? 'Unfollow' : 'Remove Friend') : (isPage ? 'Follow Venue' : 'Connect')}
            </button>
        </div>

        {isPage && (
            <div className="space-y-6 mb-8">
                <div className="bg-[#090812] border-2 border-gray-800 rounded-3xl p-6 shadow-xl relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-400 to-cyan-400"></div>
                    <h3 className="text-3xl font-['Bebas_Neue'] tracking-widest text-white mb-6">Venue Details</h3>
                    <div className="space-y-4 relative z-10">
                        <div className="bg-black/50 border border-gray-800 rounded-xl p-4">
                            <p className="flex items-start gap-3 text-gray-300 text-sm"><span className="text-xl">📍</span> <span>{entity.address || "Address not provided"}</span></p>
                        </div>
                        <div className="bg-black/50 border border-gray-800 rounded-xl p-4">
                            <p className="flex items-center gap-3 text-gray-300 text-sm"><span className="text-xl">📞</span> <span>{entity.phone || "Phone not provided"}</span></p>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {!isPage && (
            <div className="space-y-6 mb-8">
                <div className="bg-[#090812] border-2 border-gray-800 rounded-3xl p-6 shadow-xl relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-400 to-cyan-400"></div>
                    <h3 className="text-3xl font-['Bebas_Neue'] tracking-widest text-white mb-6">Vibe Check</h3>
                    <div className="grid grid-cols-2 gap-4 relative z-10">
                        <div className="bg-black/50 border border-gray-800 rounded-xl p-4">
                            <span className="text-[9px] text-gray-500 font-bold uppercase tracking-widest block mb-1">Full Name</span>
                            <p className="text-sm text-white">{entity.full_name || "Not provided"}</p>
                        </div>
                        <div className="bg-black/50 border border-gray-800 rounded-xl p-4">
                            <span className="text-[9px] text-gray-500 font-bold uppercase tracking-widest block mb-1">Current Check-In</span>
                            <p className="text-sm text-gray-500 italic">Not checked in anywhere.</p>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* DYNAMIC ROLE PROFILES */}
        {entity.account_type === 'Venue' ? (
            <div className="mt-6">
                <ProfileVenue profile={entity} isOwner={false} onViewEntity={onViewEntity} />
            </div>
        ) : entity.account_type === 'Performer' ? (
            <div className="mt-6">
                <ProfilePerformer profile={entity} isOwner={false} onViewEntity={onViewEntity} />
            </div>
        ) : entity.account_type === 'Host' ? (
            <div className="mt-6">
                <ProfileHost profile={entity} isOwner={false} onViewEntity={onViewEntity} />
            </div>
        ) : (
            showKaraokeFeatures && (
                <div className="mt-6 animate-fade-in">
                    <Setlist session={{ user: { id: entity.id } }} isOwner={false} />
                    <Repertoire userId={entity.id} isOwner={false} canSuggest={true} currentUser={currentUser} profileUser={entity} trigger={setlistTrigger} setTrigger={setSetlistTrigger} />
                    
                    <div className="mt-8 bg-[#090812] border-2 border-green-500/30 rounded-3xl p-6 shadow-xl relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-green-400 to-emerald-400"></div>
                        <SongBook currentUser={currentUser} profileUser={entity} isOwnProfile={false} embedded={true} />
                    </div>
                </div>
            )
        )}
      </div>
    </>
  )
}