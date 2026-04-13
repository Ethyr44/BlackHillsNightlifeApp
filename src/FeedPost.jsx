import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

// 🟢 FIX: Added onViewEntity to the props
export default function FeedPost({ item, currentUser, onViewEntity }) {
    const [liked, setLiked] = useState(false)
    const [likeCount, setLikeCount] = useState(0)
    
    const [showComments, setShowComments] = useState(false)
    const [comments, setComments] = useState([])
    const [newComment, setNewComment] = useState('')
    const [replyingTo, setReplyingTo] = useState(null) 

    useEffect(() => {
        checkLikeStatus()
        fetchLikeCount()
    }, [])

    const checkLikeStatus = async () => {
        const { data } = await supabase.from('post_likes').select('id').eq('post_id', item.data.id).eq('user_id', currentUser.id).maybeSingle()
        if (data) setLiked(true)
    }

    const fetchLikeCount = async () => {
        const { count } = await supabase.from('post_likes').select('*', { count: 'exact', head: true }).eq('post_id', item.data.id)
        setLikeCount(count || 0)
    }

    const fetchComments = async () => {
        const { data, error } = await supabase.from('comments')
            .select('*, profiles:user_id(username, profile_pic)')
            .eq('post_id', item.data.id)
            .order('created_at', { ascending: true })
        if (error) console.error("Comment fetch error:", error)
        if (data) setComments(data)
    }

    const toggleLike = async () => {
        const isCurrentlyLiked = liked
        setLiked(!isCurrentlyLiked)
        setLikeCount(prev => isCurrentlyLiked ? prev - 1 : prev + 1)

        if (isCurrentlyLiked) {
            const { error } = await supabase.from('post_likes').delete().eq('post_id', item.data.id).eq('user_id', currentUser.id)
            if (error) alert(`Error removing like: ${error.message}`)
        } else {
            const { error } = await supabase.from('post_likes').insert({ post_id: item.data.id, user_id: currentUser.id })
            if (error) {
                alert(`Error saving like: ${error.message}`)
                setLiked(false)
                setLikeCount(prev => prev - 1)
            }
        }
    }

    const handleCommentToggle = () => {
        if (!showComments) fetchComments()
        setShowComments(!showComments)
    }

    const submitComment = async (e) => {
        e.preventDefault()
        if (!newComment.trim()) return

        const commentData = {
            post_id: item.data.id,
            user_id: currentUser.id,
            content: newComment,
            parent_id: replyingTo?.id || null
        }

        const { data, error } = await supabase.from('comments').insert([commentData]).select('*, profiles:user_id(username, profile_pic)')
        
        if (error) {
            alert(`Error posting comment: ${error.message}`)
        } else if (data) {
            setComments([...comments, data[0]])
            setNewComment('')
            setReplyingTo(null)
        }
    }

    return (
        <div className="bg-[#090812]/80 border-2 border-blue-900/30 rounded-3xl p-5 shadow-[0_0_20px_rgba(59,130,246,0.1)] relative overflow-hidden group hover:border-blue-500/50 transition-all">
            
            {/* FACEBOOK BADGE */}
            {item.data.fb_post_id && (
                <div className="absolute top-4 right-4 z-10 flex items-center gap-1 text-[9px] text-blue-400 font-bold uppercase tracking-widest bg-blue-900/20 px-2 py-1 rounded border border-blue-500/30">
                   <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.469h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.469h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                   Official
                </div>
            )}

            <div className="flex items-center gap-3 mb-4 relative z-10 pr-20">
                {/* 🟢 FIX: Clickable Post Avatar */}
                <img 
                    src={item.data.profile_pic || `https://api.dicebear.com/7.x/bottts/svg?seed=${item.data.username}`} 
                    className="w-12 h-12 rounded-full border border-blue-500/30 object-cover bg-black cursor-pointer hover:border-blue-400 transition-colors" 
                    alt="" 
                    onClick={() => onViewEntity && onViewEntity(item.data.username)}
                />
                <div>
                    {/* 🟢 FIX: Clickable Post Username */}
                    <h4 
                        className="font-bold text-white text-lg tracking-wide cursor-pointer hover:text-blue-400 transition-colors"
                        onClick={() => onViewEntity && onViewEntity(item.data.username)}
                    >
                        {item.data.username}
                    </h4>
                    <span className="text-[9px] text-gray-500 uppercase tracking-widest font-bold">{new Date(item.timestamp).toLocaleString()}</span>
                </div>
            </div>
            
            {/* FORMATTED TEXT CONTENT */}
            {item.data.content && (
                <p className="text-gray-200 text-sm mb-4 relative z-10 whitespace-pre-wrap leading-relaxed">
                    {item.data.content}
                </p>
            )}

            {/* HIGH-RES IMAGE RENDERER */}
            {item.data.image_url && (
                <div className="relative z-10 mb-4 rounded-xl overflow-hidden border border-gray-800 bg-black">
                    <img src={item.data.image_url} alt="Post media" className="w-full h-auto object-cover max-h-[500px]" />
                </div>
            )}

            {/* EXTERNAL LINK BUTTON */}
            {item.data.external_link && (
                <a href={item.data.external_link} target="_blank" rel="noreferrer" className="relative z-10 mb-4 flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-widest text-blue-400 hover:text-white transition-colors bg-blue-900/20 hover:bg-blue-600 px-4 py-3 rounded-xl w-full border border-blue-500/30">
                    🔗 View Original Post
                </a>
            )}
            
            <div className="flex gap-4 border-t border-gray-800 pt-3 relative z-10">
                <button onClick={toggleLike} className={`text-xs font-bold uppercase tracking-widest transition-colors flex items-center gap-1 ${liked ? 'text-pink-500 drop-shadow-[0_0_8px_rgba(236,72,153,0.8)]' : 'text-gray-500 hover:text-pink-400'}`}>
                    {liked ? '❤️' : '🤍'} {likeCount} Likes
                </button>
                <button onClick={handleCommentToggle} className="text-xs text-gray-500 font-bold uppercase tracking-widest hover:text-blue-400 transition-colors flex items-center gap-1">
                    💬 {comments.length > 0 ? comments.length : ''} Reply
                </button>
            </div>

            {/* COMMENTS SECTION */}
            {showComments && (
                <div className="mt-4 pt-4 border-t border-gray-800 animate-slidedown relative z-10">
                    <div className="space-y-3 mb-4 max-h-60 overflow-y-auto pr-2 hide-scrollbar">
                        {comments.length === 0 ? (
                            <p className="text-gray-500 text-[10px] uppercase tracking-widest text-center italic">No comments yet. Be the first!</p>
                        ) : (
                            comments.map(comment => (
                                <div key={comment.id} className={`bg-black/40 p-3 rounded-2xl border border-gray-800 ${comment.parent_id ? 'ml-8 border-l-blue-500/50' : ''}`}>
                                    <div className="flex items-center gap-2 mb-1">
                                        {/* 🟢 FIX: Clickable Comment Avatar */}
                                        <img 
                                            src={comment.profiles?.profile_pic || `https://api.dicebear.com/7.x/bottts/svg?seed=${comment.profiles?.username}`} 
                                            className="w-6 h-6 rounded-full object-cover cursor-pointer hover:border-blue-400 transition-colors" 
                                            alt="" 
                                            onClick={() => onViewEntity && onViewEntity(comment.profiles?.username)}
                                        />
                                        {/* 🟢 FIX: Clickable Comment Username */}
                                        <span 
                                            className="text-xs font-bold text-white cursor-pointer hover:text-blue-400 transition-colors"
                                            onClick={() => onViewEntity && onViewEntity(comment.profiles?.username)}
                                        >
                                            {comment.profiles?.username}
                                        </span>
                                        <span className="text-[8px] text-gray-500 uppercase tracking-widest">{new Date(comment.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                    </div>
                                    <p className="text-xs text-gray-300 ml-8">{comment.content}</p>
                                    <div className="ml-8 mt-2">
                                        <button onClick={() => setReplyingTo(comment)} className="text-[9px] text-gray-500 hover:text-blue-400 uppercase tracking-widest font-bold transition-colors">Reply</button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    <form onSubmit={submitComment} className="flex flex-col gap-2">
                        {replyingTo && (
                            <div className="flex justify-between items-center bg-blue-900/20 px-3 py-1 rounded-lg border border-blue-500/30">
                                <span className="text-[10px] text-blue-400 font-bold">Replying to {replyingTo.profiles?.username}</span>
                                <button type="button" onClick={() => setReplyingTo(null)} className="text-gray-400 hover:text-white text-xs">✕</button>
                            </div>
                        )}
                        <div className="flex gap-2">
                            <input 
                                type="text" 
                                value={newComment} 
                                onChange={(e) => setNewComment(e.target.value)} 
                                placeholder="Add a vibe..." 
                                className="flex-1 bg-black border border-gray-700 text-white rounded-full py-2 px-4 focus:outline-none focus:border-blue-500 text-xs transition-colors"
                            />
                            <button type="submit" disabled={!newComment.trim()} className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest transition-colors shadow-lg">
                                Send
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    )
}