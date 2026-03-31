import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

export default function KSocialHost({ currentUser, mode, onExit }) {
    const [view, setView] = useState('start_menu')
    const [activeSession, setActiveSession] = useState(null)
    const [isLoading, setIsLoading] = useState(true)
    
    // Session State
    const [sessionTitle, setSessionTitle] = useState('KSocial LIVE!')
    const [hostName, setHostName] = useState(currentUser.username)
    const [bizName, setBizName] = useState('Black Hills Nightlife')
    const [venueName, setVenueName] = useState('')

    // 1. THE PERSISTENCE CHECK: Does a session already exist?
    useEffect(() => {
        const checkExistingSession = async () => {
            const { data } = await supabase.from('active_sessions')
                .select('*')
                .eq('host_id', currentUser.id)
                .single()
            
            if (data) {
                // Recover the lost session!
                setActiveSession(data)
                setView('dashboard')
            }
            setIsLoading(false)
        }
        checkExistingSession()
    }, [currentUser.id])

    // 2. CREATE A NEW SESSION
    const handleStartSession = async () => {
        const newSession = {
            host_id: currentUser.id,
            host_name: hostName,
            session_title: sessionTitle,
            venue_name: venueName,
            mode: mode 
            // Note: We'll add business_name to the database in a second if needed!
        }

        const { data, error } = await supabase.from('active_sessions').insert([newSession]).select().single()
        
        if (error) {
            // THIS WILL TELL US EXACTLY WHAT BROKE
            alert(`Supabase Error: ${error.message}`)
            console.error("FULL ERROR:", error)
        } else if (data) {
            setActiveSession(data)
            setView('dashboard')
        }
    }

    // 3. END SESSION & DISTRIBUTE POINTS
    const handleEndSession = async () => {
        if (window.confirm("🛑 Are you sure you want to end this session? If this is a League Session, all points will be distributed now.")) {
            // Trigger the secure backend script we just wrote
            await supabase.rpc('close_ksocial_session', { target_session_id: activeSession.id })
            
            alert(activeSession.mode === 'league' ? "🏆 League Session Ended! Points have been paid out to the Leaderboards." : "Session Ended.")
            
            setActiveSession(null)
            onExit() // Kick them back to the main BHNL Live tab
        }
    }

    if (isLoading) return <div className="flex justify-center py-20"><div className="w-12 h-12 border-4 border-[#ff2d78] border-t-transparent rounded-full animate-spin"></div></div>

    if (view === 'start_menu') {
        return (
            <div className="max-w-md mx-auto p-8 text-center animate-fade-in pb-32">
                <h1 className="text-7xl font-['Bebas_Neue'] text-[#ff2d78] leading-none mb-2 drop-shadow-[0_0_15px_rgba(255,45,120,0.6)]">KSocial LIVE!</h1>
                <p className="text-gray-400 text-sm tracking-widest uppercase mb-10">Host Control Panel <span className="text-[#00f5ff]">({mode})</span></p>

                <div className="flex flex-col gap-3">
                    <button onClick={() => setView('new_session')} className="bg-[#00f5ff]/10 border border-[#00f5ff] text-[#00f5ff] p-4 rounded-xl text-lg font-bold shadow-[0_0_15px_rgba(0,245,255,0.2)] hover:bg-[#00f5ff]/20 transition-all">
                        🆕 Start New Session
                    </button>
                    <button className="bg-[#ffe94d]/10 border border-[#ffe94d] text-[#ffe94d] p-4 rounded-xl text-lg font-bold shadow-[0_0_15px_rgba(255,233,77,0.2)] hover:bg-[#ffe94d]/20 transition-all">
                        📂 Load Session
                    </button>
                    <button onClick={onExit} className="bg-transparent text-gray-500 p-3 mt-4 text-sm font-bold uppercase tracking-widest hover:text-white transition-all">
                        ← Back to App
                    </button>
                </div>
            </div>
        )
    }

    if (view === 'new_session') {
        return (
            <div className="max-w-md mx-auto p-4 animate-fade-in pb-32">
                <h2 className="text-5xl font-['Bebas_Neue'] text-[#00f5ff] text-center mb-6 drop-shadow-[0_0_10px_rgba(0,245,255,0.6)]">New Session</h2>
                
                <div className="bg-[#090812] border border-gray-800 p-6 rounded-2xl shadow-2xl space-y-4">
                    <div>
                        <label className="block text-[10px] text-gray-500 uppercase tracking-widest mb-1">Session Title</label>
                        <input type="text" value={sessionTitle} onChange={e => setSessionTitle(e.target.value)} className="w-full bg-black border border-gray-700 text-white rounded-lg p-3 focus:border-[#00f5ff] outline-none" />
                    </div>
                    <div>
                        <label className="block text-[10px] text-gray-500 uppercase tracking-widest mb-1">Host / DJ Name</label>
                        <input type="text" value={hostName} onChange={e => setHostName(e.target.value)} className="w-full bg-black border border-gray-700 text-white rounded-lg p-3 focus:border-[#00f5ff] outline-none" />
                    </div>
                    <div>
                        <label className="block text-[10px] text-gray-500 uppercase tracking-widest mb-1">Venue Name</label>
                        <input type="text" value={venueName} onChange={e => setVenueName(e.target.value)} className="w-full bg-black border border-gray-700 text-white rounded-lg p-3 focus:border-[#00f5ff] outline-none" />
                    </div>

                    <button onClick={handleStartSession} className="w-full bg-[#00f5ff] text-black font-bold uppercase tracking-widest py-4 rounded-xl mt-4 hover:bg-[#00d5dd] shadow-[0_0_20px_rgba(0,245,255,0.4)] transition-all">
                        Launch Session!
                    </button>
                    <button onClick={() => setView('start_menu')} className="w-full bg-transparent text-gray-500 font-bold uppercase tracking-widest py-3 rounded-xl mt-2 hover:text-white transition-all">
                        Cancel
                    </button>
                </div>
            </div>
        )
    }

    if (view === 'dashboard' && activeSession) {
        return (
            <div className="max-w-xl mx-auto p-4 animate-fade-in pb-32 mt-4">
                
                {/* 1. DASHBOARD HEADER */}
                <div className="bg-[#090812] border border-[#ff2d78]/50 p-6 rounded-3xl shadow-[0_0_30px_rgba(255,45,120,0.15)] text-center relative overflow-hidden mb-6">
                    <div className="absolute top-4 right-4 bg-[#ff2d78]/20 text-[#ff2d78] px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border border-[#ff2d78]/50 animate-pulse">
                        Live Room
                    </div>
                    
                    <h2 className="text-5xl font-['Bebas_Neue'] text-white tracking-widest mb-2 mt-4">{activeSession.session_title}</h2>
                    <p className="text-gray-400 text-xs uppercase tracking-widest font-bold mb-6">Host: {activeSession.host_name} • Mode: <span className={activeSession.mode === 'league' ? 'text-[#00f5ff]' : 'text-gray-300'}>{activeSession.mode}</span></p>
                    
                    <div className="flex gap-4 justify-center">
                        <button className="flex-1 bg-white/5 border border-gray-700 text-white px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-white/10 transition-colors">
                            + Add Singer
                        </button>
                        <button onClick={handleEndSession} className="flex-1 bg-red-900/20 border border-red-500 text-red-500 px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-red-500 hover:text-white transition-colors shadow-[0_0_15px_rgba(239,68,68,0.3)]">
                            🛑 End Session
                        </button>
                    </div>
                </div>

                {/* 2. THE QUEUE (Placeholder for next step) */}
                <div className="space-y-3">
                    <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest px-2">Live Queue & Leaderboard</h3>
                    <div className="text-center p-8 border border-dashed border-gray-800 rounded-2xl bg-black/50">
                        <p className="text-gray-500 text-sm font-bold tracking-widest uppercase">No singers added yet.</p>
                        <p className="text-gray-600 text-[10px] mt-2">Users can join this session from the Live tab.</p>
                    </div>
                </div>

            </div>
        )
    }
}