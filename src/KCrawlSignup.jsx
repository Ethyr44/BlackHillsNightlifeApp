import { useState } from 'react'
import { supabase } from './supabaseClient'
// Import a simplified version of your SongBook here if needed

export default function KCrawlSignup() {
    const [step, setStep] = useState(0)
    const [loading, setLoading] = useState(false)
    
    // User Data
    const [fullName, setFullName] = useState('')
    const [birthday, setBirthday] = useState('')
    const [role, setRole] = useState('') // 'Singer' or 'Voter'
    const [agreed, setAgreed] = useState(false)
    
    // Singer Data
    const [stageName, setStageName] = useState('')
    const [tempSetlist, setTempSetlist] = useState([]) // Array of song IDs

    const handleCreateGhostAccount = async () => {
        setLoading(true)
        
        // 1. Generate Ghost Credentials
        const dummyEmail = `crawler_${Date.now()}_${Math.floor(Math.random() * 1000)}@bhnltemp.local`
        const dummyPassword = Math.random().toString(36).slice(-10) + 'A1!'

        // 2. Sign up securely behind the scenes
        const { data: authData, error: authError } = await supabase.auth.signUp({
            email: dummyEmail,
            password: dummyPassword
        })

        if (authError) {
            alert("Error generating credentials: " + authError.message)
            setLoading(false)
            return
        }

        // 3. Update the Profile with Crawl constraints
        if (authData?.user) {
            await supabase.from('profiles').update({
                full_name: fullName,
                username: role === 'Singer' ? stageName : fullName.split(' ')[0],
                account_type: role === 'Voter' ? 'Voter' : 'Temp_Crawl',
                active_setlist: tempSetlist,
                onboarding_complete: true
            }).eq('id', authData.user.id)

            // Hard redirect into the KSocial Live Hub
            window.location.href = '/?tab=Live'
        }
    }

    return (
        <div className="min-h-screen bg-[#090812] flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-md bg-black border-2 border-purple-500/30 p-6 rounded-3xl shadow-2xl relative">
                
                {/* 🟢 NEW STEP 0: The Account Check */}
                {step === 0 && (
                    <div className="animate-fade-in text-center">
                        <h2 className="text-5xl font-['Bebas_Neue'] text-white tracking-widest mb-4">Karaoke Crawl</h2>
                        <div className="bg-purple-900/20 border border-purple-500/30 p-6 rounded-2xl mb-6">
                            <p className="text-gray-300 text-sm font-bold mb-2">Wait a second!</p>
                            <p className="text-gray-400 text-xs uppercase tracking-widest">Do you already have a Black Hills Nightlife App account?</p>
                        </div>
                
                        <div className="space-y-4">
                            <button 
                                onClick={() => window.location.href = '/?mode=login'}
                                className="w-full bg-[#00f5ff] hover:bg-[#00d5dd] text-black py-4 rounded-xl font-bold uppercase tracking-widest transition-colors shadow-[0_0_15px_rgba(0,245,255,0.4)]"
                            >
                                Yes, Sign In Normally
                            </button>
                            
                            <div className="relative py-4">
                                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-800"></div></div>
                                <div className="relative flex justify-center text-sm"><span className="px-3 bg-black text-gray-500 font-bold uppercase tracking-widest text-[10px]">OR</span></div>
                            </div>
                
                            <button 
                                onClick={() => setStep(1)}
                                className="w-full bg-gray-900 hover:bg-gray-800 border border-gray-700 text-white py-4 rounded-xl font-bold uppercase tracking-widest transition-colors"
                            >
                                No, I need a Temp Pass
                            </button>
                        </div>
                    </div>
                )}
                
                {step === 1 && (
                    <div className="animate-fade-in">
                        <h2 className="text-4xl font-['Bebas_Neue'] text-white tracking-widest text-center mb-6">Karaoke Crawl Pass</h2>
                        
                        <div className="space-y-4">
                            <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Full Name" className="w-full bg-gray-900 border border-gray-700 text-white p-4 rounded-xl outline-none focus:border-purple-500" />
                            
                            <div>
                                <label className="text-[10px] text-gray-500 font-bold uppercase tracking-widest ml-1">Date of Birth</label>
                                <input type="date" value={birthday} onChange={e => setBirthday(e.target.value)} className="w-full bg-gray-900 border border-gray-700 text-white p-4 rounded-xl outline-none focus:border-purple-500 mt-1 block" />
                            </div>

                            <div className="grid grid-cols-2 gap-3 pt-2">
                                <button onClick={() => setRole('Voter')} className={`p-4 rounded-xl border-2 font-bold uppercase tracking-widest text-xs transition-all ${role === 'Voter' ? 'bg-blue-900/30 border-blue-500 text-blue-400' : 'bg-gray-900 border-gray-800 text-gray-500 hover:border-gray-600'}`}>
                                    🍺 Just Voting
                                </button>
                                <button onClick={() => setRole('Singer')} className={`p-4 rounded-xl border-2 font-bold uppercase tracking-widest text-xs transition-all ${role === 'Singer' ? 'bg-purple-900/30 border-purple-500 text-purple-400' : 'bg-gray-900 border-gray-800 text-gray-500 hover:border-gray-600'}`}>
                                    🎤 I'm Singing
                                </button>
                            </div>

                            <div className="flex items-start gap-3 mt-4 bg-gray-900/50 p-3 rounded-lg border border-gray-800">
                                <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)} className="mt-1" />
                                <label className="text-[10px] text-gray-500 leading-tight">I agree to the Terms of Service. I understand this is a temporary event pass.</label>
                            </div>

                            <button 
                                disabled={!fullName || !birthday || !role || !agreed} 
                                onClick={() => role === 'Singer' ? setStep(2) : handleCreateGhostAccount()}
                                className="w-full bg-purple-600 hover:bg-purple-500 disabled:bg-gray-800 disabled:text-gray-600 text-white py-4 rounded-xl font-bold uppercase tracking-widest mt-4 transition-colors"
                            >
                                {role === 'Singer' ? 'Next: Build Setlist' : 'Enter the Hub'}
                            </button>
                        </div>
                    </div>
                )}

                {step === 2 && role === 'Singer' && (
                    <div className="animate-fade-in">
                        <h2 className="text-3xl font-['Bebas_Neue'] text-purple-400 tracking-widest text-center mb-4">Stage Prep</h2>
                        
                        <input type="text" value={stageName} onChange={e => setStageName(e.target.value)} placeholder="Enter your Stage Name..." className="w-full bg-gray-900 border border-gray-700 text-white p-4 rounded-xl outline-none focus:border-purple-500 mb-6" />

                        {/* Note: You will render a miniaturized version of your Karafun Search here to populate tempSetlist */}
                        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-6 text-center h-40 flex items-center justify-center">
                            <p className="text-gray-500 text-xs font-bold uppercase tracking-widest">Miniature Songbook Component Goes Here.<br/>Select 3 to 7 songs.</p>
                        </div>

                        <div className="flex justify-between items-center mb-4">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{tempSetlist.length} / 7 Songs</span>
                            <button onClick={() => setStep(1)} className="text-[10px] font-bold uppercase tracking-widest text-gray-500 hover:text-white">Back</button>
                        </div>

                        <button 
                            disabled={!stageName || tempSetlist.length < 3 || loading} 
                            onClick={handleCreateGhostAccount}
                            className="w-full bg-purple-600 hover:bg-purple-500 disabled:bg-gray-800 disabled:text-gray-600 text-white py-4 rounded-xl font-bold uppercase tracking-widest transition-colors shadow-[0_0_15px_rgba(147,51,234,0.3)]"
                        >
                            {loading ? 'Generating Pass...' : 'Lock Setlist & Enter Hub'}
                        </button>
                    </div>
                )}

                {/* THE BAILOUT LINK */}
                <div className="mt-8 text-center border-t border-gray-800 pt-6">
                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-2">Already in the scene?</p>
                    <a href="/?mode=login" className="text-xs text-[#00f5ff] hover:text-white font-bold uppercase tracking-widest transition-colors">
                        Use Black Hills Nightlife Account
                    </a>
                </div>

            </div>
        </div>
    )
}