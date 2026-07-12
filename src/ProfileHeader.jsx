import { useState, useEffect } from 'react'

const Linkify = ({ text }) => {
  if (!text) return null
  const urlRegex = /(https?:\/\/[^\s]+)/g
  const parts = text.split(urlRegex)
  return (
    <>
      {parts.map((part, i) =>
        part.match(urlRegex) ? (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#4f8cff] hover:text-[#7aabff] underline underline-offset-2 break-all transition-colors"
            onClick={e => e.stopPropagation()}
          >
            {part}
          </a>
        ) : (
          part
        )
      )}
    </>
  )
}

const ACCOUNT_TYPE_STYLES = {
  Admin:     { label: 'Admin',     color: 'text-red-400',     bg: 'bg-red-500/10',     border: 'border-red-500/30'     },
  Host:      { label: 'Host',      color: 'text-[#22d4c8]',   bg: 'bg-[#22d4c8]/10',   border: 'border-[#22d4c8]/30'   },
  Venue:     { label: 'Venue',     color: 'text-[#4f8cff]',   bg: 'bg-[#4f8cff]/10',   border: 'border-[#4f8cff]/30'   },
  Performer: { label: 'Performer', color: 'text-purple-400',  bg: 'bg-purple-500/10',  border: 'border-purple-500/30'  },
  Singer:    { label: 'Singer',    color: 'text-[#f5557a]',   bg: 'bg-[#f5557a]/10',   border: 'border-[#f5557a]/30'   },
  Regular:   { label: 'Regular',   color: 'text-white/50',    bg: 'bg-white/[0.04]',   border: 'border-white/[0.08]'   },
}

export default function ProfileHeader({ profile, friendsCount, latestPost, onEditTheme, onOpenFriends }) {
  const [currentSlide, setCurrentSlide] = useState(0)

  useEffect(() => {
    if (profile?.slideshow_urls && profile.slideshow_urls.length > 1) {
      const timer = setInterval(
        () => setCurrentSlide(prev => (prev + 1) % profile.slideshow_urls.length),
        5000
      )
      return () => clearInterval(timer)
    }
  }, [profile?.slideshow_urls])

  const typeStyle = ACCOUNT_TYPE_STYLES[profile.account_type] || ACCOUNT_TYPE_STYLES.Regular

  // Use profile custom colors as subtle accents, falling back to design tokens
  const accentColor  = profile.primary_color   || '#4f8cff'
  const accentColor2 = profile.secondary_color  || '#22d4c8'
  const accentColor3 = profile.accent_color     || '#f5557a'

  const statItems = [
    { value: friendsCount,               label: 'Friends',   action: onOpenFriends },
    { value: profile.lifestyle_points || 0, label: 'Life Pts', action: null          },
    { value: profile.league_all_time || 0,  label: 'League',   action: null          },
  ]

  return (
    <div className="relative rounded-3xl overflow-hidden">
      {/* ── Slideshow / Ambient background ───────────────────────────────── */}
      <div className="absolute inset-0 rounded-3xl overflow-hidden">
        {profile.slideshow_urls && profile.slideshow_urls.length > 0 ? (
          profile.slideshow_urls.map((url, idx) => (
            <img
              key={idx}
              src={url}
              alt=""
              referrerPolicy="no-referrer"
              className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ${idx === currentSlide ? 'opacity-30' : 'opacity-0'}`}
            />
          ))
        ) : (
          // Dynamic ambient glow from profile accent colors
          <div
            className="absolute inset-0"
            style={{
              background: `radial-gradient(ellipse 120% 80% at 50% -20%, ${accentColor}18 0%, ${accentColor2}10 40%, transparent 70%)`,
            }}
          />
        )}
        {/* Overlay for legibility */}
        <div className="absolute inset-0 bg-[#070d1a]/60 backdrop-blur-sm" />
      </div>

      {/* ── Top accent line (uses profile colors) ────────────────────────── */}
      <div
        className="absolute top-0 left-0 w-full h-0.5 z-10"
        style={{
          background: `linear-gradient(90deg, ${accentColor}, ${accentColor2}, ${accentColor3})`,
        }}
      />

      {/* ── Content ──────────────────────────────────────────────────────── */}
      <div
        className="relative z-10 rounded-3xl border"
        style={{ borderColor: `${accentColor}25` }}
      >
        <div className="flex flex-col items-center text-center px-6 pt-8 pb-6">

          {/* Avatar */}
          <div className="relative mb-4">
            <div
              className="absolute -inset-1 rounded-full blur-md opacity-60"
              style={{ background: `${accentColor}55` }}
            />
            <img
              src={
                profile.profile_pic ||
                `https://api.dicebear.com/7.x/bottts/svg?seed=${profile.username}`
              }
              alt={profile.username}
              decoding="async"
              referrerPolicy="no-referrer"
              className="relative w-28 h-28 rounded-full object-cover border-2 bg-[#0e1828]"
              style={{ borderColor: `${accentColor}60` }}
              onError={e => {
                e.target.onerror = null
                e.target.src = `https://api.dicebear.com/7.x/bottts/svg?seed=${profile.username}`
              }}
            />
            {/* Online indicator */}
            <div className="absolute bottom-1 right-1 w-4 h-4 bg-emerald-400 rounded-full border-2 border-[#070d1a] shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
          </div>

          {/* Username */}
          <h1
            className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white leading-none mb-2 break-all px-2"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            {profile.username}
            {profile.zodiac_sign && (
              <span className="ml-2 text-2xl" title={profile.zodiac_sign}>
                {profile.zodiac_sign.split(' ')[0]}
              </span>
            )}
          </h1>

          {/* Account type badge */}
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border mb-4 ${typeStyle.color} ${typeStyle.bg} ${typeStyle.border}`}
          >
            {typeStyle.label}
          </span>

          {/* Latest post / status quote */}
          <div className="bg-white/[0.04] border border-white/[0.07] rounded-2xl px-4 py-3 w-full max-w-sm mb-6">
            <p className="text-white/60 text-xs italic leading-relaxed">
              {latestPost ? (
                <>
                  "<Linkify text={latestPost.content} />"
                </>
              ) : (
                'No status set. Broadcast a vibe below!'
              )}
            </p>
          </div>

          {/* Stats row */}
          <div className="flex items-center gap-1 mb-6 w-full max-w-xs justify-center">
            {statItems.map((s, i) => (
              <div key={i} className="flex flex-col items-center gap-0.5 flex-1">
                {i > 0 && (
                  <div className="absolute w-px h-6 bg-white/[0.07]" style={{ position: 'relative' }} />
                )}
                <button
                  onClick={s.action || undefined}
                  disabled={!s.action}
                  className={`flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl transition-all w-full ${
                    s.action
                      ? 'hover:bg-white/[0.06] cursor-pointer active:scale-95'
                      : 'cursor-default'
                  }`}
                >
                  <span
                    className="text-2xl font-bold leading-none"
                    style={{
                      fontFamily: "'Plus Jakarta Sans', sans-serif",
                      color: i === 0 ? accentColor : i === 1 ? accentColor2 : accentColor3,
                    }}
                  >
                    {s.value}
                  </span>
                  <span className="text-[9px] text-white/40 font-bold uppercase tracking-widest">
                    {s.label}
                  </span>
                </button>
              </div>
            ))}
          </div>

          {/* Divider */}
          <div className="w-full h-px bg-white/[0.06] mb-4" />

          {/* Slideshow dots (if multiple slides) */}
          {profile.slideshow_urls && profile.slideshow_urls.length > 1 && (
            <div className="flex gap-1.5 mb-4">
              {profile.slideshow_urls.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentSlide(idx)}
                  className={`rounded-full transition-all ${
                    idx === currentSlide
                      ? 'w-4 h-1.5 bg-white'
                      : 'w-1.5 h-1.5 bg-white/30 hover:bg-white/50'
                  }`}
                />
              ))}
            </div>
          )}

          {/* Customize button */}
          <button
            onClick={onEditTheme}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest text-white transition-all hover:scale-105 active:scale-95"
            style={{
              background: `linear-gradient(135deg, ${accentColor}, ${accentColor2})`,
              boxShadow: `0 4px 20px ${accentColor}40`,
            }}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536M9 11l6.536-6.536a2 2 0 012.828 0l.172.172a2 2 0 010 2.828L12 14H9v-3z" />
            </svg>
            Customize Theme
          </button>

        </div>
      </div>
    </div>
  )
}
