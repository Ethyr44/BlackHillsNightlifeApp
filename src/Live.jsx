import { useState } from 'react'
import { supabase } from './supabaseClient'

export default function Live({ currentUser }) {
    const [activeSessions, setActiveSessions] = useState([])
    const [isScanning, setIsScanning] = useState(false)
    const [scanComplete, setScanComplete] = useState(false)

    const scanForSessions = async () => {
        setIsScanning(true)
        setScanComplete(false)
        
        setTimeout(async () => {
            // 1. THE GHOST FIX: Only fetch sessions created in the last 12 hours
            const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString()
            
            const { data, error } = await supabase
                .from('active_sessions')
                .select('*')
                .gte('created_at', twelveHoursAgo)
                .order('created_at', { ascending: false })

            if (data) {
                // 2. THE DEDUPLICATION FIX: If a host crashed and restarted, only show their most recent session
                const uniqueSessions = []
                const seenHosts = new Set()
                
                data.forEach(sess => {
                    if (!seenHosts.has(sess.host_name)) {
                        seenHosts.add(sess.host_name)
                        uniqueSessions.push(sess)
                    }
                })
                
                setActiveSessions(uniqueSessions)
            }
            setIsScanning(false)
            setScanComplete(true)
        }, 1500)
    }

    const handleJoin = (localIp, hostName) => {
        if (window.confirm(`Join ${hostName}'s Nearby Session?`)) {
            // THE URL BUG FIX: Query parameters (?bhnl_id=...) MUST come BEFORE the hash (#user)
            const ksocialUrl = `http://${localIp}/?bhnl_id=${currentUser.id}#user`
            window.location.href = ksocialUrl
        }
    }

    return (
        <div className="p-4 space-y-6 animate-fade-in pb-32">
            <div className="flex justify-between items-end border-b border-gray-800 pb-2">
                <h2 className="text-4xl font-['Bebas_Neue'] text-blue-400 tracking-wider">LIVE SESSIONS</h2>
                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Local Network</span>
            </div>

            <div className="bg-gray-900 border border-gray-800 rounded-3xl p-6 text-center shadow-xl">
                <div className={`text-6xl mb-4 ${isScanning ? 'animate-spin' : 'animate-pulse'}`}>📡</div>
                <h3 className="text-white font-bold tracking-widest uppercase text-sm mb-2">Find Local DJs</h3>
                <p className="text-xs text-gray-400 mb-6">Connect to the venue's Wi-Fi to join the Karaoke queue instantly.</p>
                
                <button 
                    onClick={scanForSessions}
                    disabled={isScanning}
                    className={`w-full py-4 rounded-xl font-bold uppercase tracking-widest text-xs transition-all ${
                        isScanning ? 'bg-blue-900/50 text-blue-400 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.4)]'
                    }`}
                >
                    {isScanning ? 'Scanning Network...' : 'Scan for Sessions Near Me'}
                </button>
            </div>

            {scanComplete && activeSessions.length === 0 && (
                <div className="text-center p-6 border border-dashed border-gray-700 rounded-xl">
                    <p className="text-gray-500 text-sm font-bold uppercase tracking-widest">No active sessions found on your network.</p>
                </div>
            )}

            {scanComplete && activeSessions.length > 0 && (
                <div className="space-y-4">
                    <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest px-2">Discovered Hosts</h4>
                    
                    {activeSessions.map(sess => (
                        <div key={sess.id} className="bg-blue-900/10 border border-blue-500/30 rounded-2xl p-4 flex items-center justify-between shadow-lg hover:border-blue-500/60 transition-colors">
                            <div>
                                <h4 className="font-bold text-white text-lg">{sess.host_name}</h4>
                                <p className="text-gray-400 text-xs">📍 {sess.venue_name}</p>
                            </div>
                            <button 
                                onClick={() => handleJoin(sess.local_ip, sess.host_name)}
                                className="bg-blue-600 text-white px-5 py-2.5 rounded-full text-xs font-bold uppercase tracking-widest hover:bg-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.3)]"
                            >
                                Join
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}