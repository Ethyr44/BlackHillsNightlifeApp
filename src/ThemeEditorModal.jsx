import { useState } from 'react'
import { supabase } from './supabaseClient'

const GRADIENTS = {
  'deep-space': 'bg-gradient-to-b from-slate-900 via-[#090812] to-black',
  'cyber-dusk': 'bg-gradient-to-b from-purple-900/40 via-[#090812] to-black',
  'toxic-glow': 'bg-gradient-to-b from-green-900/30 via-[#090812] to-black',
  'blood-moon': 'bg-gradient-to-b from-red-900/30 via-[#090812] to-black',
  'golden-hour': 'bg-gradient-to-b from-orange-900/30 via-[#090812] to-black',
  'abyss': 'bg-black'
}

export default function ThemeEditorModal({ session, profile, onClose, onUpdate }) {
  const [saving, setSaving] = useState(false)
  
  // Current Selections
  const [primary, setPrimary] = useState(profile.primary_color || '#3b82f6')
  const [secondary, setSecondary] = useState(profile.secondary_color || '#9333ea')
  const [accent, setAccent] = useState(profile.accent_color || '#10b981')
  const [bgGradient, setBgGradient] = useState(profile.bg_gradient || 'deep-space')

  const handleSave = async () => {
    setSaving(true)
    
    // THE FIX: Removed updated_at so it doesn't crash the database cache
    const updates = {
      primary_color: primary,
      secondary_color: secondary,
      accent_color: accent,
      bg_gradient: bgGradient
    }

    const { error } = await supabase.from('profiles').update(updates).eq('id', session.user.id)
    
    if (!error) {
      onUpdate({ ...profile, ...updates })
      onClose()
    } else {
      alert("Error saving theme: " + error.message)
    }
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-fade-in">
      <div className="bg-[#090812] border border-gray-700 rounded-3xl p-6 w-full max-w-sm shadow-[0_0_50px_rgba(0,0,0,0.8)]">
        <h3 className="text-3xl font-['Bebas_Neue'] tracking-widest mb-6 text-white text-center">Customize Theme</h3>
        
        <div className="space-y-6">
          {/* Neon Accents */}
          <div className="bg-black/50 p-4 rounded-xl border border-gray-800">
              <h4 className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-3">Neon Accents</h4>
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs text-white font-bold">Primary Core</span>
                <input type="color" value={primary} onChange={e => setPrimary(e.target.value)} className="w-8 h-8 rounded cursor-pointer bg-transparent border-none" />
              </div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs text-white font-bold">Secondary Aura</span>
                <input type="color" value={secondary} onChange={e => setSecondary(e.target.value)} className="w-8 h-8 rounded cursor-pointer bg-transparent border-none" />
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-white font-bold">Action Highlight</span>
                <input type="color" value={accent} onChange={e => setAccent(e.target.value)} className="w-8 h-8 rounded cursor-pointer bg-transparent border-none" />
              </div>
          </div>

          {/* Background Gradients */}
          <div className="bg-black/50 p-4 rounded-xl border border-gray-800">
              <h4 className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-3">Vibe Background</h4>
              <div className="grid grid-cols-3 gap-2">
                  {Object.keys(GRADIENTS).map(key => (
                      <button 
                          key={key} 
                          onClick={() => setBgGradient(key)}
                          className={`h-12 rounded-lg border-2 transition-all ${GRADIENTS[key]} ${bgGradient === key ? 'border-white scale-105 shadow-[0_0_15px_rgba(255,255,255,0.3)]' : 'border-gray-800 hover:border-gray-500'}`}
                          title={key.replace('-', ' ').toUpperCase()}
                      />
                  ))}
              </div>
          </div>
        </div>

        <div className="flex gap-3 mt-8">
            <button onClick={onClose} className="px-6 py-3 border border-gray-700 text-gray-400 rounded-xl text-xs font-bold uppercase tracking-widest hover:text-white transition-colors">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold uppercase tracking-widest transition-colors shadow-[0_0_15px_rgba(59,130,246,0.5)]">
                {saving ? 'Saving...' : 'Lock it in'}
            </button>
        </div>
      </div>
    </div>
  )
}