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
  const [uploading, setUploading] = useState(false)
  
  // Theme Selections
  const [primary, setPrimary] = useState(profile.primary_color || '#3b82f6')
  const [secondary, setSecondary] = useState(profile.secondary_color || '#9333ea')
  const [accent, setAccent] = useState(profile.accent_color || '#10b981')
  const [bgGradient, setBgGradient] = useState(profile.bg_gradient || 'deep-space')

  // 🟢 RESTORED: Image States
  const [profilePic, setProfilePic] = useState(profile.profile_pic || '')
  const [slideshow, setSlideshow] = useState(profile.slideshow_urls ? profile.slideshow_urls.join('\n') : '')

  // 🟢 RESTORED: Supabase Storage Uploader
  const handleImageUpload = async (e, type) => {
    try {
      const file = e.target.files[0]
      if (!file) return
      
      setUploading(true)

      const fileExt = file.name.split('.').pop()
      const fileName = `${session.user.id}-${Math.random()}.${fileExt}`
      const filePath = `${fileName}`

      // Uploads to a Supabase bucket named 'avatars'
      const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, file)
      
      if (uploadError) {
          throw uploadError
      }

      const { data } = supabase.storage.from('avatars').getPublicUrl(filePath)
      
      if (type === 'profile') {
          setProfilePic(data.publicUrl)
      } else if (type === 'slideshow') {
          setSlideshow(prev => prev ? prev + '\n' + data.publicUrl : data.publicUrl)
      }
      
    } catch (error) {
        alert(`Upload failed: ${error.message}\n(Make sure you have a public storage bucket named 'avatars' created in your Supabase dashboard!)`)
    } finally {
        setUploading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    
    const updates = {
      primary_color: primary,
      secondary_color: secondary,
      accent_color: accent,
      bg_gradient: bgGradient,
      profile_pic: profilePic, // 🟢 Save Profile Pic
      slideshow_urls: slideshow.split('\n').map(s => s.trim()).filter(Boolean) // 🟢 Save Slideshow Array
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
      {/* Added max-h and overflow so the modal scrolls if it gets too tall on small screens */}
      <div className="bg-[#090812] border border-gray-700 rounded-3xl p-6 w-full max-w-sm shadow-[0_0_50px_rgba(0,0,0,0.8)] max-h-[90vh] overflow-y-auto hide-scrollbar">
        <h3 className="text-3xl font-['Bebas_Neue'] tracking-widest mb-6 text-white text-center">Customize Identity</h3>
        
        <div className="space-y-6">
          
          {/* 🟢 RESTORED: Profile Imagery Section */}
          <div className="bg-black/50 p-4 rounded-xl border border-gray-800">
              <h4 className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-3">Profile Imagery</h4>
              
              <div className="mb-4">
                  <label className="text-[10px] text-gray-500 font-bold uppercase tracking-widest block mb-1">Avatar Image URL</label>
                  <div className="flex gap-2">
                      <input type="text" value={profilePic} onChange={e => setProfilePic(e.target.value)} placeholder="https://..." className="flex-1 bg-black border border-gray-700 text-white rounded-lg p-2 text-xs focus:border-blue-500 outline-none" />
                      <label className="bg-gray-800 hover:bg-gray-700 text-white px-3 py-2 rounded-lg cursor-pointer text-[10px] font-bold uppercase tracking-widest flex items-center transition-colors">
                          {uploading ? '...' : 'Upload'}
                          <input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, 'profile')} className="hidden" disabled={uploading} />
                      </label>
                  </div>
              </div>

              <div>
                  <label className="text-[10px] text-gray-500 font-bold uppercase tracking-widest block mb-1">Cover Slideshow URLs (One per line)</label>
                  <textarea value={slideshow} onChange={e => setSlideshow(e.target.value)} placeholder="https://image1.jpg&#10;https://image2.jpg" className="w-full bg-black border border-gray-700 text-white rounded-lg p-2 text-xs focus:border-blue-500 outline-none h-20 resize-none mb-2" />
                  <label className="w-full bg-gray-800 hover:bg-gray-700 text-white px-3 py-2 rounded-lg cursor-pointer text-[10px] font-bold uppercase tracking-widest flex items-center justify-center transition-colors">
                      {uploading ? 'Uploading...' : '+ Upload to Slideshow'}
                      <input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, 'slideshow')} className="hidden" disabled={uploading} />
                  </label>
              </div>
          </div>

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
            <button onClick={handleSave} disabled={saving || uploading} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold uppercase tracking-widest transition-colors shadow-[0_0_15px_rgba(59,130,246,0.5)]">
                {saving ? 'Saving...' : 'Lock it in'}
            </button>
        </div>
      </div>
    </div>
  )
}