import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

export default function PublicProfile({ entity, onClose, currentUser, forceAccess }) {
  const [accessLevel, setAccessLevel] = useState('public') 
  const [followersCount, setFollowersCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [currentSlide, setCurrentSlide] = useState(0)
  
  const [recentPost, setRecentPost] = useState(null)

  const isPage = 'page_type' in entity

  const dynamicPrimary = entity.primary_color || (isPage ? '#00f5ff' : '#3b82f6')
  const dynamicSecondary = entity.secondary_color || (isPage ? '#b347ff' : '#9333ea')
  const dynamicAccent = entity.accent_color || (isPage ? '#ff2d78' : '#10b981')

  useEffect(() => {
    async function fetchProfileData() {
      // 1. Get Connections Count
      const { count } = await supabase.from('connections')
        .select('*', { count: 'exact', head: true })
        .eq('following_id', entity.id)
        .eq('status', isPage ? 'following' : 'friend') 
      
      setFollowersCount(count || 0)

      if (isPage) {
          setAccessLevel('public')
          setIsLoading(false)
          return
      }

      // 2. Fetch User's Actual Recent Post
      const { data: posts } = await supabase.from('posts')
        .select('*')
        .or(`author_id.eq.${entity.id},user_id.eq.${entity.id}`)
        .order('created_at', { ascending: false })
        .limit(1)
      
      if (posts && posts.length > 0) setRecentPost(posts[0])

      // 3. Set Beta Test Friend Override
      setAccessLevel('friend')
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

  const handleFollowPage = async () => {
      await supabase.from('connections').insert({ follower_id: currentUser.id, following_id: entity.id, status: 'following' })
      setFollowersCount(prev => prev + 1)
      alert(`You are now following ${entity.name}!`)
  }

  const handleDMClick = () => {
      alert(`Direct Messaging with ${entity.username || entity.name} will be available in the next update!`)
  }

  if (isLoading) {
      return (
          <div className="flex flex-col items-center justify-center py-20">
              <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
      )
  }

  return (
    <div className="max-w-2xl mx-auto p-4 animate-fade-in relative pb-32 space-y-8">
      <button onClick={onClose} className="mb-2 text-xs font-bold uppercase tracking-widest text-gray-500 hover:text-white flex items-center gap-2">
        ← Back to Directory
      </button>

      <div 
        className="rounded-3xl p-8 flex flex-col items-center text-center relative overflow-hidden mb-2 border-2 transition-all duration-500"
        style={{ backgroundColor: '#090812', borderColor: dynamicPrimary, boxShadow: `0 0 40px ${dynamicPrimary}44, inset 0 0 30px ${dynamicPrimary}44` }}
      >
        {entity.slideshow_urls && entity.slideshow_urls.length > 0 ? (
            entity.slideshow_urls.map((url, idx) => (
                <div key={idx} className={`absolute inset-0 bg-cover bg-center transition-opacity duration-1000 ease-in-out ${idx === currentSlide ? 'opacity-40' : 'opacity-0'}`} style={{ backgroundImage: `url(${url})` }} />
            ))
        ) : (
            <div className="absolute inset-0 opacity-20" style={{ background: `linear-gradient(135deg, ${dynamicPrimary}, ${dynamicSecondary})` }} />
        )}
        
        <div className="absolute inset-0 bg-gradient-to-t from-[#090812] via-[#090812]/50 to-transparent"></div>

        <img 
          src={entity.profile_pic || `https://api.dicebear.com/7.x/shapes/svg?seed=${isPage ? entity.name : entity.username}`} 
          className="w-36 h-36 rounded-full border-4 bg-black z-10 object-cover shadow-2xl relative" 
          style={{ borderColor: dynamicPrimary, boxShadow: `0 0 25px ${dynamicPrimary}88` }}
          alt="Profile"
        />
        
        <h2 className="text-5xl font-['Bebas_Neue'] tracking-wider mt-6 z-10 text-white relative flex items-center gap-3 justify-center" style={{ textShadow: `0 0 15px ${dynamicPrimary}, 0 0 30px ${dynamicPrimary}` }}>
            {isPage ? entity.name : entity.username} 
            {!isPage && entity.zodiac_sign && <span className="text-2xl" title={entity.zodiac_sign}>{entity.zodiac_sign.split(' ')[0]}</span>}
        </h2>
        
        <p className="text-sm text-gray-300 uppercase tracking-widest font-bold mb-6 z-10 relative drop-shadow-md">
            {isPage ? `Official ${entity.page_type}` : (entity.full_name || "BHNL Member")}
        </p>

        <div className="flex gap-4 sm:gap-6 pt-4 border-t border-white/10 w-full justify-center relative z-10">
          <div className="text-center">
            <span className="block text-2xl font-['Bebas_Neue'] text-white" style={{ textShadow: `0 0 10px ${dynamicPrimary}` }}>{followersCount}</span>
            <span className="text-[10px] text-gray-300 uppercase tracking-widest font-bold">{isPage ? 'Followers' : 'Friends'}</span>
          </div>
          {!isPage && (
              <div className="text-center">
                <span className="block text-2xl font-['Bebas_Neue'] text-white" style={{ textShadow: `0 0 10px ${dynamicSecondary}` }}>{entity.lifestyle_points || 0}</span>
                <span className="text-[10px] text-gray-300 uppercase tracking-widest font-bold">PTS</span>
              </div>
          )}
        </div>

        {isPage && (
            <button onClick={handleFollowPage} className="mt-6 px-8 py-3 rounded-full text-xs font-bold uppercase tracking-widest text-white transition-all relative z-10"
                    style={{ background: `linear-gradient(135deg, ${dynamicPrimary}, ${dynamicSecondary})`, boxShadow: `0 0 20px ${dynamicSecondary}66` }}>
                + Follow {entity.page_type}
            </button>
        )}
      </div>

      {isPage && (
          <div className="bg-[#090812]/80 border-2 rounded-3xl p-6 relative overflow-hidden transition-all duration-300" style={{ borderColor: dynamicSecondary, boxShadow: `0 0 25px ${dynamicSecondary}33, inset 0 0 10px ${dynamicSecondary}22` }}>
              <h3 className="text-2xl font-['Bebas_Neue'] tracking-widest mb-6 text-white" style={{ textShadow: `0 0 15px ${dynamicSecondary}` }}>
                  About this {entity.page_type}
              </h3>
              
              <div className="space-y-4 relative z-10">
                  {entity.address && (
                      <div className="bg-black/50 p-4 rounded-2xl border border-gray-800 flex items-center gap-4">
                          <span className="text-2xl" style={{ textShadow: `0 0 10px ${dynamicSecondary}` }}>📍</span>
                          <div>
                              <span className="block text-[10px] text-gray-500 font-bold uppercase tracking-widest">Location</span>
                              <span className="text-white text-sm">{entity.address}</span>
                          </div>
                      </div>
                  )}
                  {entity.cost && (
                      <div className="bg-black/50 p-4 rounded-2xl border border-gray-800 flex items-center gap-4">
                          <span className="text-2xl" style={{ textShadow: `0 0 10px ${dynamicSecondary}` }}>💵</span>
                          <div>
                              <span className="block text-[10px] text-gray-500 font-bold uppercase tracking-widest">Price Guide</span>
                              <span className="text-white text-sm">{entity.cost}</span>
                          </div>
                      </div>
                  )}
                  <div className="grid grid-cols-2 gap-4">
                      {entity.phone && <a href={`tel:${entity.phone}`} className="bg-gray-800 hover:bg-gray-700 text-center py-3 rounded-xl text-xs font-bold text-white uppercase tracking-widest transition-colors border border-gray-700">📞 Call</a>}
                      {entity.website && <a href={entity.website} target="_blank" rel="noreferrer" className="bg-gray-800 hover:bg-gray-700 text-center py-3 rounded-xl text-xs font-bold text-white uppercase tracking-widest transition-colors border border-gray-700">🌐 Website</a>}
                  </div>
              </div>
          </div>
      )}

      {!isPage && (
          <>
            <div className="bg-[#090812]/80 border-2 rounded-3xl p-6 relative overflow-hidden transition-all duration-300" style={{ borderColor: dynamicSecondary, boxShadow: `0 0 25px ${dynamicSecondary}33, inset 0 0 10px ${dynamicSecondary}22` }}>
                <h3 className="text-2xl font-['Bebas_Neue'] tracking-widest mb-4 text-white" style={{ textShadow: `0 0 15px ${dynamicSecondary}` }}>
                    Recent Vibe
                </h3>
                <div className="bg-black/50 p-4 rounded-2xl border border-gray-800 relative z-10">
                    <p className="text-gray-300 italic text-sm">
                        {recentPost ? `"${recentPost.content}"` : "This user hasn't posted any vibes yet."}
                    </p>
                    {recentPost && <span className="block text-[9px] text-gray-500 font-bold uppercase tracking-widest mt-2">{new Date(recentPost.created_at).toLocaleString()}</span>}
                </div>
            </div>

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
                    <div className="flex gap-3 mt-4 relative z-10">
                        <button onClick={handleDMClick} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-xl font-bold uppercase tracking-widest text-xs transition-colors shadow-[0_0_15px_rgba(59,130,246,0.4)]">
                            Direct Message
                        </button>
                        <button className="flex-1 bg-purple-600 hover:bg-purple-500 text-white py-3 rounded-xl font-bold uppercase tracking-widest text-xs transition-colors shadow-[0_0_15px_rgba(147,51,234,0.4)]">
                            View Full Setlist
                        </button>
                    </div>
                </div>
            </div>
          </>
      )}
    </div>
  )
}