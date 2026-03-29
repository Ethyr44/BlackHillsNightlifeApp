import { useState } from 'react'
import { supabase } from './supabaseClient'

export default function ThemeEditorModal({ session, profile, onClose, onUpdate }) {
  const [uploading, setUploading] = useState(false)
  const [themeColors, setThemeColors] = useState({
    primary: profile.primary_color || '#3b82f6',
    secondary: profile.secondary_color || '#9333ea',
    accent: profile.accent_color || '#10b981'
  })
  const [slideshowUrls, setSlideshowUrls] = useState(profile.slideshow_urls || [])

  const handleImageUpload = async (event, type) => {
    try {
      setUploading(true)
      const file = event.target.files[0]
      if (!file) return

      const fileExt = file.name.split('.').pop()
      const fileName = `${session.user.id}-${Math.random()}.${fileExt}`
      const { error: uploadError } = await supabase.storage.from('profile_images').upload(fileName, file)
      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage.from('profile_images').getPublicUrl(fileName)

      if (type === 'avatar') {
        await supabase.from('profiles').update({ profile_pic: publicUrl }).eq('id', session.user.id)
        onUpdate({ ...profile, profile_pic: publicUrl })
      } else if (type === 'slideshow') {
        const newSlides = [...slideshowUrls, publicUrl]
        setSlideshowUrls(newSlides)
        await supabase.from('profiles').update({ slideshow_urls: newSlides }).eq('id', session.user.id)
        onUpdate({ ...profile, slideshow_urls: newSlides })
      }
    } catch (error) {
      alert('Error uploading image: ' + error.message)
    } finally {
      setUploading(false)
    }
  }

  const handleRemoveSlide = async (indexToRemove) => {
      const newSlides = slideshowUrls.filter((_, idx) => idx !== indexToRemove)
      setSlideshowUrls(newSlides)
      await supabase.from('profiles').update({ slideshow_urls: newSlides }).eq('id', session.user.id)
      onUpdate({ ...profile, slideshow_urls: newSlides })
  }

  const handleSaveTheme = async () => {
      setUploading(true)
      await supabase.from('profiles').update({
          primary_color: themeColors.primary, 
          secondary_color: themeColors.secondary, 
          accent_color: themeColors.accent
      }).eq('id', session.user.id)
      
      onUpdate({ 
          ...profile, 
          primary_color: themeColors.primary, 
          secondary_color: themeColors.secondary, 
          accent_color: themeColors.accent 
      })
      setUploading(false)
      onClose()
  }

  return (
    <div className="bg-[#090812]/95 backdrop-blur-xl border-2 rounded-2xl p-6 shadow-2xl space-y-6 animate-fade-in relative z-50" style={{ borderColor: themeColors.primary, boxShadow: `0 0 50px ${themeColors.primary}44` }}>
        <div className="flex justify-between items-center border-b border-gray-800 pb-4">
            <h3 className="text-2xl font-['Bebas_Neue'] text-white tracking-widest" style={{ textShadow: `0 0 10px ${themeColors.primary}` }}>Customize Appearance</h3>
            <button onClick={onClose} className="text-gray-500 hover:text-white text-xl">✕</button>
        </div>

        <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Change Profile Picture</label>
            <input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, 'avatar')} disabled={uploading} className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold file:uppercase file:tracking-widest file:bg-gray-800 file:text-white hover:file:bg-gray-700 cursor-pointer" />
        </div>

        <div className="grid grid-cols-3 gap-4 border-t border-gray-800 pt-4">
            <div><label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Primary</label><input type="color" value={themeColors.primary} onChange={(e) => setThemeColors({...themeColors, primary: e.target.value})} className="w-full h-10 rounded cursor-pointer bg-transparent border-0" /></div>
            <div><label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Secondary</label><input type="color" value={themeColors.secondary} onChange={(e) => setThemeColors({...themeColors, secondary: e.target.value})} className="w-full h-10 rounded cursor-pointer bg-transparent border-0" /></div>
            <div><label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Accent</label><input type="color" value={themeColors.accent} onChange={(e) => setThemeColors({...themeColors, accent: e.target.value})} className="w-full h-10 rounded cursor-pointer bg-transparent border-0" /></div>
        </div>

        <div className="border-t border-gray-800 pt-4">
            <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Add Cover Photo / Slideshow</label>
            <input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, 'slideshow')} disabled={uploading} className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold file:uppercase file:tracking-widest file:bg-gray-800 file:text-white hover:file:bg-gray-700 cursor-pointer mb-4" />
            {slideshowUrls.length > 0 && (
                <div className="flex gap-2 overflow-x-auto pb-2">
                    {slideshowUrls.map((url, idx) => (
                        <div key={idx} className="relative flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border border-gray-700">
                            <img src={url} className="w-full h-full object-cover" alt={`Slide ${idx}`} />
                            <button onClick={() => handleRemoveSlide(idx)} className="absolute top-1 right-1 bg-red-600 text-white w-5 h-5 rounded-full text-[10px] flex items-center justify-center">✕</button>
                        </div>
                    ))}
                </div>
            )}
        </div>

        <button onClick={handleSaveTheme} disabled={uploading} className="w-full bg-green-600 text-white font-bold py-3 rounded-xl uppercase tracking-widest text-xs hover:bg-green-500 shadow-[0_0_15px_rgba(22,163,74,0.4)] disabled:opacity-50">
            {uploading ? 'Uploading...' : 'Save Appearance'}
        </button>
    </div>
  )
}