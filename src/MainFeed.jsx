import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import FeedPost from './FeedPost'
import { EVENT_EMOJIS } from './VenueCard'
import { toast } from './GlobalToast'

// 🟢 NEW: Fetches and displays rich link previews (Images, Titles, etc.)
const LinkPreview = ({ url }) => {
    const [preview, setPreview] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchPreview = async () => {
            try {
                // Using Microlink's free public API for rich embeds
                const res = await fetch(`https://api.microlink.io?url=${encodeURIComponent(url)}`)
                const data = await res.json()
                if (data.status === 'success') {
                    setPreview(data.data)
                }
            } catch (e) {
                console.error("Preview failed", e)
            }
            setLoading(false)
        }
        fetchPreview()
    }, [url])

    if (loading) return <div className="mt-2 text-[10px] font-bold uppercase tracking-widest text-gray-500 animate-pulse">Loading preview...</div>
    if (!preview || (!preview.image && !preview.title)) return null

    return (
        <a 
            href={url} 
            target="_blank" 
            rel="noopener noreferrer" 
            onClick={(e) => e.stopPropagation()} 
            className="mt-3 block border border-gray-700 rounded-xl overflow-hidden hover:border-blue-500 transition-colors bg-black/40 group"
        >
            {preview.image && (
                <div className="h-32 sm:h-48 w-full bg-gray-800 overflow-hidden">
                    <img src={preview.image.url} alt={preview.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                </div>
            )}
            <div className="p-3 bg-[#090812]">
                <h4 className="text-white font-bold text-sm line-clamp-1">{preview.title || url}</h4>
                {preview.description && <p className="text-gray-400 text-xs mt-1 line-clamp-2">{preview.description}</p>}
                <span className="text-[9px] text-gray-500 uppercase tracking-widest mt-2 block font-bold">
                    {new URL(url).hostname.replace('www.', '')}
                </span>
            </div>
        </a>
    )
}

// 🟢 UPDATED: Extracts the URL and attaches the rich preview underneath the text
const Linkify = ({ text }) => {
    if (!text) return null;
    
    const urlRegex = /((?:https?:\/\/|www\.)[^\s]+)/g;
    const parts = text.split(urlRegex);
    
    // Find the first URL to generate a preview block for
    const match = text.match(urlRegex);
    const firstUrl = match ? (match[0].startsWith('www.') ? `https://${match[0]}` : match[0]) : null;

    return (
        <div className="flex flex-col w-full">
            <p className="whitespace-pre-wrap">
                {parts.map((part, i) => {
                    if (part.match(urlRegex)) {
                        const href = part.startsWith('www.') ? `https://${part}` : part;
                        return (
                            <a 
                                key={i} 
                                href={href} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="text-blue-400 hover:text-blue-300 underline underline-offset-2 break-all"
                                onClick={(e) => e.stopPropagation()} 
                            >
                                {part}
                            </a>
                        );
                    }
                    return part;
                })}
            </p>
            
            {/* 🟢 Render the rich card preview below the text */}
            {firstUrl && <LinkPreview url={firstUrl} />}
        </div>
    );
};

export default function MainFeed({ currentUser, onViewEntity }) {
  const [feed, setFeed] = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const ITEMS_PER_PAGE = 50

  // 🟢 NEW: Post Creation State
  const [newPostContent, setNewPostContent] = useState('')
  const [selectedImage, setSelectedImage] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [isPosting, setIsPosting] = useState(false)

  useEffect(() => {
    fetchLivingFeed()
  }, [page])

  const fetchLivingFeed = async (reset = false) => {
    if (page === 1 || reset) setLoading(true)
    
    const currentPage = reset ? 1 : page
    const from = (currentPage - 1) * ITEMS_PER_PAGE
    const to = from + ITEMS_PER_PAGE - 1
    
    // 1. Fetch Posts
    const { data: rawPosts } = await supabase.from('posts').select('*').order('created_at', { ascending: false }).range(from, to)
    const { data: profiles } = await supabase.from('profiles').select('id, username, profile_pic')
    
    const formattedPosts = (rawPosts || []).map(post => {
        const author = profiles?.find(p => p.id === post.author_id) || {}
        return {
            id: `post_${post.id}`, type: 'post', timestamp: new Date(post.created_at).getTime(),
            data: { ...post, username: author.username || 'Unknown', profile_pic: author.profile_pic }
        }
    })

    // 2. Fetch Events
    const { data: rawEvents } = await supabase.from('events').select('*').eq('status', 'approved').gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
    const formattedEvents = (rawEvents || []).map(event => ({
        id: `event_${event.id}`, type: 'event', timestamp: new Date(event.created_at).getTime(),
        data: event
    }))

    // Combine and Sort
    const combined = [...formattedPosts, ...formattedEvents].sort((a, b) => b.timestamp - a.timestamp)
    
    // 🟢 FIX 3: STRICT DEDUPLICATION to permanently stop the React Key Error
    setFeed(prev => {
        const newArray = reset ? combined : [...prev, ...combined]
        const seenIds = new Set()
        const uniqueFeed = []
        
        for (const item of newArray) {
            if (!seenIds.has(item.id)) {
                seenIds.add(item.id)
                uniqueFeed.push(item)
            }
        }
        return uniqueFeed
    })
    
    setHasMore(formattedPosts.length === ITEMS_PER_PAGE)
    setLoading(false)
  }

  // 🟢 NEW: Image Upload Handlers
  const handleImageSelect = (e) => {
      const file = e.target.files[0]
      if (file) {
          setSelectedImage(file)
          setImagePreview(URL.createObjectURL(file))
      }
  }

  const handleCreatePost = async (e) => {
      e.preventDefault()
      if (!newPostContent.trim() && !selectedImage) return
      setIsPosting(true)
      
      let imageUrl = null
      
      // Upload Image if present
      if (selectedImage) {
          try {
              const fileExt = selectedImage.name.split('.').pop()
              const fileName = `${currentUser.id}_${Date.now()}.${fileExt}`
              
              const { error: uploadError } = await supabase.storage.from('post_images').upload(fileName, selectedImage)
              if (uploadError) throw uploadError
              
              const { data: { publicUrl } } = supabase.storage.from('post_images').getPublicUrl(fileName)
              imageUrl = publicUrl
          } catch (err) {
              toast.error("Image upload failed: " + err.message)
              setIsPosting(false)
              return
          }
      }

      // Insert Post Record
      const { error } = await supabase.from('posts').insert([{
          author_id: currentUser.id,
          content: newPostContent,
          image_url: imageUrl
      }])
      
      if (!error) {
          setNewPostContent('')
          setSelectedImage(null)
          setImagePreview(null)
          toast.success("Vibe posted!")
          fetchLivingFeed(true) // Force fresh fetch
      } else {
          toast.error(error.message)
      }
      setIsPosting(false)
  }

  return (
    <div className="max-w-2xl mx-auto mt-4 p-4 animate-fade-in pb-12">
      
      {/* 🟢 NEW: The Post Creation UI */}
      <div className="bg-[#090812] border-2 border-gray-800 p-4 sm:p-6 rounded-3xl mb-6 shadow-[0_10px_30px_rgba(0,0,0,0.5)]">
          <form onSubmit={handleCreatePost}>
              <textarea 
                  value={newPostContent}
                  onChange={(e) => setNewPostContent(e.target.value)}
                  placeholder="What's the vibe tonight?"
                  className="w-full bg-black border border-gray-700 text-white rounded-xl p-4 focus:outline-none focus:border-[#00f5ff]/50 resize-none text-sm"
                  rows="2"
              />
              
              {imagePreview && (
                  <div className="relative mt-3 inline-block">
                      <img src={imagePreview} className="max-h-48 rounded-xl border border-gray-700 object-cover shadow-lg" />
                      <button type="button" onClick={() => {setSelectedImage(null); setImagePreview(null)}} className="absolute top-2 right-2 bg-black/80 text-white w-6 h-6 flex items-center justify-center rounded-full text-xs hover:bg-red-500 transition-colors">✕</button>
                  </div>
              )}

              <div className="flex justify-between items-center mt-3 pt-3 border-t border-gray-800">
                  <label className="cursor-pointer text-gray-400 hover:text-[#00f5ff] transition-colors flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-gray-900">
                      <span className="text-xl">📷</span>
                      <span className="text-[10px] font-bold uppercase tracking-widest hidden sm:inline">Attach Photo</span>
                      <input type="file" accept="image/*" onChange={handleImageSelect} className="hidden" />
                  </label>
                  <button type="submit" disabled={isPosting || (!newPostContent.trim() && !selectedImage)} className="bg-blue-600 hover:bg-blue-500 disabled:bg-gray-800 disabled:text-gray-600 text-white px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all shadow-[0_0_15px_rgba(37,99,235,0.3)]">
                      {isPosting ? 'Posting...' : 'Post Vibe'}
                  </button>
              </div>
          </form>
      </div>

      {/* The Living Feed Loop */}
      {loading && page === 1 ? (
          <div className="text-center p-12"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div></div>
      ) : (
          feed.map((item) => {
              if (item.type === 'post') {
                  return <FeedPost key={item.id} item={item} currentUser={currentUser} onViewEntity={onViewEntity} />
              }
              if (item.type === 'event') {
                  const eventDate = new Date(item.data.event_date)
                  const dayString = eventDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
                  
                  return (
                      <div key={item.id} className="bg-[#090812] border border-gray-800 p-4 sm:p-6 rounded-3xl mb-4 shadow-lg cursor-pointer hover:border-purple-500/50 transition-colors group" onClick={() => onViewEntity(item.data.venue)}>
                         <div className="flex justify-between items-start mb-2">
                             <div>
                                 <span className="text-purple-400 font-bold uppercase tracking-widest text-[9px] bg-purple-900/20 px-2 py-1 rounded border border-purple-500/30">New Event Published</span>
                                 <h4 className="font-bold text-white text-lg leading-tight mt-1">{item.data.title}</h4>
                             </div>
                             <div className="text-3xl opacity-50 group-hover:opacity-100 transition-opacity">
                                {EVENT_EMOJIS[item.data.event_type] || '🗓️'}
                             </div>
                         </div>
                         <p className="text-gray-300 font-bold text-sm mb-3">
                             {item.data.event_type} at <span className="text-cyan-400">{item.data.venue}</span> • {dayString}
                         </p>
                         {item.data.description && (
                             <div className="bg-black/50 p-4 rounded-xl border border-gray-800 text-gray-400 text-sm italic">
                                 <Linkify text={item.data.description} />
                             </div>
                         )}
                      </div>
                  )
              }
              return null
          })
      )}

      {hasMore && feed.length >= ITEMS_PER_PAGE && (
          <button onClick={() => setPage(p => p + 1)} className="w-full bg-[#090812] border-2 border-gray-800 text-gray-400 hover:text-white hover:border-blue-500/50 py-4 rounded-3xl text-xs font-bold uppercase tracking-widest transition-all mt-6 shadow-[0_0_15px_rgba(0,0,0,0.5)]">
              Load More
          </button>
      )}
    </div>
  )
}