import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import FeedPost from './FeedPost'
import { EVENT_EMOJIS } from './VenueCard'
import { toast } from './GlobalToast'

export default function MainFeed({ currentUser, onViewEntity }) {
  const [feed, setFeed] = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const ITEMS_PER_PAGE = 50

  const [newPostContent, setNewPostContent] = useState('')
  const [selectedImage, setSelectedImage] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [isPosting, setIsPosting] = useState(false)
  const [composerFocused, setComposerFocused] = useState(false)

  useEffect(() => { fetchLivingFeed() }, [page])

  useEffect(() => {
    const sub = supabase.channel('public-feed-inserts')
      .on('postgres', { event: 'INSERT', schema: 'public', table: 'posts' }, async payload => {
        const { data: prof } = await supabase.from('profiles').select('username, profile_pic').eq('id', payload.new.author_id).maybeSingle()
        const fp = {
          id: `post_${payload.new.id}`, type: 'post',
          timestamp: new Date(payload.new.created_at || 0).getTime(),
          data: { ...payload.new, username: prof?.username || 'Unknown', profile_pic: prof?.profile_pic },
        }
        setFeed(cur => cur.find(i => i.id === fp.id) ? cur : [fp, ...cur].sort((a, b) => b.timestamp - a.timestamp))
      })
      .on('postgres', { event: 'INSERT', schema: 'public', table: 'events' }, payload => {
        if (payload.new.status !== 'approved') return
        const ts = new Date(payload.new.created_at || payload.new.event_date || 0).getTime()
        const fe = { id: `event_${payload.new.id}`, type: 'event', timestamp: isNaN(ts) ? 0 : ts, data: payload.new }
        setFeed(cur => cur.find(i => i.id === fe.id) ? cur : [fe, ...cur].sort((a, b) => b.timestamp - a.timestamp))
      })
      .subscribe()
    return () => supabase.removeChannel(sub)
  }, [])

  const fetchLivingFeed = async (reset = false) => {
    if (page === 1 || reset) setLoading(true)
    const cur = reset ? 1 : page
    const from = (cur - 1) * ITEMS_PER_PAGE

    const { data: rawPosts } = await supabase.from('posts').select('*').order('created_at', { ascending: false }).range(from, from + ITEMS_PER_PAGE - 1)
    const { data: profiles } = await supabase.from('profiles').select('id, username, profile_pic')

    const formattedPosts = (rawPosts || []).map(post => {
      const author = profiles?.find(p => p.id === post.author_id) || {}
      return {
        id: `post_${post.id}`, type: 'post', timestamp: new Date(post.created_at || 0).getTime() || 0,
        data: { ...post, username: author.username || 'Unknown', profile_pic: author.profile_pic },
      }
    })

    const { data: rawEvents } = await supabase.from('events').select('*').eq('status', 'approved').limit(30).order('id', { ascending: false })
    const formattedEvents = (rawEvents || []).map(event => {
      const ts = new Date(event.created_at || event.event_date || 0).getTime()
      return { id: `event_${event.id}`, type: 'event', timestamp: isNaN(ts) ? 0 : ts, data: event }
    })

    const combined = [...formattedPosts, ...formattedEvents].sort((a, b) => b.timestamp - a.timestamp)
    setFeed(prev => {
      const arr = reset ? combined : [...prev, ...combined]
      const seen = new Set()
      return arr.filter(i => seen.has(i.id) ? false : seen.add(i.id))
    })
    setHasMore(formattedPosts.length === ITEMS_PER_PAGE)
    setLoading(false)
  }

  const handleImageSelect = e => {
    const file = e.target.files[0]
    if (file) { setSelectedImage(file); setImagePreview(URL.createObjectURL(file)) }
  }

  const handleCreatePost = async e => {
    e.preventDefault()
    if (!newPostContent.trim() && !selectedImage) return
    setIsPosting(true)
    let imageUrl = null
    if (selectedImage) {
      try {
        const fileExt = selectedImage.name.split('.').pop()
        const fileName = `${currentUser.id}_${Date.now()}.${fileExt}`
        const { error } = await supabase.storage.from('post_images').upload(fileName, selectedImage)
        if (error) throw error
        const { data: { publicUrl } } = supabase.storage.from('post_images').getPublicUrl(fileName)
        imageUrl = publicUrl
      } catch (err) {
        toast.error('Image upload failed: ' + err.message)
        setIsPosting(false)
        return
      }
    }
    const { error } = await supabase.from('posts').insert([{ author_id: currentUser.id, content: newPostContent, image_url: imageUrl }])
    if (!error) {
      setNewPostContent('')
      setSelectedImage(null)
      setImagePreview(null)
      setComposerFocused(false)
      toast.success('Posted!')
    } else {
      toast.error(error.message)
    }
    setIsPosting(false)
  }

  const timeAgo = d => {
    const s = Math.floor((Date.now() - new Date(d)) / 1000)
    if (s < 60) return 'now'
    if (s < 3600) return `${Math.floor(s / 60)}m`
    if (s < 86400) return `${Math.floor(s / 3600)}h`
    return `${Math.floor(s / 86400)}d`
  }

  return (
    <div className="max-w-2xl mx-auto pt-2 pb-4 px-4 animate-fade-in-up">

      {/* Composer */}
      <div
        className="rounded-2xl mb-5 overflow-hidden transition-all duration-200"
        style={{
          background: 'rgba(255,255,255,0.04)',
          border: composerFocused ? '1px solid rgba(79,140,255,0.4)' : '1px solid rgba(255,255,255,0.08)',
          boxShadow: composerFocused ? '0 0 0 3px rgba(79,140,255,0.1)' : 'none',
        }}
      >
        <form onSubmit={handleCreatePost}>
          <div className="flex items-start gap-3 p-4">
            <img
              src={currentUser?.profile_pic || `https://api.dicebear.com/7.x/bottts/svg?seed=${currentUser?.username}`}
              className="w-8 h-8 rounded-full object-cover flex-shrink-0 mt-0.5"
              style={{ border: '2px solid rgba(255,255,255,0.12)' }}
              alt=""
            />
            <textarea
              value={newPostContent}
              onChange={e => setNewPostContent(e.target.value)}
              onFocus={() => setComposerFocused(true)}
              onBlur={() => setComposerFocused(false)}
              placeholder="What's the vibe tonight?"
              rows={composerFocused ? 3 : 2}
              className="flex-1 bg-transparent text-sm text-white/80 placeholder-white/25 resize-none outline-none transition-all duration-200"
              style={{ fontFamily: 'Inter, sans-serif' }}
            />
          </div>

          {imagePreview && (
            <div className="px-4 pb-3 relative inline-block ml-4">
              <img src={imagePreview} className="h-32 rounded-xl border border-white/10 object-cover" alt="Preview" />
              <button
                type="button"
                onClick={() => { setSelectedImage(null); setImagePreview(null) }}
                className="absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold"
                style={{ background: 'rgba(0,0,0,0.7)', color: '#fff' }}
              >
                ✕
              </button>
            </div>
          )}

          <div
            className="flex items-center justify-between px-4 py-2.5"
            style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
          >
            <label className="flex items-center gap-1.5 cursor-pointer text-white/30 hover:text-white/60 transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ fontFamily: 'Inter, sans-serif' }}>Photo</span>
              <input type="file" accept="image/*" onChange={handleImageSelect} className="hidden" />
            </label>

            <button
              type="submit"
              disabled={isPosting || (!newPostContent.trim() && !selectedImage)}
              className="px-5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 disabled:opacity-30"
              style={{
                fontFamily: 'Inter, sans-serif',
                background: 'linear-gradient(135deg, #4f8cff, #2463d4)',
                color: '#fff',
                boxShadow: '0 2px 8px rgba(79,140,255,0.3)',
              }}
            >
              {isPosting ? 'Posting…' : 'Post'}
            </button>
          </div>
        </form>
      </div>

      {/* Feed */}
      {loading && page === 1 ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-[#4f8cff]/20 border-t-[#4f8cff] rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-3">
          {feed.map(item => {
            if (!item?.data) return null
            if (item.type === 'post') {
              return <FeedPost key={item.id} item={item} currentUser={currentUser} onViewEntity={onViewEntity} />
            }
            if (item.type === 'event') {
              let dayStr = 'Unknown Date'
              try {
                if (item.data.event_date) {
                  const safe = item.data.event_date.includes('Z') || item.data.event_date.includes('+') ? item.data.event_date : item.data.event_date + 'Z'
                  const d = new Date(safe)
                  if (!isNaN(d)) dayStr = d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
                }
              } catch {}
              return (
                <div
                  key={item.id}
                  onClick={() => onViewEntity(item.data.venue)}
                  className="rounded-2xl px-4 py-4 cursor-pointer transition-all duration-150 hover:scale-[1.005] active:scale-[0.998] group"
                  style={{
                    background: 'rgba(255,255,255,0.035)',
                    border: '1px solid rgba(255,255,255,0.07)',
                    boxShadow: '0 2px 12px rgba(0,0,0,0.25)',
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <span
                        className="inline-block text-[9px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded mb-2"
                        style={{ background: 'rgba(79,140,255,0.12)', color: 'rgba(79,140,255,0.8)', border: '1px solid rgba(79,140,255,0.2)', fontFamily: 'Inter, sans-serif' }}
                      >
                        New Event
                      </span>
                      <h4 className="text-sm font-bold text-white/85 leading-snug truncate" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                        {item.data.title}
                      </h4>
                      <p className="text-xs text-white/40 mt-1" style={{ fontFamily: 'Inter, sans-serif' }}>
                        {item.data.event_type} at{' '}
                        <span className="text-[#22d4c8]/70">{item.data.venue}</span>
                        {' • '}{dayStr}
                      </p>
                    </div>
                    <div
                      className="text-2xl opacity-40 group-hover:opacity-80 transition-opacity flex-shrink-0"
                    >
                      {EVENT_EMOJIS[item.data.event_type] || '🗓️'}
                    </div>
                  </div>
                  {item.data.description && (
                    <p className="text-xs text-white/35 mt-3 leading-relaxed line-clamp-2" style={{ fontFamily: 'Inter, sans-serif' }}>
                      {item.data.description}
                    </p>
                  )}
                </div>
              )
            }
            return null
          })}
        </div>
      )}

      {hasMore && feed.length >= ITEMS_PER_PAGE && (
        <button
          onClick={() => setPage(p => p + 1)}
          className="w-full mt-4 py-3.5 rounded-xl text-xs font-semibold transition-all duration-150"
          style={{
            fontFamily: 'Inter, sans-serif',
            background: 'rgba(79,140,255,0.07)',
            border: '1px solid rgba(79,140,255,0.15)',
            color: 'rgba(79,140,255,0.7)',
          }}
        >
          Load more
        </button>
      )}
    </div>
  )
}
