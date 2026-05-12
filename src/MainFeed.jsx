import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import FeedPost from './FeedPost'
import { EVENT_EMOJIS } from './VenueCard'

export default function MainFeed({ currentUser, onViewEntity }) {
  const [feed, setFeed] = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const ITEMS_PER_PAGE = 50

  useEffect(() => {
    const fetchLivingFeed = async () => {
      if (page === 1) setLoading(true)
      
      const from = (page - 1) * ITEMS_PER_PAGE
      const to = from + ITEMS_PER_PAGE - 1
      
      const { data: rawPosts } = await supabase.from('posts').select('*').order('created_at', { ascending: false }).range(from, to)
      const { data: profiles } = await supabase.from('profiles').select('id, username, profile_pic')
      
      const formattedPosts = (rawPosts || []).map(post => {
          const author = profiles?.find(p => p.id === post.author_id) || {}
          return {
              id: `post_${post.id}`, type: 'post', timestamp: new Date(post.created_at).getTime(),
              data: { ...post, username: author.username || 'Unknown', profile_pic: author.profile_pic }
          }
      })

      const eventFrom = (page - 1) * 20
      const eventTo = eventFrom + 19
      const { data: rawEvents } = await supabase.from('events').select('*').eq('status', 'approved').order('created_at', { ascending: false }).range(eventFrom, eventTo)
      const formattedEvents = (rawEvents || []).map(evt => ({
          id: `event_${evt.id}`, type: 'event', timestamp: new Date(evt.created_at).getTime(), data: evt
      }))

      const combinedFeed = [...formattedPosts, ...formattedEvents].sort((a, b) => b.timestamp - a.timestamp)
      
      if (page === 1) {
          setFeed(combinedFeed)
      } else {
          setFeed(prev => {
              const existingIds = new Set(prev.map(i => i.id))
              const uniqueCombined = combinedFeed.filter(i => !existingIds.has(i.id))
              return [...prev, ...uniqueCombined].sort((a, b) => b.timestamp - a.timestamp)
          })
      }

      if ((rawPosts?.length || 0) < ITEMS_PER_PAGE && (rawEvents?.length || 0) < 20) setHasMore(false)
      setLoading(false)
    }
    fetchLivingFeed()
  }, [page])

  if (loading) return <div className="flex justify-center py-20"><div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div></div>

  return (
    <div className="space-y-6 animate-fade-in">
      {feed.length === 0 ? (
          <div className="text-center p-10 bg-[#090812]/80 border-2 border-gray-800 rounded-3xl">
            <p className="text-gray-500 font-bold tracking-widest uppercase text-sm">No recent updates.</p>
          </div>
      ) : (
          feed.map(item => {
              if (item.type === 'post') {
                  return <FeedPost key={item.id} item={item} currentUser={currentUser} onViewEntity={onViewEntity} />
              }
              if (item.type === 'event') {
                  const evtDate = new Date(item.data.event_date)
                  const dayString = item.data.recurring_weekly ? `Every ${evtDate.toLocaleDateString('en-US', {weekday: 'long'})}` : evtDate.toLocaleDateString()
                  
                  return (
                      <div key={item.id} className="bg-[#090812]/80 border-2 border-purple-900/30 rounded-3xl p-5 shadow-[0_0_20px_rgba(147,51,234,0.1)] hover:border-purple-500/50 transition-all cursor-pointer" onClick={() => onViewEntity(item.data.venue)}>
                         <div className="flex items-center gap-3 mb-3">
                             <div className="text-3xl bg-purple-900/30 p-2 rounded-xl border border-purple-500/30">
                                 {EVENT_EMOJIS[item.data.event_type] || '🗓️'}
                             </div>
                             <div>
                                 <span className="text-purple-400 font-bold uppercase tracking-widest text-[9px] bg-purple-900/20 px-2 py-1 rounded border border-purple-500/30">New Event Published</span>
                                 <h4 className="font-bold text-white text-lg leading-tight mt-1">{item.data.title}</h4>
                             </div>
                         </div>
                         <p className="text-gray-300 font-bold text-sm mb-3">
                             {item.data.event_type} at <span className="text-cyan-400">{item.data.venue}</span> • {dayString}
                         </p>
                         {item.data.description && (
                             <div className="bg-black/50 p-4 rounded-xl border border-gray-800 text-gray-400 text-sm italic">
                                 {item.data.description}
                             </div>
                         )}
                      </div>
                  )
              }
              return null
          })
      )}

      {hasMore && feed.length >= ITEMS_PER_PAGE && (
          <button 
              onClick={() => setPage(p => p + 1)}
              className="w-full bg-[#090812] border-2 border-gray-800 text-gray-400 hover:text-white hover:border-blue-500/50 py-4 rounded-3xl text-xs font-bold uppercase tracking-widest transition-all mt-6 shadow-[0_0_15px_rgba(0,0,0,0.5)]"
          >
              Load More
          </button>
      )}
    </div>
  )
}