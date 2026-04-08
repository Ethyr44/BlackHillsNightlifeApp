import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

const ZODIAC_SIGNS = [
  "♈ Aries", "♉ Taurus", "♊ Gemini", "♋ Cancer",
  "♌ Leo", "♍ Virgo", "♎ Libra", "♏ Scorpio",
  "♐ Sagittarius", "♑ Capricorn", "♒ Aquarius", "♓ Pisces"
]

export default function Onboarding({ session, onComplete }) {
  const [step, setStep] = useState(1)
  const [username, setUsername] = useState('')
  const [accountType, setAccountType] = useState('Singer')
  const [zodiac, setZodiac] = useState('')
  const [saving, setSaving] = useState(false)

  // 🟢 NEW: Security states for Host/Admin PIN
  const [showPinModal, setShowPinModal] = useState(false)
  const [pendingRole, setPendingRole] = useState('')
  const [pinCode, setPinCode] = useState('')

  // Dynamic Options State
  const [options, setOptions] = useState({ venues: [], genres: [], events: [] })
  const [prefs, setPrefs] = useState({ venues: [], genres: [], events: [] })

  // Fetch options from the database
  useEffect(() => {
      async function fetchCategories() {
          const { data } = await supabase.from('system_categories').select('*')
          if (data) {
              setOptions({
                  venues: data.filter(d => d.category_type === 'venue').map(d => d.name),
                  genres: data.filter(d => d.category_type === 'genre').map(d => d.name),
                  events: data.filter(d => d.category_type === 'event').map(d => d.name)
              })
          }
      }
      fetchCategories()
  }, [])

  const toggleSelection = (category, item) => {
    setPrefs(prev => {
      const current = prev[category]
      if (current.includes(item)) return { ...prev, [category]: current.filter(i => i !== item) }
      return { ...prev, [category]: [...current, item] }
    })
  }

  // 🟢 NEW: Role selection logic with PIN gate
  const handleRoleSelect = (type) => {
      if (type === 'Host' || type === 'Admin') {
          setPendingRole(type)
          setShowPinModal(true)
      } else {
          setAccountType(type)
      }
  }

  // 🟢 NEW: Verify the PIN before assigning restricted roles
  const verifyPin = () => {
      if (pinCode === '1144') {
          setAccountType(pendingRole)
          setShowPinModal(false)
          setPinCode('')
      } else {
          alert('Incorrect PIN. Access denied.')
          setPinCode('')
      }
  }

  const handleFinish = async () => {
    if (!username.trim()) return alert("Your stage name is required!")
    
    setSaving(true)
    const payload = {
      id: session.user.id,
      username: username.trim(), 
      account_type: accountType,
      zodiac_sign: zodiac,
      pref_venues: prefs.venues, 
      pref_genres: prefs.genres, 
      pref_events: prefs.events,
      onboarding_complete: true,
      updated_at: new Date().toISOString()
    }

    const { error } = await supabase.from('profiles').upsert(payload)
    
    if (error) {
      if (error.message.includes('duplicate key') || error.message.includes('unique constraint')) {
          alert(`Bummer! The stage name "${username.trim()}" is already taken. Please choose another one!`)
          setStep(1)
      } else {
          alert(`Error saving profile: ${error.message}`)
      }
      setSaving(false)
    } else {
      onComplete()
    }
  }

  const renderGrid = (category, items) => (
    <div className="flex flex-wrap gap-3 justify-center mt-6">
      {items.map(item => {
        const isSelected = prefs[category].includes(item)
        return (
          <button 
            key={item} onClick={() => toggleSelection(category, item)}
            className={`px-4 py-2 rounded-full text-sm font-bold tracking-widest uppercase transition-all duration-300 ${
              isSelected ? 'bg-blue-600 text-white border border-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.6)] scale-105' : 'bg-gray-900 text-gray-400 border border-gray-800 hover:border-gray-600'
            }`}
          >
            {item}
          </button>
        )
      })}
    </div>
  )

  return (
    <div className="min-h-screen bg-[#030712] flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-600/20 rounded-full blur-[100px] pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-600/20 rounded-full blur-[100px] pointer-events-none"></div>

      <div className="bg-[#090812]/90 border border-gray-800 rounded-3xl p-8 w-full max-w-md relative z-10 shadow-[0_0_40px_rgba(59,130,246,0.1)] backdrop-blur-xl max-h-[90vh] overflow-y-auto custom-scrollbar">
        
        <div className="flex justify-center gap-2 mb-8">
            {[1, 2, 3, 4, 5, 6].map(num => (
                <div key={num} className={`h-1.5 rounded-full transition-all duration-300 ${step >= num ? 'w-6 bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.8)]' : 'w-3 bg-gray-800'}`}></div>
            ))}
        </div>

        {step === 1 && (
          <div className="animate-fade-in text-center">
            <h2 className="text-4xl font-['Bebas_Neue'] text-white tracking-wider mb-2">Welcome to BHNL</h2>
            <p className="text-gray-400 text-sm mb-8">What should the crowd call you?</p>
            <input type="text" placeholder="Enter Stage Name" value={username} onChange={e => setUsername(e.target.value)} className="w-full bg-black/50 border border-gray-700 text-white rounded-xl p-4 text-center text-lg focus:border-blue-500 outline-none mb-6" />
            <button onClick={() => username.trim() ? setStep(2) : alert("Please enter a name!")} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-xl uppercase tracking-widest text-sm transition-colors shadow-[0_0_15px_rgba(59,130,246,0.4)]">Continue</button>
          </div>
        )}

        {step === 2 && (
          <div className="animate-fade-in text-center">
            <h2 className="text-4xl font-['Bebas_Neue'] text-white tracking-wider mb-2">Your Role</h2>
            <div className="space-y-3 mb-8 mt-6">
                {/* 🟢 THE FIX: Added Admin and wired them all to handleRoleSelect */}
                {['Singer', 'Host', 'Admin', 'Regular'].map(type => (
                    <button key={type} onClick={() => handleRoleSelect(type)} className={`w-full p-4 rounded-xl border text-left font-bold transition-all ${accountType === type ? 'bg-blue-600/20 border-blue-500 text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.2)]' : 'bg-black/50 border-gray-800 text-gray-400 hover:border-gray-600'}`}>
                        {type === 'Singer' && '🎤 Karaoke Singer'}
                        {type === 'Host' && '🎛️ Event Host / DJ'}
                        {type === 'Admin' && '👑 System Admin'}
                        {type === 'Regular' && '🍻 Here for the Vibes (Regular)'}
                    </button>
                ))}
            </div>
            <div className="flex gap-3">
                <button onClick={() => setStep(1)} className="px-6 py-4 rounded-xl border border-gray-800 text-gray-400 hover:text-white font-bold uppercase text-xs transition-colors">Back</button>
                <button onClick={() => setStep(3)} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-xl uppercase tracking-widest text-sm transition-colors shadow-[0_0_15px_rgba(59,130,246,0.4)]">Continue</button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="animate-fade-in text-center">
            <h2 className="text-3xl font-['Bebas_Neue'] text-white tracking-wider">Where do you hang?</h2>
            {renderGrid('venues', options.venues)}
            <div className="flex gap-3 mt-8">
                <button onClick={() => setStep(2)} className="px-6 py-4 rounded-xl border border-gray-800 text-gray-400 hover:text-white font-bold uppercase text-xs transition-colors">Back</button>
                <button onClick={() => setStep(4)} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-xl uppercase tracking-widest text-sm transition-colors shadow-[0_0_15px_rgba(59,130,246,0.4)]">Continue</button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="animate-fade-in text-center">
            <h2 className="text-3xl font-['Bebas_Neue'] text-white tracking-wider">What's your frequency?</h2>
            {renderGrid('genres', options.genres)}
            <div className="flex gap-3 mt-8">
                <button onClick={() => setStep(3)} className="px-6 py-4 rounded-xl border border-gray-800 text-gray-400 hover:text-white font-bold uppercase text-xs transition-colors">Back</button>
                <button onClick={() => setStep(5)} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-xl uppercase tracking-widest text-sm transition-colors shadow-[0_0_15px_rgba(59,130,246,0.4)]">Continue</button>
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="animate-fade-in text-center">
            <h2 className="text-3xl font-['Bebas_Neue'] text-white tracking-wider">What's the plan?</h2>
            {renderGrid('events', options.events)}
            <div className="flex gap-3 mt-8">
                <button onClick={() => setStep(4)} className="px-6 py-4 rounded-xl border border-gray-800 text-gray-400 hover:text-white font-bold uppercase text-xs transition-colors">Back</button>
                <button onClick={() => setStep(6)} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-xl uppercase tracking-widest text-sm transition-colors shadow-[0_0_15px_rgba(59,130,246,0.4)]">Continue</button>
            </div>
          </div>
        )}

        {step === 6 && (
          <div className="animate-fade-in text-center">
            <h2 className="text-4xl font-['Bebas_Neue'] text-purple-400 tracking-wider mb-2" style={{ textShadow: '0 0 15px rgba(168,85,247,0.5)' }}>Your Sign</h2>
            <div className="grid grid-cols-2 gap-2 mb-8 mt-6 max-h-40 overflow-y-auto custom-scrollbar">
                {ZODIAC_SIGNS.map(sign => (
                    <button 
                      key={sign} 
                      onClick={() => setZodiac(sign)} 
                      className={`p-3 rounded-lg border text-xs font-bold transition-all ${zodiac === sign ? 'bg-purple-600/20 border-purple-500 text-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.4)] scale-105' : 'bg-black/50 border-gray-800 text-gray-400 hover:border-gray-600'}`}
                    >
                        {sign}
                    </button>
                ))}
            </div>
            <div className="flex gap-3">
                <button onClick={() => setStep(5)} disabled={saving} className="px-6 py-4 rounded-xl border border-gray-800 text-gray-400 hover:text-white font-bold uppercase text-xs transition-colors">Back</button>
                <button onClick={handleFinish} disabled={saving} className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-bold py-4 rounded-xl uppercase tracking-widest text-sm transition-colors shadow-[0_0_20px_rgba(168,85,247,0.4)]">
                    {saving ? 'Saving...' : 'Enter Platform'}
                </button>
            </div>
          </div>
        )}

      </div>

      {/* 🟢 NEW: THE SECURITY PIN MODAL */}
      {showPinModal && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <div className="bg-gray-900 border-2 border-red-500/50 p-8 rounded-3xl w-full max-w-sm text-center shadow-[0_0_50px_rgba(239,68,68,0.2)] animate-slide-up-fast">
                <div className="text-4xl mb-4">🔒</div>
                <h3 className="text-3xl font-['Bebas_Neue'] tracking-widest mb-2 text-red-400">Restricted Access</h3>
                <p className="text-gray-400 text-xs mb-6 uppercase tracking-widest">Enter the security PIN to register as {pendingRole}.</p>
                
                <input 
                    type="password" 
                    value={pinCode} 
                    onChange={e => setPinCode(e.target.value)} 
                    placeholder="****" 
                    className="w-full bg-black border border-gray-700 text-white text-center text-2xl tracking-[1em] rounded-xl p-4 focus:border-red-500 outline-none mb-6 font-mono"
                    maxLength={4}
                />

                <div className="flex gap-3">
                    <button onClick={() => {setShowPinModal(false); setPinCode('');}} className="flex-1 border border-gray-700 text-gray-400 rounded-xl text-xs font-bold uppercase tracking-widest hover:text-white py-3 transition-colors">Cancel</button>
                    <button onClick={verifyPin} className="flex-1 bg-red-600 text-white rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.4)] py-3 transition-all">Unlock Role</button>
                </div>
            </div>
        </div>
      )}
    </div>
  )
}