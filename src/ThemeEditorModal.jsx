import { useState } from 'react'
import { supabase } from './supabaseClient'
import { GRADIENTS } from './themeConstants'

// ── gradient preview helper ─────────────────────────────────────────────────
// Maps the Tailwind class string to a CSS gradient for the preview swatch,
// because Tailwind classes on dynamically-built strings won't be purged anyway;
// this keeps things visually accurate without full Tailwind parsing.
const GRADIENT_PREVIEWS = {
  'deep-space':  'linear-gradient(160deg, #1a2d5a 0%, #070d1a 100%)',
  'cyber-dusk':  'linear-gradient(160deg, #4c1d95 0%, #070d1a 100%)',
  'toxic-glow':  'linear-gradient(160deg, #064e3b 0%, #070d1a 100%)',
  'blood-moon':  'linear-gradient(160deg, #7f1d1d 0%, #070d1a 100%)',
  'golden-hour': 'linear-gradient(160deg, #78350f 0%, #070d1a 100%)',
  'abyss':       'linear-gradient(160deg, #0a0f1a 0%, #070d1a 100%)',
}

const GRADIENT_LABELS = {
  'deep-space':  'Deep Space',
  'cyber-dusk':  'Cyber Dusk',
  'toxic-glow':  'Toxic Glow',
  'blood-moon':  'Blood Moon',
  'golden-hour': 'Golden Hour',
  'abyss':       'Abyss',
}

// ── sub-components ───────────────────────────────────────────────────────────
function SectionLabel({ children }) {
  return (
    <p className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-2">
      {children}
    </p>
  )
}

function ColorSwatch({ label, value, onChange }) {
  return (
    <div className="flex items-center justify-between bg-white/[0.03] border border-white/[0.07] rounded-xl px-4 py-3 hover:bg-white/[0.05] transition-colors">
      <span className="text-sm font-medium text-white/70">{label}</span>
      <div className="relative flex items-center gap-2">
        <div
          className="w-6 h-6 rounded-lg border border-white/20 shadow-inner"
          style={{ backgroundColor: value }}
        />
        <input
          type="color"
          value={value}
          onChange={e => onChange(e.target.value)}
          className="absolute opacity-0 w-8 h-8 cursor-pointer right-0"
          title={`Pick ${label}`}
        />
      </div>
    </div>
  )
}

// ── main component ───────────────────────────────────────────────────────────
export default function ThemeEditorModal({ session, profile, onClose, onUpdate }) {
  const [saving,    setSaving]    = useState(false)
  const [uploading, setUploading] = useState(false)

  const [primary,    setPrimary]    = useState(profile.primary_color   || '#4f8cff')
  const [secondary,  setSecondary]  = useState(profile.secondary_color || '#22d4c8')
  const [accent,     setAccent]     = useState(profile.accent_color    || '#f5557a')
  const [bgGradient, setBgGradient] = useState(profile.bg_gradient     || 'deep-space')

  const [profilePic, setProfilePic] = useState(profile.profile_pic        || '')
  const [slideshow,  setSlideshow]  = useState(profile.slideshow_urls || [])

  const handleImageUpload = async (e, type) => {
    try {
      const file = e.target.files[0]
      if (!file) return
      setUploading(true)

      const fileExt = file.name.split('.').pop()
      const fileName = `${session.user.id}-${Math.random()}.${fileExt}`

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file)

      if (uploadError) throw uploadError

      const { data } = supabase.storage.from('avatars').getPublicUrl(fileName)

      if (type === 'profile') {
        setProfilePic(data.publicUrl)
      } else if (type === 'slideshow') {
        setSlideshow(prev => [...prev, data.publicUrl])
      }
    } catch (error) {
      alert(`Upload failed: ${error.message}`)
    } finally {
      setUploading(false)
    }
  }

  const handleRemoveSlide = idx =>
    setSlideshow(prev => prev.filter((_, i) => i !== idx))

  const handleSave = async () => {
    setSaving(true)
    const updates = {
      primary_color:   primary,
      secondary_color: secondary,
      accent_color:    accent,
      bg_gradient:     bgGradient,
      profile_pic:     profilePic,
      slideshow_urls:  slideshow,
    }
    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', session.user.id)

    if (!error) {
      onUpdate({ ...profile, ...updates })
      onClose()
    } else {
      alert('Error saving theme: ' + error.message)
    }
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-[#070d1a]/80 backdrop-blur-md p-4 animate-fade-in">

      {/* ── Modal card ────────────────────────────────────────────────── */}
      <div className="bg-[#0e1828]/90 backdrop-blur-2xl border border-white/[0.08] rounded-3xl w-full max-w-sm shadow-[0_24px_64px_rgba(0,0,0,0.6)] max-h-[90vh] overflow-y-auto hide-scrollbar">

        {/* Top accent line using current primary */}
        <div
          className="h-0.5 w-full rounded-t-3xl"
          style={{ background: `linear-gradient(90deg, ${primary}, ${secondary}, ${accent})` }}
        />

        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3
                className="text-xl font-extrabold text-white tracking-tight"
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
              >
                Customize Identity
              </h3>
              <p className="text-white/40 text-xs mt-0.5">Personalize your profile theme</p>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-xl bg-white/[0.06] border border-white/[0.08] flex items-center justify-center text-white/50 hover:text-white hover:bg-white/[0.1] transition-all"
            >
              ✕
            </button>
          </div>

          <div className="space-y-5">

            {/* ── Avatar ──────────────────────────────────────────────── */}
            <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-4">
              <SectionLabel>Avatar Image</SectionLabel>
              <div className="flex items-center gap-4">
                <div className="relative">
                  <img
                    src={
                      profilePic ||
                      `https://api.dicebear.com/7.x/shapes/svg?seed=${profile.username}`
                    }
                    alt="Avatar"
                    className="w-16 h-16 rounded-2xl object-cover border border-white/[0.12] bg-[#070d1a]"
                  />
                  {uploading && (
                    <div className="absolute inset-0 rounded-2xl bg-black/60 flex items-center justify-center">
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    </div>
                  )}
                </div>
                <label className="flex-1 flex items-center justify-center gap-2 bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] hover:border-white/[0.14] rounded-xl px-4 py-3 cursor-pointer transition-all text-xs font-bold uppercase tracking-widest text-white/60 hover:text-white">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4-4 4 4 4-8 4 8" />
                  </svg>
                  {uploading ? 'Uploading…' : 'Change Avatar'}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={e => handleImageUpload(e, 'profile')}
                    className="hidden"
                    disabled={uploading}
                  />
                </label>
              </div>
            </div>

            {/* ── Slideshow ───────────────────────────────────────────── */}
            <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-4">
              <SectionLabel>Cover Slideshow</SectionLabel>
              <div className="flex flex-wrap gap-2 mb-3">
                {slideshow.map((url, i) => (
                  <div key={i} className="relative group">
                    <img
                      src={url}
                      alt={`Slide ${i + 1}`}
                      className="w-16 h-16 rounded-xl object-cover border border-white/[0.1]"
                    />
                    <button
                      onClick={() => handleRemoveSlide(i)}
                      className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full text-[10px] font-bold flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                {/* Add slide button */}
                <label className="w-16 h-16 flex flex-col items-center justify-center gap-1 bg-white/[0.03] border border-dashed border-white/[0.12] hover:border-white/[0.25] rounded-xl cursor-pointer transition-all hover:bg-white/[0.06]">
                  <svg className="w-5 h-5 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  <span className="text-[8px] text-white/30 font-bold uppercase tracking-widest">Add</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={e => handleImageUpload(e, 'slideshow')}
                    className="hidden"
                    disabled={uploading}
                  />
                </label>
              </div>
              <p className="text-[9px] text-white/25 uppercase tracking-widest">
                Images rotate every 5 seconds on your profile
              </p>
            </div>

            {/* ── Neon Accents ────────────────────────────────────────── */}
            <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-4">
              <SectionLabel>Neon Accents</SectionLabel>
              <div className="space-y-2">
                <ColorSwatch label="Primary Core"     value={primary}   onChange={setPrimary}   />
                <ColorSwatch label="Secondary Aura"   value={secondary} onChange={setSecondary} />
                <ColorSwatch label="Action Highlight" value={accent}    onChange={setAccent}    />
              </div>

              {/* Live preview strip */}
              <div
                className="mt-3 h-1 rounded-full w-full"
                style={{ background: `linear-gradient(90deg, ${primary}, ${secondary}, ${accent})` }}
              />
            </div>

            {/* ── Background Gradient ─────────────────────────────────── */}
            <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-4">
              <SectionLabel>Vibe Background</SectionLabel>
              <div className="grid grid-cols-3 gap-2">
                {Object.keys(GRADIENTS).map(key => (
                  <button
                    key={key}
                    onClick={() => setBgGradient(key)}
                    className={`relative h-14 rounded-xl border-2 overflow-hidden transition-all hover:scale-105 active:scale-95 ${
                      bgGradient === key
                        ? 'border-white/60 shadow-[0_0_12px_rgba(255,255,255,0.15)] scale-105'
                        : 'border-white/[0.08] hover:border-white/[0.2]'
                    }`}
                    style={{ background: GRADIENT_PREVIEWS[key] }}
                    title={GRADIENT_LABELS[key]}
                  >
                    {bgGradient === key && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-5 h-5 rounded-full bg-white/90 flex items-center justify-center">
                          <svg className="w-3 h-3 text-[#070d1a]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      </div>
                    )}
                    <span className="absolute bottom-1 left-0 right-0 text-center text-[7px] text-white/50 font-bold uppercase tracking-widest">
                      {GRADIENT_LABELS[key]}
                    </span>
                  </button>
                ))}
              </div>
            </div>

          </div>

          {/* ── Actions ───────────────────────────────────────────────── */}
          <div className="flex gap-3 mt-6">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-white/[0.04] border border-white/[0.08] text-white/60 hover:text-white hover:bg-white/[0.08] rounded-xl text-xs font-bold uppercase tracking-widest transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || uploading}
              className="flex-1 px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-widest text-white transition-all disabled:opacity-50 hover:scale-[1.02] active:scale-[0.98]"
              style={{
                background: `linear-gradient(135deg, ${primary}, ${secondary})`,
                boxShadow: `0 4px 20px ${primary}40`,
              }}
            >
              {saving ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Saving…
                </span>
              ) : (
                'Lock It In'
              )}
            </button>
          </div>

        </div>
      </div>
    </div>
  )
}
