import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import { toast } from './GlobalToast'

const LinkPreview = ({ url }) => {
  const [preview, setPreview] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchPreview = async () => {
      try {
        const res = await fetch(`https://api.microlink.io?url=${encodeURIComponent(url)}`)
        const data = await res.json()
        if (data.status === 'success') setPreview(data.data)
      } catch (e) {
        console.error('Preview failed', e)
      }
      setLoading(false)
    }
    fetchPreview()
  }, [url])

  if (loading) return (
    <div className="mt-2 h-4 w-32 rounded animate-pulse" style={{ background: 'rgba(255,255,255,0.07)' }} />
  )
  if (!preview || (!preview.image && !preview.title)) return null

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className="mt-3 block rounded-xl overflow-hidden group transition-all duration-200 hover:scale-[1.01]"
      style={{ border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.3)' }}
    >
      {preview.image && (
        <div className="h-32 sm:h-44 w-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
          <img
            src={preview.image.url}
            alt={preview.title}
            loading="lazy"
            decoding="async"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        </div>
      )}
      <div className="p-3">
        <h4 className="text-white font-semibold text-sm line-clamp-1">{preview.title || url}</h4>
        {preview.description && (
          <p className="text-xs mt-0.5 line-clamp-2" style={{ color: 'rgba(255,255,255,0.45)' }}>
            {preview.description}
          </p>
        )}
        <span className="text-[9px] font-bold uppercase tracking-widest mt-1.5 block" style={{ color: 'rgba(255,255,255,0.3)' }}>
          {new URL(url).hostname.replace('www.', '')}
        </span>
      </div>
    </a>
  )
}

const Linkify = ({ text }) => {
  if (!text) return null
  const urlRegex = /((?:https?:\/\/|www\.)[^\s]+)/g
  const parts = text.split(urlRegex)
  const match = text.match(urlRegex)
  const firstUrl = match ? (match[0].startsWith('www.') ? `https://${match[0]}` : match[0]) : null

  return (
    <div className="flex flex-col w-full">
      <p className="whitespace-pre-wrap leading-relaxed">
        {parts.map((part, i) => {
          if (part.match(urlRegex)) {
            const href = part.startsWith('www.') ? `https://${part}` : part
            return (
              <a
                key={i}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2 break-all transition-colors"
                style={{ color: '#4f8cff' }}
                onClick={(e) => e.stopPropagation()}
              >
                {part}
              </a>
            )
          }
          return part
        })}
      </p>
      {firstUrl && <LinkPreview url={firstUrl} />}
    </div>
  )
}

function HeartIcon({ filled }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill={filled ? '#f5557a' : 'none'} stroke={filled ? '#f5557a' : 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  )
}

function CommentIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  )
}

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
    if (!item?.data?.id || !currentUser?.id) return

    const checkLikeStatus = async () => {
      const { data } = await supabase
        .from('post_likes').select('id')
        .eq('post_id', item.data.id).eq('user_id', currentUser.id).maybeSingle()
      if (data) setLiked(true)
    }
    const fetchLikeCount = async () => {
      const { count } = await supabase
        .from('post_likes').select('*', { count: 'exact', head: true })
        .eq('post_id', item.data.id)
      setLikeCount(count || 0)
    }
    const fetchCommentCount = async () => {
      const { count } = await supabase
        .from('comments').select('*', { count: 'exact', head: true })
        .eq('post_id', item.data.id)
      setCommentCount(count || 0)
    }

    checkLikeStatus()
    fetchLikeCount()
    fetchCommentCount()
  }, [item?.data?.id, currentUser?.id])

  const fetchComments = async () => {
    const { data, error } = await supabase
      .from('comments')
      .select('*, profiles(username, profile_pic)')
      .eq('post_id', item.data.id)
      .order('created_at', { ascending: true })
    if (error) console.error('Comments Error:', error)
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
    const payload = { post_id: item.data.id, user_id: currentUser.id, content: newComment }
    if (replyingTo) payload.reply_to_id = replyingTo.id
    const { error } = await supabase.from('comments').insert([payload])
    if (!error) {
      setNewComment('')
      setReplyingTo(null)
      fetchComments()
      setCommentCount(prev => prev + 1)
      if (item.data.author_id !== currentUser.id) {
        await supabase.from('notifications').insert([{
          user_id: item.data.author_id,
          title: 'New Comment',
          content: `${currentUser.username} replied to your post.`,
        }])
      }
    } else {
      toast.error('Failed to post: ' + error.message)
    }
  }

  const timeAgo = (dateStr) => {
    const s = Math.floor((new Date() - new Date(dateStr)) / 1000)
    if (s < 60) return 'just now'
    if (s < 3600) return `${Math.floor(s / 60)}m`
    if (s < 86400) return `${Math.floor(s / 3600)}h`
    return `${Math.floor(s / 86400)}d`
  }

  const handleDelete = async () => {
    if (window.confirm('Delete this Post?')) {
      const { error } = await supabase.from('posts').delete().eq('id', item.data.id)
      if (!error) { toast.success('Post deleted.'); setIsDeleted(true) }
      else toast.error('Failed to delete post: ' + error.message)
    }
  }

  const canDelete = currentUser?.account_type === 'Admin' || currentUser?.id === item.data.author_id

  if (isDeleted) return null

  return (
    <article
      className="rounded-2xl overflow-hidden mb-4 transition-all duration-200 hover:translate-y-[-1px] animate-[fadeIn_0.25s_ease-out]"
      style={{
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
        backdropFilter: 'blur(16px)',
        boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
      }}
    >
      {/* Post Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
        <button
          className="flex items-center gap-3 group"
          onClick={() => onViewEntity && onViewEntity(item.data.username)}
        >
          <div
            className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0"
            style={{ border: '2px solid rgba(79,140,255,0.3)' }}
          >
            <img
              src={item.data.profile_pic || `https://api.dicebear.com/7.x/avataaars/svg?seed=${item.data.username}`}
              alt="Avatar"
              loading="lazy"
              decoding="async"
              className="w-full h-full object-cover"
            />
          </div>
          <div className="text-left">
            <p
              className="font-semibold text-sm text-white leading-tight group-hover:text-[#4f8cff] transition-colors"
            >
              {item.data.username}
            </p>
            <p className="text-[10px] font-medium uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.35)' }}>
              {timeAgo(item.data.created_at)}
            </p>
          </div>
        </button>

        {canDelete && (
          <button
            onClick={handleDelete}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-xs transition-all duration-150 hover:bg-red-500/20"
            style={{ color: 'rgba(255,255,255,0.3)' }}
            title="Delete Post"
          >
            ✕
          </button>
        )}
      </div>

      {/* Post Content */}
      <div className="px-4 pb-3 text-sm" style={{ color: 'rgba(255,255,255,0.85)' }}>
        <Linkify text={item.data.content} />
      </div>

      {/* Attached Image */}
      {item.data.image_url && (
        <div className="px-4 pb-3">
          <img
            src={item.data.image_url}
            alt="Post Attachment"
            loading="lazy"
            decoding="async"
            className="w-full rounded-xl object-cover max-h-[500px]"
            style={{ border: '1px solid rgba(255,255,255,0.08)' }}
          />
        </div>
      )}

      {/* Action Bar */}
      <div
        className="flex items-center gap-5 px-4 py-3"
        style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
      >
        <button
          onClick={handleLike}
          className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider transition-all duration-150 hover:scale-105 active:scale-95"
          style={{ color: liked ? '#f5557a' : 'rgba(255,255,255,0.4)' }}
        >
          <HeartIcon filled={liked} />
          <span>{likeCount}</span>
        </button>

        <button
          onClick={toggleComments}
          className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider transition-all duration-150 hover:scale-105 active:scale-95"
          style={{ color: showComments ? '#4f8cff' : 'rgba(255,255,255,0.4)' }}
        >
          <CommentIcon />
          <span>{commentCount > 0 ? `${commentCount} ${commentCount === 1 ? 'Reply' : 'Replies'}` : 'Reply'}</span>
        </button>
      </div>

      {/* Comments Section */}
      {showComments && (
        <div
          className="px-4 pb-4 space-y-3"
          style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
        >
          <div className="pt-3 space-y-3">
            {comments.map(c => (
              <div
                key={c.id}
                className={`flex gap-2.5 ${c.reply_to_id ? 'ml-6 pl-3' : ''}`}
                style={c.reply_to_id ? { borderLeft: '2px solid rgba(79,140,255,0.25)' } : {}}
              >
                <div
                  className="w-6 h-6 rounded-full overflow-hidden flex-shrink-0 mt-0.5"
                  style={{ border: '1px solid rgba(255,255,255,0.12)' }}
                >
                  <img
                    src={c.profiles?.profile_pic || `https://api.dicebear.com/7.x/avataaars/svg?seed=${c.profiles?.username || 'User'}`}
                    alt="Avatar"
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1">
                  <div
                    className="rounded-xl rounded-tl-sm px-3 py-2"
                    style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.07)' }}
                  >
                    <p className="font-semibold text-white text-xs mb-0.5">{c.profiles?.username || 'User'}</p>
                    <div className="text-xs" style={{ color: 'rgba(255,255,255,0.7)' }}>
                      <Linkify text={c.content} />
                    </div>
                  </div>
                  <div className="flex gap-3 mt-1 ml-1">
                    <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.25)' }}>
                      {timeAgo(c.created_at)}
                    </span>
                    <button
                      onClick={() => setReplyingTo(c)}
                      className="text-[9px] font-bold uppercase tracking-wider transition-colors"
                      style={{ color: 'rgba(255,255,255,0.35)' }}
                      onMouseEnter={e => e.target.style.color = '#4f8cff'}
                      onMouseLeave={e => e.target.style.color = 'rgba(255,255,255,0.35)'}
                    >
                      Reply
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <form onSubmit={handleComment} className="flex flex-col gap-2 pt-2">
            {replyingTo && (
              <div
                className="flex justify-between items-center px-3 py-1.5 rounded-lg"
                style={{ background: 'rgba(79,140,255,0.1)', border: '1px solid rgba(79,140,255,0.25)' }}
              >
                <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#4f8cff' }}>
                  Replying to {replyingTo.profiles?.username}
                </span>
                <button
                  type="button"
                  onClick={() => setReplyingTo(null)}
                  className="text-xs font-bold transition-colors"
                  style={{ color: 'rgba(255,255,255,0.4)' }}
                >
                  ✕
                </button>
              </div>
            )}
            <div className="flex gap-2">
              <input
                type="text"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Add a vibe..."
                className="flex-1 rounded-full py-2 px-4 text-xs text-white placeholder-white/30 outline-none transition-all duration-200"
                style={{
                  background: 'rgba(0,0,0,0.3)',
                  border: '1px solid rgba(255,255,255,0.1)',
                }}
                onFocus={e => e.target.style.borderColor = 'rgba(79,140,255,0.5)'}
                onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
              />
              <button
                type="submit"
                disabled={!newComment.trim()}
                className="px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest text-white transition-all duration-200 disabled:opacity-30"
                style={{
                  background: 'linear-gradient(135deg, #4f8cff, #2463d4)',
                  boxShadow: newComment.trim() ? '0 4px 14px rgba(79,140,255,0.35)' : 'none',
                }}
              >
                Send
              </button>
            </div>
          </form>
        </div>
      )}
    </article>
  )
}
