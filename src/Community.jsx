import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from './supabaseClient'
import { toast } from './GlobalToast'

const CATEGORIES = [
    { id: 'Release Notes', label: 'Release Notes', icon: '🚀', badgeClass: 'bg-blue-500/15 text-blue-300 border-blue-500/30' },
    { id: 'Update', label: 'Updates', icon: '⚡', badgeClass: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30' },
    { id: 'Announcement', label: 'Announcements', icon: '📣', badgeClass: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
    { id: 'More', label: 'Features & More', icon: '✨', badgeClass: 'bg-purple-500/15 text-purple-300 border-purple-500/30' }
]

const DEFAULT_COMMUNITY_POSTS = [
    {
        id: 'bhnl-v0998-release',
        title: 'Black Hills Nightlife V0.998 Release Notes',
        category: 'Release Notes',
        version: 'V0.998',
        pinned: true,
        author_name: 'BHNL Admin',
        created_at: new Date().toISOString(),
        content: `Welcome to the official Black Hills Nightlife Community Board! Here is what's new in V0.998:

• Community Board & Live Alerts: Admins can now publish Release Notes, Updates, and Announcements directly to the Community Board, with instant notifications that take you straight to the full update.
• Casual KSocial Sessions: Starting a "Casual" KSocial session no longer requires selecting an official Venue, Host Agency, or mandatory setup fields — jump straight into a session for fun or testing!
• Dual KSocial Setlists (Side A & Side B): Build two 7-song setlists and swipe left or right to flip between Side A and Side B.
• Gem & Item Buffs: Consume Quartz, Agate, Opal, Onyx, Jade, Ruby, Emerald, Diamond, Microphones, and Megaphones directly from your Profile Inventory.
• L$ Reward Notifications: Every time you earn L$ Points, you now receive a persistent notification in your alerts menu.`
    }
]

export default function Community({ currentUser }) {
    const [searchParams, setSearchParams] = useSearchParams()
    const isAdmin = currentUser?.account_type === 'Admin'

    const [posts, setPosts] = useState([])
    const [rawVisibilityConfig, setRawVisibilityConfig] = useState({})
    const [loading, setLoading] = useState(true)
    const [selectedCategory, setSelectedCategory] = useState('All')
    const [activePost, setActivePost] = useState(null)

    // Admin Editor Modal State
    const [showEditor, setShowEditor] = useState(false)
    const [editingPostId, setEditingPostId] = useState(null)
    const [title, setTitle] = useState('')
    const [category, setCategory] = useState('Release Notes')
    const [versionTag, setVersionTag] = useState('V0.998')
    const [content, setContent] = useState('')
    const [pinned, setPinned] = useState(false)
    const [notifyAllUsers, setNotifyAllUsers] = useState(true)
    const [isSaving, setIsSaving] = useState(false)

    useEffect(() => {
        fetchCommunityBoard()

        const sub = supabase
            .channel('community-board-sync')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'system_config', filter: 'id=eq.1' },
                () => fetchCommunityBoard()
            )
            .subscribe()

        return () => supabase.removeChannel(sub)
    }, [])

    // Deep-link handling when clicking a Community Board notification (?tab=Community&post=<id>)
    useEffect(() => {
        const targetPostId = searchParams.get('post')
        if (!targetPostId || posts.length === 0) return

        const found = posts.find(p => String(p.id) === String(targetPostId))
        if (found) {
            setActivePost(found)
            setTimeout(() => {
                const el = document.getElementById(`community-post-${found.id}`)
                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
            }, 120)
        }
    }, [searchParams, posts])

    const fetchCommunityBoard = async () => {
        setLoading(true)
        const { data } = await supabase
            .from('system_config')
            .select('page_visibility')
            .eq('id', 1)
            .maybeSingle()

        const configObj = data?.page_visibility || {}
        setRawVisibilityConfig(configObj)

        const storedPosts = Array.isArray(configObj.community_posts)
            ? configObj.community_posts
            : DEFAULT_COMMUNITY_POSTS

        setPosts(storedPosts)
        setLoading(false)
    }

    const persistPostsToConfig = async (nextPosts) => {
        const { data: latestRow } = await supabase
            .from('system_config')
            .select('page_visibility')
            .eq('id', 1)
            .maybeSingle()

        const baseConfig = latestRow?.page_visibility || rawVisibilityConfig || {}
        const updatedConfig = {
            ...baseConfig,
            community_posts: nextPosts
        }

        const { error } = await supabase
            .from('system_config')
            .update({ page_visibility: updatedConfig })
            .eq('id', 1)

        if (!error) {
            setRawVisibilityConfig(updatedConfig)
            setPosts(nextPosts)
        }
        return { error }
    }

    const broadcastNotificationToAllUsers = async (postObj, isUpdate = false) => {
        const { data: allProfiles, error: profErr } = await supabase
            .from('profiles')
            .select('id')

        if (profErr || !allProfiles || allProfiles.length === 0) return 0

        const prefix = isUpdate ? 'Community Board Updated' : `New ${postObj.category || 'Community Update'}`
        const verLabel = postObj.version ? ` (${postObj.version})` : ''
        const notifTitle = `📰 ${prefix}${verLabel}`
        const notifContent = `${postObj.title} — Tap to view full post on the Community Board! [post:${postObj.id}]`

        const rows = allProfiles.map(u => ({
            user_id: u.id,
            title: notifTitle,
            content: notifContent
        }))

        // Insert in chunks of 100 to avoid payload limits
        for (let i = 0; i < rows.length; i += 100) {
            const batch = rows.slice(i, i + 100)
            await supabase.from('notifications').insert(batch)
        }

        return allProfiles.length
    }

    const openCreateModal = () => {
        setEditingPostId(null)
        setTitle('')
        setCategory('Release Notes')
        setVersionTag('V0.998')
        setContent('')
        setPinned(false)
        setNotifyAllUsers(true)
        setShowEditor(true)
    }

    const openEditModal = (post, e) => {
        if (e) e.stopPropagation()
        setEditingPostId(post.id)
        setTitle(post.title || '')
        setCategory(post.category || 'Release Notes')
        setVersionTag(post.version || '')
        setContent(post.content || '')
        setPinned(Boolean(post.pinned))
        setNotifyAllUsers(true)
        setShowEditor(true)
    }

    const handleSavePost = async (e) => {
        e.preventDefault()
        if (!isAdmin) return
        if (!title.trim() || !content.trim()) {
            toast.error('Please enter both a title and post content.')
            return
        }

        setIsSaving(true)
        const nowIso = new Date().toISOString()
        const isEditing = Boolean(editingPostId)
        const postId = editingPostId || `cb-${Date.now()}`

        const postPayload = {
            id: postId,
            title: title.trim(),
            category,
            version: versionTag.trim(),
            content: content.trim(),
            pinned: Boolean(pinned),
            author_name: currentUser?.username || 'BHNL Admin',
            created_at: isEditing
                ? (posts.find(p => p.id === editingPostId)?.created_at || nowIso)
                : nowIso,
            updated_at: nowIso
        }

        const nextPosts = isEditing
            ? posts.map(p => (p.id === editingPostId ? postPayload : p))
            : [postPayload, ...posts]

        const { error } = await persistPostsToConfig(nextPosts)
        if (error) {
            toast.error('Failed to save Community Board post: ' + error.message)
            setIsSaving(false)
            return
        }

        if (notifyAllUsers) {
            const count = await broadcastNotificationToAllUsers(postPayload, isEditing)
            toast.success(
                isEditing
                    ? `Post updated & notified ${count} users!`
                    : `Published to Community Board & notified ${count} users!`
            )
        } else {
            toast.success(isEditing ? 'Community post updated!' : 'Published to Community Board!')
        }

        setIsSaving(false)
        setShowEditor(false)
        setActivePost(postPayload)
    }

    const handleTogglePin = async (post, e) => {
        if (e) e.stopPropagation()
        if (!isAdmin) return
        const nextPosts = posts.map(p =>
            p.id === post.id ? { ...p, pinned: !p.pinned } : p
        )
        const { error } = await persistPostsToConfig(nextPosts)
        if (!error) {
            toast.success(post.pinned ? 'Post unpinned.' : '📌 Post pinned to top!')
        }
    }

    const handleDeletePost = async (post, e) => {
        if (e) e.stopPropagation()
        if (!isAdmin) return
        if (!window.confirm(`Delete "${post.title}" from the Community Board?`)) return

        const nextPosts = posts.filter(p => p.id !== post.id)
        const { error } = await persistPostsToConfig(nextPosts)
        if (!error) {
            toast.success('Community post deleted.')
            if (activePost?.id === post.id) closeActivePost()
        }
    }

    const closeActivePost = () => {
        setActivePost(null)
        if (searchParams.get('post')) {
            setSearchParams({ tab: 'Community' }, { replace: true })
        }
    }

    const getCategoryMeta = (catId) =>
        CATEGORIES.find(c => c.id === catId) || CATEGORIES[0]

    const filteredPosts = posts
        .filter(p => selectedCategory === 'All' || p.category === selectedCategory)
        .sort((a, b) => {
            if (Boolean(a.pinned) !== Boolean(b.pinned)) return a.pinned ? -1 : 1
            return new Date(b.created_at || 0) - new Date(a.created_at || 0)
        })

    const formatDate = (iso) => {
        if (!iso) return ''
        try {
            return new Date(iso).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
            })
        } catch {
            return ''
        }
    }

    return (
        <div className="p-4 pb-28 animate-fade-in max-w-2xl mx-auto">
            {/* Header Banner */}
            <div className="relative rounded-3xl overflow-hidden p-6 mb-6 border border-blue-500/25 bg-gradient-to-br from-[#0c1631] via-[#090d1d] to-[#130b24] shadow-[0_12px_40px_rgba(0,0,0,0.45)]">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-400/25 text-blue-300 text-[10px] font-bold uppercase tracking-widest mb-2">
                            <span>📰 Official Bulletin</span>
                        </div>
                        <h2 className="text-4xl font-['Bebas_Neue'] text-white tracking-widest leading-none">
                            Community Board
                        </h2>
                        <p className="text-xs text-gray-400 mt-1">
                            New Release Notes, App Updates, Official Announcements &amp; More
                        </p>
                    </div>

                    {isAdmin && (
                        <button
                            onClick={openCreateModal}
                            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white px-4 py-3 rounded-xl font-bold uppercase tracking-widest text-xs shadow-[0_0_20px_rgba(59,130,246,0.4)] transition-all flex items-center gap-2"
                        >
                            <span>＋ Post Update</span>
                        </button>
                    )}
                </div>

                {/* Category Filter Pills */}
                <div className="flex items-center gap-2 overflow-x-auto pt-5 pb-1 no-scrollbar">
                    <button
                        onClick={() => setSelectedCategory('All')}
                        className={`px-3.5 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wider border transition-all flex-shrink-0 ${
                            selectedCategory === 'All'
                                ? 'bg-blue-600 text-white border-blue-400 shadow-[0_0_12px_rgba(37,99,235,0.4)]'
                                : 'bg-black/40 text-gray-400 border-white/10 hover:text-white'
                        }`}
                    >
                        All ({posts.length})
                    </button>
                    {CATEGORIES.map(cat => (
                        <button
                            key={cat.id}
                            onClick={() => setSelectedCategory(cat.id)}
                            className={`px-3.5 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wider border transition-all flex-shrink-0 flex items-center gap-1.5 ${
                                selectedCategory === cat.id
                                    ? 'bg-blue-600 text-white border-blue-400 shadow-[0_0_12px_rgba(37,99,235,0.4)]'
                                    : 'bg-black/40 text-gray-400 border-white/10 hover:text-white'
                            }`}
                        >
                            <span>{cat.icon}</span>
                            <span>{cat.label}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Posts List */}
            {loading ? (
                <div className="py-16 text-center text-gray-400 animate-pulse font-bold uppercase tracking-widest text-xs">
                    Loading Community Board...
                </div>
            ) : filteredPosts.length === 0 ? (
                <div className="bg-[#090812]/90 border border-gray-800 rounded-2xl p-10 text-center">
                    <p className="text-3xl mb-2">📭</p>
                    <p className="text-white font-bold text-sm">No updates in this category yet.</p>
                    {isAdmin && (
                        <button
                            onClick={openCreateModal}
                            className="mt-4 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest"
                        >
                            Create First Post
                        </button>
                    )}
                </div>
            ) : (
                <div className="space-y-4">
                    {filteredPosts.map(post => {
                        const catMeta = getCategoryMeta(post.category)
                        const isHighlighted = String(searchParams.get('post')) === String(post.id)

                        return (
                            <div
                                id={`community-post-${post.id}`}
                                key={post.id}
                                onClick={() => setActivePost(post)}
                                className={`group rounded-2xl p-5 border transition-all cursor-pointer relative overflow-hidden ${
                                    isHighlighted
                                        ? 'bg-[#0e1730] border-blue-400 shadow-[0_0_25px_rgba(59,130,246,0.3)]'
                                        : post.pinned
                                        ? 'bg-[#0b1022]/95 border-blue-500/35 hover:border-blue-400/60'
                                        : 'bg-[#090812]/90 border-gray-800/90 hover:border-gray-700'
                                }`}
                            >
                                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                                    <div className="flex flex-wrap items-center gap-2">
                                        {post.pinned && (
                                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-400/30">
                                                📌 Pinned
                                            </span>
                                        )}
                                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${catMeta.badgeClass}`}>
                                            {catMeta.icon} {post.category || 'Release Notes'}
                                        </span>
                                        {post.version && (
                                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-white/10 text-white border border-white/15">
                                                {post.version}
                                            </span>
                                        )}
                                    </div>

                                    <span className="text-[11px] text-gray-500 font-medium">
                                        {formatDate(post.created_at)}
                                    </span>
                                </div>

                                <h3 className="text-xl font-bold text-white group-hover:text-blue-300 transition-colors mb-2">
                                    {post.title}
                                </h3>

                                <p className="text-sm text-gray-300 whitespace-pre-line line-clamp-4 leading-relaxed">
                                    {post.content}
                                </p>

                                <div className="mt-4 pt-3 border-t border-white/5 flex flex-wrap items-center justify-between gap-2">
                                    <span className="text-[11px] font-bold text-blue-400 group-hover:translate-x-0.5 transition-transform">
                                        Read Full Update →
                                    </span>

                                    {isAdmin && (
                                        <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                                            <button
                                                onClick={(e) => handleTogglePin(post, e)}
                                                className="px-2.5 py-1 rounded-lg bg-gray-800/90 hover:bg-gray-700 text-[10px] font-bold uppercase tracking-wider text-gray-300"
                                            >
                                                {post.pinned ? 'Unpin' : '📌 Pin'}
                                            </button>
                                            <button
                                                onClick={(e) => openEditModal(post, e)}
                                                className="px-2.5 py-1 rounded-lg bg-blue-900/40 hover:bg-blue-800/60 border border-blue-500/30 text-[10px] font-bold uppercase tracking-wider text-blue-300"
                                            >
                                                Edit
                                            </button>
                                            <button
                                                onClick={(e) => handleDeletePost(post, e)}
                                                className="px-2.5 py-1 rounded-lg bg-red-900/30 hover:bg-red-800/50 border border-red-500/30 text-[10px] font-bold uppercase tracking-wider text-red-300"
                                            >
                                                Delete
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

            {/* Full Post Reader Modal (Viewport-Centered + Tap-Outside-to-Close) */}
            {activePost && (
                <div
                    onClick={closeActivePost}
                    className="fixed inset-0 z-[500] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in"
                >
                    <div
                        onClick={e => e.stopPropagation()}
                        className="bg-[#0b1020] border border-blue-500/30 rounded-3xl max-w-lg w-full max-h-[85vh] flex flex-col overflow-hidden shadow-[0_24px_64px_rgba(0,0,0,0.75)]"
                    >
                        <div className="p-5 border-b border-white/10 flex items-start justify-between gap-3 bg-black/40">
                            <div>
                                <div className="flex flex-wrap items-center gap-2 mb-2">
                                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${getCategoryMeta(activePost.category).badgeClass}`}>
                                        {getCategoryMeta(activePost.category).icon} {activePost.category}
                                    </span>
                                    {activePost.version && (
                                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-white/10 text-white border border-white/15">
                                            {activePost.version}
                                        </span>
                                    )}
                                    <span className="text-[11px] text-gray-400">
                                        {formatDate(activePost.created_at)}
                                    </span>
                                </div>
                                <h3 className="text-2xl font-bold text-white leading-snug">
                                    {activePost.title}
                                </h3>
                                {activePost.author_name && (
                                    <p className="text-[11px] text-gray-400 mt-1">
                                        Posted by <span className="text-blue-300 font-semibold">{activePost.author_name}</span>
                                    </p>
                                )}
                            </div>
                            <button
                                onClick={closeActivePost}
                                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white flex items-center justify-center flex-shrink-0"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto flex-1 text-sm text-gray-200 whitespace-pre-line leading-relaxed">
                            {activePost.content}
                        </div>

                        <div className="p-4 border-t border-white/10 bg-black/40 flex items-center justify-between gap-2">
                            {isAdmin ? (
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => {
                                            const postToEdit = activePost
                                            closeActivePost()
                                            openEditModal(postToEdit)
                                        }}
                                        className="px-3 py-2 rounded-xl bg-blue-600/20 border border-blue-500/40 text-blue-300 text-xs font-bold uppercase tracking-wider hover:bg-blue-600/30"
                                    >
                                        Edit Post
                                    </button>
                                </div>
                            ) : <div />}

                            <button
                                onClick={closeActivePost}
                                className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold uppercase tracking-widest"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Admin Create / Edit Post Modal (Viewport-Centered + Tap-Outside-to-Close) */}
            {showEditor && isAdmin && (
                <div
                    onClick={() => setShowEditor(false)}
                    className="fixed inset-0 z-[520] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in"
                >
                    <form
                        onClick={e => e.stopPropagation()}
                        onSubmit={handleSavePost}
                        className="bg-[#0b1020] border border-blue-500/35 rounded-3xl max-w-lg w-full max-h-[88vh] flex flex-col overflow-hidden shadow-[0_24px_64px_rgba(0,0,0,0.8)]"
                    >
                        <div className="p-5 border-b border-white/10 flex items-center justify-between bg-black/40">
                            <h3 className="text-2xl font-['Bebas_Neue'] text-blue-400 tracking-widest">
                                {editingPostId ? 'Edit Community Board Post' : 'New Community Board Post'}
                            </h3>
                            <button
                                type="button"
                                onClick={() => setShowEditor(false)}
                                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white flex items-center justify-center"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="p-5 overflow-y-auto space-y-4 flex-1">
                            <div>
                                <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 block mb-1">
                                    Headline / Title *
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={title}
                                    onChange={e => setTitle(e.target.value)}
                                    placeholder="e.g., Black Hills Nightlife V0.998 Release Notes"
                                    className="w-full bg-black/70 border border-gray-700 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-blue-500"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 block mb-1">
                                        Category
                                    </label>
                                    <select
                                        value={category}
                                        onChange={e => setCategory(e.target.value)}
                                        className="w-full bg-black/70 border border-gray-700 rounded-xl px-3 py-3 text-sm text-white outline-none focus:border-blue-500"
                                    >
                                        {CATEGORIES.map(c => (
                                            <option key={c.id} value={c.id}>
                                                {c.icon} {c.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 block mb-1">
                                        Version / Tag (Optional)
                                    </label>
                                    <input
                                        type="text"
                                        value={versionTag}
                                        onChange={e => setVersionTag(e.target.value)}
                                        placeholder="e.g., V0.998"
                                        className="w-full bg-black/70 border border-gray-700 rounded-xl px-3 py-3 text-sm text-white outline-none focus:border-blue-500"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 block mb-1">
                                    Full Update / Announcement Details *
                                </label>
                                <textarea
                                    required
                                    rows={7}
                                    value={content}
                                    onChange={e => setContent(e.target.value)}
                                    placeholder="Write release notes, bullet points, announcements, or event highlights..."
                                    className="w-full bg-black/70 border border-gray-700 rounded-xl p-4 text-sm text-white outline-none focus:border-blue-500 leading-relaxed"
                                />
                            </div>

                            <div className="flex flex-col sm:flex-row gap-3 pt-1">
                                <label className="flex items-center gap-2.5 bg-black/40 border border-white/10 rounded-xl px-3.5 py-2.5 cursor-pointer flex-1">
                                    <input
                                        type="checkbox"
                                        checked={pinned}
                                        onChange={e => setPinned(e.target.checked)}
                                        className="accent-blue-500 w-4 h-4"
                                    />
                                    <span className="text-xs font-semibold text-gray-200">
                                        📌 Pin to top of Board
                                    </span>
                                </label>

                                <label className="flex items-center gap-2.5 bg-blue-950/30 border border-blue-500/30 rounded-xl px-3.5 py-2.5 cursor-pointer flex-1">
                                    <input
                                        type="checkbox"
                                        checked={notifyAllUsers}
                                        onChange={e => setNotifyAllUsers(e.target.checked)}
                                        className="accent-blue-500 w-4 h-4"
                                    />
                                    <span className="text-xs font-semibold text-blue-200">
                                        🔔 Notify All Users
                                    </span>
                                </label>
                            </div>
                        </div>

                        <div className="p-4 border-t border-white/10 bg-black/40 flex items-center justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => setShowEditor(false)}
                                className="px-4 py-2.5 rounded-xl border border-gray-700 text-gray-400 hover:text-white text-xs font-bold uppercase tracking-widest"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={isSaving}
                                className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold uppercase tracking-widest shadow-[0_0_20px_rgba(37,99,235,0.45)]"
                            >
                                {isSaving ? 'Publishing...' : editingPostId ? 'Save & Update' : 'Publish Update'}
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    )
}
