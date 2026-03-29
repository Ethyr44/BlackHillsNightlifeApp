import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import FeedPost from './FeedPost'

export default function Feed({ session, targetUserId = null, isFriend = false, isOwner = false }) {
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchPosts()
  }, [targetUserId])

  const fetchPosts = async () => {
    setLoading(true)
    
    // Notice how much smaller this query is now! 
    // FeedPost handles the likes/comments fetching on its own.
    let query = supabase
      .from('posts')
      .select(`
        *,
        profiles:user_id (username, profile_pic, account_type)
      `)
      .order('created_at', { ascending: false })

    // If looking at a specific profile, filter the posts
    if (targetUserId) {
      query = query.eq('user_id', targetUserId)
      // Enforce the Friend Rule: Non-friends only see the 1 most recent post
      if (!isFriend && !isOwner) {
        query = query.limit(1)
      }
    }

    const { data, error } = await query
    if (!error && data) setPosts(data)
    setLoading(false)
  }

  if (loading) return (
    <div className="flex justify-center p-8">
      <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
    </div>
  )

  return (
    <div className="space-y-6 animate-fade-in">
      {posts.length === 0 ? (
        <div className="text-center p-8 bg-gray-900 border border-gray-800 rounded-xl shadow-lg">
          <p className="text-gray-500 font-bold tracking-widest uppercase text-sm">No vibes broadcasted yet.</p>
        </div>
      ) : (
        posts.map(post => {
          // Format the data perfectly for the FeedPost component
          const formattedItem = {
             id: `post_${post.id}`,
             type: 'post',
             timestamp: new Date(post.created_at).getTime(),
             data: {
                 ...post,
                 username: post.profiles?.username || 'Unknown',
                 profile_pic: post.profiles?.profile_pic
             }
          }
          
          return <FeedPost key={post.id} item={formattedItem} currentUser={session.user} />
        })
      )}
    </div>
  )
}