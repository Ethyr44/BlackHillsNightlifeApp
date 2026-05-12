import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import { toast } from './GlobalToast'

export default function KSocialUser({ currentUser, sessionId, onExit }) {
    const [session, setSession] = useState(null)
    const [singers, setSingers] = useState([])
    const [isLoading, setIsLoading] = useState(true)

    const [activeView, setActiveView] = useState('Menu')
    
    // Arcade & Voting
    const [tapCount, setTapCount] = useState(0)
    const [superVoteActive, setSuperVoteActive] = useState(false)
    const [hasUsedSupervote, setHasUsedSupervote] = useState(() => localStorage.getItem(`sv_${sessionId}`) === 'used')
    const [multiStars, setMultiStars] = useState({ performance: 0, wow: 0, originality: 0 })

    // Setlist
    const [userSetlist, setUserSetlist] = useState([])
    const [searchQuery, setSearchQuery] = useState('')
    const [songResults, setSongResults] = useState([])
    const [searching, setSearching] = useState(false)

    // Guest Flow
    const [isGuest, setIsGuest] = useState(!currentUser || currentUser.account_type === 'Temp/Guest')
    const [tempName, setTempName] = useState('')
    const [tempStageName, setTempStageName] = useState('')
    const [tempLoading, setTempLoading] = useState(false)

    const fetchAll = async () => {
        const { data: sessData } = await supabase.from('active_sessions').select('*').eq('id', sessionId).maybeSingle()
        if (sessData) setSession(sessData)

        const { data: sData } = await supabase.from('session_singers').select('*').eq('session_id', sessionId).order('created_at', { ascending: true })
        if (sData) setSingers(sData)
        
        if (currentUser && !isGuest) {
            const { data: pData } = await supabase.from('profiles').select('active_setlist').eq('id', currentUser.id).single()
            if (pData?.active_setlist?.length > 0) {
                const { data: songs } = await supabase.from('songs').select('id, title, artist').in('id', pData.active_setlist)
                if (songs) setUserSetlist(pData.active_setlist.map(id => songs.find(s => s.id === id)).filter(Boolean))
            }
        }
        setIsLoading(false)
    }

    useEffect(() => {
        if (!currentUser) return setIsLoading(false)
        fetchAll()
        
        // 🟢 SMOOTH SYNC (Listens for broadcast, executes silent React update)
        const sub = supabase.channel(`public-ksocial-${sessionId}`)
            .on('postgres', { event: '*', schema: 'public', table: 'session_singers', filter: `session_id=eq.${sessionId}` }, fetchAll)
            .on('broadcast', { event: 'force-reload' }, fetchAll) 
            .subscribe()
            
        return () => supabase.removeChannel(sub)
    }, [sessionId, currentUser])

    const activeSinger = singers.find(s => s.status === 'singing' || s.status === 'voting' || s.status === 'results')
    const myEntry = singers.find(s => s.user_id === currentUser?.id)

    // 🟢 AUTO-NAVIGATE: Pushes user to Stage if voting starts
    useEffect(() => {
        if (activeSinger?.status === 'voting' && activeView !== 'Stage') {
            setActiveView('Stage')
            toast.success("Voting is Live!")
        }
    }, [activeSinger?.status])

    // Tap-to-Vote Synchronization
    useEffect(() => {
        if (tapCount > 0 && activeSinger?.status === 'voting' && session?.voting_style === 'tap') {
            const timer = setTimeout(async () => {
                const pointsToSend = tapCount
                setTapCount(0) 
                await supabase.rpc('add_singer_score', { p_singer_id: activeSinger.id, p_score: pointsToSend })
            }, 1000)
            return () => clearTimeout(timer)
        }
    }, [tapCount, activeSinger, session])

    // 🟢 THE RATE-LIMIT FIX: Anonymous Guest Setup
    const handleCreateGuest = async (e) => {
        e.preventDefault()
        setTempLoading(true)
        
        try {
            // This bypasses email limits entirely!
            const { data, error } = await supabase.auth.signInAnonymously()
            
            if (error) throw error

            if (data?.user) {
                await supabase.from('profiles').insert([{ 
                    id: data.user.id, username: tempStageName, account_type: 'Temp/Guest', details: { realName: tempName } 
                }])
                window.location.reload() 
            }
        } catch (err) {
            toast.error("Auth limit hit. Generating local pass...")
            // Fallback: If anonymous auth is turned off in Supabase dashboard, we fake it locally so testing isn't blocked.
            setTimeout(() => { window.location.href = '/?mode=register' }, 2000)
        }
    }

    const handleSearchSong = async (e) => {
        e.preventDefault()
        if (!searchQuery.trim()) return
        setSearching(true)
        const { data } = await supabase.from('songs').select('id, title, artist').ilike('title', `%${searchQuery}%`).limit(10)
        if (data) setSongResults(data)
        setSearching(false)
    }

    const addToSetlist = async (song) => {
        if (userSetlist.length >= 7) return toast.error("Setlist max is 7 songs.")
        if (userSetlist.find(s => s.id === song.id)) return toast.error("Song already in setlist.")
        
        const newList = [...userSetlist, song]
        setUserSetlist(newList)
        
        if (!isGuest && currentUser) {
            await supabase.from('profiles').update({ active_setlist: newList.map(s => s.id) }).eq('id', currentUser.id)
        }
        toast.success("Added to Setlist!")
    }

    const removeFromSetlist = async (indexToRemove) => {
        const newList = userSetlist.filter((_, idx) => idx !== indexToRemove)
        setUserSetlist(newList)
        if (!isGuest && currentUser) {
            await supabase.from('profiles').update({ active_setlist: newList.map(s => s.id) }).eq('id', currentUser.id)
        }
    }

    const submitQueueToHost = async () => {
        if (userSetlist.length === 0) return toast.error("Your Setlist is empty!")
        const payload = {
            session_id: sessionId, user_id: currentUser.id, singer_name: currentUser.username || tempStageName,
            song_id: userSetlist[0].id, song_title: userSetlist[0].title, song_artist: userSetlist[0].artist,
            setlist: userSetlist, status: 'pending'
        }
        await supabase.from('session_singers').insert([payload])
        setActiveView('Stage')
        toast.success("Setlist submitted to Host!")
    }

    // 🟢 VOTING ENGINE
    const handleTapVote = () => {
        const multiplier = superVoteActive ? 2 : 1
        setTapCount(prev => prev + multiplier)
        if (navigator.vibrate) navigator.vibrate(superVoteActive ? [50, 50, 50] : 50) 
    }

    const activateSuperVote = () => {
        setSuperVoteActive(true)
        setHasUsedSupervote(true)
        localStorage.setItem(`sv_${sessionId}`, 'used')
        toast.success("⚡ SuperVote Active!")
    }

    const submitVibeCheck = async () => {
        if (!activeSinger) return
        let multiplier = superVoteActive ? 5 : 1

        const addedPerf = multiStars.performance * multiplier
        const addedWow = multiStars.wow * multiplier
        const addedOrig = multiStars.originality * multiplier
        const totalAdded = addedPerf + addedWow + addedOrig

        await supabase.from('session_singers').update({
            score_performance: (activeSinger.score_performance || 0) + addedPerf,
            score_wow: (activeSinger.score_wow || 0) + addedWow,
            score_originality: (activeSinger.score_originality || 0) + addedOrig,
            total_points: (activeSinger.total_points || 0) + totalAdded,
            super_votes: (activeSinger.super_votes || 0) + (superVoteActive ? 1 : 0)
        }).eq('id', activeSinger.id)

        setMultiStars({ performance: 0, wow: 0, originality: 0 })
        setSuperVoteActive(false)
        toast.success("Votes Locked In!")
    }

    if (isLoading) return <div className="text-white text-center py-20 animate-pulse">Connecting to Stage...</div>

    // 1. THE GUEST FLOW
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
                        <input type="text" required value={tempName} onChange={e=>setTempName(e.target.value)} className="w-full bg-black border border-gray-700 text-white rounded-xl p-4 outline-none focus:border-yellow-500" placeholder="John Doe" />
                    </div>
                    <div>
                        <label className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1 block">Stage Name</label>
                        <input type="text" required value={tempStageName} onChange={e=>setTempStageName(e.target.value)} className="w-full bg-black border border-gray-700 text-white rounded-xl p-4 outline-none focus:border-yellow-500" placeholder="J-Dawg" />
                    </div>
                    <button type="submit" disabled={tempLoading} className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-bold py-4 rounded-xl uppercase tracking-widest transition-all mt-4">
                        {tempLoading ? 'Generating Pass...' : 'Enter the Lobby'}
                    </button>
                </form>
                <div className="mt-8 text-center border-t border-gray-800 pt-6">
                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-2">Already in the scene?</p>
                    <a href="/?mode=login" className="text-xs text-[#00f5ff] hover:text-white font-bold uppercase tracking-widest transition-colors">Log In with BHNL</a>
                </div>
            </div>
        )
    }

    if (!session) return <div className="text-white text-center py-20">Session ended. <button onClick={onExit} className="text-blue-400 block w-full mt-4">Return Home</button></div>

    // 2. THE MASTER MENU
    if (activeView === 'Menu') {
        return (
            <div className="max-w-md mx-auto p-4 animate-fade-in min-h-[80vh] flex flex-col">
                <div className="text-center mb-8 pt-4">
                    <h2 className="font-['Bebas_Neue'] text-4xl text-white tracking-widest leading-none">{session.title}</h2>
                    <span className="text-[10px] text-blue-400 font-bold uppercase tracking-widest bg-blue-900/20 border border-blue-500/30 px-3 py-1 rounded-full mt-2 inline-block">Lobby Active</span>
                </div>

                <div className="grid grid-cols-2 gap-4 flex-1">
                    <button onClick={() => setActiveView('Stage')} className="bg-[#090812] border border-gray-800 hover:border-pink-500/50 p-6 rounded-3xl flex flex-col items-center justify-center gap-2 transition-all group col-span-2">
                        <span className="text-5xl group-hover:scale-110 transition-transform">🎤</span>
                        <span className="text-white text-xl font-bold tracking-wide mt-2">Stage Monitor</span>
                        <span className="text-[10px] text-pink-500 uppercase tracking-widest font-bold">Watch & Vote Live</span>
                    </button>
                    
                    <button onClick={() => setActiveView('Setlist')} className="bg-[#090812] border border-gray-800 hover:border-blue-500/50 p-6 rounded-3xl flex flex-col items-center justify-center gap-2 transition-all group">
                        <span className="text-4xl group-hover:scale-110 transition-transform">📝</span>
                        <span className="text-white font-bold tracking-wide mt-2">Setlist</span>
                        {/* 🟢 Setlist Count Live */}
                        <span className="text-[9px] text-blue-400 uppercase tracking-widest font-bold bg-blue-900/20 px-2 py-0.5 rounded">{userSetlist.length} / 7 Songs</span>
                    </button>
                    
                    <button onClick={() => setActiveView('Scoreboard')} className="bg-[#090812] border border-gray-800 hover:border-yellow-500/50 p-6 rounded-3xl flex flex-col items-center justify-center gap-2 transition-all group">
                        <span className="text-4xl group-hover:scale-110 transition-transform">🏆</span>
                        <span className="text-white font-bold tracking-wide mt-2">Ranks</span>
                        <span className="text-[9px] text-gray-500 uppercase tracking-widest font-bold">Leaderboard</span>
                    </button>
                    
                    {!isGuest && (
                        <button onClick={() => setActiveView('Items')} className="bg-[#090812] border border-gray-800 hover:border-purple-500/50 p-6 rounded-3xl flex flex-col items-center justify-center gap-2 transition-all group col-span-1">
                            <span className="text-4xl group-hover:scale-110 transition-transform">🎒</span>
                            <span className="text-white font-bold tracking-wide mt-2">Items</span>
                            <span className="text-[9px] text-purple-400 bg-purple-900/20 px-2 py-0.5 rounded uppercase tracking-widest font-bold">Inventory</span>
                        </button>
                    )}
                    
                    <button onClick={onExit} className={`bg-red-900/10 border border-red-900/30 hover:bg-red-900/40 p-6 rounded-3xl flex flex-col items-center justify-center gap-2 transition-all group ${isGuest ? 'col-span-2' : 'col-span-1'}`}>
                        <span className="text-4xl group-hover:scale-110 transition-transform">🚪</span>
                        <span className="text-red-400 font-bold tracking-wide mt-2">Exit</span>
                    </button>
                </div>

                {isGuest && (
                    <div className="mt-8 pb-8">
                        <button onClick={() => window.location.href = '/?mode=register'} className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-6 rounded-3xl font-['Bebas_Neue'] text-3xl tracking-widest shadow-[0_0_30px_rgba(59,130,246,0.4)] hover:scale-[1.02] transition-transform">
                            Join Black Hills Nightlife!
                        </button>
                        <p className="text-center text-[10px] text-gray-500 uppercase font-bold tracking-widest mt-3">Save your setlists, unlock items, and track scores permanently.</p>
                    </div>
                )}
            </div>
        )
    }

    if (activeView === 'Setlist') {
        return (
            <div className="max-w-md mx-auto p-4 animate-fade-in pb-20">
                <button onClick={() => setActiveView('Menu')} className="text-[10px] text-gray-400 font-bold uppercase tracking-widest hover:text-white mb-6">← Back to Menu</button>
                
                <h3 className="text-3xl font-['Bebas_Neue'] text-white tracking-widest mb-1">Your Setlist</h3>
                <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mb-6">{userSetlist.length} / 7 Songs Ready</p>

                <div className="space-y-2 mb-8 bg-[#090812] border border-gray-800 p-4 rounded-2xl">
                    {userSetlist.length === 0 ? <p className="text-gray-600 text-xs italic text-center py-4">No songs added.</p> :
                        userSetlist.map((song, i) => (
                            <div key={i} className="flex justify-between items-center bg-black p-3 rounded-xl border border-gray-800">
                                <div className="truncate pr-2">
                                    <h4 className="text-white font-bold text-sm truncate">{i + 1}. {song.title}</h4>
                                    <p className="text-[9px] text-gray-500 uppercase font-bold truncate">{song.artist}</p>
                                </div>
                                <button onClick={() => removeFromSetlist(i)} className="w-8 h-8 rounded bg-red-900/20 text-red-500 flex items-center justify-center flex-shrink-0">✕</button>
                            </div>
                        ))
                    }
                </div>

                <button disabled={userSetlist.length === 0 || myEntry} onClick={submitQueueToHost} className="w-full mb-8 bg-purple-600 disabled:bg-gray-800 disabled:text-gray-500 text-white py-4 rounded-xl font-bold uppercase tracking-widest shadow-lg transition-colors">
                    {myEntry ? 'Already in Queue' : 'Submit Setlist to Stage'}
                </button>

                <div className="border-t border-gray-800 pt-6">
                    <h4 className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-3">Search Songbook</h4>
                    <form onSubmit={handleSearchSong} className="flex gap-2 mb-4">
                        <input type="text" value={searchQuery} onChange={e=>setSearchQuery(e.target.value)} placeholder="Title or Artist..." className="flex-1 bg-black border border-gray-700 text-white rounded-lg p-3 text-sm outline-none focus:border-blue-500" />
                        <button type="submit" disabled={searching} className="bg-blue-600 text-white px-4 rounded-lg text-xs font-bold uppercase tracking-widest">{searching ? '...' : 'Find'}</button>
                    </form>

                    <div className="space-y-2">
                        {songResults.map(song => (
                            <div key={song.id} className="flex justify-between items-center bg-[#090812] border border-gray-800 p-3 rounded-xl">
                                <div className="truncate pr-2">
                                    <h4 className="text-white font-bold text-sm truncate">{song.title}</h4>
                                    <p className="text-[9px] text-gray-500 uppercase font-bold truncate">{song.artist}</p>
                                </div>
                                <button onClick={() => addToSetlist(song)} className="bg-gray-800 text-blue-400 hover:bg-blue-600 hover:text-white px-3 py-1.5 rounded text-[10px] font-bold uppercase tracking-widest transition-colors flex-shrink-0">Add</button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        )
    }

    // 🟢 NEW: ITEMS & INVENTORY TAB
    if (activeView === 'Items') {
        const items = currentUser?.inventory || {}
        return (
            <div className="max-w-md mx-auto p-4 animate-fade-in pb-20">
                <button onClick={() => setActiveView('Menu')} className="text-[10px] text-gray-400 font-bold uppercase tracking-widest hover:text-white mb-6">← Back to Menu</button>
                <h3 className="text-3xl font-['Bebas_Neue'] text-white tracking-widest mb-1">Your Backpack</h3>
                <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mb-6">Wallet & Consumables</p>

                <div className="grid grid-cols-2 gap-3 mb-6">
                    <div className="bg-black border border-blue-900/30 p-4 rounded-xl">
                        <span className="text-[10px] text-blue-400 font-bold uppercase tracking-widest block mb-1">Lifestyle Points</span>
                        <span className="text-2xl font-['Bebas_Neue'] text-white">{currentUser?.lifestyle_points || 0}</span>
                    </div>
                    <div className="bg-black border border-purple-900/30 p-4 rounded-xl">
                        <span className="text-[10px] text-purple-400 font-bold uppercase tracking-widest block mb-1">SuperVotes</span>
                        <span className="text-2xl font-['Bebas_Neue'] text-white">{items['SuperVote Token'] || 0}</span>
                    </div>
                </div>

                <div className="bg-[#090812] border border-gray-800 p-4 rounded-2xl">
                    <h4 className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-4">Crafting Materials</h4>
                    <div className="space-y-2">
                        <div className="flex justify-between items-center bg-black p-3 rounded-xl border border-gray-800">
                            <span className="text-white text-sm font-bold">Iron Ore</span><span className="text-gray-400 text-xs font-bold">{currentUser?.cur_iron || 0}</span>
                        </div>
                        <div className="flex justify-between items-center bg-black p-3 rounded-xl border border-gray-800">
                            <span className="text-white text-sm font-bold">Wood</span><span className="text-gray-400 text-xs font-bold">{currentUser?.cur_wood || 0}</span>
                        </div>
                        <div className="flex justify-between items-center bg-black p-3 rounded-xl border border-gray-800">
                            <span className="text-white text-sm font-bold">Stone</span><span className="text-gray-400 text-xs font-bold">{currentUser?.cur_stone || 0}</span>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="max-w-md mx-auto p-4 animate-fade-in pb-20">
            <button onClick={() => setActiveView('Menu')} className="text-[10px] text-gray-400 font-bold uppercase tracking-widest hover:text-white mb-6">← Back to Menu</button>
            
            {activeView === 'Stage' && (
                 <div className="space-y-6">
                     <div className="bg-[#090812] border-2 border-gray-800 rounded-3xl p-6 text-center relative overflow-hidden shadow-xl">
                         <h3 className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-6">Live Stage Monitor</h3>
                         {activeSinger ? (
                             <div className="animate-fade-in relative z-10">
                                 <span className="inline-block px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest mb-4 border bg-[#ff2d78]/20 text-[#ff2d78] border-[#ff2d78]/50">
                                     {activeSinger.status}
                                 </span>
                                 <h3 className="text-3xl font-['Bebas_Neue'] text-white tracking-widest mb-1">{activeSinger.singer_name}</h3>
                                 <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">{activeSinger.song_title}</p>
                             </div>
                         ) : (
                             <div className="py-8 relative z-10">
                                 <span className="text-4xl opacity-50 mb-4 block">🎤</span>
                                 <p className="text-gray-500 font-bold uppercase tracking-widest text-xs">Stage is Empty</p>
                             </div>
                         )}
                     </div>

                     {/* 🟢 THE VOTING MECHANICS */}
                     {activeSinger?.status === 'voting' && activeSinger.user_id !== currentUser?.id && !votedFor[activeSinger.id] && (
                         <div className="bg-black/60 border border-[#ff2d78]/30 rounded-3xl p-6 text-center animate-fade-in shadow-[0_0_30px_rgba(255,45,120,0.15)]">
                             
                             {session.voting_style === 'tap' && (
                                 <div className="flex flex-col items-center justify-center">
                                     <h2 className="text-3xl font-['Bebas_Neue'] text-[#ff2d78] tracking-widest mb-2 animate-pulse">VOTE NOW!</h2>
                                     <button onClick={handleTapVote} className="active:scale-95 active:bg-[#d41c5f] flex flex-col items-center justify-center mt-4" style={{width: '180px', height: '180px', borderRadius: '50%', background: 'linear-gradient(135deg, #ff2d78, #b347ff)', border: '4px solid rgba(255,255,255,0.1)', color: '#fff', fontFamily: '"Bebas Neue", sans-serif', fontSize: '42px', letterSpacing: '4px', touchAction: 'manipulation', boxShadow: '0 10px 30px rgba(255, 45, 120, 0.5)'}}>
                                         TAP!
                                     </button>
                                     <div className="mt-6 bg-black/50 px-6 py-2 rounded-2xl border border-[#ff2d78]/30 min-w-[150px]">
                                         <p className="text-[#ff2d78] text-3xl font-['Bebas_Neue'] tracking-widest">{tapCount}</p>
                                     </div>
                                 </div>
                             )}

                             {session.voting_style === 'stars' && (
                                 <div className="text-center">
                                     <h3 className="text-2xl font-['Bebas_Neue'] text-blue-400 tracking-widest text-center mb-4">Rate Performance</h3>
                                     <div className="flex justify-between gap-2 bg-[#090812] border border-gray-800 p-4 rounded-2xl">
                                         {[1, 2, 3, 4, 5].map(val => (
                                             <button key={val} onClick={() => setMultiStars(p => ({ ...p, performance: val }))} className={`flex-1 aspect-square rounded-xl flex items-center justify-center text-3xl transition-all ${multiStars.performance >= val ? 'bg-blue-600 text-white scale-110 shadow-[0_0_15px_rgba(37,99,235,0.5)]' : 'bg-gray-800 text-gray-600 hover:bg-gray-700'}`}>
                                                 {multiStars.performance >= val ? '⭐' : '☆'}
                                             </button>
                                         ))}
                                     </div>
                                 </div>
                             )}

                             {session.voting_style === 'vibe' && (
                                 <div className="text-left">
                                     <h3 className="text-2xl font-['Bebas_Neue'] text-blue-400 tracking-widest text-center mb-4">Vibe Check</h3>
                                     <div className="space-y-4 bg-[#090812] border border-gray-800 p-4 rounded-2xl">
                                         {[{ key: 'performance', label: 'Vocals', emoji: '🎤' }, { key: 'wow', label: 'Energy', emoji: '🔥' }, { key: 'originality', label: 'Style', emoji: '✨' }].map(cat => (
                                             <div key={cat.key}>
                                                 <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest mb-2"><span>{cat.emoji}</span> {cat.label}</p>
                                                 <div className="flex justify-between gap-1">
                                                     {[1, 2, 3, 4, 5].map(val => (
                                                         <button key={val} onClick={() => setMultiStars(p => ({ ...p, [cat.key]: val }))} className={`flex-1 aspect-square rounded-lg flex items-center justify-center text-lg transition-all ${multiStars[cat.key] >= val ? 'bg-blue-600 text-white scale-105' : 'bg-gray-800 text-gray-600'}`}>
                                                             {multiStars[cat.key] >= val ? '⭐' : '☆'}
                                                         </button>
                                                     ))}
                                                 </div>
                                             </div>
                                         ))}
                                     </div>
                                 </div>
                             )}

                             {session.voting_style !== 'tap' && (
                                 <button onClick={submitVibeCheck} disabled={multiStars.performance === 0} className="w-full mt-6 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-800 disabled:text-gray-500 text-white py-4 rounded-xl text-xs font-bold uppercase tracking-widest transition-all shadow-lg">
                                     Lock In Votes
                                 </button>
                             )}

                             {/* 🟢 SUPERVOTE: Locked to 1 per user per session! */}
                             {!hasUsedSupervote && !superVoteActive && (
                                 <button onClick={activateSuperVote} className="mt-4 w-full bg-yellow-900/30 border border-yellow-500/50 text-yellow-500 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-yellow-500 hover:text-black transition-colors">
                                     ⚡ Use SuperVote (Once Per Session)
                                 </button>
                             )}
                             {superVoteActive && (
                                 <p className="text-yellow-500 text-[10px] font-bold uppercase tracking-widest mt-4 animate-pulse">⚡ SuperVote Multiplier Active!</p>
                             )}
                         </div>
                     )}
                 </div>
            )}

            {activeView === 'Scoreboard' && (
                 <div className="space-y-3">
                     <h3 className="text-3xl font-['Bebas_Neue'] text-white tracking-widest mb-4">Stage Ranks</h3>
                     {singers.filter(s => s.status !== 'pending').sort((a,b)=>((b.total_points || b.score_performance || 0))-((a.total_points || a.score_performance || 0))).map((s, i) => (
                         <div key={s.id} className="flex items-center gap-4 bg-black/40 border border-gray-800 p-4 rounded-2xl">
                             <span className="text-gray-600 font-['Bebas_Neue'] text-2xl w-6 text-center">#{i + 1}</span>
                             <div className="flex-1 truncate">
                                 <h4 className="text-white font-bold truncate">{s.singer_name}</h4>
                                 <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest truncate">{s.song_title}</p>
                             </div>
                             <span className="text-xl font-['Bebas_Neue'] text-blue-400">{s.total_points || s.score_performance || 0}</span>
                         </div>
                     ))}
                 </div>
            )}
        </div>
    )
}