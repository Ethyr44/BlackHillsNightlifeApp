import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

export default function ProfilePerformer({ profile, isOwner, onViewEntity }) {
  const details = profile?.details || {}
  const links = details.links || {}

  const PLATFORM_STYLES = {
    spotify:    { color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', icon: '🎧' },
    soundcloud: { color: 'text-orange-400',  bg: 'bg-orange-500/10',  border: 'border-orange-500/20',  icon: '☁️' },
    youtube:    { color: 'text-red-400',     bg: 'bg-red-500/10',     border: 'border-red-500/20',     icon: '▶️' },
    instagram:  { color: 'text-pink-400',    bg: 'bg-pink-500/10',    border: 'border-pink-500/20',    icon: '📸' },
    tiktok:     { color: 'text-white/70',    bg: 'bg-white/[0.04]',   border: 'border-white/[0.08]',   icon: '🎵' },
    facebook:   { color: 'text-[#4f8cff]',  bg: 'bg-[#4f8cff]/10',  border: 'border-[#4f8cff]/20',  icon: '👍' },
    web:        { color: 'text-[#22d4c8]',  bg: 'bg-[#22d4c8]/10',  border: 'border-[#22d4c8]/20',  icon: '🌐' },
    twitter:    { color: 'text-white/60',    bg: 'bg-white/[0.04]',   border: 'border-white/[0.08]',   icon: '𝕏' },
    x:          { color: 'text-white/60',    bg: 'bg-white/[0.04]',   border: 'border-white/[0.08]',   icon: '𝕏' },
    threads:    { color: 'text-white/60',    bg: 'bg-white/[0.04]',   border: 'border-white/[0.08]',   icon: '@' },
    twitch:     { color: 'text-purple-400',  bg: 'bg-purple-500/10',  border: 'border-purple-500/20',  icon: '🎮' },
  }

  const activeLinks = Object.entries(links).filter(([, url]) => url && url.trim() !== '')

  return (
    <div className="animate-fade-in space-y-4">
      {/* Performer header */}
      <div className="relative rounded-2xl border border-purple-500/20 bg-purple-500/5 p-5 text-center overflow-hidden">
        <div className="h-0.5 w-full absolute top-0 left-0 bg-gradient-to-r from-purple-500 via-pink-500 to-purple-500" />

        <div className="inline-flex items-center gap-2 bg-purple-500/10 border border-purple-500/20 px-3 py-1 rounded-full mb-3">
          <span className="text-purple-300 text-[10px] font-bold uppercase tracking-widest">{details.actType || 'Performer'}</span>
        </div>

        <h2 className="text-2xl font-bold text-white mb-2">{details.name || profile.username}</h2>

        {details.genres && details.genres.length > 0 && (
          <div className="flex flex-wrap justify-center gap-1.5 mt-3">
            {details.genres.map(g => (
              <span key={g} className="text-white/50 text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-white/[0.04] border border-white/[0.07]">
                {g}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Links */}
      <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-4">
        <h3 className="text-xs font-bold text-white/50 uppercase tracking-widest mb-3">Links & Socials</h3>

        {activeLinks.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-white/30 text-xs font-medium uppercase tracking-widest">No links provided</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {activeLinks.map(([platform, url]) => {
              const s = PLATFORM_STYLES[platform.toLowerCase()] || PLATFORM_STYLES.web
              const href = url.startsWith('http') ? url : `https://${url}`
              return (
                <a
                  key={platform}
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  className={`flex items-center justify-between p-3 rounded-xl border transition-all hover:scale-[1.02] ${s.bg} ${s.border} group`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-base">{s.icon}</span>
                    <span className={`text-sm font-semibold capitalize ${s.color}`}>{platform}</span>
                  </div>
                  <svg className="w-3.5 h-3.5 text-white/30 group-hover:text-white/60 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              )
            })}
          </div>
        )}
      </div>

      {/* Placeholder */}
      <div className="rounded-2xl border border-dashed border-white/[0.08] p-6 text-center">
        <div className="w-10 h-10 rounded-xl bg-white/[0.04] border border-white/[0.07] flex items-center justify-center mx-auto mb-3">
          <span className="text-xl opacity-40">🎸</span>
        </div>
        <h4 className="text-sm font-semibold text-white mb-1">Tour Dates & Setlists</h4>
        <p className="text-white/30 text-[10px] uppercase tracking-widest">Coming in a future update</p>
      </div>
    </div>
  )
}
