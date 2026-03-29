import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import FeedPost from './FeedPost' // <-- OUR NEW COMPONENT IMPORT

export default function FYP({ currentUser }) {
  const [feed, setFeed] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchLivingFeed()
  }, [])

  const fetchLivingFeed = async () => {
    setLoading(true)
    try {
        // Fetch Posts
        const { data: rawPosts } = await supabase.from('posts').select('*').order('created_at', { ascending: false }).limit(20)
        const { data: profiles } = await supabase.from('profiles').select('id, username, profile_pic')
        
        const formattedPosts = (rawPosts || []).map(post => {
            const author = profiles?.find(p => p.id === post.author_id || p.id === post.user_id) || {}
            return {
                id: `post_${post.id}`, type: 'post', timestamp: new Date(post.created_at).getTime(),
                data: { ...post, username: author.username || 'Unknown', profile_pic: author.profile_pic }
            }
        })

        // Fetch Events
        // Fetch Events (FIX: Added .eq('status', 'approved'))
        const { data: rawEvents } = await supabase.from('events').select('*').eq('status', 'approved').order('created_at', { ascending: false }).limit(10)
        const formattedEvents = (rawEvents || []).map(evt => ({
            id: `event_${evt.id}`, type: 'event', timestamp: new Date(evt.created_at).getTime(), data: evt
        }))

        // Fetch Pages
        const { data: rawPages } = await supabase.from('pages').select('*').order('created_at', { ascending: false }).limit(5)
        const formattedPages = (rawPages || []).map(page => ({
            id: `page_${page.id}`, type: 'page', timestamp: new Date(page.created_at).getTime(), data: page
        }))

        // Merge & Sort
        const combinedFeed = [...formattedPosts, ...formattedEvents, ...formattedPages].sort((a, b) => b.timestamp - a.timestamp)
        setFeed(combinedFeed)
    } catch (error) {
        console.error("Feed Error:", error)
    } finally {
        setLoading(false)
    }
  }

  const renderEvent = (item) => (
      <div key={item.id} className="bg-gradient-to-br from-purple-900/20 to-black border-2 border-purple-500/40 rounded-3xl p-6 shadow-[0_0_25px_rgba(147,51,234,0.15)] relative overflow-hidden">
          <div className="absolute -right-6 -top-6 text-8xl opacity-10">🎸</div>
          <span className="bg-purple-600 text-white text-[9px] font-bold uppercase tracking-widest px-3 py-1 rounded-full mb-3 inline-block">New Event Added</span>
          <h3 className="text-3xl font-['Bebas_Neue'] text-white tracking-widest mb-1" style={{ textShadow: '0 0 10px #9333ea' }}>{item.data.title}</h3>
          <p className="text-purple-400 text-xs font-bold uppercase tracking-widest mb-4">📍 {item.data.venue} • {new Date(item.data.event_date).toLocaleDateString()}</p>
          <p className="text-gray-300 text-sm line-clamp-2 mb-4 relative z-10">{item.data.description}</p>
      </div>
  )

  const renderPage = (item) => (
      <div key={item.id} className="bg-gradient-to-br from-cyan-900/20 to-black border-2 border-cyan-500/40 rounded-3xl p-6 shadow-[0_0_25px_rgba(6,182,212,0.15)] flex flex-col items-center text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
          <span className="bg-cyan-600 text-black text-[9px] font-bold uppercase tracking-widest px-3 py-1 rounded-full mb-4 inline-block relative z-10">New to the Scene</span>
          <img src={item.data.profile_pic || `https://api.dicebear.com/7.x/shapes/svg?seed=${item.data.name}`} className="w-20 h-20 rounded-full border-2 border-cyan-400 object-cover bg-black mb-3 relative z-10" alt="" />
          <h3 className="text-3xl font-['Bebas_Neue'] text-white tracking-widest relative z-10" style={{ textShadow: '0 0 10px #06b6d4' }}>{item.data.name}</h3>
          <p className="text-cyan-400 text-xs font-bold uppercase tracking-widest mb-5 relative z-10">{item.data.page_type}</p>
      </div>
  )

  return (
    <div className="max-w-2xl mx-auto p-4 animate-fade-in pb-32">
      <div className="mb-8 pt-4">
        <h2 className="text-5xl font-['Bebas_Neue'] text-white tracking-wider drop-shadow-[0_0_15px_rgba(255,255,255,0.4)]">THE FEED</h2>
        <p className="text-gray-400 font-bold tracking-widest uppercase text-[10px] mt-1">Real-time updates from the Black Hills</p>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : feed.length === 0 ? (
        <div className="text-center p-10 bg-[#090812]/80 border-2 border-gray-800 rounded-3xl">
          <p className="text-gray-500 font-bold tracking-widest uppercase text-sm">The feed is currently quiet.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {feed.map(item => {
              if (item.type === 'post') return <FeedPost key={item.id} item={item} currentUser={currentUser} />
              if (item.type === 'event') return renderEvent(item)
              if (item.type === 'page') return renderPage(item)
              return null
          })}
        </div>
      )}
    </div>
  )
}