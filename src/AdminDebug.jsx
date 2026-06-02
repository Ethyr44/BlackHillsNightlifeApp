import { useState } from 'react'
import { supabase } from './supabaseClient'

export default function AdminDebug({ setTestOnboardingType, setShowSplash }) {
    const [loading, setLoading] = useState(false)

    // 1. Trigger Splashscreen
    const handleRunSplash = () => {
        if (setShowSplash) {
            setShowSplash(true)
            setTimeout(() => setShowSplash(false), 3000)
        } else {
            alert("Splash screen state not connected.")
        }
    }

    // 2. Global Notifications
    const handleTestNotifications = async () => {
        if (!window.confirm("Send a test notification to EVERY user in the database?")) return
        setLoading(true)
        const { error } = await supabase.rpc('test_global_notification')
        if (error) alert("Error: " + error.message)
        else alert("Notifications broadcasted!")
        setLoading(false)
    }

    // 3. Global Daily Bonus
    const handleTestBonus = async () => {
        if (!window.confirm("Distribute 50 L$ to EVERY user in the database?")) return
        setLoading(true)
        const { error } = await supabase.rpc('test_global_daily_bonus')
        if (error) alert("Error: " + error.message)
        else alert("50 L$ distributed to all users!")
        setLoading(false)
    }

    // 4. Test Account Creation (Ghost Auth)
    const handleTestAccount = async () => {
        setLoading(true)
        const dummyEmail = `debug_${Date.now()}@example.com`
        const dummyPassword = 'DebugPassword123!'

        const { data: authData, error: authError } = await supabase.auth.signUp({
            email: dummyEmail,
            password: dummyPassword
        })

        if (authError) {
            alert("Creation failed: " + authError.message)
        } else {
            // Because triggers create the profile automatically, we just update it
            await supabase.from('profiles').update({
                username: `DebugUser_${Math.floor(Math.random() * 1000)}`,
                account_type: 'Regular',
                account_status: 'approved',
                onboarding_completed: true // 🟢 BUG 1 FIX: Added the 'd' to match App.jsx!
            }).eq('id', authData.user.id)
            
            alert(`Test account created: ${dummyEmail}`)
        }
        setLoading(false)
    }

    return (
        <div className="space-y-6 animate-fade-in pb-10">
            <h3 className="text-3xl font-['Bebas_Neue'] text-red-500 tracking-widest border-b border-red-900/50 pb-2">God Mode (Debug)</h3>

            {/* 🟢 Test Onboarding Flows */}
            <div className="bg-gray-900 border border-gray-800 p-6 rounded-3xl">
                <h4 className="text-white text-sm font-bold uppercase tracking-widest mb-4">🚀 Test Onboarding Flows</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {['Regular', 'Singer', 'Venue', 'Performer', 'Host'].map(role => (
                        <button 
                            key={role}
                            onClick={() => setTestOnboardingType(role)}
                            className="bg-black hover:bg-gray-800 text-purple-400 hover:text-white border border-gray-800 hover:border-purple-500/50 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-colors"
                        >
                            {role} Flow
                        </button>
                    ))}
                </div>
                <p className="text-[9px] text-gray-500 uppercase tracking-widest mt-3">Triggers the specialized onboarding UI for the selected account type.</p>
            </div>

            {/* 🌍 Global Actions */}
            <div className="bg-red-900/10 border border-red-500/30 p-6 rounded-3xl">
                <h4 className="text-red-400 text-sm font-bold uppercase tracking-widest mb-4">🌍 Global Triggers</h4>
                <div className="space-y-3">
                    <button onClick={handleTestNotifications} disabled={loading} className="w-full bg-red-900/30 text-red-500 hover:bg-red-600 hover:text-white border border-red-500/50 py-4 rounded-xl text-xs font-bold uppercase tracking-widest transition-colors">
                        🔔 Blast Test Notification to All
                    </button>
                    <button onClick={handleTestBonus} disabled={loading} className="w-full bg-yellow-900/30 text-yellow-500 hover:bg-yellow-600 hover:text-black border border-yellow-500/50 py-4 rounded-xl text-xs font-bold uppercase tracking-widest transition-colors">
                        💰 Trigger Daily Bonus (All Users)
                    </button>
                </div>
            </div>

            {/* ⚙️ Local Tests */}
            <div className="bg-blue-900/10 border border-blue-500/30 p-6 rounded-3xl">
                <h4 className="text-blue-400 text-sm font-bold uppercase tracking-widest mb-4">⚙️ Local Tests</h4>
                <div className="space-y-3">
                    <button onClick={handleRunSplash} className="w-full bg-black text-blue-400 hover:text-white border border-blue-500/50 py-4 rounded-xl text-xs font-bold uppercase tracking-widest transition-colors">
                        🎬 Run Splashscreen
                    </button>
                    <button onClick={handleTestAccount} disabled={loading} className="w-full bg-black text-gray-400 hover:text-white border border-gray-700 py-4 rounded-xl text-xs font-bold uppercase tracking-widest transition-colors">
                        👤 Generate Dummy Account
                    </button>
                </div>
            </div>

        </div>
    )
}