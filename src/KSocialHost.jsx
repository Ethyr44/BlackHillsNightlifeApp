import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import { toast } from './GlobalToast'
import {
    awardKSocialPoints,
    getSingerRotationOrder,
    withSingerRotationOrder,
    sortSingersForRotation
} from './utils'

export default function KSocialHost({ currentUser, mode, onExit }) {
    const [view, setView] = useState('start_menu')
    const [activeSession, setActiveSession] = useState(null)
    const [isLoading, setIsLoading] = useState(true)
    const [hostTab, setHostTab] = useState('rotation') // 'rotation' | 'standings'

    const [showQR, setShowQR] = useState(false)
    const [showTempQR, setShowTempQR] = useState(false)
    const [showSettingsModal, setShowSettingsModal] = useState(false)
    const [expandedContender, setExpandedContender] = useState(null)
    const [overrideSongTitle, setOverrideSongTitle] = useState('')
    const [overrideSongArtist, setOverrideSongArtist] = useState('')

    const [showAddSingerModal, setShowAddSingerModal] = useState(false)
    const [manualName, setManualName] = useState('')
    const [manualSong, setManualSong] = useState('')
    const [manualArtist, setManualArtist] = useState('')

    const [officialVenues, setOfficialVenues] = useState([])
    const [officialAgencies] = useState(['Independent', 'Black Hills Nightlife', 'Dakota Entertainment'])

    const [sessionTitle, setSessionTitle] = useState('KSocial LIVE!')
    const [stageName, setStageName] = useState(currentUser?.username || '')
    const [agencyName, setAgencyName] = useState('Independent')
    const [venueName, setVenueName] = useState('')
    const [sessionType, setSessionType] = useState(
        mode?.toLowerCase() === 'league' ? 'League' : mode?.toLowerCase() === 'crawl' ? 'Crawl' : 'Casual'
    )
    const [votingStyle, setVotingStyle] = useState('tap')
    const [votingIcon, setVotingIcon] = useState('star')

    const [singers, setSingers] = useState([])
    const [votingTimeLeft, setVotingTimeLeft] = useState(0)
    const [activeVotingSinger, setActiveVotingSinger] = useState(null)

    const pendingSingers = singers.filter(s => s.status === 'pending')
    const rotationSingers = sortSingersForRotation(singers)
    const scoreboardSingers = singers
        .filter(s => s.status !== 'pending')
        .sort((a, b) => (b.total_points || 0) - (a.total_points || 0))

    const isVotingDisabled = activeSession?.voting_style === 'none'

    // 🟢 THE SMOOTH SYNC ENGINE (Broadcasts to both phones and Projector)
    const triggerGlobalSync = async (silent = false) => {
        if (!activeSession?.id) return
        if (!silent) toast.success('Syncing network...')
        await Promise.all([
            supabase
                .channel(`public-ksocial-${activeSession.id}`)
                .send({ type: 'broadcast', event: 'force-reload', payload: {} }),
            supabase
                .channel(`projector-channel-${activeSession.id}`)
                .send({ type: 'broadcast', event: 'force-reload', payload: {} })
        ])
        fetchSingers(activeSession.id)
    }

    useEffect(() => {
        fetchValidationData()
        checkExistingSession()
    }, [])

    useEffect(() => {
        if (!activeSession?.id) return
        fetchSingers(activeSession.id)

        const sub = supabase
            .channel(`host-room-${activeSession.id}`)
            .on(
                'postgres',
                { event: '*', schema: 'public', table: 'session_singers', filter: `session_id=eq.${activeSession.id}` },
                () => fetchSingers(activeSession.id)
            )
            .on('broadcast', { event: 'force-reload' }, () => fetchSingers(activeSession.id))
            .subscribe()

        return () => supabase.removeChannel(sub)
    }, [activeSession?.id])

    useEffect(() => {
        let interval
        if (votingTimeLeft > 0) {
            interval = setInterval(() => setVotingTimeLeft(prev => prev - 1), 1000)
        } else if (votingTimeLeft === 0 && activeVotingSinger) {
            handleSingerAction(activeVotingSinger, 'results')
            setActiveVotingSinger(null)
        }
        return () => clearInterval(interval)
    }, [votingTimeLeft, activeVotingSinger])

    const fetchValidationData = async () => {
        const { data } = await supabase.from('pages').select('name').eq('page_type', 'Venue').order('name')
        if (data) setOfficialVenues(data.map(v => v.name))
    }

    const checkExistingSession = async () => {
        const { data } = await supabase
            .from('active_sessions')
            .select('*')
            .eq('host_id', currentUser.id)
            .maybeSingle()
        if (data) {
            setActiveSession(data)
            setView('dashboard')
            setSessionTitle(data.title || data.session_title || 'KSocial LIVE!')
            setVotingStyle(data.voting_style || 'tap')
            setVotingIcon(data.voting_icon || 'star')
            if (data.session_type) setSessionType(data.session_type)
        }
        setIsLoading(false)
    }

    const fetchSingers = async (sessId) => {
        const { data } = await supabase.from('session_singers').select('*').eq('session_id', sessId)
        if (data) {
            setSingers(data)
            setExpandedContender(prev => (prev ? data.find(s => s.id === prev.id) || null : null))
        }
    }

    const initializeSession = async () => {
        const isCasual = sessionType === 'Casual'
        if (!isCasual && !venueName) return toast.error('You must select an official Venue.')
        if (!isCasual && !agencyName) return toast.error('You must select an Agency.')

        setIsLoading(true)
        const newCode = Math.random().toString(36).substring(2, 8).toUpperCase()
        const effectiveTitle = (sessionTitle || '').trim() || (isCasual ? 'Casual KSocial Stage' : 'KSocial LIVE!')
        const effectiveHost = (stageName || '').trim() || currentUser?.username || 'Casual Host'
        const effectiveAgency = (agencyName || '').trim() || (isCasual ? 'Casual / Independent' : 'Independent')
        const effectiveVenue = (venueName || '').trim() || (isCasual ? 'Casual Session (Anywhere)' : '')

        // If launching in Crawl mode, look up the active tournament so this stage docks into KCrawlManager
        let activeTournamentId = null
        if (sessionType === 'Crawl') {
            const { data: activeCrawl } = await supabase
                .from('active_tournaments')
                .select('id')
                .eq('status', 'active')
                .maybeSingle()
            if (activeCrawl?.id) activeTournamentId = activeCrawl.id
        }

        const basePayload = {
            host_id: currentUser.id,
            session_code: newCode,
            title: effectiveTitle,
            host_name: effectiveHost,
            business_name: effectiveAgency,
            venue_name: effectiveVenue,
            status: 'active',
            voting_style: votingStyle,
            voting_icon: votingIcon,
            supervotes_allowed: 1,
            session_type: sessionType,
            ...(activeTournamentId ? { tournament_id: activeTournamentId } : {})
        }

        let { data, error } = await supabase.from('active_sessions').insert([basePayload]).select().single()
        if (error && activeTournamentId) {
            const { tournament_id, ...fallbackPayload } = basePayload
            const retry = await supabase.from('active_sessions').insert([fallbackPayload]).select().single()
            data = retry.data
            error = retry.error
        }

        if (error) toast.error(`Launch Error: ${error.message}`)
        else if (data) {
            setActiveSession(data)
            setView('dashboard')
            // Only publish a public venue event if an official venue was chosen
            if (venueName && venueName.trim()) {
                await supabase.from('events').insert([
                    {
                        title: effectiveTitle,
                        venue: venueName,
                        event_type: 'Karaoke',
                        event_date: new Date().toISOString(),
                        end_date: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
                        host_id: currentUser.id,
                        created_by: currentUser.id,
                        status: 'approved',
                        description: `🎤 LIVE NOW! The Stage is open at ${venueName}. Join the queue!`
                    }
                ])
            }
            triggerGlobalSync(true)
        }
        setIsLoading(false)
    }

    const updateSessionSettings = async () => {
        const payload = { title: sessionTitle, voting_style: votingStyle, voting_icon: votingIcon }
        const { error } = await supabase.from('active_sessions').update(payload).eq('id', activeSession.id)
        if (error) {
            toast.error('Error updating settings: ' + error.message)
            return
        }
        setActiveSession({ ...activeSession, ...payload })
        setShowSettingsModal(false)
        triggerGlobalSync(true)
    }

    const closeSession = async () => {
        if (!window.confirm('End this session? All singers and scores will be wiped.')) return

        const { error: singersError } = await supabase.from('session_singers').delete().eq('session_id', activeSession.id)
        if (singersError) {
            toast.error('Error clearing singers: ' + singersError.message)
        }

        const { error: sessionError } = await supabase.from('active_sessions').delete().eq('id', activeSession.id)
        if (sessionError) {
            toast.error('Error closing session: ' + sessionError.message)
            return
        }

        setActiveSession(null)
        setView('start_menu')
        if (onExit) onExit()
    }

    const handleApproveRequest = async (id, isApproved) => {
        let error
        if (isApproved) {
            const target = singers.find(s => s.id === id)
            const stampedSetlist = withSingerRotationOrder(target?.setlist, Date.now())
            const { error: updateError } = await supabase
                .from('session_singers')
                .update({ status: 'queued', setlist: stampedSetlist })
                .eq('id', id)
            error = updateError
            if (!error) toast.success('Contender added to rotation!')
        } else {
            const { error: deleteError } = await supabase.from('session_singers').delete().eq('id', id)
            error = deleteError
        }
        if (error) {
            toast.error('DB Error: ' + error.message)
            return
        }
        triggerGlobalSync(true)
    }

    const handleAddManualSinger = async (e) => {
        e.preventDefault()
        if (!manualName || !manualSong) return toast.error('Name and Song Title are required.')

        const payload = {
            session_id: activeSession.id,
            user_id: null,
            singer_name: manualName + ' (Walk-up)',
            song_id: 'manual-entry',
            song_title: manualSong,
            song_artist: manualArtist || 'Unknown Artist',
            setlist: withSingerRotationOrder(
                [{ id: 'manual-entry', title: manualSong, artist: manualArtist || 'Unknown Artist' }],
                Date.now()
            ),
            status: 'queued',
            user_type: 'Walk-up'
        }

        const { data, error } = await supabase.from('session_singers').insert([payload]).select().single()

        if (error) {
            return toast.error(`Database Error: ${error.message}`)
        }

        if (data) {
            setSingers(prev => [...prev, data])
        }

        setManualName('')
        setManualSong('')
        setManualArtist('')
        setShowAddSingerModal(false)
        triggerGlobalSync(true)
        toast.success('Walk-up added to rotation!')
    }

    const handleRemoveSinger = async (singer, e) => {
        if (e) e.stopPropagation()
        if (!singer) return
        if (!window.confirm(`Remove ${singer.singer_name} from the stage rotation?`)) return

        const { error } = await supabase.from('session_singers').delete().eq('id', singer.id)
        if (error) {
            toast.error('Failed to remove singer: ' + error.message)
            return
        }
        setSingers(prev => prev.filter(s => s.id !== singer.id))
        if (expandedContender?.id === singer.id) setExpandedContender(null)
        triggerGlobalSync(true)
        toast.success(`${singer.singer_name} removed from rotation.`)
    }

    const handleMoveSinger = async (singerId, direction) => {
        const queuedOnly = rotationSingers.filter(s => s.status === 'queued')
        const idx = queuedOnly.findIndex(s => s.id === singerId)
        if (idx === -1) return
        const targetIdx = direction === 'up' ? idx - 1 : idx + 1
        if (targetIdx < 0 || targetIdx >= queuedOnly.length) return

        const normalizedOrders = queuedOnly.map((s, i) => {
            const raw = getSingerRotationOrder(s, i)
            return raw + i
        })

        const singerA = queuedOnly[idx]
        const singerB = queuedOnly[targetIdx]
        const orderA = normalizedOrders[idx]
        const orderB = normalizedOrders[targetIdx]

        const newOrderForA = orderB === orderA ? (direction === 'up' ? orderB - 10 : orderB + 10) : orderB
        const newOrderForB = orderB === orderA ? orderA : orderA

        const setlistA = withSingerRotationOrder(singerA.setlist, newOrderForA)
        const setlistB = withSingerRotationOrder(singerB.setlist, newOrderForB)

        await Promise.all([
            supabase.from('session_singers').update({ setlist: setlistA }).eq('id', singerA.id),
            supabase.from('session_singers').update({ setlist: setlistB }).eq('id', singerB.id)
        ])

        triggerGlobalSync(true)
    }

    const handleSelectNextSongForContender = async (singer, songIndex) => {
        if (!singer || !Array.isArray(singer.setlist) || !singer.setlist[songIndex]) return
        const chosen = singer.setlist[songIndex]
        const rest = singer.setlist.filter((_, idx) => idx !== songIndex)
        const currentRotOrder = getSingerRotationOrder(singer, 0)
        const reordered = withSingerRotationOrder([chosen, ...rest], currentRotOrder)

        const { error } = await supabase
            .from('session_singers')
            .update({
                song_id: chosen.id || 'manual-entry',
                song_title: chosen.title,
                song_artist: chosen.artist || 'Unknown Artist',
                setlist: reordered
            })
            .eq('id', singer.id)

        if (error) {
            toast.error('Failed to switch song: ' + error.message)
            return
        }
        toast.success(`Switched ${singer.singer_name}'s next song to "${chosen.title}"!`)
        triggerGlobalSync(true)
    }

    const handleOverrideContenderSong = async (e) => {
        e.preventDefault()
        if (!expandedContender || !overrideSongTitle.trim()) return

        const customSong = {
            id: 'manual-entry',
            title: overrideSongTitle.trim(),
            artist: overrideSongArtist.trim() || 'Custom Request'
        }
        const currentRotOrder = getSingerRotationOrder(expandedContender, 0)
        const existingList = Array.isArray(expandedContender.setlist) ? expandedContender.setlist : []
        const updatedSetlist = withSingerRotationOrder([customSong, ...existingList], currentRotOrder)

        const { error } = await supabase
            .from('session_singers')
            .update({
                song_id: customSong.id,
                song_title: customSong.title,
                song_artist: customSong.artist,
                setlist: updatedSetlist
            })
            .eq('id', expandedContender.id)

        if (error) {
            toast.error('Failed to override song: ' + error.message)
            return
        }
        setOverrideSongTitle('')
        setOverrideSongArtist('')
        toast.success(`Set "${customSong.title}" as ${expandedContender.singer_name}'s active song!`)
        triggerGlobalSync(true)
    }

    const handleSingerAction = async (singerId, action) => {
        if (action === 'voting') {
            const { error } = await supabase.from('session_singers').update({ status: 'voting' }).eq('id', singerId)
            if (error) return toast.error('Action failed: ' + error.message)

            setActiveVotingSinger(singerId)
            setVotingTimeLeft(30)
            triggerGlobalSync(true)
        } else if (action === 'complete') {
            const singer = singers.find(s => s.id === singerId)
            if (!singer) return

            if (singer.user_id) {
                const { error: rpcError } = await supabase.rpc('mark_song_sung', {
                    p_user_id: singer.user_id,
                    p_song_id: singer.song_id
                })
                if (rpcError) console.warn('mark_song_sung warning:', rpcError.message)

                // Award +25 KSocial Points per song sung & clear single-song Microphone buff
                await awardKSocialPoints(supabase, singer.user_id, 25, {
                    title: 'Song Completed (+25 KSocial PTS)',
                    clearMicrophoneBuff: true
                })
            }

            const currentSetlist = Array.isArray(singer.setlist) ? singer.setlist : []
            let nextSetlist = []
            let nextSong = { id: 'manual-entry', title: 'TBD', artist: 'TBD' }

            if (currentSetlist.length > 1) {
                nextSetlist = currentSetlist.slice(1)
                nextSong = nextSetlist[0]
            } else {
                nextSong = { id: 'finished', title: 'Finished Set', artist: 'Needs new songs' }
                nextSetlist = [nextSong]
            }

            // Stamp new rotation order (Date.now()) so completed singer cycles to the bottom of the queue
            const rotatedSetlist = withSingerRotationOrder(nextSetlist, Date.now())

            const { error } = await supabase
                .from('session_singers')
                .update({
                    status: 'queued',
                    song_id: nextSong.id,
                    song_title: nextSong.title,
                    song_artist: nextSong.artist,
                    setlist: rotatedSetlist,
                    previous_score: singer.score_performance || 0,
                    score_performance: 0,
                    score_wow: 0,
                    score_originality: 0,
                    super_votes: 0
                })
                .eq('id', singerId)

            if (error) return toast.error('Failed to cycle: ' + error.message)
            triggerGlobalSync(true)
        } else {
            const { error } = await supabase.from('session_singers').update({ status: action }).eq('id', singerId)
            if (error) return toast.error('Action failed: ' + error.message)
            triggerGlobalSync(true)
        }
    }

    if (isLoading) return <div className="text-white text-center py-20 animate-pulse">Initializing System...</div>

    if (view === 'start_menu') {
        const isCasual = sessionType === 'Casual'
        return (
            <div className="max-w-md mx-auto animate-fade-in p-6 pb-24">
                <h2 className="text-4xl font-['Bebas_Neue'] text-blue-400 tracking-widest text-center mb-4">Initialize Stage</h2>
                {isCasual && (
                    <div className="mb-5 bg-cyan-950/30 border border-cyan-500/30 rounded-xl p-3 text-center">
                        <p className="text-[11px] font-bold text-cyan-300 uppercase tracking-widest">
                            🍹 Casual Mode — Instant Launch
                        </p>
                        <p className="text-[11px] text-gray-400 mt-0.5">
                            No Venue, Host/Agency, or mandatory fields required. Hit <span className="text-white font-bold">Go Live</span> anytime for fun &amp; debugging!
                        </p>
                    </div>
                )}
                <div className="space-y-4">
                    <div>
                        <label className="text-xs text-gray-500 font-bold uppercase block mb-1">
                            Session Title {isCasual && <span className="text-gray-600">(Optional)</span>}
                        </label>
                        <input
                            type="text"
                            value={sessionTitle}
                            onChange={e => setSessionTitle(e.target.value)}
                            placeholder={isCasual ? 'Casual KSocial Stage' : 'KSocial LIVE!'}
                            className="w-full bg-black border border-gray-800 text-white p-4 rounded-xl outline-none focus:border-blue-500"
                        />
                    </div>
                    <div>
                        <label className="text-xs text-gray-500 font-bold uppercase block mb-1">
                            Host Stage Name {isCasual && <span className="text-gray-600">(Optional)</span>}
                        </label>
                        <input
                            type="text"
                            value={stageName}
                            onChange={e => setStageName(e.target.value)}
                            placeholder={currentUser?.username || 'Casual Host'}
                            className="w-full bg-black border border-gray-800 text-white p-4 rounded-xl outline-none focus:border-blue-500"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-[10px] text-gray-500 font-bold uppercase block mb-1">
                                Agency {isCasual && <span className="text-gray-600">(Optional)</span>}
                            </label>
                            <select
                                value={agencyName}
                                onChange={e => setAgencyName(e.target.value)}
                                className="w-full bg-black border border-gray-700 text-white p-3 rounded-lg outline-none focus:border-blue-500"
                            >
                                {isCasual ? (
                                    <option value="">None / Casual</option>
                                ) : (
                                    <option value="" disabled>Select Agency</option>
                                )}
                                {officialAgencies.map(a => (
                                    <option key={a} value={a}>{a}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="text-[10px] text-gray-500 font-bold uppercase block mb-1">
                                Venue {isCasual && <span className="text-gray-600">(Optional)</span>}
                            </label>
                            <select
                                value={venueName}
                                onChange={e => setVenueName(e.target.value)}
                                className="w-full bg-black border border-gray-700 text-white p-3 rounded-lg outline-none focus:border-blue-500"
                            >
                                {isCasual ? (
                                    <option value="">No Venue (Anywhere)</option>
                                ) : (
                                    <option value="" disabled>Select Venue</option>
                                )}
                                {officialVenues.map(v => (
                                    <option key={v} value={v}>{v}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="bg-[#090812] border border-gray-800 p-4 rounded-xl space-y-4">
                        <h4 className="text-white font-bold uppercase tracking-widest text-[10px]">Session Mode</h4>
                        <div>
                            <select
                                value={sessionType}
                                onChange={e => setSessionType(e.target.value)}
                                className="w-full bg-black border border-gray-700 text-white p-3 rounded-lg text-sm font-bold outline-none focus:border-blue-500"
                            >
                                <option value="Casual">Casual (No Mandatory Details / Fun &amp; Debug)</option>
                                <option value="League">League (Voting Enabled)</option>
                                <option value="Crawl">Karaoke Crawl (Sync to Hub)</option>
                            </select>
                        </div>

                        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-800">
                            <div>
                                <label className="text-[10px] text-gray-500 font-bold uppercase block mb-1">Voting Style</label>
                                <select
                                    value={votingStyle}
                                    onChange={e => setVotingStyle(e.target.value)}
                                    className="w-full bg-black border border-gray-700 text-white p-2 rounded-lg outline-none focus:border-blue-500"
                                >
                                    <option value="tap">Tap-to-Vote (Multi-tap)</option>
                                    <option value="stars">1-5 Rating (Classic)</option>
                                    <option value="vibe">Vibe Check (Categories)</option>
                                    <option value="full">Full (Tap + Vibe Check)</option>
                                    <option value="none">None (Queue Only / No Voting)</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-[10px] text-gray-500 font-bold uppercase block mb-1">Voting Icon</label>
                                <select
                                    value={votingIcon}
                                    onChange={e => setVotingIcon(e.target.value)}
                                    className="w-full bg-black border border-gray-700 text-white p-2 rounded-lg outline-none focus:border-blue-500"
                                >
                                    <option value="star">⭐ Stars</option>
                                    <option value="fire">🔥 Fire</option>
                                    <option value="beer">🍻 Cheers</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <div className="pt-4 flex gap-3">
                        <button
                            onClick={onExit}
                            className="flex-1 border border-gray-700 text-gray-400 py-4 rounded-xl font-bold uppercase tracking-widest hover:text-white transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={initializeSession}
                            className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-4 rounded-xl font-bold uppercase tracking-widest shadow-[0_0_15px_rgba(37,99,235,0.4)] transition-colors"
                        >
                            Go Live
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    const displayedSingers = hostTab === 'standings' ? scoreboardSingers : rotationSingers
    const queuedSingersList = rotationSingers.filter(s => s.status === 'queued')

    return (
        <div className="animate-fade-in pb-20 flex flex-col lg:flex-row gap-6 p-4 max-w-7xl mx-auto">
            <div className="flex-1 space-y-6">
                <div className="bg-[#090812] border-2 border-blue-900/30 p-4 rounded-3xl flex flex-wrap justify-between items-center shadow-lg gap-4">
                    <div>
                        <h2 className="font-['Bebas_Neue'] text-3xl text-white tracking-widest leading-none">
                            {activeSession.title || activeSession.session_title}
                        </h2>
                        <span className="text-[10px] text-green-400 font-bold uppercase tracking-widest animate-pulse">
                            ● {activeSession.session_type || 'Casual'} Live
                        </span>
                    </div>
                    <div className="flex flex-wrap gap-2 items-center">
                        <button onClick={() => setShowSettingsModal(true)} className="text-gray-400 hover:text-white text-xl mr-2">⚙️</button>
                        <button
                            onClick={() =>
                                window.open(
                                    `/?tab=Projector&session=${activeSession.id}`,
                                    'Projector',
                                    'width=1280,height=720,popup=yes,menubar=no,toolbar=no'
                                )
                            }
                            className="bg-white/10 text-white border border-white/20 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-white hover:text-black transition-colors"
                        >
                            Projector
                        </button>
                        <button
                            onClick={() => setShowTempQR(true)}
                            className="bg-yellow-900/30 text-yellow-500 border border-yellow-500/50 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-yellow-500 hover:text-black transition-colors"
                        >
                            Temp QR
                        </button>
                        <button
                            onClick={() => setShowQR(true)}
                            className="bg-blue-900/30 text-blue-400 border border-blue-500/50 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-blue-600 hover:text-white transition-colors"
                        >
                            BHNL QR
                        </button>
                        <button
                            onClick={() => triggerGlobalSync()}
                            className="bg-orange-900/30 text-orange-400 border border-orange-500/50 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-orange-600 hover:text-white transition-colors"
                        >
                            Force Sync
                        </button>
                        <button
                            onClick={closeSession}
                            className="bg-red-900/30 text-red-500 border border-red-500/50 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-red-600 hover:text-white transition-colors"
                        >
                            End
                        </button>
                    </div>
                </div>

                {pendingSingers.length > 0 && (
                    <div className="bg-yellow-900/10 border border-yellow-500/30 rounded-3xl p-4 shadow-[0_0_15px_rgba(234,179,8,0.1)]">
                        <h4 className="text-yellow-500 font-bold uppercase tracking-widest text-[10px] mb-3">
                            Pending Contenders ({pendingSingers.length})
                        </h4>
                        {pendingSingers.map(ps => (
                            <div
                                key={ps.id}
                                className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-black border border-yellow-900/50 p-3 rounded-xl mb-2 gap-3"
                            >
                                <div>
                                    <p className="text-white font-bold text-sm">{ps.singer_name}</p>
                                    <p className="text-[10px] text-gray-400 uppercase tracking-widest truncate max-w-[200px]">
                                        <span className="text-gray-200">{ps.setlist?.length || 1} Songs</span> • Starts w/ {ps.song_title}
                                    </p>
                                </div>
                                <div className="flex gap-2 w-full sm:w-auto">
                                    <button
                                        onClick={() => handleApproveRequest(ps.id, false)}
                                        className="flex-1 bg-red-900/20 text-red-500 border border-red-900/50 px-4 py-2 rounded-lg text-[10px] font-bold uppercase hover:bg-red-500 hover:text-white transition-colors"
                                    >
                                        Reject
                                    </button>
                                    <button
                                        onClick={() => handleApproveRequest(ps.id, true)}
                                        className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg text-[10px] font-bold uppercase shadow-[0_0_10px_rgba(34,197,94,0.4)] hover:bg-green-500 transition-colors"
                                    >
                                        Approve
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                <div className="bg-black/40 border border-gray-800 rounded-3xl p-4 sm:p-6">
                    <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
                        <div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setHostTab('rotation')}
                                    className={`px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${
                                        hostTab === 'rotation'
                                            ? 'bg-blue-600 text-white shadow-md'
                                            : 'bg-gray-900 text-gray-400 hover:text-white'
                                    }`}
                                >
                                    🎤 Queue Rotation ({rotationSingers.length})
                                </button>
                                <button
                                    onClick={() => setHostTab('standings')}
                                    className={`px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${
                                        hostTab === 'standings'
                                            ? 'bg-amber-500 text-black shadow-md'
                                            : 'bg-gray-900 text-gray-400 hover:text-white'
                                    }`}
                                >
                                    🏆 Live Standings
                                </button>
                            </div>
                            <span className="block text-[10px] text-gray-500 mt-2 font-bold uppercase tracking-widest">
                                Room Code: <span className="text-white">{activeSession.session_code}</span>
                            </span>
                        </div>

                        <button
                            onClick={() => setShowAddSingerModal(true)}
                            className="bg-purple-900/30 text-purple-400 hover:bg-purple-600 hover:text-white border border-purple-500/50 px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-colors"
                        >
                            ➕ Add Walk-up
                        </button>
                    </div>

                    <div className="space-y-3">
                        {displayedSingers.length === 0 ? (
                            <p className="text-center text-gray-600 text-xs font-bold uppercase tracking-widest py-8">
                                Rotation Empty
                            </p>
                        ) : (
                            displayedSingers.map((singer, index) => {
                                const isBlocked =
                                    rotationSingers.some(
                                        s => s.status === 'standby' || s.status === 'singing' || s.status === 'voting'
                                    ) && singer.status === 'queued'
                                const queuedIdx = queuedSingersList.findIndex(s => s.id === singer.id)
                                const canMoveUp = hostTab === 'rotation' && singer.status === 'queued' && queuedIdx > 0
                                const canMoveDown =
                                    hostTab === 'rotation' &&
                                    singer.status === 'queued' &&
                                    queuedIdx !== -1 &&
                                    queuedIdx < queuedSingersList.length - 1

                                return (
                                    <div
                                        key={singer.id}
                                        className={`p-4 rounded-2xl border transition-all flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 ${
                                            singer.status === 'standby'
                                                ? 'bg-yellow-900/20 border-yellow-500 shadow-[0_0_15px_rgba(234,179,8,0.2)]'
                                                : singer.status === 'singing'
                                                ? 'bg-[#ff2d78]/10 border-[#ff2d78] shadow-[0_0_15px_rgba(255,45,120,0.2)]'
                                                : singer.status === 'voting'
                                                ? 'bg-blue-900/20 border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.2)]'
                                                : singer.status === 'results'
                                                ? 'bg-gray-900 border-gray-700'
                                                : 'bg-[#090812] border-gray-800'
                                        }`}
                                    >
                                        <div className="flex items-center gap-3 min-w-0">
                                            {/* Queue Reorder Arrows */}
                                            {hostTab === 'rotation' && singer.status === 'queued' && (
                                                <div className="flex flex-col gap-1 flex-shrink-0">
                                                    <button
                                                        type="button"
                                                        disabled={!canMoveUp}
                                                        onClick={() => handleMoveSinger(singer.id, 'up')}
                                                        title="Move Up in Queue"
                                                        className="w-6 h-5 rounded bg-gray-800 hover:bg-gray-700 disabled:opacity-25 text-[9px] text-gray-300 flex items-center justify-center"
                                                    >
                                                        ▲
                                                    </button>
                                                    <button
                                                        type="button"
                                                        disabled={!canMoveDown}
                                                        onClick={() => handleMoveSinger(singer.id, 'down')}
                                                        title="Move Down in Queue"
                                                        className="w-6 h-5 rounded bg-gray-800 hover:bg-gray-700 disabled:opacity-25 text-[9px] text-gray-300 flex items-center justify-center"
                                                    >
                                                        ▼
                                                    </button>
                                                </div>
                                            )}

                                            <div className="w-10 h-10 rounded-xl bg-black border border-gray-700 flex items-center justify-center text-gray-400 font-['Bebas_Neue'] text-2xl flex-shrink-0 shadow-inner">
                                                #{index + 1}
                                            </div>
                                            <div className="truncate pr-2">
                                                <h4 className="text-white font-bold text-lg leading-tight truncate">
                                                    {singer.singer_name}
                                                </h4>
                                                <p className="text-gray-400 text-[10px] font-bold uppercase tracking-widest truncate">
                                                    {singer.song_title}
                                                    {singer.song_artist ? ` — ${singer.song_artist}` : ''}
                                                </p>

                                                <div className="mt-1.5 flex flex-wrap gap-2">
                                                    <span className="text-gray-500 text-[9px] font-bold uppercase border border-gray-700 bg-black px-2 py-0.5 rounded">
                                                        Prev Score: {singer.previous_score || 0}
                                                    </span>
                                                    {singer.status === 'standby' && (
                                                        <span className="text-yellow-400 text-[9px] font-bold uppercase border border-yellow-500/40 bg-yellow-500/15 px-2 py-0.5 rounded">
                                                            ON DECK
                                                        </span>
                                                    )}
                                                    {singer.status === 'singing' && (
                                                        <span className="text-[#ff2d78] text-[9px] font-bold uppercase animate-pulse border border-[#ff2d78]/30 bg-[#ff2d78]/20 px-2 py-0.5 rounded">
                                                            ON STAGE
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex gap-2 w-full sm:w-auto mt-2 sm:mt-0 flex-shrink-0 justify-end items-center">
                                            <button
                                                onClick={() => setExpandedContender(singer)}
                                                title="View / Edit Setlist"
                                                className="w-10 h-10 rounded-xl bg-gray-800 text-gray-400 flex items-center justify-center hover:bg-gray-700 hover:text-white transition-colors border border-gray-700 shadow-md"
                                            >
                                                👁️
                                            </button>
                                            <button
                                                onClick={(e) => handleRemoveSinger(singer, e)}
                                                title="Remove Singer from Queue"
                                                className="w-10 h-10 rounded-xl bg-red-950/30 text-red-400 flex items-center justify-center hover:bg-red-600 hover:text-white transition-colors border border-red-900/40 shadow-md text-xs"
                                            >
                                                🗑️
                                            </button>

                                            <div className="flex flex-col items-end mr-2 ml-2">
                                                <span className="text-2xl font-['Bebas_Neue'] text-blue-400 leading-none">
                                                    {singer.total_points || 0}
                                                </span>
                                                <span className="text-[8px] text-gray-500 font-bold uppercase tracking-widest leading-tight">
                                                    Total<br />Score
                                                </span>
                                            </div>

                                            {singer.status === 'singing' && !isVotingDisabled && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleSingerAction(singer.id, 'complete')}
                                                    title="Finish song without opening voting"
                                                    className="px-3 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white border border-gray-700 transition-all"
                                                >
                                                    Skip Vote
                                                </button>
                                            )}

                                            <button
                                                disabled={isBlocked}
                                                onClick={() => {
                                                    if (singer.status === 'queued') handleSingerAction(singer.id, 'standby')
                                                    else if (singer.status === 'standby') handleSingerAction(singer.id, 'singing')
                                                    else if (singer.status === 'singing') {
                                                        if (isVotingDisabled) {
                                                            handleSingerAction(singer.id, 'complete')
                                                        } else {
                                                            handleSingerAction(singer.id, 'voting')
                                                        }
                                                    } else if (singer.status === 'voting') {
                                                        setVotingTimeLeft(0)
                                                        setActiveVotingSinger(null)
                                                        handleSingerAction(singer.id, 'results')
                                                    } else if (singer.status === 'results') {
                                                        handleSingerAction(singer.id, 'complete')
                                                    }
                                                }}
                                                className={`min-w-[90px] px-4 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all shadow-lg ${
                                                    singer.status === 'queued'
                                                        ? 'bg-gray-800 text-gray-400 hover:bg-white hover:text-black'
                                                        : singer.status === 'standby'
                                                        ? 'bg-yellow-500 text-black'
                                                        : singer.status === 'singing'
                                                        ? 'bg-[#ff2d78] text-white'
                                                        : singer.status === 'voting'
                                                        ? 'bg-blue-600 text-white animate-pulse'
                                                        : singer.status === 'results'
                                                        ? 'bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white'
                                                        : 'bg-gray-800 text-gray-600'
                                                }`}
                                            >
                                                {singer.status === 'queued'
                                                    ? 'Ready'
                                                    : singer.status === 'standby'
                                                    ? 'Play'
                                                    : singer.status === 'singing'
                                                    ? isVotingDisabled
                                                        ? 'Finish / Next'
                                                        : 'Vote'
                                                    : singer.status === 'voting'
                                                    ? `${votingTimeLeft}s (Skip)`
                                                    : singer.status === 'results'
                                                    ? 'Next'
                                                    : '▶'}
                                            </button>
                                        </div>
                                    </div>
                                )
                            })
                        )}
                    </div>
                </div>
            </div>

            <div className="hidden lg:block w-[400px] flex-shrink-0">
                <h3 className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-3 ml-2">
                    Projector Output Monitor
                </h3>
                <div className="w-[400px] h-[225px] bg-black rounded-2xl border-4 border-gray-800 shadow-[0_0_30px_rgba(0,0,0,0.8)] overflow-hidden relative group">
                    <div className="absolute inset-0 bg-[#090812] pointer-events-none flex flex-col items-center justify-center p-4 text-center">
                        <h2 className="text-4xl font-['Bebas_Neue'] text-blue-400 tracking-widest mb-2 opacity-50">
                            {activeSession.title || activeSession.session_title}
                        </h2>
                        <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Screen Cast Ready</p>
                        <div className="mt-4 flex items-center justify-center gap-2 text-[#ff2d78] animate-pulse">
                            <span className="w-2 h-2 bg-[#ff2d78] rounded-full"></span> Live
                        </div>
                    </div>
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm">
                        <button
                            onClick={() =>
                                window.open(
                                    `/?tab=Projector&session=${activeSession.id}`,
                                    'Projector',
                                    'width=1280,height=720,popup=yes,menubar=no,toolbar=no'
                                )
                            }
                            className="bg-blue-600 text-white px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest shadow-lg hover:bg-blue-500 transition-colors"
                        >
                            Open Fullscreen
                        </button>
                    </div>
                </div>
            </div>

            {expandedContender && (
                <div
                    onClick={() => setExpandedContender(null)}
                    className="fixed inset-0 bg-black/90 z-[200] flex items-center justify-center p-4 animate-fade-in backdrop-blur-md"
                >
                    <div
                        onClick={e => e.stopPropagation()}
                        className="bg-[#090812] p-6 rounded-3xl border-2 border-gray-800 w-full max-w-lg shadow-2xl relative max-h-[90vh] overflow-y-auto"
                    >
                        <button
                            onClick={() => setExpandedContender(null)}
                            className="absolute top-6 right-6 text-gray-500 hover:text-white font-bold text-xl"
                        >
                            ✕
                        </button>

                        <div className="flex items-center gap-4 mb-5 pb-5 border-b border-gray-800">
                            <div className="w-16 h-16 rounded-2xl bg-gray-800 flex items-center justify-center text-3xl font-['Bebas_Neue'] text-gray-400 border border-gray-700">
                                #{rotationSingers.findIndex(s => s.id === expandedContender.id) + 1}
                            </div>
                            <div className="flex-1 min-w-0">
                                <h3 className="text-3xl font-['Bebas_Neue'] text-white tracking-widest leading-none truncate">
                                    {expandedContender.singer_name}
                                </h3>
                                <div className="mt-2 flex flex-wrap gap-2">
                                    <span className="text-[9px] bg-blue-900/30 text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded font-bold uppercase tracking-widest">
                                        {expandedContender.user_type || 'BHNL User'}
                                    </span>
                                    <span className="text-[9px] bg-gray-800 text-gray-400 border border-gray-700 px-2 py-0.5 rounded font-bold uppercase tracking-widest">
                                        Total Score: {expandedContender.total_points || 0}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <h4 className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-2">
                            Setlist Timeline (Tap a song to make it Up Next)
                        </h4>
                        <div className="space-y-2 max-h-48 overflow-y-auto pr-1 hide-scrollbar mb-5">
                            {expandedContender.setlist?.map((song, i) => (
                                <div
                                    key={`${song.id}-${i}`}
                                    onClick={() => i !== 0 && handleSelectNextSongForContender(expandedContender, i)}
                                    className={`bg-black border p-3 rounded-xl flex justify-between items-center transition-colors ${
                                        i === 0
                                            ? 'border-[#00f5ff]/60 bg-[#00f5ff]/5'
                                            : 'border-gray-800 hover:border-blue-500/50 cursor-pointer'
                                    }`}
                                >
                                    <div className="min-w-0 pr-2">
                                        <p className={`font-bold text-sm truncate ${i === 0 ? 'text-[#00f5ff]' : 'text-white'}`}>
                                            {i + 1}. {song.title}
                                        </p>
                                        <p className="text-[9px] text-gray-500 uppercase tracking-widest font-bold truncate">
                                            {song.artist}
                                        </p>
                                    </div>
                                    {i === 0 ? (
                                        <span className="text-[9px] font-bold uppercase tracking-widest px-2 py-1 rounded bg-[#00f5ff]/20 text-[#00f5ff] flex-shrink-0">
                                            Active Song
                                        </span>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                handleSelectNextSongForContender(expandedContender, i)
                                            }}
                                            className="text-[9px] font-bold uppercase tracking-widest px-2.5 py-1 rounded bg-blue-600/20 text-blue-300 border border-blue-500/30 hover:bg-blue-600 hover:text-white flex-shrink-0"
                                        >
                                            Make Next
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>

                        {/* Custom Booth Song Override */}
                        <form onSubmit={handleOverrideContenderSong} className="border-t border-gray-800 pt-4 space-y-3">
                            <h4 className="text-[10px] text-purple-400 font-bold uppercase tracking-widest">
                                🎛️ Booth Song Override (Change Current Song)
                            </h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <input
                                    type="text"
                                    value={overrideSongTitle}
                                    onChange={e => setOverrideSongTitle(e.target.value)}
                                    placeholder="New Song Title..."
                                    className="bg-black border border-gray-700 text-white rounded-xl px-3 py-2 text-xs outline-none focus:border-purple-500"
                                />
                                <input
                                    type="text"
                                    value={overrideSongArtist}
                                    onChange={e => setOverrideSongArtist(e.target.value)}
                                    placeholder="Artist (Optional)..."
                                    className="bg-black border border-gray-700 text-white rounded-xl px-3 py-2 text-xs outline-none focus:border-purple-500"
                                />
                            </div>
                            <div className="flex items-center justify-between gap-2 pt-1">
                                <button
                                    type="button"
                                    onClick={(e) => handleRemoveSinger(expandedContender, e)}
                                    className="px-3 py-2.5 rounded-xl bg-red-950/40 border border-red-500/40 text-red-400 hover:bg-red-600 hover:text-white text-[10px] font-bold uppercase tracking-widest"
                                >
                                    🗑️ Remove Singer
                                </button>
                                <button
                                    type="submit"
                                    disabled={!overrideSongTitle.trim()}
                                    className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white text-[10px] font-bold uppercase tracking-widest"
                                >
                                    Set Active Song
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MANUAL ADD SINGER MODAL */}
            {showAddSingerModal && (
                <div
                    onClick={() => setShowAddSingerModal(false)}
                    className="fixed inset-0 bg-black/90 z-[200] flex items-center justify-center p-4 animate-fade-in backdrop-blur-sm"
                >
                    <div
                        onClick={e => e.stopPropagation()}
                        className="bg-[#090812] p-6 rounded-3xl border-2 border-purple-500/50 w-full max-w-md shadow-[0_0_30px_rgba(168,85,247,0.2)] relative"
                    >
                        <button
                            onClick={() => setShowAddSingerModal(false)}
                            className="absolute top-6 right-6 text-gray-500 hover:text-white font-bold text-xl"
                        >
                            ✕
                        </button>

                        <h3 className="text-3xl font-['Bebas_Neue'] text-purple-400 tracking-widest mb-1">Add Walk-up Singer</h3>
                        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-6">
                            Manually insert a guest into the queue
                        </p>

                        <form onSubmit={handleAddManualSinger} className="space-y-4">
                            <div>
                                <label className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1 block">Singer Name</label>
                                <input
                                    type="text"
                                    value={manualName}
                                    onChange={e => setManualName(e.target.value)}
                                    required
                                    className="w-full bg-black border border-gray-700 text-white rounded-xl p-3 outline-none focus:border-purple-500"
                                    placeholder="e.g. Local Legend Larry"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1 block">Song Title</label>
                                <input
                                    type="text"
                                    value={manualSong}
                                    onChange={e => setManualSong(e.target.value)}
                                    required
                                    className="w-full bg-black border border-gray-700 text-white rounded-xl p-3 outline-none focus:border-purple-500"
                                    placeholder="e.g. Sweet Caroline"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1 block">Artist (Optional)</label>
                                <input
                                    type="text"
                                    value={manualArtist}
                                    onChange={e => setManualArtist(e.target.value)}
                                    className="w-full bg-black border border-gray-700 text-white rounded-xl p-3 outline-none focus:border-purple-500"
                                    placeholder="e.g. Neil Diamond"
                                />
                            </div>

                            <button
                                type="submit"
                                className="w-full mt-4 bg-purple-600 hover:bg-purple-500 text-white font-bold py-4 rounded-xl uppercase tracking-widest text-xs transition-all shadow-lg"
                            >
                                Inject into Queue
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {showSettingsModal && (
                <div
                    onClick={() => setShowSettingsModal(false)}
                    className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4 animate-fade-in backdrop-blur-sm"
                >
                    <div
                        onClick={e => e.stopPropagation()}
                        className="bg-[#090812] border border-gray-800 p-6 rounded-3xl w-full max-w-sm shadow-2xl"
                    >
                        <h3 className="text-2xl font-['Bebas_Neue'] text-white tracking-widest mb-4">Stage Settings</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="text-[10px] text-gray-500 font-bold uppercase block mb-1">Session Title</label>
                                <input
                                    type="text"
                                    value={sessionTitle}
                                    onChange={e => setSessionTitle(e.target.value)}
                                    className="w-full bg-black border border-gray-700 text-white p-3 rounded-lg outline-none focus:border-blue-500"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] text-gray-500 font-bold uppercase block mb-1">Voting Style</label>
                                <select
                                    value={votingStyle}
                                    onChange={e => setVotingStyle(e.target.value)}
                                    className="w-full bg-black border border-gray-700 text-white p-3 rounded-lg outline-none focus:border-blue-500"
                                >
                                    <option value="none">None (Casual / Queue Only)</option>
                                    <option value="tap">Tap-to-Vote (Multi-tap)</option>
                                    <option value="stars">1-5 Rating (Classic)</option>
                                    <option value="vibe">Vibe Check (Categories)</option>
                                    <option value="full">Full (Tap + Vibe Check)</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-[10px] text-gray-500 font-bold uppercase block mb-1">Voting Icon</label>
                                <select
                                    value={votingIcon}
                                    onChange={e => setVotingIcon(e.target.value)}
                                    className="w-full bg-black border border-gray-700 text-white p-3 rounded-lg outline-none focus:border-blue-500"
                                >
                                    <option value="star">⭐ Stars</option>
                                    <option value="fire">🔥 Fire</option>
                                    <option value="beer">🍻 Cheers</option>
                                </select>
                            </div>
                            <div className="flex gap-2 mt-4 pt-4 border-t border-gray-800">
                                <button
                                    onClick={() => setShowSettingsModal(false)}
                                    className="flex-1 bg-gray-800 text-gray-400 py-3 rounded-lg text-xs font-bold uppercase hover:text-white transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={updateSessionSettings}
                                    className="flex-1 bg-blue-600 text-white py-3 rounded-lg text-xs font-bold uppercase hover:bg-blue-500 transition-colors"
                                >
                                    Save
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showQR && (
                <div
                    onClick={() => setShowQR(false)}
                    className="fixed inset-0 bg-black/90 z-[200] flex items-center justify-center p-4 animate-fade-in backdrop-blur-sm"
                >
                    <div
                        onClick={e => e.stopPropagation()}
                        className="bg-white p-8 rounded-3xl text-center relative max-w-sm w-full"
                    >
                        <button
                            onClick={() => setShowQR(false)}
                            className="absolute top-4 right-4 text-gray-400 hover:text-black font-bold text-xl"
                        >
                            ✕
                        </button>
                        <h3 className="text-3xl font-['Bebas_Neue'] text-black mb-1 tracking-widest">Join The Stage</h3>
                        <p className="text-gray-500 font-bold uppercase tracking-widest text-[10px] mb-6">
                            Scan with BHNL App to enter queue
                        </p>
                        <div className="flex justify-center bg-gray-100 p-4 rounded-2xl mb-4">
                            <img
                                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(`${window.location.origin}/?join=${activeSession.id}`)}&color=090812&bgcolor=ffffff`}
                                alt="BHNL Session QR"
                                className="w-48 h-48"
                            />
                        </div>
                        <p className="text-xs font-bold uppercase tracking-widest text-gray-600">
                            Room Code: <span className="text-black font-black">{activeSession.session_code}</span>
                        </p>
                    </div>
                </div>
            )}

            {showTempQR && (
                <div
                    onClick={() => setShowTempQR(false)}
                    className="fixed inset-0 bg-black/90 z-[200] flex items-center justify-center p-4 animate-fade-in backdrop-blur-sm"
                >
                    <div
                        onClick={e => e.stopPropagation()}
                        className="bg-yellow-500 p-8 rounded-3xl text-center relative max-w-sm w-full shadow-[0_0_50px_rgba(234,179,8,0.3)]"
                    >
                        <button
                            onClick={() => setShowTempQR(false)}
                            className="absolute top-4 right-4 text-yellow-900 hover:text-black font-bold text-xl"
                        >
                            ✕
                        </button>
                        <h3 className="text-3xl font-['Bebas_Neue'] text-black mb-1 tracking-widest">Guest Access</h3>
                        <p className="text-yellow-900 font-bold uppercase tracking-widest text-[10px] mb-6">
                            Scan with native camera for Temp Passport
                        </p>
                        <div className="flex justify-center bg-white p-4 rounded-2xl mb-4">
                            <img
                                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(`${window.location.origin}/?join=${activeSession.id}&guest=true`)}&color=000000&bgcolor=ffffff`}
                                alt="Temp Passport QR"
                                className="w-48 h-48"
                            />
                        </div>
                        <p className="text-xs font-bold uppercase tracking-widest text-yellow-950">
                            Room Code: <span className="text-black font-black">{activeSession.session_code}</span>
                        </p>
                    </div>
                </div>
            )}
        </div>
    )
}
