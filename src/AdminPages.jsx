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
  
  const [availableTags, setAvailableTags] = useState([])
  const [selectedTags, setSelectedTags] = useState([])

  // 🟢 NEW: Ownership States
  const [venueUsers, setVenueUsers] = useState([])
  const [ownerId, setOwnerId] = useState('')

  useEffect(() => { fetchPages() }, [])

  const fetchPages = async () => {
    const { data: pData } = await supabase.from('pages').select('*').order('created_at', { ascending: false })
    if (pData) setPages(pData)
    
    const { data: catData } = await supabase.from('system_categories').select('name').eq('category_type', 'venue')
    if (catData) setAvailableTags(catData.map(c => c.name))

    // 🟢 NEW: Fetch all approved Venue accounts
    const { data: vUsers } = await supabase.from('profiles').select('id, username').eq('account_type', 'Venue').eq('account_status', 'approved')
    if (vUsers) setVenueUsers(vUsers)
  }

  const handleFileUpload = async (event, isSlideshow = false) => {
    const file = event.target.files[0]
    if (!file) return
    setUploading(true)

    const fileExt = file.name.split('.').pop()
    const fileName = `${Math.random()}.${fileExt}`
    const filePath = `pages/${fileName}`

    const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, file)
    if (uploadError) {
        alert('Error uploading image!')
        setUploading(false)
        return
    }

    const { data } = supabase.storage.from('avatars').getPublicUrl(filePath)
    if (isSlideshow) {
        setSlideshowUrls(prev => [...prev, data.publicUrl])
    } else {
        setProfilePic(data.publicUrl)
    }
    setUploading(false)
  }

  const toggleTag = (tag) => {
      setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])
  }

  const savePage = async () => {
    if (!pageName) return alert('Name is required')
    setLoading(true)

    const payload = {
      name: pageName,
      page_type: pageType,
      profile_pic: profilePic,
      slideshow_urls: slideshowUrls,
      address, phone, website, facebook, cost,
      tags: selectedTags,
      owner_id: ownerId || null // 🟢 NEW: Save the assignment
    }

    if (editingPageId) {
      await supabase.from('pages').update(payload).eq('id', editingPageId)
    } else {
      await supabase.from('pages').insert([payload])
    }

    setPageName(''); setPageType('Venue'); setEditingPageId(null); setProfilePic(''); setSlideshowUrls([]);
    setAddress(''); setPhone(''); setWebsite(''); setFacebook(''); setCost('$$'); setSelectedTags([]); setOwnerId('');
    fetchPages()
    setLoading(false)
  }

  const editPage = (p) => {
    setEditingPageId(p.id)
    setPageName(p.name)
    setPageType(p.page_type)
    setProfilePic(p.profile_pic || '')
    setSlideshowUrls(p.slideshow_urls || [])
    setAddress(p.address || '')
    setPhone(p.phone || '')
    setWebsite(p.website || '')
    setFacebook(p.facebook || '')
    setCost(p.cost || '$$')
    setSelectedTags(p.tags || [])
    setOwnerId(p.owner_id || '') // 🟢 NEW: Load existing owner
  }

  const deletePage = async (id) => {
    if (!window.confirm("Delete this page?")) return
    await supabase.from('pages').delete().eq('id', id)
    fetchPages()
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="bg-gray-900 border border-gray-800 p-6 rounded-xl">
        <h3 className="text-2xl font-['Bebas_Neue'] text-blue-400 tracking-widest mb-4">{editingPageId ? 'Edit Page' : 'Create Page'}</h3>
        
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
              <input type="text" value={pageName} onChange={e => setPageName(e.target.value)} placeholder="Business Name" className="w-full bg-black border border-gray-700 text-white rounded-lg p-3 outline-none focus:border-blue-500" />
              <select value={pageType} onChange={e => setPageType(e.target.value)} className="w-full bg-black border border-gray-700 text-white rounded-lg p-3 outline-none focus:border-blue-500">
                  <option value="Venue">Venue / Hotspot</option>
                  <option value="Performer">Performer / Artist</option>
                  <option value="Business">Local Business</option>
              </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
              <input type="text" value={address} onChange={e => setAddress(e.target.value)} placeholder="Physical Address" className="w-full bg-black border border-gray-700 text-white rounded-lg p-3 outline-none focus:border-blue-500" />
              <input type="text" value={phone} onChange={e => setPhone(e.target.value)} placeholder="Phone Number" className="w-full bg-black border border-gray-700 text-white rounded-lg p-3 outline-none focus:border-blue-500" />
          </div>

          {/* 🟢 NEW: Venue Owner Assignment UI */}
          {pageType === 'Venue' && (
              <div className="mb-4 pt-4 border-t border-gray-800">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-cyan-400 mb-2 block">Link to Venue Account (Optional)</label>
                  <select 
                      value={ownerId} 
                      onChange={e => setOwnerId(e.target.value)} 
                      className="w-full bg-black border border-cyan-900/50 p-4 rounded-xl text-white outline-none focus:border-cyan-500"
                  >
                      <option value="">-- No Owner Assigned --</option>
                      {venueUsers.map(vu => (
                          <option key={vu.id} value={vu.id}>{vu.username}</option>
                      ))}
                  </select>
                  <p className="text-[9px] text-gray-500 mt-1 uppercase tracking-widest font-bold">Linking an account allows the Map pin to open their managed Venue Dashboard.</p>
              </div>
          )}

          <div className="pt-4 border-t border-gray-800">
              <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2 block">Primary Logo/Avatar</label>
              <div className="flex gap-4 items-center">
                  {profilePic && <img src={profilePic} className="w-16 h-16 rounded-lg object-cover border border-gray-700" alt="Preview" />}
                  <input type="file" accept="image/*" onChange={(e) => handleFileUpload(e, false)} disabled={uploading} className="text-xs text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-gray-800 file:text-white hover:file:bg-gray-700" />
              </div>
          </div>

          <div className="pt-4 border-t border-gray-800">
              <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2 block">Atmosphere & Tags</label>
              <div className="flex flex-wrap gap-2">
                  {availableTags.map(tag => (
                      <button key={tag} onClick={() => toggleTag(tag)} className={`px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all ${selectedTags.includes(tag) ? 'bg-blue-600 text-white shadow-[0_0_10px_rgba(37,99,235,0.5)]' : 'bg-black text-gray-500 border border-gray-800 hover:border-gray-600'}`}>
                          {tag}
                      </button>
                  ))}
              </div>
          </div>

          <button onClick={savePage} disabled={loading || uploading} className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-gray-800 text-white font-bold py-4 rounded-xl uppercase tracking-widest text-xs transition-colors shadow-lg">
            {loading ? 'Saving...' : editingPageId ? 'Update Page' : 'Create Page'}
          </button>
          {editingPageId && <button onClick={() => {setEditingPageId(null); setPageName(''); setProfilePic(''); setSlideshowUrls([]); setAddress(''); setPhone(''); setWebsite(''); setFacebook(''); setCost('$$'); setSelectedTags([]); setOwnerId('');}} className="w-full mt-2 bg-transparent border border-gray-700 hover:bg-gray-600 text-white font-bold py-3 px-6 rounded-xl uppercase tracking-widest text-xs transition-colors">Cancel</button>}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {pages.map(p => (
          <div key={p.id} className="bg-gray-900 border border-gray-800 p-4 rounded-xl flex justify-between items-center hover:border-gray-600 transition-colors">
            <div className="flex items-center gap-3">
              <img src={p.profile_pic || `https://api.dicebear.com/7.x/shapes/svg?seed=${p.name}`} className="w-10 h-10 rounded-full border border-gray-700 object-cover bg-black" alt="" referrerPolicy="no-referrer" onError={(e) => { e.target.onerror = null; e.target.src = `https://api.dicebear.com/7.x/shapes/svg?seed=${p.name}` }} />
              <div>
                <h4 className="font-bold text-white text-lg leading-tight">{p.name}</h4>
                <div className="flex gap-2 mt-1">
                    <span className={`text-[9px] px-2 py-0.5 rounded uppercase tracking-widest font-bold ${p.page_type === 'Venue' ? 'text-blue-400 border border-blue-500/30 bg-blue-900/20' : 'text-purple-400 border border-purple-500/30 bg-purple-900/20'}`}>
                    {p.page_type}
                    </span>
                    {p.owner_id && (
                        <span className="text-[9px] px-2 py-0.5 rounded uppercase tracking-widest font-bold text-cyan-400 border border-cyan-500/30 bg-cyan-900/20">
                            Linked
                        </span>
                    )}
                </div>
              </div>
            </div>
            <div className="flex gap-2">
                <button onClick={() => editPage(p)} className="text-gray-400 hover:text-white border border-gray-700 hover:border-blue-500 px-3 py-2 rounded-lg text-xs font-bold transition-all">✏️</button>
                <button onClick={() => deletePage(p.id)} className="bg-red-900/20 text-red-500 border border-red-900/50 px-3 py-2 rounded-lg text-xs font-bold hover:bg-red-500 hover:text-white transition-all">✕</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}