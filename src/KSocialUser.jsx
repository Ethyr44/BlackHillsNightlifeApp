import { useState, useEffect, useRef } from 'react'
import { supabase } from './supabaseClient'
import { toast } from './GlobalToast'
import {
    CONSUMABLE_CATALOG,
    consumeInventoryAsset,
    awardKSocialPoints,
    extractSetlistsFromProfile,
    updateDualSetlistOnProfile,
    getSingerRotationOrder,
    withSingerRotationOrder,
    sortSingersForRotation
} from './utils'

const REACTION_EMOJIS = [
    { emoji: '🔥', label: 'Fire' },
    { emoji: '🍻', label: 'Cheers' },
    { emoji: '👏', label: 'Applause' },
    { emoji: '🎤', label: 'Encore' },
    { emoji: '💖', label: 'Love' }
]

export default function KSocialUser({ currentUser, sessionId, onExit }) {
    const [session, setSession] = useState(null)
    const [singers, setSingers] = useState([])
    const [isLoading, setIsLoading] = useState(true)
    const [activeView, setActiveView] = useState('Menu')
    const [liveProfile, setLiveProfile] = useState(currentUser || null)

    const [votedFor, setVotedFor] = useState({})

    // Arcade & Voting
    const [tapCount, setTapCount] = useState(0)
    const [fullModeTaps, setFullModeTaps] = useState(0)

    const [superVoteActive, setSuperVoteActive] = useState(false)
    const [hasUsedSupervote, setHasUsedSupervote] = useState(() => localStorage.getItem(`sv_${sessionId}`) === 'used')
    const [multiStars, setMultiStars] = useState({ performance: 0, wow: 0, originality: 0 })

    // Live Floating Crowd Reactions
    const [floatingReactions, setFloatingReactions] = useState([])
    const prevMyStatusRef = useRef(null)

    // Dual Setlists: Side A & Side B
    const [sideASongs, setSideASongs] = useState([])
    const [sideBSongs, setSideBSongs] = useState([])
    const [activeSide, setActiveSide] = useState('A')
    const setlistTouchRef = useRef(null)

    const userSetlist = activeSide === 'B' ? sideBSongs : sideASongs
    const [searchQuery, setSearchQuery] = useState('')
    const [songResults, setSongResults] = useState([])
    const [searching, setSearching] = useState(false)

    const [isGuest] = useState(!currentUser || currentUser.account_type === 'Temp/Guest')
    const [tempName, setTempName] = useState('')
    const [tempStageName, setTempStageName] = useState('')
    const [tempLoading, setTempLoading] = useState(false)

    const spawnFloatingReaction = (emoji) => {
        const id = `${Date.now()}-${Math.random()}`
        const leftPct = 15 + Math.floor(Math.random() * 70)
        setFloatingReactions(prev => [...prev.slice(-18), { id, emoji, leftPct }])
        setTimeout(() => {
            setFloatingReactions(prev => prev.filter(r => r.id !== id))
        }, 2000)
    }

    const handleSendReaction = async (emoji) => {
        spawnFloatingReaction(emoji)
        if (navigator.vibrate) navigator.vibrate(25)
        const payload = { emoji, sender: currentUser?.username || tempStageName || 'Crowd' }
        await Promise.all([
            supabase
                .channel(`public-ksocial-${sessionId}`)
                .send({ type: 'broadcast', event: 'stage-reaction', payload }),
            supabase
                .channel(`projector-channel-${sessionId}`)
                .send({ type: 'broadcast', event: 'stage-reaction', payload })
        ])
    }

    const fetchAll = async () => {
        const { data: sessData } = await supabase.from('active_sessions').select('*').eq('id', sessionId).maybeSingle()
        if (sessData) {
            setSession(sessData)
        } else {
            setSession(null)
            localStorage.removeItem('bhnl_joined_session')
            if (onExit) onExit()
            return
        }

        const { data: sData } = await supabase
            .from('session_singers')
            .select('*')
            .eq('session_id', sessionId)
            .order('created_at', { ascending: true })
        if (sData) setSingers(sData)

        if (currentUser && !isGuest) {
            const { data: pData } = await supabase.from('profiles').select('*').eq('id', currentUser.id).maybeSingle()
            if (pData) {
                setLiveProfile(pData)
                const parsed = extractSetlistsFromProfile(pData)
                setActiveSide(parsed.activeSide)
                const allSongIds = Array.from(new Set([...parsed.sideA, ...parsed.sideB]))
                if (allSongIds.length > 0) {
                    const { data: songs } = await supabase.from('songs').select('id, title, artist').in('id', allSongIds)
                    if (songs) {
                        setSideASongs(parsed.sideA.map(id => songs.find(s => s.id === id)).filter(Boolean))
                        setSideBSongs(parsed.sideB.map(id => songs.find(s => s.id === id)).filter(Boolean))
                    }
                } else {
                    setSideASongs([])
                    setSideBSongs([])
                }
            }
        }
        setIsLoading(false)
    }

    // Award +20 KSocial Points once per session joined
    useEffect(() => {
        if (!currentUser?.id || isGuest || !sessionId) return
        awardKSocialPoints(supabase, currentUser.id, 20, {
            title: 'Joined KSocial Session!',
            guardKey: `ksocial_join_${sessionId}`,
            emitToast: true
        })
    }, [sessionId, currentUser?.id, isGuest])

    useEffect(() => {
        if (!currentUser) return setIsLoading(false)
        fetchAll()

        const sub = supabase
            .channel(`public-ksocial-${sessionId}`)
            .on(
                'postgres',
                { event: '*', schema: 'public', table: 'session_singers', filter: `session_id=eq.${sessionId}` },
                fetchAll
            )
            .on('broadcast', { event: 'force-reload' }, fetchAll)
            .on('broadcast', { event: 'stage-reaction' }, ({ payload }) => {
                if (payload?.emoji) spawnFloatingReaction(payload.emoji)
            })
            .subscribe()

        return () => supabase.removeChannel(sub)
    }, [sessionId, currentUser])

    const rotationSingers = sortSingersForRotation(singers)
    const activeSinger = singers.find(s => s.status === 'singing' || s.status === 'voting' || s.status === 'results')
    const onDeckSingers = rotationSingers.filter(s => s.id !== activeSinger?.id).slice(0, 2)
    const myEntry = singers.find(s => s.user_id && s.user_id === currentUser?.id)
    const myRotationIndex = myEntry ? rotationSingers.findIndex(s => s.id === myEntry.id) : -1

    const activeVoteIcon =
        session?.voting_icon === 'fire' ? '🔥' : session?.voting_icon === 'beer' ? '🍻' : '⭐'

    // Alert singer when they are placed On Deck (standby)
    useEffect(() => {
        if (!myEntry) {
            prevMyStatusRef.current = null
            return
        }
        if (prevMyStatusRef.current && prevMyStatusRef.current !== myEntry.status) {
            if (myEntry.status === 'standby') {
                toast.success(`🎤 You're ON DECK! Get ready for "${myEntry.song_title}"!`)
                if (navigator.vibrate) navigator.vibrate([200, 100, 200])
            } else if (myEntry.status === 'singing') {
                toast.success(`🌟 You're LIVE ON STAGE!`)
            }
        }
        prevMyStatusRef.current = myEntry.status
    }, [myEntry?.status, myEntry?.song_title])

    // Helper to resolve Microphone (incoming x2) & Megaphone (outgoing x2) vote multipliers
    const applyVoteBuffsAndAward = async (baseVotePoints) => {
        if (!activeSinger || baseVotePoints <= 0) return { buffMultiplier: 1, hasMegaphone: false, singerHasMic: false }
        let hasMegaphone = Boolean(liveProfile?.details?.active_buffs?.megaphone)
        let singerHasMic = false

        if (activeSinger.user_id) {
            const { data: singerProf } = await supabase
                .from('profiles')
                .select('details')
                .eq('id', activeSinger.user_id)
                .maybeSingle()
            singerHasMic = Boolean(singerProf?.details?.active_buffs?.microphone)
        }

        const buffMultiplier = (hasMegaphone ? 2 : 1) * (singerHasMic ? 2 : 1)
        const totalVotePoints = baseVotePoints * buffMultiplier

        // Clear Voter's single-song Megaphone buff once used
        if (hasMegaphone && currentUser?.id && !isGuest) {
            const nextDetails = {
                ...(liveProfile?.details || {}),
                active_buffs: {
                    ...(liveProfile?.details?.active_buffs || {}),
                    megaphone: false
                }
            }
            await supabase.from('profiles').update({ details: nextDetails }).eq('id', currentUser.id)
            setLiveProfile(prev => (prev ? { ...prev, details: nextDetails } : prev))
        }

        // Award +1 KSocial Point per Vote Point received to the singer
        if (activeSinger.user_id && totalVotePoints > 0) {
            await awardKSocialPoints(supabase, activeSinger.user_id, totalVotePoints, {
                title: 'Stage Votes Received!'
            })
        }

        return { buffMultiplier, hasMegaphone, singerHasMic, totalVotePoints }
    }

    // Reset Full Mode Taps when a new singer goes on stage
    useEffect(() => {
        if (activeSinger?.status === 'singing') {
            setFullModeTaps(0)
        }
    }, [activeSinger?.id, activeSinger?.status])

    useEffect(() => {
        if (activeSinger?.status === 'voting' && activeView !== 'Stage') {
            setActiveView('Stage')
            toast.success('Voting is Live!')
        }
    }, [activeSinger?.status])

    // Standard "Tap" Mode Synchronization
    useEffect(() => {
        if (tapCount > 0 && activeSinger?.status === 'voting' && session?.voting_style === 'tap') {
            const timer = setTimeout(async () => {
                const rawPoints = tapCount
                setTapCount(0)
                const { buffMultiplier } = await applyVoteBuffsAndAward(rawPoints)
                const effectiveTaps = rawPoints * buffMultiplier
                await supabase.rpc('submit_stage_vote', {
                    p_singer_id: activeSinger.id,
                    p_voting_style: 'tap',
                    p_taps: effectiveTaps,
                    p_perf_stars: 0,
                    p_wow_stars: 0,
                    p_orig_stars: 0,
                    p_is_supervote: superVoteActive
                })
            }, 1000)
            return () => clearTimeout(timer)
        }
    }, [tapCount, activeSinger, session, superVoteActive])

    const handleCreateGuest = async (e) => {
        e.preventDefault()
        setTempLoading(true)
        try {
            const { data, error } = await supabase.auth.signInAnonymously()
            if (error) throw error
            if (data?.user) {
                await supabase.from('profiles').insert([
                    {
                        id: data.user.id,
                        username: tempStageName,
                        account_type: 'Temp/Guest',
                        details: { realName: tempName }
                    }
                ])
                window.location.reload()
            }
        } catch {
            toast.error('Auth limit hit. Generating local pass...')
            setTimeout(() => {
                window.location.href = '/?mode=register'
            }, 2000)
        }
    }

    const handleSearchSong = async (e) => {
        e.preventDefault()
        if (!searchQuery.trim()) return
        setSearching(true)
        const { data } = await supabase
            .from('songs')
            .select('id, title, artist')
            .or(`title.ilike.%${searchQuery}%,artist.ilike.%${searchQuery}%`)
            .limit(12)
        if (data) setSongResults(data)
        setSearching(false)
    }

    const handleSwitchSide = async (nextSide) => {
        if (nextSide === activeSide) return
        setActiveSide(nextSide)
        if (!isGuest && currentUser?.id) {
            await updateDualSetlistOnProfile(supabase, currentUser.id, {
                sideA: sideASongs.map(s => s.id),
                sideB: sideBSongs.map(s => s.id),
                activeSide: nextSide
            })
            window.dispatchEvent(new Event('setlistUpdated'))
        }
    }

    const handleSetlistTouchStart = (e) => {
        e.stopPropagation()
        if (!e.touches || e.touches.length !== 1) return
        setlistTouchRef.current = {
            x: e.touches[0].clientX,
            y: e.touches[0].clientY
        }
    }

    const handleSetlistTouchEnd = (e) => {
        e.stopPropagation()
        if (!setlistTouchRef.current || !e.changedTouches || e.changedTouches.length === 0) return
        const dx = e.changedTouches[0].clientX - setlistTouchRef.current.x
        const dy = e.changedTouches[0].clientY - setlistTouchRef.current.y
        setlistTouchRef.current = null
        if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.2) {
            handleSwitchSide(activeSide === 'A' ? 'B' : 'A')
        }
    }

    const syncDualSetlistsToServer = async (nextSideASongs, nextSideBSongs, side = activeSide) => {
        if (isGuest || !currentUser?.id) return
        const { error } = await updateDualSetlistOnProfile(supabase, currentUser.id, {
            sideA: nextSideASongs.map(s => s.id),
            sideB: nextSideBSongs.map(s => s.id),
            activeSide: side
        })
        if (error) toast.error('Failed to update setlist: ' + error.message)
        else window.dispatchEvent(new Event('setlistUpdated'))
    }

    const addToSetlist = async (song) => {
        if (userSetlist.length >= 7) return toast.error(`Side ${activeSide} max is 7 songs.`)
        if (userSetlist.find(s => s.id === song.id)) return toast.error(`Song already in Side ${activeSide}.`)
        const newList = [...userSetlist, song]
        const nextA = activeSide === 'A' ? newList : sideASongs
        const nextB = activeSide === 'B' ? newList : sideBSongs
        setSideASongs(nextA)
        setSideBSongs(nextB)
        await syncDualSetlistsToServer(nextA, nextB, activeSide)
        toast.success(`Added to Side ${activeSide}!`)
    }

    const removeFromSetlist = async (indexToRemove) => {
        const newList = userSetlist.filter((_, idx) => idx !== indexToRemove)
        const nextA = activeSide === 'A' ? newList : sideASongs
        const nextB = activeSide === 'B' ? newList : sideBSongs
        setSideASongs(nextA)
        setSideBSongs(nextB)
        await syncDualSetlistsToServer(nextA, nextB, activeSide)
    }

    const submitQueueToHost = async () => {
        if (userSetlist.length === 0) return toast.error(`Your Side ${activeSide} setlist is empty!`)

        if (myEntry) {
            // Update active stage entry in-place while preserving rotation position!
            const preservedOrder = getSingerRotationOrder(myEntry, 0)
            const stampedSetlist = withSingerRotationOrder(userSetlist, preservedOrder)
            const { error } = await supabase
                .from('session_singers')
                .update({
                    song_id: userSetlist[0].id,
                    song_title: userSetlist[0].title,
                    song_artist: userSetlist[0].artist,
                    setlist: stampedSetlist
                })
                .eq('id', myEntry.id)

            if (error) {
                toast.error('Failed to update stage setlist: ' + error.message)
                return
            }
            await supabase
                .channel(`public-ksocial-${sessionId}`)
                .send({ type: 'broadcast', event: 'force-reload', payload: {} })
            fetchAll()
            setActiveView('Stage')
            toast.success(`Updated your live queue to Side ${activeSide}!`)
            return
        }

        const payload = {
            session_id: sessionId,
            user_id: currentUser.id,
            singer_name: currentUser.username || tempStageName,
            song_id: userSetlist[0].id,
            song_title: userSetlist[0].title,
            song_artist: userSetlist[0].artist,
            setlist: withSingerRotationOrder(userSetlist, Date.now()),
            status: 'pending'
        }
        await supabase.from('session_singers').insert([payload])
        await supabase
            .channel(`public-ksocial-${sessionId}`)
            .send({ type: 'broadcast', event: 'force-reload', payload: {} })
        fetchAll()
        setActiveView('Stage')
        toast.success(`Side ${activeSide} submitted to Host!`)
    }

    // 🟢 VOTING ENGINE INTERACTIONS
    const handleTapVote = () => {
        if (session?.voting_style === 'full') {
            setFullModeTaps(prev => prev + 1)
            if (navigator.vibrate) navigator.vibrate(50)
        } else {
            const multiplier = superVoteActive ? 2 : 1
            setTapCount(prev => prev + multiplier)
            if (navigator.vibrate) navigator.vibrate(superVoteActive ? [50, 50, 50] : 50)
        }
    }

    const activateSuperVote = () => {
        setSuperVoteActive(true)
        setHasUsedSupervote(true)
        localStorage.setItem(`sv_${sessionId}`, 'used')
        toast.success('⚡ SuperVote Active!')
    }

    const submitFinalVote = async () => {
        if (!activeSinger) return

        const rawStarsTotal =
            session.voting_style === 'stars'
                ? multiStars.performance
                : multiStars.performance +
                  multiStars.wow +
                  multiStars.originality +
                  (session.voting_style === 'full' ? fullModeTaps : 0)
        const superMult = superVoteActive ? 2 : 1
        const baseVotePts = rawStarsTotal * superMult

        const { buffMultiplier, hasMegaphone, singerHasMic } = await applyVoteBuffsAndAward(baseVotePts)

        const { error } = await supabase.rpc('submit_stage_vote', {
            p_singer_id: activeSinger.id,
            p_voting_style: session.voting_style,
            p_taps: fullModeTaps * buffMultiplier,
            p_perf_stars: multiStars.performance * buffMultiplier,
            p_wow_stars: multiStars.wow * buffMultiplier,
            p_orig_stars: multiStars.originality * buffMultiplier,
            p_is_supervote: superVoteActive
        })

        if (error) {
            toast.error(error.message)
        } else {
            setVotedFor(prev => ({ ...prev, [activeSinger.id]: true }))
            setMultiStars({ performance: 0, wow: 0, originality: 0 })
            setSuperVoteActive(false)
            if (hasMegaphone || singerHasMic) {
                toast.success(`Votes Locked In! (${buffMultiplier}x Item Boost Applied!)`)
            } else {
                toast.success('Votes Locked In!')
            }
        }
    }

    const handleConsumeInBackpack = async (assetName) => {
        if (!currentUser?.id) return
        const res = await consumeInventoryAsset(supabase, currentUser.id, assetName)
        if (!res.ok) {
            toast.error(res.message)
            return
        }
        if (res.updatedProfile) setLiveProfile(res.updatedProfile)
        toast.success(res.message)
    }

    const renderMyQueueBanner = () => {
        if (!myEntry) return null
        if (myEntry.status === 'pending') {
            return (
                <div className="mb-4 bg-yellow-950/30 border border-yellow-500/40 rounded-2xl p-3 text-center">
                    <p className="text-[11px] font-bold text-yellow-300 uppercase tracking-widest">
                        ⏳ Awaiting Host Approval • Next Song: {myEntry.song_title}
                    </p>
                </div>
            )
        }
        if (myEntry.status === 'standby') {
            return (
                <div className="mb-4 bg-amber-500/20 border-2 border-amber-400 rounded-2xl p-3.5 text-center animate-pulse shadow-[0_0_20px_rgba(245,158,11,0.3)]">
                    <p className="text-xs font-black text-amber-300 uppercase tracking-widest">
                        🚨 YOU ARE ON DECK! Head to the Stage for &ldquo;{myEntry.song_title}&rdquo;!
                    </p>
                </div>
            )
        }
        if (myEntry.status === 'singing') {
            return (
                <div className="mb-4 bg-[#ff2d78]/20 border-2 border-[#ff2d78] rounded-2xl p-3.5 text-center animate-pulse">
                    <p className="text-xs font-black text-white uppercase tracking-widest">
                        🎤 YOU ARE LIVE ON STAGE! ({myEntry.song_title})
                    </p>
                </div>
            )
        }
        return (
            <div className="mb-4 bg-blue-950/30 border border-blue-500/35 rounded-2xl p-3 flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold text-blue-300 uppercase tracking-widest">
                    🎟️ Rotation Position: <span className="text-white">#{myRotationIndex + 1}</span>
                </span>
                <span className="text-[10px] font-bold text-gray-300 truncate max-w-[180px]">
                    Up Next: {myEntry.song_title}
                </span>
            </div>
        )
    }

    if (isLoading) return <div className="text-white text-center py-20 animate-pulse">Connecting to Stage...</div>

    if (!currentUser) {
        return (
            <div className="max-w-md mx-auto p-6 animate-fade-in pb-20">
                <div className="bg-yellow-500 p-8 rounded-3xl text-center shadow-[0_0_50px_rgba(234,179,8,0.3)] mb-8">
                    <span className="text-5xl block mb-2">🎫</span>
                    <h2 className="text-4xl font-['Bebas_Neue'] text-black tracking-widest leading-none mb-1">Guest Pass</h2>
                    <p className="text-[10px] text-yellow-900 font-bold uppercase tracking-widest">No App Download Required</p>
                </div>
                <form onSubmit={handleCreateGuest} className="space-y-4">
                    <div>
                        <label className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1 block">Your Name</label>
                        <input
                            type="text"
                            required
                            value={tempName}
                            onChange={e => setTempName(e.target.value)}
                            className="w-full bg-black border border-gray-700 text-white rounded-xl p-4 outline-none focus:border-yellow-500"
                            placeholder="John Doe"
                        />
                    </div>
                    <div>
                        <label className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1 block">Stage Name</label>
                        <input
                            type="text"
                            required
                            value={tempStageName}
                            onChange={e => setTempStageName(e.target.value)}
                            className="w-full bg-black border border-gray-700 text-white rounded-xl p-4 outline-none focus:border-yellow-500"
                            placeholder="J-Dawg"
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={tempLoading}
                        className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-bold py-4 rounded-xl uppercase tracking-widest transition-all mt-4"
                    >
                        {tempLoading ? 'Generating Pass...' : 'Enter the Lobby'}
                    </button>
                </form>
                <div className="mt-8 text-center border-t border-gray-800 pt-6">
                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-2">Already in the scene?</p>
                    <a
                        href="/?mode=login"
                        className="text-xs text-[#00f5ff] hover:text-white font-bold uppercase tracking-widest transition-colors"
                    >
                        Log In with BHNL
                    </a>
                </div>
            </div>
        )
    }

    if (!session)
        return (
            <div className="text-white text-center py-20">
                Session ended.{' '}
                <button onClick={onExit} className="text-blue-400 block w-full mt-4">
                    Return Home
                </button>
            </div>
        )

    if (activeView === 'Menu') {
        return (
            <div className="max-w-md mx-auto p-4 animate-fade-in min-h-[80vh] flex flex-col">
                <div className="text-center mb-6 pt-4">
                    <h2 className="font-['Bebas_Neue'] text-4xl text-white tracking-widest leading-none">
                        {session.title || session.session_title}
                    </h2>
                    <div className="flex items-center justify-center gap-2 mt-2">
                        <span className="text-[10px] text-blue-400 font-bold uppercase tracking-widest bg-blue-900/20 border border-blue-500/30 px-3 py-1 rounded-full">
                            {session.session_type || 'Casual'} Stage Active
                        </span>
                        {session.session_code && (
                            <span className="text-[10px] text-gray-300 font-bold uppercase tracking-widest bg-white/10 border border-white/15 px-3 py-1 rounded-full">
                                Code: {session.session_code}
                            </span>
                        )}
                    </div>
                </div>

                {renderMyQueueBanner()}

                <div className="grid grid-cols-2 gap-4 flex-1">
                    <button
                        onClick={() => setActiveView('Stage')}
                        className="bg-[#090812] border border-gray-800 hover:border-pink-500/50 p-6 rounded-3xl flex flex-col items-center justify-center gap-2 transition-all group col-span-2"
                    >
                        <span className="text-5xl group-hover:scale-110 transition-transform">🎤</span>
                        <span className="text-white text-xl font-bold tracking-wide mt-2">Stage Monitor</span>
                        <span className="text-[10px] text-pink-500 uppercase tracking-widest font-bold">
                            Watch, React &amp; Vote Live
                        </span>
                    </button>

                    <button
                        onClick={() => setActiveView('Setlist')}
                        className="bg-[#090812] border border-gray-800 hover:border-blue-500/50 p-6 rounded-3xl flex flex-col items-center justify-center gap-2 transition-all group"
                    >
                        <span className="text-4xl group-hover:scale-110 transition-transform">📝</span>
                        <span className="text-white font-bold tracking-wide mt-2">Setlist</span>
                        <span className="text-[9px] text-blue-400 uppercase tracking-widest font-bold bg-blue-900/20 px-2 py-0.5 rounded">
                            Side {activeSide}: {userSetlist.length} / 7
                        </span>
                    </button>

                    <button
                        onClick={() => setActiveView('Scoreboard')}
                        className="bg-[#090812] border border-gray-800 hover:border-yellow-500/50 p-6 rounded-3xl flex flex-col items-center justify-center gap-2 transition-all group"
                    >
                        <span className="text-4xl group-hover:scale-110 transition-transform">🏆</span>
                        <span className="text-white font-bold tracking-wide mt-2">Queue &amp; Ranks</span>
                        <span className="text-[9px] text-gray-500 uppercase tracking-widest font-bold">
                            Rotation ({rotationSingers.length})
                        </span>
                    </button>

                    {!isGuest && (
                        <button
                            onClick={() => setActiveView('Items')}
                            className="bg-[#090812] border border-gray-800 hover:border-purple-500/50 p-6 rounded-3xl flex flex-col items-center justify-center gap-2 transition-all group col-span-1"
                        >
                            <span className="text-4xl group-hover:scale-110 transition-transform">🎒</span>
                            <span className="text-white font-bold tracking-wide mt-2">Items</span>
                            <span className="text-[9px] text-purple-400 bg-purple-900/20 px-2 py-0.5 rounded uppercase tracking-widest font-bold">
                                Inventory
                            </span>
                        </button>
                    )}

                    <button
                        onClick={onExit}
                        className={`bg-red-900/10 border border-red-900/30 hover:bg-red-900/40 p-6 rounded-3xl flex flex-col items-center justify-center gap-2 transition-all group ${
                            isGuest ? 'col-span-2' : 'col-span-1'
                        }`}
                    >
                        <span className="text-4xl group-hover:scale-110 transition-transform">🚪</span>
                        <span className="text-red-400 font-bold tracking-wide mt-2">Exit</span>
                    </button>
                </div>

                {isGuest && (
                    <div className="mt-8 pb-8">
                        <button
                            onClick={() => (window.location.href = '/?mode=register')}
                            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-6 rounded-3xl font-['Bebas_Neue'] text-3xl tracking-widest shadow-[0_0_30px_rgba(59,130,246,0.4)] hover:scale-[1.02] transition-transform"
                        >
                            Join Black Hills Nightlife!
                        </button>
                        <p className="text-center text-[10px] text-gray-500 uppercase font-bold tracking-widest mt-3">
                            Save your setlists, unlock items, and track scores permanently.
                        </p>
                    </div>
                )}
            </div>
        )
    }

    if (activeView === 'Setlist') {
        return (
            <div className="max-w-md mx-auto p-4 animate-fade-in pb-20">
                <button
                    onClick={() => setActiveView('Menu')}
                    className="text-[10px] text-gray-400 font-bold uppercase tracking-widest hover:text-white mb-6"
                >
                    ← Back to Menu
                </button>
                <div className="flex items-center justify-between mb-2">
                    <div>
                        <h3 className="text-3xl font-['Bebas_Neue'] text-white tracking-widest leading-none">
                            Setlist · Side {activeSide}
                        </h3>
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">
                            {userSetlist.length} / 7 Songs · Swipe left/right to switch sides
                        </p>
                    </div>
                    <div className="inline-flex rounded-xl p-1 bg-black border border-gray-800">
                        {['A', 'B'].map(side => {
                            const isSelected = activeSide === side
                            const count = side === 'A' ? sideASongs.length : sideBSongs.length
                            return (
                                <button
                                    key={side}
                                    type="button"
                                    onClick={() => handleSwitchSide(side)}
                                    className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${
                                        isSelected
                                            ? 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-lg'
                                            : 'text-gray-500 hover:text-white'
                                    }`}
                                >
                                    Side {side} ({count})
                                </button>
                            )
                        })}
                    </div>
                </div>

                <div
                    data-no-page-swipe="true"
                    onTouchStart={handleSetlistTouchStart}
                    onTouchEnd={handleSetlistTouchEnd}
                    className="space-y-2 mb-6 mt-4 bg-[#090812] border border-gray-800 p-4 rounded-2xl select-none"
                >
                    {userSetlist.length === 0 ? (
                        <p className="text-gray-600 text-xs italic text-center py-4">
                            No songs added to Side {activeSide} yet. Swipe left/right to flip sides.
                        </p>
                    ) : (
                        userSetlist.map((song, i) => (
                            <div
                                key={i}
                                className="flex justify-between items-center bg-black p-3 rounded-xl border border-gray-800"
                            >
                                <div className="truncate pr-2">
                                    <h4 className="text-white font-bold text-sm truncate">
                                        {i + 1}. {song.title}
                                    </h4>
                                    <p className="text-[9px] text-gray-500 uppercase font-bold truncate">{song.artist}</p>
                                </div>
                                <button
                                    onClick={() => removeFromSetlist(i)}
                                    className="w-8 h-8 rounded bg-red-900/20 text-red-500 flex items-center justify-center flex-shrink-0"
                                >
                                    ✕
                                </button>
                            </div>
                        ))
                    )}
                </div>

                <button
                    disabled={userSetlist.length === 0}
                    onClick={submitQueueToHost}
                    className="w-full mb-8 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-800 disabled:text-gray-500 text-white py-4 rounded-xl font-bold uppercase tracking-widest shadow-lg transition-colors"
                >
                    {myEntry ? `🔄 Update My Live Queue with Side ${activeSide}` : `🎤 Submit Side ${activeSide} to Stage`}
                </button>

                <div className="border-t border-gray-800 pt-6">
                    <h4 className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-3">
                        Search Songbook (Add to Side {activeSide})
                    </h4>
                    <form onSubmit={handleSearchSong} className="flex gap-2 mb-4">
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            placeholder="Title or Artist..."
                            className="flex-1 bg-black border border-gray-700 text-white rounded-lg p-3 text-sm outline-none focus:border-blue-500"
                        />
                        <button
                            type="submit"
                            disabled={searching}
                            className="bg-blue-600 text-white px-4 rounded-lg text-xs font-bold uppercase tracking-widest"
                        >
                            {searching ? '...' : 'Find'}
                        </button>
                    </form>
                    <div className="space-y-2">
                        {songResults.map(song => (
                            <div
                                key={song.id}
                                className="flex justify-between items-center bg-[#090812] border border-gray-800 p-3 rounded-xl"
                            >
                                <div className="truncate pr-2">
                                    <h4 className="text-white font-bold text-sm truncate">{song.title}</h4>
                                    <p className="text-[9px] text-gray-500 uppercase font-bold truncate">{song.artist}</p>
                                </div>
                                <button
                                    onClick={() => addToSetlist(song)}
                                    className="bg-gray-800 text-blue-400 hover:bg-blue-600 hover:text-white px-3 py-1.5 rounded text-[10px] font-bold uppercase tracking-widest transition-colors flex-shrink-0"
                                >
                                    + Side {activeSide}
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        )
    }

    if (activeView === 'Items') {
        const pObj = liveProfile || currentUser || {}
        const gems = pObj.inv_gems || {}
        const items = pObj.inv_items || pObj.inventory || {}
        const activeBuffs = pObj.details?.active_buffs || {}
        return (
            <div className="max-w-md mx-auto p-4 animate-fade-in pb-20 space-y-5">
                <button
                    onClick={() => setActiveView('Menu')}
                    className="text-[10px] text-gray-400 font-bold uppercase tracking-widest hover:text-white"
                >
                    ← Back to Menu
                </button>
                <div>
                    <h3 className="text-3xl font-['Bebas_Neue'] text-white tracking-widest mb-1">Your Backpack</h3>
                    <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">Wallet, Gems &amp; Stage Buffs</p>
                </div>

                {/* Active Buffs Banner */}
                {(pObj.multiplier_uses_left > 0 || activeBuffs.microphone || activeBuffs.megaphone) && (
                    <div className="space-y-2">
                        {pObj.multiplier_uses_left > 0 && (
                            <div className="bg-emerald-900/20 border border-emerald-500/40 rounded-xl px-4 py-2.5 flex justify-between items-center text-[10px] font-bold uppercase tracking-widest text-emerald-400">
                                <span>Active L$ Multiplier: x{pObj.active_multiplier}</span>
                                <span>{pObj.multiplier_uses_left} Left</span>
                            </div>
                        )}
                        {activeBuffs.microphone && (
                            <div className="bg-purple-900/20 border border-purple-500/40 rounded-xl px-4 py-2.5 flex justify-between items-center text-[10px] font-bold uppercase tracking-widest text-purple-300">
                                <span>🎤 Microphone Active</span>
                                <span>Next Song Incoming Votes x2</span>
                            </div>
                        )}
                        {activeBuffs.megaphone && (
                            <div className="bg-yellow-900/20 border border-yellow-500/40 rounded-xl px-4 py-2.5 flex justify-between items-center text-[10px] font-bold uppercase tracking-widest text-yellow-300">
                                <span>📢 Megaphone Active</span>
                                <span>Next Song Outgoing Votes x2</span>
                            </div>
                        )}
                    </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                    <div className="bg-black border border-blue-900/30 p-4 rounded-xl">
                        <span className="text-[10px] text-blue-400 font-bold uppercase tracking-widest block mb-1">
                            Lifestyle Points
                        </span>
                        <span className="text-2xl font-['Bebas_Neue'] text-white">{pObj.lifestyle_points || 0} L$</span>
                    </div>
                    <div className="bg-black border border-purple-900/30 p-4 rounded-xl">
                        <span className="text-[10px] text-purple-400 font-bold uppercase tracking-widest block mb-1">
                            KSocial Points
                        </span>
                        <span className="text-2xl font-['Bebas_Neue'] text-white">{pObj.league_monthly || 0} PTS</span>
                    </div>
                </div>

                {/* Consumable Stage Items & Gems */}
                <div className="bg-[#090812] border border-gray-800 p-4 rounded-2xl space-y-3">
                    <h4 className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                        Gems &amp; Stage Consumables
                    </h4>
                    {Object.entries({ ...gems, ...items }).filter(([, qty]) => qty >= 1).length === 0 ? (
                        <p className="text-gray-600 text-xs italic text-center py-3">No gems or stage items in backpack.</p>
                    ) : (
                        <div className="space-y-2">
                            {Object.entries({ ...gems, ...items }).map(([name, qty]) => {
                                if (qty < 1) return null
                                const specKey = Object.keys(CONSUMABLE_CATALOG).find(
                                    k => k.toLowerCase() === name.toLowerCase()
                                )
                                const spec = specKey ? CONSUMABLE_CATALOG[specKey] : null
                                return (
                                    <div
                                        key={name}
                                        className="flex justify-between items-center bg-black p-3 rounded-xl border border-gray-800 gap-2"
                                    >
                                        <div>
                                            <span className="text-white text-sm font-bold block">
                                                {spec?.icon ? `${spec.icon} ` : ''}
                                                {name} <span className="text-gray-400 text-xs">×{qty}</span>
                                            </span>
                                            {spec?.label && (
                                                <span className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">
                                                    {spec.label}
                                                </span>
                                            )}
                                        </div>
                                        {spec && (
                                            <button
                                                onClick={() => handleConsumeInBackpack(name)}
                                                className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors"
                                            >
                                                Consume
                                            </button>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>

                <div className="bg-[#090812] border border-gray-800 p-4 rounded-2xl">
                    <h4 className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-4">Crafting Materials</h4>
                    <div className="space-y-2">
                        <div className="flex justify-between items-center bg-black p-3 rounded-xl border border-gray-800">
                            <span className="text-white text-sm font-bold">Iron Ore</span>
                            <span className="text-gray-400 text-xs font-bold">{pObj.cur_iron || 0}</span>
                        </div>
                        <div className="flex justify-between items-center bg-black p-3 rounded-xl border border-gray-800">
                            <span className="text-white text-sm font-bold">Wood</span>
                            <span className="text-gray-400 text-xs font-bold">{pObj.cur_wood || 0}</span>
                        </div>
                        <div className="flex justify-between items-center bg-black p-3 rounded-xl border border-gray-800">
                            <span className="text-white text-sm font-bold">Stone</span>
                            <span className="text-gray-400 text-xs font-bold">{pObj.cur_stone || 0}</span>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="max-w-md mx-auto p-4 animate-fade-in pb-20">
            <button
                onClick={() => setActiveView('Menu')}
                className="text-[10px] text-gray-400 font-bold uppercase tracking-widest hover:text-white mb-4"
            >
                ← Back to Menu
            </button>

            {renderMyQueueBanner()}

            {activeView === 'Stage' && (
                <div className="space-y-5">
                    {/* 🟢 LIVE STAGE MONITOR */}
                    <div className="bg-[#090812] border-2 border-gray-800 rounded-3xl p-6 text-center relative overflow-hidden shadow-xl">
                        {/* Floating Live Reactions Layer */}
                        <div className="pointer-events-none absolute inset-0 overflow-hidden z-20">
                            {floatingReactions.map(r => (
                                <span
                                    key={r.id}
                                    style={{ left: `${r.leftPct}%` }}
                                    className="absolute bottom-4 text-3xl animate-bounce opacity-90"
                                >
                                    {r.emoji}
                                </span>
                            ))}
                        </div>

                        <h3 className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-6">
                            Live Stage Monitor
                        </h3>

                        {/* 🟢 "Full" Mode Pre-Voting Tap Input */}
                        {activeSinger?.status === 'singing' &&
                            session?.voting_style === 'full' &&
                            activeSinger.user_id !== currentUser?.id && (
                                <div className="mb-8 z-10 relative">
                                    <p className="text-blue-400 font-bold uppercase tracking-widest text-[10px] mb-4 animate-pulse">
                                        Voting is open during performance!
                                    </p>
                                    <button
                                        onClick={handleTapVote}
                                        className="active:scale-95 mx-auto flex flex-col items-center justify-center bg-blue-600 text-white rounded-full w-32 h-32 border-4 border-white/20 shadow-[0_0_20px_rgba(59,130,246,0.5)]"
                                    >
                                        <span className="font-['Bebas_Neue'] text-3xl tracking-widest">TAP</span>
                                    </button>
                                    <p className="text-white font-bold text-xs mt-3">
                                        You&apos;ve tapped <span className="text-blue-400 text-lg">{fullModeTaps}</span> times
                                    </p>
                                </div>
                            )}

                        {activeSinger ? (
                            <div className="animate-fade-in relative z-10">
                                <span className="inline-block px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest mb-4 border bg-[#ff2d78]/20 text-[#ff2d78] border-[#ff2d78]/50">
                                    {activeSinger.status}
                                </span>
                                <h3 className="text-3xl font-['Bebas_Neue'] text-white tracking-widest mb-1">
                                    {activeSinger.singer_name}
                                </h3>
                                <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">
                                    {activeSinger.song_title}
                                </p>
                                {activeSinger.song_artist && (
                                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-0.5">
                                        by {activeSinger.song_artist}
                                    </p>
                                )}
                            </div>
                        ) : (
                            <div className="py-8 relative z-10">
                                <span className="text-4xl opacity-50 mb-4 block">🎤</span>
                                <p className="text-gray-500 font-bold uppercase tracking-widest text-xs">Stage is Empty</p>
                            </div>
                        )}

                        {/* Live Crowd Reaction Bar */}
                        <div className="mt-6 pt-4 border-t border-gray-800/80 relative z-10">
                            <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest mb-2.5">
                                Send Live Stage Hype
                            </p>
                            <div className="flex items-center justify-center gap-2">
                                {REACTION_EMOJIS.map(item => (
                                    <button
                                        key={item.emoji}
                                        type="button"
                                        onClick={() => handleSendReaction(item.emoji)}
                                        className="flex-1 py-2.5 rounded-xl bg-black/80 hover:bg-gray-800 active:scale-90 border border-gray-800 text-xl transition-transform"
                                        title={item.label}
                                    >
                                        {item.emoji}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* 🟢 ON DECK / UP NEXT QUEUE PREVIEW */}
                    {onDeckSingers.length > 0 && (
                        <div className="bg-[#090812] border border-gray-800 rounded-2xl p-4 space-y-2">
                            <h4 className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                                Up Next in Rotation
                            </h4>
                            {onDeckSingers.map((s, idx) => (
                                <div
                                    key={s.id}
                                    className="flex items-center justify-between bg-black/70 border border-gray-800/80 px-3.5 py-2.5 rounded-xl"
                                >
                                    <div className="min-w-0 pr-2">
                                        <span className="text-[9px] font-bold uppercase tracking-widest text-cyan-400 block">
                                            {s.status === 'standby' || idx === 0 ? '🔥 On Deck' : '⏳ In the Hole'}
                                        </span>
                                        <p className="text-white font-bold text-sm truncate">{s.singer_name}</p>
                                    </div>
                                    <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider truncate max-w-[150px]">
                                        {s.song_title}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* 🟢 THE RESULTS DISPLAY */}
                    {activeSinger?.status === 'results' && (
                        <div className="bg-black/60 border border-blue-500/30 rounded-3xl p-8 text-center shadow-[0_0_30px_rgba(59,130,246,0.2)] animate-fade-in mt-6">
                            <h3 className="text-4xl sm:text-5xl font-['Bebas_Neue'] text-white mb-2 leading-none">
                                {activeSinger.singer_name} scored{' '}
                                <span className="text-blue-400">{activeSinger.total_points || 0}</span> Points!
                            </h3>
                            <p className="text-gray-400 font-bold uppercase tracking-widest text-sm mt-4">
                                Total Voters = <span className="text-white">{activeSinger.voter_count || 0}</span>
                            </p>
                        </div>
                    )}

                    {/* 🟢 THE MAIN VOTING MECHANICS */}
                    {activeSinger?.status === 'voting' &&
                        session?.voting_style !== 'none' &&
                        activeSinger.user_id !== currentUser?.id &&
                        !votedFor[activeSinger.id] && (
                            <div className="bg-black/60 border border-[#ff2d78]/30 rounded-3xl p-6 text-center animate-fade-in shadow-[0_0_30px_rgba(255,45,120,0.15)]">
                                {session.voting_style === 'tap' && (
                                    <div className="flex flex-col items-center justify-center">
                                        <h2 className="text-3xl font-['Bebas_Neue'] text-[#ff2d78] tracking-widest mb-2 animate-pulse">
                                            VOTE NOW! ({activeVoteIcon})
                                        </h2>
                                        <button
                                            onClick={handleTapVote}
                                            className="active:scale-95 active:bg-[#d41c5f] flex flex-col items-center justify-center mt-4"
                                            style={{
                                                width: '180px',
                                                height: '180px',
                                                borderRadius: '50%',
                                                background: 'linear-gradient(135deg, #ff2d78, #b347ff)',
                                                border: '4px solid rgba(255,255,255,0.1)',
                                                color: '#fff',
                                                fontFamily: '"Bebas Neue", sans-serif',
                                                fontSize: '42px',
                                                letterSpacing: '4px',
                                                touchAction: 'manipulation',
                                                boxShadow: '0 10px 30px rgba(255, 45, 120, 0.5)'
                                            }}
                                        >
                                            TAP! {activeVoteIcon}
                                        </button>
                                        <div className="mt-6 bg-black/50 px-6 py-2 rounded-2xl border border-[#ff2d78]/30 min-w-[150px]">
                                            <p className="text-[#ff2d78] text-3xl font-['Bebas_Neue'] tracking-widest">
                                                {tapCount}
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {session.voting_style === 'stars' && (
                                    <div className="text-center">
                                        <h3 className="text-2xl font-['Bebas_Neue'] text-blue-400 tracking-widest text-center mb-4">
                                            Rate Performance
                                        </h3>
                                        <div className="flex justify-between gap-2 bg-[#090812] border border-gray-800 p-4 rounded-2xl">
                                            {[1, 2, 3, 4, 5].map(val => (
                                                <button
                                                    key={val}
                                                    onClick={() => setMultiStars(p => ({ ...p, performance: val }))}
                                                    className={`flex-1 aspect-square rounded-xl flex items-center justify-center text-3xl transition-all ${
                                                        multiStars.performance >= val
                                                            ? 'bg-blue-600 text-white scale-110 shadow-[0_0_15px_rgba(37,99,235,0.5)]'
                                                            : 'bg-gray-800 text-gray-600 hover:bg-gray-700'
                                                    }`}
                                                >
                                                    {multiStars.performance >= val ? activeVoteIcon : '☆'}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {(session.voting_style === 'vibe' || session.voting_style === 'full') && (
                                    <div className="text-left">
                                        <h3 className="text-2xl font-['Bebas_Neue'] text-blue-400 tracking-widest text-center mb-4">
                                            Vibe Check
                                        </h3>

                                        {session.voting_style === 'full' && fullModeTaps > 0 && (
                                            <div className="bg-blue-900/20 border border-blue-500/30 p-3 rounded-xl mb-4 text-center">
                                                <p className="text-blue-400 font-bold uppercase tracking-widest text-[10px]">
                                                    Taps Recorded: {fullModeTaps}
                                                </p>
                                            </div>
                                        )}

                                        <div className="space-y-4 bg-[#090812] border border-gray-800 p-4 rounded-2xl">
                                            {[
                                                { key: 'performance', label: 'Vocals', emoji: '🎤' },
                                                { key: 'wow', label: 'Energy', emoji: '🔥' },
                                                { key: 'originality', label: 'Style', emoji: '✨' }
                                            ].map(cat => (
                                                <div key={cat.key}>
                                                    <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest mb-2">
                                                        <span>{cat.emoji}</span> {cat.label}
                                                    </p>
                                                    <div className="flex justify-between gap-1">
                                                        {[1, 2, 3, 4, 5].map(val => (
                                                            <button
                                                                key={val}
                                                                onClick={() =>
                                                                    setMultiStars(p => ({ ...p, [cat.key]: val }))
                                                                }
                                                                className={`flex-1 aspect-square rounded-lg flex items-center justify-center text-lg transition-all ${
                                                                    multiStars[cat.key] >= val
                                                                        ? 'bg-blue-600 text-white scale-105'
                                                                        : 'bg-gray-800 text-gray-600'
                                                                }`}
                                                            >
                                                                {multiStars[cat.key] >= val ? activeVoteIcon : '☆'}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {session.voting_style !== 'tap' && (
                                    <button
                                        onClick={submitFinalVote}
                                        disabled={multiStars.performance === 0}
                                        className="w-full mt-6 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-800 disabled:text-gray-500 text-white py-4 rounded-xl text-xs font-bold uppercase tracking-widest transition-all shadow-lg"
                                    >
                                        Lock In Votes
                                    </button>
                                )}

                                {!hasUsedSupervote && !superVoteActive && (
                                    <button
                                        onClick={activateSuperVote}
                                        className="mt-4 w-full bg-yellow-900/30 border border-yellow-500/50 text-yellow-500 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-yellow-500 hover:text-black transition-colors"
                                    >
                                        ⚡ Use SuperVote (Once Per Session)
                                    </button>
                                )}
                                {superVoteActive && (
                                    <p className="text-yellow-500 text-[10px] font-bold uppercase tracking-widest mt-4 animate-pulse">
                                        ⚡ SuperVote Multiplier Active!
                                    </p>
                                )}
                            </div>
                        )}
                </div>
            )}

            {activeView === 'Scoreboard' && (
                <div className="space-y-6">
                    <div>
                        <h3 className="text-3xl font-['Bebas_Neue'] text-white tracking-widest mb-3">
                            🎤 Up Next Rotation
                        </h3>
                        {rotationSingers.length === 0 ? (
                            <p className="text-gray-500 text-xs uppercase font-bold tracking-widest">
                                Queue is currently empty.
                            </p>
                        ) : (
                            <div className="space-y-2.5">
                                {rotationSingers.map((s, i) => (
                                    <div
                                        key={`rot-${s.id}`}
                                        className={`flex items-center gap-4 border p-3.5 rounded-2xl ${
                                            s.user_id === currentUser?.id
                                                ? 'bg-blue-950/30 border-blue-500/50'
                                                : 'bg-black/40 border-gray-800'
                                        }`}
                                    >
                                        <span className="text-cyan-400 font-['Bebas_Neue'] text-2xl w-7 text-center">
                                            #{i + 1}
                                        </span>
                                        <div className="flex-1 truncate">
                                            <h4 className="text-white font-bold truncate">{s.singer_name}</h4>
                                            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest truncate">
                                                {s.song_title}
                                            </p>
                                        </div>
                                        <span className="text-[9px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full bg-white/10 text-gray-300">
                                            {s.status === 'standby' ? 'On Deck' : s.status}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="border-t border-gray-800 pt-5">
                        <h3 className="text-3xl font-['Bebas_Neue'] text-amber-400 tracking-widest mb-3">
                            🏆 Stage Scoreboard
                        </h3>
                        {singers
                            .filter(s => s.status !== 'pending')
                            .sort((a, b) => (b.total_points || b.score_performance || 0) - (a.total_points || a.score_performance || 0))
                            .map((s, i) => (
                                <div
                                    key={`score-${s.id}`}
                                    className="flex items-center gap-4 bg-black/40 border border-gray-800 p-4 rounded-2xl mb-2.5"
                                >
                                    <span className="text-gray-500 font-['Bebas_Neue'] text-2xl w-6 text-center">
                                        #{i + 1}
                                    </span>
                                    <div className="flex-1 truncate">
                                        <h4 className="text-white font-bold truncate">{s.singer_name}</h4>
                                        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest truncate">
                                            {s.song_title}
                                        </p>
                                    </div>
                                    <div className="flex flex-col items-end">
                                        <span className="text-xl font-['Bebas_Neue'] text-blue-400">
                                            {s.total_points || s.score_performance || 0}
                                        </span>
                                        {s.voter_count > 0 && (
                                            <span className="text-[8px] text-gray-500 uppercase tracking-widest font-bold">
                                                {s.voter_count} Votes
                                            </span>
                                        )}
                                    </div>
                                </div>
                            ))}
                    </div>
                </div>
            )}
        </div>
    )
}
