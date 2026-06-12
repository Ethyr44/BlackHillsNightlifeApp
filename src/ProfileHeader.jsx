import { useState, useEffect } from 'react'

// 🟢 Drop this near the top of your file
const Linkify = ({ text }) => {
    if (!text) return null;
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlRegex);

    return (
        <>
            {parts.map((part, i) => {
                if (part.match(urlRegex)) {
                    return (
                        <a 
                            key={i} 
                            href={part} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="text-blue-400 hover:text-blue-300 underline underline-offset-2 break-all"
                            onClick={(e) => e.stopPropagation()} // Prevents the post container click from firing
                        >
                            {part}
                        </a>
                    );
                }
                return part;
            })}
        </>
    );
};

export default function ProfileHeader({ profile, friendsCount, latestPost, onEditTheme, onOpenFriends }) {
  const [currentSlide, setCurrentSlide] = useState(0)

  // Slideshow Timer
  useEffect(() => {
    if (profile?.slideshow_urls && profile.slideshow_urls.length > 1) {
      const timer = setInterval(() => setCurrentSlide((prev) => (prev + 1) % profile.slideshow_urls.length), 5000)
      return () => clearInterval(timer)
    }
  }, [profile?.slideshow_urls])

  const dynamicPrimary = profile.primary_color || '#3b82f6'
  const dynamicSecondary = profile.secondary_color || '#9333ea'
  const dynamicAccent = profile.accent_color || '#10b981'

  return (
    <div className="rounded-3xl p-8 flex flex-col items-center text-center relative overflow-hidden mb-2 border-2 transition-all duration-500"
         style={{ backgroundColor: '#090812', borderColor: dynamicPrimary, boxShadow: `0 0 40px ${dynamicPrimary}44, inset 0 0 30px ${dynamicPrimary}44` }}>
      
      {/* Background Logic */}
      {profile.slideshow_urls && profile.slideshow_urls.length > 0 ? (
          profile.slideshow_urls.map((url, idx) => (
              <img 
                  key={idx} 
                  src={url} 
                  alt="Slideshow" 
                  referrerPolicy="no-referrer" 
                  className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ease-in-out ${idx === currentSlide ? 'opacity-40 z-0' : 'opacity-0 -z-10'}`} 
              />
          ))
      ) : (
          <div className="absolute inset-0 opacity-20" style={{ background: `linear-gradient(135deg, ${dynamicPrimary}, ${dynamicSecondary})` }} />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-[#090812] via-[#090812]/50 to-transparent"></div>

      <img 
          src={profile.profile_pic || `https://api.dicebear.com/7.x/bottts/svg?seed=${profile.username}`} 
          className="w-36 h-36 rounded-full border-4 bg-black z-10 object-cover shadow-2xl relative" 
          style={{ borderColor: dynamicPrimary, boxShadow: `0 0 25px ${dynamicPrimary}88` }} 
          alt="Profile" 
          onError={(e) => { e.target.onerror = null; e.target.src = `https://api.dicebear.com/7.x/bottts/svg?seed=${profile.username}` }}
          referrerPolicy="no-referrer"
      />
      
      <h1 className="font-['Bebas_Neue'] text-white tracking-widest uppercase leading-none drop-shadow-[0_5px_15px_rgba(0,0,0,0.8)] text-5xl sm:text-6xl break-all px-4 mt-6 z-10 relative flex items-center gap-3 justify-center" style={{ textShadow: `0 0 15px ${dynamicPrimary}, 0 0 30px ${dynamicPrimary}` }}>
          {profile.username}
          {profile.zodiac_sign && <span className="text-2xl" title={profile.zodiac_sign}>{profile.zodiac_sign.split(' ')[0]}</span>}
      </h1>
      
      <div className="bg-black/50 border border-white/10 px-4 py-1 rounded-full relative z-10 backdrop-blur-md mt-1 mb-4">
          <span className="text-[10px] font-bold text-gray-300 uppercase tracking-widest">{profile.account_type} Account</span>
      </div>

      <div className="bg-black/50 border border-white/10 px-4 py-3 rounded-xl w-full max-w-sm relative z-10 backdrop-blur-md">
          <p className="text-gray-200 text-xs sm:text-sm italic font-medium break-words">
            {latestPost ? <>"<Linkify text={latestPost.content} />"</> : "No status set. Broadcast a vibe below!"}
          </p>
      </div>

      <div className="flex gap-4 sm:gap-6 mt-6 pt-6 border-t border-white/10 w-full justify-center relative z-10">
        <div className="text-center cursor-pointer hover:opacity-80 transition-opacity" onClick={onOpenFriends}>
          <span className="block text-2xl font-['Bebas_Neue'] text-white" style={{ textShadow: `0 0 10px ${dynamicPrimary}` }}>{friendsCount}</span>
          <span className="text-[10px] text-gray-300 uppercase tracking-widest font-bold">Friends</span>
        </div>
        <div className="text-center">
          <span className="block text-2xl font-['Bebas_Neue'] text-white" style={{ textShadow: `0 0 10px ${dynamicSecondary}` }}>{profile.lifestyle_points || 0}</span>
          <span className="text-[10px] text-gray-300 uppercase tracking-widest font-bold">Life Pts</span>
        </div>
        <div className="text-center">
          <span className="block text-2xl font-['Bebas_Neue'] text-white" style={{ textShadow: `0 0 10px ${dynamicAccent}` }}>{profile.league_all_time || 0}</span>
          <span className="text-[10px] text-gray-300 uppercase tracking-widest font-bold">League</span>
        </div>
      </div>

      <button onClick={onEditTheme} className="mt-6 px-8 py-3 rounded-full text-xs font-bold uppercase tracking-widest text-white transition-all relative z-10"
              style={{ background: `linear-gradient(135deg, ${dynamicPrimary}, ${dynamicSecondary})`, boxShadow: `0 0 20px ${dynamicSecondary}66` }}>
          ✨ Customize Theme
      </button>
    </div>
  )
}