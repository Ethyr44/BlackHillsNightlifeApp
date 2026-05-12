import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

export default function ProfilePerformer({ profile, isOwner, onViewEntity }) {
    const details = profile?.details || {}
    const links = details.links || {}

    // Clean up empty links
    const activeLinks = Object.entries(links).filter(([platform, url]) => url && url.trim() !== '')

    return (
        <div className="animate-fade-in space-y-6">
            
            {/* PERFORMER HEADER */}
            <div className="bg-[#090812] border border-purple-500/30 p-6 rounded-3xl shadow-[0_0_20px_rgba(168,85,247,0.15)] text-center relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-600 to-pink-600"></div>
                
                <span className="bg-purple-900/40 border border-purple-500/50 text-purple-300 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest inline-block mb-3">
                    {details.actType || 'Performer'}
                </span>
                
                <h2 className="text-4xl font-['Bebas_Neue'] text-white tracking-widest mb-1">
                    {details.name || profile.username}
                </h2>

                {details.genres && details.genres.length > 0 && (
                    <div className="flex flex-wrap justify-center gap-2 mt-4">
                        {details.genres.map(g => (
                            <span key={g} className="text-gray-400 text-xs font-bold uppercase tracking-widest px-2 border-r border-gray-800 last:border-0">
                                {g}
                            </span>
                        ))}
                    </div>
                )}
            </div>

            {/* BOOKING & SOCIAL LINKS */}
            <div>
                <h3 className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-3 ml-2">Links & Socials</h3>
                
                {activeLinks.length === 0 ? (
                    <div className="bg-black/50 border border-dashed border-gray-800 p-6 rounded-2xl text-center">
                        <p className="text-gray-500 text-xs font-bold uppercase tracking-widest">No links provided.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {activeLinks.map(([platform, url]) => (
                            <a 
                                key={platform}
                                href={url.startsWith('http') ? url : `https://${url}`}
                                target="_blank"
                                rel="noreferrer"
                                className="bg-gray-900 hover:bg-gray-800 border border-gray-800 hover:border-purple-500/50 p-4 rounded-xl flex items-center justify-between transition-all group"
                            >
                                <span className="text-white font-bold capitalize">{platform}</span>
                                <span className="text-gray-500 group-hover:text-purple-400 transition-colors">↗</span>
                            </a>
                        ))}
                    </div>
                )}
            </div>

            {/* UPCOMING SHOWS (Coming Soon Placeholder) */}
            <div className="bg-black/40 border border-gray-800 p-6 rounded-3xl text-center">
                <span className="text-3xl mb-2 block opacity-50">🎸</span>
                <h4 className="text-white font-bold mb-1">Tour Dates & Setlists</h4>
                <p className="text-[10px] text-gray-500 uppercase tracking-widest">Coming in a future update.</p>
            </div>

        </div>
    )
}