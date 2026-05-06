import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

export default function KCrawlManager({ session }) {
    const [activeCrawl, setActiveCrawl] = useState(null)
    const [linkedSessions, setLinkedSessions] = useState([])
    const [selectedSession, setSelectedSession] = useState(null)
    const [loading, setLoading] = useState(true)

    // Data points for the modal
    const [sessionStats, setSessionStats] = useState({ singerCount: 0 })

    useEffect(() => {
        fetchHubData()
        
        // Listen for new sessions joining the crawl
        const sub = supabase.channel('crawl-admin')
            .on('postgres', { event: '*', schema: 'public', table: 'active_sessions' }, fetchHubData)
            .subscribe()

        return () => supabase.removeChannel(sub)
    }, [])

    const fetchHubData = async () => {
        setLoading(true)
        // 1. Check for Active Tournament
        const { data: crawlData } = await supabase
            .from('active_tournaments')
            .select('*')
            .eq('status', 'active')
            .maybeSingle()
        
        setActiveCrawl(crawlData)

        // 2. If active, fetch docked sessions
        if (crawlData) {
            const { data: sessionsData } = await supabase
                .from('active_sessions')
                .select('*')
                .eq('tournament_id', crawlData.id)
            
            if (sessionsData) setLinkedSessions(sessionsData)
        }
        setLoading(false)
    }

    const launchCrawl = async () => {
        const title = prompt("Enter a title for this Karaoke Crawl (e.g., Spring Fest 2026):")
        if (!title) return

        const { error } = await supabase.from('active_tournaments').insert([{ title }])
        if (error) alert("Failed to launch hub: " + error.message)
        else fetchHubData()
    }

    const endCrawl = async () => {
        if (!window.confirm("Are you sure you want to end the Karaoke Crawl? This will finalize the global leaderboards.")) return
        
        await supabase.from('active_tournaments').update({ status: 'completed' }).eq('id', activeCrawl.id)
        // Note: You would also trigger the Cloud Function here or rely on the cron job to wipe Temp accounts
        fetchHubData()
    }

    const openSessionDetails = async (sess) => {
        setSelectedSession(sess)
        
        // Fetch specific stats: Number of singers
        const { count } = await supabase
            .from('session_singers')
            .select('*', { count: 'exact', head: true })
            .eq('session_id', sess.id)
            
        setSessionStats({ singerCount: count || 0 })
    }

    // --- Admin Actions ---
    const handleAction = async (action) => {
        if (!selectedSession) return

        if (action === 'pause') {
            const newStatus = selectedSession.status === 'paused' ? 'active' : 'paused'
            await supabase.from('active_sessions').update({ status: newStatus }).eq('id', selectedSession.id)
            setSelectedSession({ ...selectedSession, status: newStatus })
            fetchHubData()
        }

        if (action === 'reset') {
            if (window.confirm("Clear the active singer queue for this session? Points remain intact.")) {
                await supabase.from('session_singers').update({ status: 'queued' }).eq('session_id', selectedSession.id).eq('status', 'singing')
                alert("Queue reset.")
            }
        }

        if (action === 'shutdown') {
            if (window.confirm("Force-close this stage? Points will be converted to L$ and users will be kicked back to the radar.")) {
                
                // 1. Trigger the massive L$ Payout server-side BEFORE deleting the session
                await supabase.rpc('payout_session_points', { p_session_id: selectedSession.id })
                
                // 2. Nuke the session (cascade delete will handle the session_singers)
                await supabase.from('active_sessions').delete().eq('id', selectedSession.id)
                
                setSelectedSession(null)
                fetchHubData()
                alert("Stage closed. All L$ payouts successful.")
            }
        }

        if (action === 'edit') {
            alert("Edit modal logic goes here (Change Venue, Change Style)")
            // Open a sub-modal to change venue_name, voting_style, etc.
        }
    }

    if (loading) return <div className="text-center text-blue-500 py-10 animate-pulse font-bold tracking-widest uppercase">Syncing Hub...</div>

    return (
        <div className="bg-[#090812] border-2 border-red-500/50 rounded-3xl p-6 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-600 to-orange-500"></div>
            
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-3xl font-['Bebas_Neue'] text-white tracking-widest">Crawl Command Center</h2>
                    <p className="text-red-400 text-[10px] font-bold uppercase tracking-widest">Master Tournament Hub</p>
                </div>
                {!activeCrawl ? (
                    <button onClick={launchCrawl} className="bg-red-600 hover:bg-red-500 text-white px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-widest shadow-[0_0_15px_rgba(239,68,68,0.4)]">
                        Initiate Crawl
                    </button>
                ) : (
                    <button onClick={endCrawl} className="bg-gray-800 hover:bg-red-900/50 text-gray-400 hover:text-red-400 px-6 py-3 border border-gray-700 hover:border-red-500/50 rounded-xl text-xs font-bold uppercase tracking-widest transition-colors">
                        Terminate Hub
                    </button>
                )}
            </div>

            {activeCrawl && (
                <>
                    <div className="bg-black/50 p-4 rounded-xl border border-red-900/30 mb-6 flex justify-between items-center">
                        <span className="text-white font-bold">{activeCrawl.title}</span>
                        <span className="text-[10px] text-green-400 font-bold uppercase tracking-widest animate-pulse">● Global Hub Online</span>
                    </div>

                    <h3 className="text-gray-500 text-xs font-bold uppercase tracking-widest mb-3">Docked Stages ({linkedSessions.length})</h3>
                    
                    {linkedSessions.length === 0 ? (
                        <div className="text-center py-8 border border-dashed border-gray-800 rounded-xl">
                            <p className="text-gray-600 text-xs uppercase tracking-widest font-bold">Waiting for KJs to launch sessions...</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {linkedSessions.map(sess => (
                                <button 
                                    key={sess.id}
                                    onClick={() => openSessionDetails(sess)}
                                    className={`bg-gray-900 border text-left p-4 rounded-xl transition-all hover:scale-[1.02] ${sess.status === 'paused' ? 'border-yellow-500/50 shadow-[0_0_15px_rgba(234,179,8,0.1)]' : 'border-[#00f5ff]/30 shadow-[0_0_15px_rgba(0,245,255,0.1)] hover:border-[#00f5ff]'}`}
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <h4 className="text-white font-bold text-lg leading-none">{sess.session_title}</h4>
                                        <span className={`w-2 h-2 rounded-full ${sess.status === 'paused' ? 'bg-yellow-500' : 'bg-[#00f5ff] animate-pulse'}`}></span>
                                    </div>
                                    <p className="text-gray-400 text-[10px] font-bold uppercase tracking-widest">📍 {sess.venue_name}</p>
                                    <p className="text-gray-500 text-[10px] font-bold uppercase tracking-widest mt-1">Host: {sess.host_name}</p>
                                </button>
                            ))}
                        </div>
                    )}
                </>
            )}

            {/* THE DETAILS & CONTROL MODAL */}
            {selectedSession && (
                <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-gray-900 border border-gray-700 rounded-3xl w-full max-w-md p-6 shadow-2xl animate-slide-up-fast">
                        <div className="flex justify-between items-start mb-6 border-b border-gray-800 pb-4">
                            <div>
                                <h3 className="text-2xl font-['Bebas_Neue'] text-white tracking-widest">{selectedSession.session_title}</h3>
                                <p className={`text-[10px] font-bold uppercase tracking-widest ${selectedSession.status === 'paused' ? 'text-yellow-500' : 'text-[#00f5ff]'}`}>
                                    {selectedSession.status === 'paused' ? 'STAGE PAUSED' : 'STAGE ACTIVE'}
                                </p>
                            </div>
                            <button onClick={() => setSelectedSession(null)} className="text-gray-500 hover:text-white bg-black w-8 h-8 rounded-full flex items-center justify-center">✕</button>
                        </div>

                        <div className="space-y-4 mb-8">
                            <div className="flex justify-between border-b border-gray-800 pb-2">
                                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Venue</span>
                                <span className="text-sm text-white font-bold">{selectedSession.venue_name}</span>
                            </div>
                            <div className="flex justify-between border-b border-gray-800 pb-2">
                                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Host</span>
                                <span className="text-sm text-white font-bold">{selectedSession.host_name}</span>
                            </div>
                            <div className="flex justify-between border-b border-gray-800 pb-2">
                                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Launch Time</span>
                                <span className="text-sm text-gray-300">{new Date(selectedSession.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                            </div>
                            <div className="flex justify-between border-b border-gray-800 pb-2">
                                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Singers Signed In</span>
                                <span className="text-sm text-[#00f5ff] font-bold">{sessionStats.singerCount}</span>
                            </div>
                            <div className="flex justify-between border-b border-gray-800 pb-2">
                                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Voting Style</span>
                                <span className="text-[10px] bg-purple-900/30 text-purple-400 border border-purple-500/30 px-2 py-0.5 rounded font-bold uppercase tracking-widest">
                                    {selectedSession.voting_style === 'normal' ? 'Standard' : selectedSession.voting_style === '1to5' ? '5-Star' : 'Multi-Category'}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Time of Last Singer</span>
                                <span className="text-sm text-gray-300">
                                    {selectedSession.last_stage_time 
                                        ? `${Math.floor((Date.now() - new Date(selectedSession.last_stage_time).getTime()) / 60000)} mins ago` 
                                        : 'Awaiting first singer'}
                                </span>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <button onClick={() => handleAction('edit')} className="bg-gray-800 text-gray-300 hover:bg-gray-700 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-colors">
                                ✏️ Edit Details
                            </button>
                            <button onClick={() => handleAction('pause')} className="bg-yellow-900/20 text-yellow-500 border border-yellow-500/30 hover:bg-yellow-500 hover:text-black py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-colors">
                                {selectedSession.status === 'paused' ? '▶ Unpause Stage' : '⏸ Pause Stage'}
                            </button>
                            <button onClick={() => handleAction('reset')} className="bg-gray-800 text-gray-300 hover:bg-gray-700 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-colors">
                                🔄 Reset Queue
                            </button>
                            <button onClick={() => handleAction('shutdown')} className="bg-red-900/20 text-red-500 border border-red-500/30 hover:bg-red-600 hover:text-white py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-colors shadow-[0_0_15px_rgba(239,68,68,0.2)]">
                                ⏹ Shut Down
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}