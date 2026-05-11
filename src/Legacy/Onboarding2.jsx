import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

const ZODIAC_SIGNS = [
  "♈ Aries", "♉ Taurus", "♊ Gemini", "♋ Cancer",
  "♌ Leo", "♍ Virgo", "♎ Libra", "♏ Scorpio",
  "♐ Sagittarius", "♑ Capricorn", "♒ Aquarius", "♓ Pisces"
]

const accountTypes = [
  { id: 'Regular', icon: '👤', title: 'Regular', desc: 'Just here to vibe, vote, and explore.' },
  { id: 'Singer', icon: '🎤', title: 'Singer', desc: 'I want to build setlists and hit the stage.' },
  { id: 'Performer', icon: '🎸', title: 'Performer', desc: 'I perform original music or live bands.' },
  { id: 'Host', icon: '🎧', title: 'Host', desc: 'I run karaoke or trivia events.' },
  { id: 'Venue', icon: '🏛️', title: 'Venue', desc: 'I manage a bar, club, or event space.' }
]

export default function Onboarding({ session, onComplete }) {
  const [step, setStep] = useState(1)
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  // Form State
  const [agreeTerms, setAgreeTerms] = useState(false)
  const [agreeAge, setAgreeAge] = useState(false)
  const [accountType, setAccountType] = useState('Regular')
  const [fullName, setFullName] = useState('')
  const [username, setUsername] = useState('')
  const [zodiac, setZodiac] = useState('')
  
  const [prefEvents, setPrefEvents] = useState([])
  const [prefVenues, setPrefVenues] = useState([])
  const [prefGenres, setPrefGenres] = useState([])

  // Dynamic Options from system_categories
  const [options, setOptions] = useState({ events: [], venues: [], genres: [] })

  useEffect(() => {
      async function fetchCategories() {
          const { data } = await supabase.from('system_categories').select('*')
          if (data) {
              setOptions({
                  events: data.filter(d => d.category_type === 'event').map(d => d.name),
                  venues: data.filter(d => d.category_type === 'venue').map(d => d.name),
                  genres: data.filter(d => d.category_type === 'genre').map(d => d.name)
              })
          }
      }
      fetchCategories()
  }, [])

  const toggleSelection = (list, setList, item) => {
      if (list.includes(item)) setList(list.filter(i => i !== item))
      else setList([...list, item])
  }

  // --- NEW: Handle Role Selection & Security ---
  const handleRoleSelection = (role) => {
      setAccountType(role)
      setStep(3)
  }

  const handleUsernameCheck = async () => {
      setErrorMsg('')
      if (!username.trim()) return setErrorMsg('Stage name is required.')
      if (username.length > 17) return setErrorMsg('Stage name must be 17 characters or less.')
      
      setSaving(true)
      const { data } = await supabase.from('profiles').select('id').ilike('username', username.trim()).maybeSingle()
      setSaving(false)

      if (data && data.id !== session.user.id) {
          setErrorMsg('That Stage Name is already taken! Please choose another.')
          return
      }
      setStep(4)
  }

  const finishOnboarding = async () => {
      setSaving(true)
      const finalUsername = username.trim()
      
      // 🟢 NEW: Determine if they require Admin approval
      const requiresApproval = ['Venue', 'Performer', 'Host'].includes(accountType)
      const initialStatus = requiresApproval ? 'pending' : 'approved'

      // Update Profile with new account_type
      await supabase.from('profiles').update({
          username: finalUsername,
          full_name: fullName.trim(),
          account_type: accountType,
          account_status: initialStatus, // 🟢 Inject the status
          zodiac_sign: zodiac,
          pref_events: prefEvents,
          pref_venues: prefVenues,
          pref_genres: prefGenres,
          onboarding_complete: true
      }).eq('id', session.user.id)

      // Inject Global Welcome Post into FYP
      let welcomeMessage = `${finalUsername} has joined the scene!`
      if (accountType === 'Host') welcomeMessage = `🎤 New Host Alert: ${finalUsername} has joined the scene!`
      if (accountType === 'Admin') welcomeMessage = `⚙️ Admin ${finalUsername} has authenticated.`

      await supabase.from('posts').insert([{
          author_id: session.user.id,
          content: welcomeMessage
      }])

      setSaving(false)
      onComplete()
  }

  return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center p-4">
        
        {/* STEP 1: AGREEMENTS */}
        {step === 1 && (
            <div className="w-full max-w-sm bg-black border border-gray-800 p-8 rounded-3xl shadow-2xl animate-fade-in">
                <h2 className="text-3xl font-['Bebas_Neue'] text-blue-400 mb-6 tracking-wider text-center">What's Boppin!<br/><span className="text-white text-xl">Let's get you signed up.</span></h2>
                
                <div className="space-y-4 mb-8">
                    <label className="flex items-start gap-3 cursor-pointer">
                        <input type="checkbox" checked={agreeTerms} onChange={e => setAgreeTerms(e.target.checked)} className="mt-1 w-5 h-5 accent-blue-500" />
                        <span className="text-sm text-gray-300 font-bold">I agree to the Terms of Service and Privacy Policy.</span>
                    </label>
                    <label className="flex items-start gap-3 cursor-pointer">
                        <input type="checkbox" checked={agreeAge} onChange={e => setAgreeAge(e.target.checked)} className="mt-1 w-5 h-5 accent-blue-500" />
                        <span className="text-sm text-gray-300 font-bold">I confirm that I am at least 18 years of age.</span>
                    </label>
                </div>

                <button 
                    disabled={!agreeTerms || !agreeAge} 
                    onClick={() => setStep(2)} 
                    className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-gray-800 disabled:text-gray-600 text-white py-4 rounded-xl font-bold uppercase tracking-widest transition-colors"
                >
                    Continue
                </button>
            </div>
        )}

        {/* STEP 2: ACCOUNT TYPE */}
        {step === 2 && (
            <div className="w-full max-w-sm bg-black border border-gray-800 p-8 rounded-3xl shadow-2xl animate-fade-in">
                <h2 className="text-3xl font-['Bebas_Neue'] text-blue-400 mb-2 tracking-wider text-center">Choose Your Path</h2>
                <p className="text-center text-gray-500 text-xs font-bold uppercase tracking-widest mb-6">Select your account type</p>
                
                <div className="space-y-3">
                    {accountTypes.map(type => (
                        <button key={type.id} onClick={() => handleRoleSelection(type.id)} className="w-full bg-gray-900 border border-gray-700 hover:border-blue-500 text-white p-4 rounded-xl text-left transition-all flex items-center gap-4">
                            <span className="text-3xl">{type.icon}</span>
                            <div>
                                <div className="font-bold uppercase tracking-widest">{type.title}</div>
                                <div className="text-[10px] text-gray-500">{type.desc}</div>
                            </div>
                        </button>
                    ))}
                </div>
            </div>
        )}

        {/* STEP 3: NAMES */}
        {step === 3 && (
            <div className="w-full max-w-sm bg-black border border-gray-800 p-8 rounded-3xl shadow-2xl animate-fade-in">
                <h2 className="text-3xl font-['Bebas_Neue'] text-blue-400 mb-6 tracking-wider text-center">Identity Setup</h2>
                
                <div className="space-y-6 mb-8">
                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 block">Real Name (Optional)</label>
                        <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="First & Last Name" className="w-full bg-gray-900 border border-gray-700 text-white rounded-xl p-4 focus:border-blue-500 outline-none" />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 block">Stage Name / Nickname *</label>
                        <input type="text" value={username} onChange={e => setUsername(e.target.value)} maxLength={17} placeholder="What should we call you?" className="w-full bg-gray-900 border border-gray-700 text-white rounded-xl p-4 focus:border-blue-500 outline-none" />
                        <p className="text-[10px] text-gray-500 mt-2 font-bold uppercase tracking-widest text-right">{username.length}/17</p>
                    </div>
                    {errorMsg && <p className="text-red-500 text-xs font-bold uppercase tracking-widest text-center animate-pulse">{errorMsg}</p>}
                </div>

                <button onClick={handleUsernameCheck} disabled={saving} className="w-full bg-blue-600 hover:bg-blue-500 text-white py-4 rounded-xl font-bold uppercase tracking-widest transition-colors">
                    {saving ? 'Verifying...' : 'Check Availability'}
                </button>
            </div>
        )}

        {/* STEP 4: ZODIAC */}
        {step === 4 && (
            <div className="w-full max-w-sm bg-black border border-gray-800 p-8 rounded-3xl shadow-2xl animate-fade-in">
                <h2 className="text-3xl font-['Bebas_Neue'] text-blue-400 mb-6 tracking-wider text-center">What's your zodiac sign?</h2>
                <div className="grid grid-cols-2 gap-3 mb-8">
                    {ZODIAC_SIGNS.map(sign => (
                        <button key={sign} onClick={() => setZodiac(sign)} className={`p-3 rounded-xl border font-bold text-sm transition-all ${zodiac === sign ? 'bg-purple-600/20 border-purple-500 text-purple-300' : 'bg-gray-900 border-gray-800 text-gray-500 hover:border-gray-600'}`}>
                            {sign}
                        </button>
                    ))}
                </div>
                <button disabled={!zodiac} onClick={() => setStep(5)} className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-gray-800 text-white py-4 rounded-xl font-bold uppercase tracking-widest transition-colors">Continue</button>
            </div>
        )}

        {/* STEP 5: EVENTS */}
        {step === 5 && (
            <div className="w-full max-w-xl bg-black border border-gray-800 p-8 rounded-3xl shadow-2xl animate-fade-in">
                <h2 className="text-3xl font-['Bebas_Neue'] text-blue-400 mb-2 tracking-wider text-center">What kind of Events are you into?</h2>
                <p className="text-center text-gray-500 text-xs font-bold uppercase tracking-widest mb-6">Choose at least 4 ({prefEvents.length}/4)</p>
                <div className="flex flex-wrap justify-center gap-3 mb-8">
                    {options.events.length === 0 ? <p className="text-red-500 text-xs">No events found in database. Admins must add them.</p> : options.events.map(item => (
                        <button key={item} onClick={() => toggleSelection(prefEvents, setPrefEvents, item)} className={`px-4 py-2 rounded-full border text-xs font-bold uppercase tracking-widest transition-all ${prefEvents.includes(item) ? 'bg-cyan-900/30 border-cyan-500 text-cyan-300' : 'bg-gray-900 border-gray-800 text-gray-500 hover:border-gray-600'}`}>
                            {item}
                        </button>
                    ))}
                </div>
                <button disabled={prefEvents.length < 4} onClick={() => setStep(6)} className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-gray-800 text-white py-4 rounded-xl font-bold uppercase tracking-widest transition-colors">Continue</button>
            </div>
        )}

        {/* STEP 6: VENUES */}
        {step === 6 && (
            <div className="w-full max-w-xl bg-black border border-gray-800 p-8 rounded-3xl shadow-2xl animate-fade-in">
                <h2 className="text-3xl font-['Bebas_Neue'] text-blue-400 mb-2 tracking-wider text-center">Which of these places would you go to?</h2>
                <p className="text-center text-gray-500 text-xs font-bold uppercase tracking-widest mb-6">Choose at least 4 ({prefVenues.length}/4)</p>
                <div className="flex flex-wrap justify-center gap-3 mb-8">
                    {options.venues.length === 0 ? <p className="text-red-500 text-xs">No venues found in database. Admins must add them.</p> : options.venues.map(item => (
                        <button key={item} onClick={() => toggleSelection(prefVenues, setPrefVenues, item)} className={`px-4 py-2 rounded-full border text-xs font-bold uppercase tracking-widest transition-all ${prefVenues.includes(item) ? 'bg-purple-900/30 border-purple-500 text-purple-300' : 'bg-gray-900 border-gray-800 text-gray-500 hover:border-gray-600'}`}>
                            {item}
                        </button>
                    ))}
                </div>
                <button disabled={prefVenues.length < 4} onClick={() => setStep(7)} className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-gray-800 text-white py-4 rounded-xl font-bold uppercase tracking-widest transition-colors">Continue</button>
            </div>
        )}

        {/* STEP 7: GENRES */}
        {step === 7 && (
            <div className="w-full max-w-xl bg-black border border-gray-800 p-8 rounded-3xl shadow-2xl animate-fade-in">
                <h2 className="text-3xl font-['Bebas_Neue'] text-blue-400 mb-2 tracking-wider text-center">Which Music Genres describe your Taste?</h2>
                <p className="text-center text-gray-500 text-xs font-bold uppercase tracking-widest mb-6">Pick at least 2 ({prefGenres.length}/2)</p>
                <div className="flex flex-wrap justify-center gap-3 mb-8">
                    {options.genres.length === 0 ? <p className="text-red-500 text-xs">No genres found in database. Admins must add them.</p> : options.genres.map(item => (
                        <button key={item} onClick={() => toggleSelection(prefGenres, setPrefGenres, item)} className={`px-4 py-2 rounded-full border text-xs font-bold uppercase tracking-widest transition-all ${prefGenres.includes(item) ? 'bg-[#ff2d78]/20 border-[#ff2d78] text-[#ff2d78]' : 'bg-gray-900 border-gray-800 text-gray-500 hover:border-gray-600'}`}>
                            {item}
                        </button>
                    ))}
                </div>
                <button disabled={prefGenres.length < 2 || saving} onClick={finishOnboarding} className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-gray-800 text-white py-4 rounded-xl font-bold uppercase tracking-widest transition-colors shadow-[0_0_20px_rgba(59,130,246,0.3)]">
                    {saving ? 'Finalizing...' : 'Complete Profile'}
                </button>
            </div>
        )}
    </div>
  )
}