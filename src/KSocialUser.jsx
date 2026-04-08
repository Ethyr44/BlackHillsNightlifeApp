import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

export default function KSocialUser({ currentUser, sessionId, onExit }) {
    const [session, setSession] = useState(null)
    const [singers, setSingers] = useState([])
    const [votedFor, setVotedFor] = useState({}) 
    const [isLoading, setIsLoading] = useState(true)

    const [superVotesRemaining, setSuperVotesRemaining] = useState(0)
    const [superVoteActive, setSuperVoteActive] = useState(false)
    const [selectedStars, setSelectedStars] = useState(0)
    const [multiStars, setMultiStars] = useState({ performance: 0, wow: 0, originality: 0 })

    const [showJoinModal, setShowJoinModal] = useState(false)
    const [singerAlias, setSingerAlias] = useState(currentUser?.username || '')
    const [prevStatus, setPrevStatus] = useState(null)

    // 1. INITIAL FETCH & 4-SECOND POLLING
    useEffect(() => {
        const fetchSingers = async () => {
            const { data } = await supabase.from('session_singers')
                .select('*')
                .eq('session_id', sessionId)
                .order('total_points', { ascending: false })
            if (data) setSingers(data)
        }

        const fetchSessionData = async () => {
            const { data: sessData } = await supabase.from('active_sessions').select('*').eq('id', sessionId).maybeSingle()
            if (sessData) {
                setSession(sessData)
                setSuperVotesRemaining(sessData.supervotes || 2)
                fetchSingers()
                setIsLoading(false)
            } else {
                alert("This session has ended or is no longer available.")
                onExit()
            }
        }

        fetchSessionData()

        const singerSub = supabase.channel('user-realtime-stage')
            .on('postgres', { event: '*', schema: 'public', table: 'session_singers', filter: `session_id=eq.${sessionId}` }, fetchSingers)
            .subscribe()

        // 🟢 THE BULLETPROOF POLLING FALLBACK
        const pollInterval = setInterval(() => {
            fetchSingers()
        }, 4000)

        return () => {
            supabase.removeChannel(singerSub)
            clearInterval(pollInterval)
        }
    }, [sessionId])

    const myRecord = singers.find(s => s.bhnl_id === currentUser?.id)
    const currentStatus = myRecord ? myRecord.status : null

    useEffect(() => {
        if (prevStatus === 'pending' && (currentStatus === 'queued' || currentStatus === 'singing')) {
            alert("Join Request Approved! You are now in the lineup 🎤")
        }
        setPrevStatus(currentStatus)
    }, [currentStatus, prevStatus])

    const handleRequestJoin = async (e) => {
        e.preventDefault()
        if (!singerAlias.trim()) return
        
        const { error } = await supabase.from('session_singers').insert([{
            session_id: sessionId,
            name: singerAlias.trim(),
            status: 'pending',
            total_points: 0,
            bhnl_id: currentUser.id
        }])
        
        if (error) {
            alert(`Failed to send request: ${error.message}`)
            return
        }
        
        setShowJoinModal(false)
    }

    const handleSubmitVote = async (singer) => {
        const lastVoteTime = votedFor[singer.id] || 0
        if (Date.now() - lastVoteTime < 5000) {
            alert("Please wait a few seconds before scoring this singer again!")
            return
        }

        let pointsToAdd = 0;
        
        if (session.voting_style === '1to5') {
            if (selectedStars === 0) return alert("Please select a star rating first!")
            pointsToAdd = selectedStars;
        } else if (session.voting_style === 'multi') {
            if (multiStars.performance === 0 || multiStars.wow === 0 || multiStars.originality === 0) return alert("Please rate all 3 categories!")
            pointsToAdd = multiStars.performance + multiStars.wow + multiStars.originality;
        } else {
            pointsToAdd = session.vote_value || 10;
        }

        if (superVoteActive && superVotesRemaining > 0) {
            pointsToAdd *= 2;
            setSuperVotesRemaining(prev => prev - 1);
            setSuperVoteActive(false); 
        }

        await supabase.from('session_singers').update({ total_points: (singer.total_points || 0) + pointsToAdd }).eq('id', singer.id)
        if (singer.bhnl_id) await supabase.rpc('add_points', { target_user_id: singer.bhnl_id, league_pts: pointsToAdd, life_pts: 0 })
        await supabase.rpc('add_points', { target_user_id: currentUser.id, league_pts: 0, life_pts: 2 })

        setSelectedStars(0)
        setMultiStars({ performance: 0, wow: 0, originality: 0 })
        setVotedFor(prev => ({ ...prev, [singer.id]: Date.now() }))
    }

    const StarRow = ({ label, value, onChange }) => (
        <div className="flex justify-between items-center bg-black/40 p-3 rounded-xl mb-2 border border-gray-800">
            <span className="text-xs text-gray-400 font-bold uppercase tracking-widest">{label}</span>
            <div className="flex gap-2">
                {[1,2,3,4,5].map(star => (
                    <button key={star} onClick={() => onChange(star)} className={`text-3xl transition-transform hover:scale-110 ${star <= value ? 'text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.8)]' : 'text-gray-700'}`}>
                        ★
                    </button>
                ))}
            </div>
        </div>
    )

    if (isLoading) return <div className="flex justify-center py-20"><div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div></div>

    const activeSinger = singers.find(s => s.status === 'singing')
    const queue = singers.filter(s => s.status === 'queued')

    return (
        <div className="max-w-md mx-auto space-y-6 animate-fade-in">
            
            <div className="bg-[#090812] border-2 border-blue-900/30 rounded-3xl p-6 text-center shadow-[0_0_20px_rgba(59,130,246,0.15)] relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-[#ff2d78]"></div>
                <h2 className="text-3xl font-['Bebas_Neue'] text-white tracking-widest mb-1">{session.session_title}</h2>
                <p className="text-blue-400 text-xs font-bold uppercase tracking-widest">Hosted by {session.host_name}</p>
                <button onClick={onExit} className="absolute top-4 right-4 text-gray-500 hover:text-white bg-black/50 w-8 h-8 rounded-full flex items-center justify-center text-xs">✕</button>
            </div>

            {activeSinger && superVotesRemaining > 0 && session.mode === 'league' && (
                <div className="flex justify-center animate-fade-in">
                    <button 
                        onClick={() => setSuperVoteActive(!superVoteActive)}
                        className={`flex items-center gap-2 px-6 py-3 rounded-full font-bold uppercase tracking-widest text-xs transition-all ${
                            superVoteActive 
                            ? 'bg-yellow-500 text-black shadow-[0_0_25px_rgba(234,179,8,0.7)] scale-105' 
                            : 'bg-gray-900 border border-yellow-500/50 text-yellow-500 hover:bg-gray-800 hover:scale-105'
                        }`}
                    >
                        <span className="text-lg">⭐</span>
                        {superVoteActive ? 'SUPERVOTE ARMED!' : 'USE SUPERVOTE'} 
                        <span className="bg-black/50 text-yellow-500 px-2 py-0.5 rounded-md ml-1 border border-yellow-500/30">x{superVotesRemaining}</span>
                    </button>
                </div>
            )}

            <div className={`bg-[#090812] border-2 ${activeSinger ? 'border-[#ff2d78] shadow-[0_0_30px_rgba(255,45,120,0.2)]' : 'border-gray-800'} rounded-3xl p-6 relative overflow-hidden transition-all duration-500`}>
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-2xl font-['Bebas_Neue'] text-white tracking-widest">On Stage Now</h3>
                    <span className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-[#ff2d78] bg-[#ff2d78]/10 px-2 py-1 rounded border border-[#ff2d78]/30">
                        <span className="w-2 h-2 rounded-full bg-[#ff2d78] animate-pulse"></span> Live
                    </span>
                </div>

                {activeSinger ? (
                    <div className="text-center animate-fade-in">
                        <h4 className="text-4xl font-bold text-white mb-6 drop-shadow-md">{activeSinger.name}</h4>
                        
                        {session.voting_style === 'multi' ? (
                            <div className="mb-6">
                                <StarRow label="Performance" value={multiStars.performance} onChange={val => setMultiStars({...multiStars, performance: val})} />
                                <StarRow label="Wow Factor" value={multiStars.wow} onChange={val => setMultiStars({...multiStars, wow: val})} />
                                <StarRow label="Originality" value={multiStars.originality} onChange={val => setMultiStars({...multiStars, originality: val})} />
                                <button onClick={() => handleSubmitVote(activeSinger)} className="w-full mt-4 bg-green-600 hover:bg-green-500 text-white py-4 rounded-xl font-bold text-sm uppercase tracking-widest transition-all shadow-[0_0_15px_rgba(34,197,94,0.4)]">
                                    Submit Scores
                                </button>
                            </div>
                        ) : session.voting_style === '1to5' ? (
                            <div className="mb-6">
                                <StarRow label="Overall Rating" value={selectedStars} onChange={setSelectedStars} />
                                <button onClick={() => handleSubmitVote(activeSinger)} className="w-full mt-4 bg-blue-600 hover:bg-blue-500 text-white py-4 rounded-xl font-bold text-sm uppercase tracking-widest transition-all shadow-[0_0_15px_rgba(59,130,246,0.4)]">
                                    Submit Rating
                                </button>
                            </div>
                        ) : (
                            <button 
                                onClick={() => handleSubmitVote(activeSinger)} 
                                className="w-32 h-32 mx-auto rounded-full bg-gradient-to-br from-[#ff2d78] to-purple-600 flex items-center justify-center text-6xl shadow-[0_0_30px_rgba(255,45,120,0.6)] hover:scale-105 active:scale-95 transition-all mb-6"
                            >
                                {session.voting_icon === 'star' ? '⭐' : session.voting_icon === 'fire' ? '🔥' : '👏'}
                            </button>
                        )}

                        <div className="bg-black/50 p-4 rounded-2xl border border-gray-800">
                            <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest block mb-1">Current Score</span>
                            <span className="text-4xl font-['Bebas_Neue'] tracking-widest text-[#00f5ff] drop-shadow-[0_0_10px_rgba(0,245,255,0.5)]">
                                {activeSinger.total_points}
                            </span>
                        </div>
                    </div>
                ) : (
                    <div className="text-center py-10 opacity-50">
                        <div className="text-5xl mb-4">🎤</div>
                        <p className="text-gray-400 font-bold uppercase tracking-widest text-xs">Stage is empty</p>
                    </div>
                )}
            </div>

            <div className="bg-[#090812] border-2 border-gray-800 rounded-3xl p-6">
                <h3 className="text-xl font-['Bebas_Neue'] text-gray-400 tracking-widest mb-4">Up Next</h3>
                <div className="space-y-3 mb-6">
                    {queue.length === 0 ? (
                        <p className="text-center text-gray-600 font-bold uppercase tracking-widest text-[10px] py-4">No singers queued</p>
                    ) : (
                        queue.map((singer, index) => (
                            <div key={singer.id} className="bg-black/40 border border-gray-800 rounded-xl p-4 flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="font-['Bebas_Neue'] text-2xl w-6 text-center text-gray-600">{index + 1}</div>
                                    <h4 className="font-bold text-gray-300 text-lg leading-tight">{singer.name} {singer.bhnl_id === currentUser.id && <span className="text-gray-500 text-xs font-sans ml-2">(You)</span>}</h4>
                                </div>
                                <span className="text-gray-600 font-['Bebas_Neue'] text-2xl">{singer.total_points}</span>
                            </div>
                        ))
                    )}
                </div>

                {!currentStatus && (
                    <button onClick={() => setShowJoinModal(true)} className="w-full bg-purple-600/20 hover:bg-purple-600 text-purple-400 hover:text-white border border-purple-500/30 py-3.5 rounded-xl font-bold text-xs uppercase tracking-widest transition-colors">
                        🎙️ Request to Sing
                    </button>
                )}
                {currentStatus === 'pending' && (
                    <div className="w-full bg-yellow-900/20 border border-yellow-500/30 text-yellow-500 py-3.5 rounded-xl font-bold text-xs uppercase tracking-widest text-center animate-pulse">
                        ⏳ Request Pending Host Approval...
                    </div>
                )}
            </div>

            {showJoinModal && (
                <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <form onSubmit={handleRequestJoin} className="bg-gray-900 border-2 border-purple-500/30 p-8 rounded-3xl w-full max-w-sm shadow-[0_0_50px_rgba(147,51,234,0.2)] animate-slide-up-fast">
                        <div className="text-4xl mb-4 text-center">🎙️</div>
                        <h3 className="text-3xl font-['Bebas_Neue'] tracking-widest mb-2 text-white text-center">Hit the Stage</h3>
                        <p className="text-gray-400 text-xs mb-6 uppercase tracking-widest text-center">What alias should the host call you?</p>
                        
                        <input 
                            type="text" 
                            value={singerAlias} 
                            onChange={e => setSingerAlias(e.target.value)} 
                            placeholder="Your Stage Name..." 
                            className="w-full bg-black border border-gray-700 text-white rounded-xl p-4 focus:border-purple-500 outline-none mb-6"
                            required
                        />

                        <div className="flex gap-3">
                            <button type="button" onClick={() => setShowJoinModal(false)} className="flex-1 border border-gray-700 text-gray-400 rounded-xl text-xs font-bold uppercase tracking-widest hover:text-white py-3">Cancel</button>
                            <button type="submit" className="flex-1 bg-purple-600 text-white rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-purple-500 shadow-[0_0_15px_rgba(147,51,234,0.4)] py-3">Submit Request</button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    )
}