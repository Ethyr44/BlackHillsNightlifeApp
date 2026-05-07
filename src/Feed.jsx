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
    
    // N+1 Fix: Fetch everything needed for rendering in a single query
    // Notice how we changed "profiles:user_id" to "profiles:author_id"
    let query = supabase
      .from('posts')
      .select(`
        *,
        profiles:author_id (username, profile_pic, account_type),
        likes (id, user_id),
        comments (id, content, user_id, created_at)
      `)
      .order('created_at', { ascending: false })

    if (targetUserId) {
      // Changed 'user_id' to 'author_id' here as well
      query = query.eq('author_id', targetUserId)
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
          const formattedItem = {
             id: `post_${post.id}`,
             type: 'post',
             timestamp: new Date(post.created_at).getTime(),
             data: {
                 ...post,
                 username: post.profiles?.username || 'Unknown',
                 profile_pic: post.profiles?.profile_pic,
                 likes: post.likes || [],
                 comments: post.comments || []
             }
          }
          
          return <FeedPost key={post.id} item={formattedItem} currentUser={session.user} />
        })
      )}
    </div>
  )
}