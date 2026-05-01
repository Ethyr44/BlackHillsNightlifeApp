import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

export default function AdminPages() {
  const [pages, setPages] = useState([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)

  const [pageName, setPageName] = useState('')
  const [pageType, setPageType] = useState('Venue')
  const [editingPageId, setEditingPageId] = useState(null)
  const [profilePic, setProfilePic] = useState('')
  const [slideshowUrls, setSlideshowUrls] = useState([])
  const [address, setAddress] = useState('')
  const [phone, setPhone] = useState('')
  const [website, setWebsite] = useState('')
  const [facebook, setFacebook] = useState('')
  const [cost, setCost] = useState('$$')

  useEffect(() => { fetchPages() }, [])

  const fetchPages = async () => {
    const { data } = await supabase.from('pages').select('*').order('created_at', { ascending: false })
    if (data) setPages(data)
  }

  const handleImageUpload = async (event, type) => {
    try {
      setUploading(true)
      const file = event.target.files[0]
      if (!file) return
      const fileName = `page-${Date.now()}-${Math.random()}.${file.name.split('.').pop()}`
      const { error } = await supabase.storage.from('profile_images').upload(fileName, file)
      if (error) throw error
      const { data: { publicUrl } } = supabase.storage.from('profile_images').getPublicUrl(fileName)

      if (type === 'avatar') setProfilePic(publicUrl)
      else if (type === 'slideshow') setSlideshowUrls(prev => [...prev, publicUrl])
    } catch (error) {
      alert('Error uploading image: ' + error.message)
    } finally {
      setUploading(false)
    }
  }

  const resetForm = () => {
    setEditingPageId(null); setPageName(''); setProfilePic(''); setSlideshowUrls([]); 
    setAddress(''); setPhone(''); setWebsite(''); setFacebook(''); setCost('$$');
  }

  const savePage = async () => {
    if (!pageName) return alert('Name is required')
    setLoading(true)
    
    let lat = null
    let lng = null

    // --- THE AUTO-GEOCODER ---
    // If it's a venue and has an address, quietly fetch the GPS coordinates before saving!
    if (pageType === 'Venue' && address) {
        try {
            const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`)
            const geoData = await res.json()
            if (geoData && geoData.length > 0) {
                lat = parseFloat(geoData[0].lat)
                lng = parseFloat(geoData[0].lon)
            }
        } catch (err) {
            console.error("Geocoding failed:", err)
        }
    }

    const payload = {
        name: pageName, page_type: pageType, profile_pic: profilePic, slideshow_urls: slideshowUrls,
        address: pageType === 'Venue' ? address : null, phone: pageType === 'Venue' ? phone : null,
        website: pageType === 'Venue' ? website : null, facebook: pageType === 'Venue' ? facebook : null,
        cost: pageType === 'Venue' ? cost : null, lat: lat, lng: lng
    }
    
    if (editingPageId) await supabase.from('pages').update(payload).eq('id', editingPageId)
    else await supabase.from('pages').insert([payload])
    
    resetForm(); fetchPages(); setLoading(false);
  }

  const editPage = (p) => {
    setEditingPageId(p.id); setPageName(p.name); setPageType(p.page_type); setProfilePic(p.profile_pic || ''); 
    setSlideshowUrls(p.slideshow_urls || []); setAddress(p.address || ''); setPhone(p.phone || ''); 
    setWebsite(p.website || ''); setFacebook(p.facebook || ''); setCost(p.cost || '$$'); 
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="bg-gray-900 p-6 rounded-xl border border-gray-800">
        <h3 className="text-2xl font-['Bebas_Neue'] text-blue-400 mb-4 tracking-wider">{editingPageId ? 'Edit Directory Page' : 'Create New Page'}</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <input type="text" placeholder="Page / Venue / Act Name" value={pageName} onChange={e => setPageName(e.target.value)} className="bg-black border border-gray-700 text-white rounded p-3 text-sm focus:border-blue-500 outline-none w-full" />
          <select value={pageType} onChange={e => setPageType(e.target.value)} className="bg-black border border-gray-700 text-white rounded p-3 text-sm focus:border-blue-500 outline-none w-full">
            <option value="Venue">Venue</option>
            <option value="Act">Entertainer / Act</option>
          </select>
        </div>

        <div className="mb-6 border border-gray-700 bg-black/40 p-4 rounded-xl space-y-4">
            <h4 className="text-sm font-bold text-gray-400 uppercase tracking-widest border-b border-gray-800 pb-2">Media & Branding</h4>
            <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">Logo / Profile Picture</label>
                <div className="flex items-center gap-4">
                    {profilePic && <img src={profilePic} className="w-12 h-12 rounded-full border border-gray-700 object-cover" alt="Logo preview" referrerPolicy="no-referrer" />}
                    <input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, 'avatar')} disabled={uploading} className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-bold file:uppercase file:tracking-widest file:bg-gray-800 file:text-white hover:file:bg-gray-700 cursor-pointer" />
                </div>
            </div>
            <div className="pt-2 border-t border-gray-800">
                <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">Slideshow Photos / Flyers</label>
                <input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, 'slideshow')} disabled={uploading} className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-bold file:uppercase file:tracking-widest file:bg-gray-800 file:text-white hover:file:bg-gray-700 cursor-pointer mb-3" />
                {slideshowUrls.length > 0 && (
                  <div className="flex gap-2 overflow-x-auto pb-2">
                      {slideshowUrls.map((url, idx) => (
                          <div key={idx} className="relative flex-shrink-0 w-16 h-16 rounded overflow-hidden border border-gray-700">
                              <img src={url} className="w-full h-full object-cover" alt={`Slide ${idx}`} referrerPolicy="no-referrer" />
                              <button onClick={() => setSlideshowUrls(slideshowUrls.filter((_, i) => i !== idx))} className="absolute top-1 right-1 bg-red-600 text-white w-4 h-4 rounded-full text-[8px] flex items-center justify-center">✕</button>
                          </div>
                      ))}
                  </div>
              )}
            </div>
        </div>

        {pageType === 'Venue' && (
            <div className="space-y-4 mb-6 border border-blue-900/30 bg-blue-900/10 p-4 rounded-xl">
                <h4 className="text-sm font-bold text-blue-400 uppercase tracking-widest">Venue Details</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <input type="text" placeholder="Full Street Address (Will auto-pin on map)" value={address} onChange={e => setAddress(e.target.value)} className="bg-black border border-gray-700 text-white rounded p-3 text-sm focus:border-blue-500 outline-none w-full md:col-span-2" />
                    <input type="text" placeholder="Phone Number" value={phone} onChange={e => setPhone(e.target.value)} className="bg-black border border-gray-700 text-white rounded p-3 text-sm focus:border-blue-500 outline-none w-full" />
                    <input type="text" placeholder="Website URL" value={website} onChange={e => setWebsite(e.target.value)} className="bg-black border border-gray-700 text-white rounded p-3 text-sm focus:border-blue-500 outline-none w-full" />
                    <input type="text" placeholder="Facebook URL" value={facebook} onChange={e => setFacebook(e.target.value)} className="bg-black border border-gray-700 text-white rounded p-3 text-sm focus:border-blue-500 outline-none w-full" />
                    <select value={cost} onChange={e => setCost(e.target.value)} className="bg-black border border-gray-700 text-white rounded p-3 text-sm focus:border-blue-500 outline-none w-full">
                        <option value="$">Cost: $ (Cheap)</option><option value="$$">Cost: $$ (Moderate)</option><option value="$$$">Cost: $$$ (Expensive)</option>
                    </select>
                </div>

                {/* Live Google Map Preview right inside the Admin form! */}
                {address && (
                    <div className="mt-4">
                        <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Location Preview</h4>
                        <div className="relative w-full h-40 bg-gray-900 border border-gray-700 rounded-xl overflow-hidden shadow-[0_0_15px_rgba(59,130,246,0.1)]">
                            <iframe 
                                width="100%" height="100%" style={{ border: 0, filter: 'invert(90%) hue-rotate(180deg)' }} loading="lazy" allowFullScreen referrerPolicy="no-referrer-when-downgrade"
                                src={`https://maps.google.com/maps?q=${encodeURIComponent(address)}&t=m&z=15&output=embed&iwloc=near`}
                            ></iframe>
                        </div>
                    </div>
                )}
            </div>
        )}

        <div className="flex gap-2">
          <button onClick={savePage} disabled={loading || uploading} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded uppercase tracking-widest text-xs transition-colors shadow-lg">
            {uploading ? 'Uploading Media...' : editingPageId ? 'Update Page' : 'Save New Page'}
          </button>
          {editingPageId && <button onClick={resetForm} className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 px-6 rounded uppercase tracking-widest text-xs transition-colors">Cancel</button>}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {pages.map(p => (
          <div key={p.id} className="bg-gray-900 border border-gray-800 p-4 rounded-xl flex justify-between items-center hover:border-gray-600 transition-colors">
            <div className="flex items-center gap-3">
              <img src={p.profile_pic || `https://api.dicebear.com/7.x/shapes/svg?seed=${p.name}`} className="w-10 h-10 rounded-full border border-gray-700 object-cover bg-black" alt="" referrerPolicy="no-referrer" onError={(e) => { e.target.onerror = null; e.target.src = `https://api.dicebear.com/7.x/shapes/svg?seed=${p.name}` }} />
              <div>
                <h4 className="font-bold text-white text-lg">{p.name}</h4>
                <span className={`text-[9px] px-2 py-0.5 rounded uppercase tracking-widest font-bold ${p.page_type === 'Venue' ? 'text-blue-400 border border-blue-500/30 bg-blue-900/20' : 'text-purple-400 border border-purple-500/30 bg-purple-900/20'}`}>{p.page_type}</span>
              </div>
            </div>
            <button onClick={() => editPage(p)} className="text-gray-400 hover:text-white border border-gray-700 hover:border-blue-500 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all">Edit</button>
          </div>
        ))}
      </div>
    </div>
  )
}