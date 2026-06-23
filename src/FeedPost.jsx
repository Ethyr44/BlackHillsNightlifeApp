import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
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
                    <img src={preview.image.url} alt={preview.title} loading="lazy" decoding="async" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
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

export default function FeedPost({ item, currentUser, onViewEntity }) {
    const [liked, setLiked] = useState(false)
    const [likeCount, setLikeCount] = useState(0)
    
    const [showComments, setShowComments] = useState(false)
    const [comments, setComments] = useState([])
    const [newComment, setNewComment] = useState('')
    const [replyingTo, setReplyingTo] = useState(null) 
    const [isDeleted, setIsDeleted] = useState(false)
    const [commentCount, setCommentCount] = useState(0)

    useEffect(() => {
        if (!item?.data?.id || !currentUser?.id) return; // 🟢 Prevents Unmounted Crashes

        const checkLikeStatus = async () => {
            const { data } = await supabase.from('post_likes').select('id').eq('post_id', item.data.id).eq('user_id', currentUser.id).maybeSingle()
            if (data) setLiked(true)
        }
        const fetchLikeCount = async () => {
            const { count } = await supabase.from('post_likes').select('*', { count: 'exact', head: true }).eq('post_id', item.data.id)
            setLikeCount(count || 0)
        }
        const fetchCommentCount = async () => {
            const { count } = await supabase.from('comments').select('*', { count: 'exact', head: true }).eq('post_id', item.data.id)
            setCommentCount(count || 0)
        }

        checkLikeStatus()
        fetchLikeCount()
        fetchCommentCount()
    }, [item?.data?.id, currentUser?.id])

    const fetchComments = async () => {
        const { data, error } = await supabase.from('comments')
            .select('*, profiles(username, profile_pic)')
            .eq('post_id', item.data.id)
            .order('created_at', { ascending: true })
        if (error) console.error("Comments Error:", error)
        if (!error && data) setComments(data)
    }

    const toggleComments = () => {
        if (!showComments) fetchComments()
        setShowComments(!showComments)
    }

    const handleLike = async () => {
        if (liked) {
            await supabase.from('post_likes').delete().eq('post_id', item.data.id).eq('user_id', currentUser.id)
            setLikeCount(p => Math.max(0, p - 1))
        } else {
            await supabase.from('post_likes').insert([{ post_id: item.data.id, user_id: currentUser.id }])
            setLikeCount(p => p + 1)
        }
        setLiked(!liked)
    }

    const handleComment = async (e) => {
        e.preventDefault()
        if (!newComment.trim()) return

        // 🟢 Create the base payload first
        const payload = {
            post_id: item.data.id,
            user_id: currentUser.id,
            content: newComment
        }
        
        // 🟢 Only append the reply key if we are actually replying to someone
        if (replyingTo) {
            payload.reply_to_id = replyingTo.id
        }

        const { error } = await supabase.from('comments').insert([payload])
        if (!error) {
            setNewComment('')
            setReplyingTo(null)
            fetchComments()
            setCommentCount(prev => prev + 1)
            
            // 🟢 Send a notification to the Post Author!
            if (item.data.author_id !== currentUser.id) {
                await supabase.from('notifications').insert([{
                    user_id: item.data.author_id,
                    title: 'New Comment',
                    content: `${currentUser.username} replied to your post.`
                }])
            }
        } else {
            toast.error("Failed to post: " + error.message)
        }
    }

    const timeAgo = (dateStr) => {
        const seconds = Math.floor((new Date() - new Date(dateStr)) / 1000)
        if (seconds < 60) return 'just now'
        if (seconds < 3600) return `${Math.floor(seconds / 60)}m`
        if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`
        return `${Math.floor(seconds / 86400)}d`
    }

    const handleDelete = async () => {
        if (window.confirm("Delete this Post?")) {
            const { error } = await supabase.from('posts').delete().eq('id', item.data.id)
            if (!error) {
                toast.success("Post deleted.")
                setIsDeleted(true)
            } else {
                toast.error("Failed to delete post: " + error.message)
            }
        }
    }

    const canDelete = currentUser?.account_type === 'Admin' || currentUser?.id === item.data.author_id

    if (isDeleted) return null;

    return (
        <div className="bg-[#090812] border border-gray-800 p-4 sm:p-6 rounded-3xl mb-4 shadow-lg hover:border-gray-700 transition-colors">
            
            {/* Header: User Info */}
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3 cursor-pointer" onClick={() => onViewEntity && onViewEntity(item.data.username)}>
                    <div className="w-10 h-10 rounded-full bg-gray-800 overflow-hidden border border-gray-700 flex-shrink-0">
                        <img src={item.data.profile_pic || `https://api.dicebear.com/7.x/avataaars/svg?seed=${item.data.username}`} alt="Avatar" loading="lazy" decoding="async" className="w-full h-full object-cover" />
                    </div>
                    <div>
                        <h4 className="font-bold text-white text-sm leading-tight hover:text-blue-400 transition-colors">{item.data.username}</h4>
                        <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">{timeAgo(item.data.created_at)}</span>
                    </div>
                </div>
                {canDelete && (
                    <button 
                        onClick={handleDelete} 
                        className="ml-auto text-gray-500 hover:text-red-500 font-bold transition-colors"
                        title="Delete Post"
                    >
                        ✕
                    </button>
                )}
            </div>

            {/* 🟢 Post Content */}
            <div className="text-gray-200 text-sm mt-3 mb-3 whitespace-pre-wrap leading-relaxed">
                <Linkify text={item.data.content} />
            </div>
            
            {/* 🟢 THE FIX: Render the Image if attached! */}
            {item.data.image_url && (
                <img 
                    src={item.data.image_url} 
                    alt="Post Attachment" 
                    loading="lazy"
                    decoding="async"
                    className="w-full rounded-2xl mb-4 border border-gray-800 object-cover max-h-[500px]" 
                />
            )}

            {/* Action Bar (Likes & Comments) */}
            <div className="flex items-center gap-6 mt-4 pt-4 border-t border-gray-800/50">
                <button onClick={handleLike} className={`flex items-center gap-2 text-xs font-bold uppercase tracking-widest transition-colors ${liked ? 'text-pink-500' : 'text-gray-400 hover:text-pink-400'}`}>
                    <span className="text-lg">{liked ? '❤️' : '🤍'}</span> {likeCount}
                </button>
                
                <button onClick={toggleComments} className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-gray-400 hover:text-blue-400 transition-colors">
                    <span className="text-lg">💬</span> {commentCount > 0 ? `${commentCount} Replies` : 'Reply'}
                </button>
            </div>

            {/* Comments Section (Toggled) */}
            {showComments && (
                <div className="mt-4 pt-4 border-t border-gray-800 space-y-4">
                    {comments.map(c => (
                        <div key={c.id} className={`flex gap-3 ${c.reply_to_id ? 'ml-8 relative before:absolute before:content-[\"\"] before:w-4 before:h-px before:bg-gray-700 before:-left-6 before:top-4 border-l border-gray-800 pl-4' : ''}`}>
                            <div className="w-6 h-6 rounded-full bg-gray-800 overflow-hidden flex-shrink-0">
                                <img src={c.profiles?.profile_pic || `https://api.dicebear.com/7.x/avataaars/svg?seed=${c.profiles?.username || 'User'}`} alt="Avatar" loading="lazy" decoding="async" className="w-full h-full object-cover" />
                            </div>
                            <div className="flex-1">
                                <div className="bg-black/50 border border-gray-800 p-3 rounded-2xl rounded-tl-sm">
                                    <h5 className="font-bold text-white text-xs mb-1">{c.profiles?.username || 'User'}</h5>
                                    <div className="text-gray-300 text-xs"><Linkify text={c.content} /></div>
                                </div>
                                <div className="flex gap-4 mt-1 ml-2">
                                    <span className="text-[9px] text-gray-600 font-bold uppercase tracking-widest">{timeAgo(c.created_at)}</span>
                                    <button onClick={() => setReplyingTo(c)} className="text-[9px] text-gray-500 hover:text-blue-400 font-bold uppercase tracking-widest transition-colors">Reply</button>
                                </div>
                            </div>
                        </div>
                    ))}

                    <form onSubmit={handleComment} className="flex flex-col gap-2 mt-4">
                        {replyingTo && (
                            <div className="flex justify-between items-center bg-blue-900/20 px-3 py-1.5 rounded-lg border border-blue-500/30">
                                <span className="text-[10px] text-blue-400 font-bold uppercase tracking-widest">Replying to {replyingTo.profiles?.username}</span>
                                <button type="button" onClick={() => setReplyingTo(null)} className="text-gray-400 hover:text-white text-xs font-bold">✕</button>
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
                            <button type="submit" disabled={!newComment.trim()} className="bg-blue-600 hover:bg-blue-500 disabled:bg-gray-800 disabled:text-gray-600 text-white px-5 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest transition-colors shadow-lg">
                                Send
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    )
}