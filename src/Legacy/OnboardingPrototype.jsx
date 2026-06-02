import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

// Roles consolidated for streamlined access
const accountTypes = [
  { id: 'Regular', icon: '👤', title: 'Regular', desc: 'Vibe, vote, build setlists, and hit the stage.' },
  { id: 'Performer', icon: '🎸', title: 'Performer', desc: 'I perform original music or live bands.' },
  { id: 'Host', icon: '🎧', title: 'Host', desc: 'I run karaoke or trivia events.' },
  { id: 'Venue', icon: '🏛️', title: 'Venue', desc: 'I manage a bar, club, or event space.' }
]

export default function Onboarding({ session, onComplete, forcedType = null }) {
  const [step, setStep] = useState(forcedType ? 3 : 1)
  const [subStep, setSubStep] = useState(1)
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const [agreeTerms, setAgreeTerms] = useState(false)
  const [agreeAge, setAgreeAge] = useState(false)
  
  const [realName, setRealName] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [accountType, setAccountType] = useState(forcedType || 'Regular')
  const [details, setDetails] = useState({})

  // 🟢 RESTORED: BHNL System Categories State
  const [systemCategories, setSystemCategories] = useState([])

  useEffect(() => {
      async function loadData() {
          // Load pre-existing details if resuming
          const { data: profile } = await supabase.from('profiles').select('details').eq('id', session?.user?.id).single()
          if (profile?.details) {
              setDetails(profile.details)
              if (profile.details.realName) setRealName(profile.details.realName)
              if (profile.details.birthDate) setBirthDate(profile.details.birthDate)
          }

          // 🟢 RESTORED: Fetch Categories from Database
          const { data: cats } = await supabase.from('system_categories').select('*').order('name')
          if (cats) setSystemCategories(cats)
      }
      if (session?.user?.id) loadData()
  }, [session])

  const handleRoleSelection = async (role) => {
      setAccountType(role)
      if (['Host', 'Venue', 'Performer'].includes(role)) {
          await supabase.from('profiles').update({ 
              account_type: role, 
              account_status: 'pending',
              details: { ...details, realName, birthDate }
          }).eq('id', session.user.id)
          window.location.reload()
      } else {
          setStep(3)
      }
  }

  const handleNextSubStep = async () => {
      if (accountType === 'Host' && subStep === 3) await handleFinishOnboarding()
      else if (accountType === 'Venue' && subStep === 5) await handleFinishOnboarding()
      else if (accountType === 'Performer' && subStep === 3) await handleFinishOnboarding()
      else if (accountType === 'Regular') await handleFinishOnboarding()
      else setSubStep(s => s + 1)
  }

  const handleFinishOnboarding = async () => {
      setSaving(true)
      const finalDetails = { ...details, realName, birthDate }
      
      // 🟢 BUG 2 FIX: Ensure safe status applied to prevent Admin overwrite loops
      const requiresApproval = ['Venue', 'Performer', 'Host'].includes(accountType)
      const finalStatus = (requiresApproval && !forcedType) ? 'pending' : 'approved'

      const { error } = await supabase.from('profiles').update({
          account_type: accountType,
          account_status: finalStatus,
          onboarding_completed: true, // 🟢 BUG 1 FIX: Confirmed match with App.jsx
          details: finalDetails
      }).eq('id', session.user.id)
      
      if (error) {
          setErrorMsg(error.message)
          setSaving(false)
      } else {
          // 🟢 FIX: Only inject the welcome post if this is their very first time applying
          if (!forcedType) {
              let welcomeMessage = `${realName || 'A new user'} has joined the scene!`
              if (accountType === 'Host') welcomeMessage = `🎤 New Host Alert: ${details.stageName || realName} has joined the scene!`

              await supabase.from('posts').insert([{
                  author_id: session.user.id,
                  content: welcomeMessage
              }])
          }
          onComplete()
      }
  }

  const toggleArrayItem = (key, item) => {
      const current = details[key] || []
      if (current.includes(item)) {
          setDetails({ ...details, [key]: current.filter(i => i !== item) })
      } else {
          setDetails({ ...details, [key]: [...current, item] })
      }
  }

  const renderSpecializedOnboarding = () => {
      if (accountType === 'Host') {
          if (subStep === 1) return (
              <div className="space-y-4 animate-fade-in text-left">
                  <h3 className="text-xl font-bold text-blue-400">Host Configuration</h3>
                  <div>
                      <label className="text-[10px] text-gray-500 font-bold uppercase tracking-widest block mb-1">Stage/DJ Name</label>
                      <input type="text" value={details.stageName || ''} onChange={e => setDetails({...details, stageName: e.target.value})} className="w-full bg-black border border-gray-700 text-white rounded-lg p-3 text-sm outline-none focus:border-blue-500" placeholder="DJ Nightowl" />
                  </div>
              </div>
          )
          if (subStep === 2) return (
              <div className="space-y-4 animate-fade-in text-left">
                  <h3 className="text-xl font-bold text-blue-400">Location</h3>
                  <div>
                      <label className="text-[10px] text-gray-500 font-bold uppercase tracking-widest block mb-1">Base City / Region</label>
                      <input type="text" value={details.city || ''} onChange={e => setDetails({...details, city: e.target.value})} className="w-full bg-black border border-gray-700 text-white rounded-lg p-3 text-sm outline-none focus:border-blue-500" placeholder="Rapid City, SD" />
                  </div>
              </div>
          )
          if (subStep === 3) return (
              <div className="space-y-4 animate-fade-in text-left">
                  <h3 className="text-xl font-bold text-blue-400">Affiliation</h3>
                  <div>
                      <label className="text-[10px] text-gray-500 font-bold uppercase tracking-widest block mb-1">Agency or Independent</label>
                      <select value={details.agency || ''} onChange={e => setDetails({...details, agency: e.target.value})} className="w-full bg-black border border-gray-700 text-white rounded-lg p-3 text-sm outline-none focus:border-blue-500">
                          <option value="" disabled>Select Affiliation</option>
                          <option value="Independent">Independent</option>
                          <option value="Black Hills Nightlife">Black Hills Nightlife</option>
                          <option value="Dakota Entertainment">Dakota Entertainment</option>
                      </select>
                  </div>
              </div>
          )
      }

      if (accountType === 'Performer') {
          if (subStep === 1) return (
              <div className="space-y-4 animate-fade-in text-left">
                  <h3 className="text-xl font-bold text-purple-400">Performer Configuration</h3>
                  <div>
                      <label className="text-[10px] text-gray-500 font-bold uppercase tracking-widest block mb-1">Act / Band Name</label>
                      <input type="text" value={details.name || ''} onChange={e => setDetails({...details, name: e.target.value})} className="w-full bg-black border border-gray-700 text-white rounded-lg p-3 text-sm outline-none focus:border-purple-500" placeholder="The Midnight Echoes" />
                  </div>
              </div>
          )
          if (subStep === 2) {
              // 🟢 RESTORED: Dynamic Genre Mapping
              const genres = systemCategories.filter(c => c.category_type === 'genre')
              return (
                  <div className="space-y-4 animate-fade-in text-left">
                      <h3 className="text-xl font-bold text-purple-400">Music Genres</h3>
                      <div className="flex flex-wrap gap-2">
                          {genres.map(g => {
                              const isSelected = (details.genres || []).includes(g.name)
                              return (
                                  <button 
                                      key={g.id} 
                                      onClick={() => toggleArrayItem('genres', g.name)}
                                      className={`px-3 py-2 rounded-lg border text-xs font-bold transition-all ${isSelected ? 'bg-purple-600 text-white border-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.4)]' : 'bg-gray-800 text-gray-400 border-gray-700 hover:bg-gray-700'}`}
                                  >
                                      {g.name}
                                  </button>
                              )
                          })}
                      </div>
                  </div>
              )
          }
          if (subStep === 3) return (
              <div className="space-y-4 animate-fade-in text-left">
                  <h3 className="text-xl font-bold text-purple-400">Social Links</h3>
                  <div><label className="text-[10px] text-gray-500 font-bold uppercase tracking-widest block mb-1">Spotify URL</label><input type="text" value={details.links?.spotify || ''} onChange={e => setDetails({...details, links: {...details.links, spotify: e.target.value}})} className="w-full bg-black border border-gray-700 text-white rounded-lg p-3 text-sm outline-none focus:border-purple-500" placeholder="https://..." /></div>
                  <div><label className="text-[10px] text-gray-500 font-bold uppercase tracking-widest block mb-1">Instagram URL</label><input type="text" value={details.links?.instagram || ''} onChange={e => setDetails({...details, links: {...details.links, instagram: e.target.value}})} className="w-full bg-black border border-gray-700 text-white rounded-lg p-3 text-sm outline-none focus:border-purple-500" placeholder="https://..." /></div>
              </div>
          )
      }

      if (accountType === 'Venue') {
          if (subStep === 1) return (
              <div className="space-y-4 animate-fade-in text-left">
                  <h3 className="text-xl font-bold text-cyan-400">Venue Profile</h3>
                  <div>
                      <label className="text-[10px] text-gray-500 font-bold uppercase tracking-widest block mb-1">Establishment Name</label>
                      <input type="text" value={details.name || ''} onChange={e => setDetails({...details, name: e.target.value})} className="w-full bg-black border border-gray-700 text-white rounded-lg p-3 text-sm outline-none focus:border-cyan-500" placeholder="The Iron Phnx" />
                  </div>
              </div>
          )
          if (subStep === 2) return (
              <div className="space-y-4 animate-fade-in text-left">
                  <h3 className="text-xl font-bold text-cyan-400">Address</h3>
                  <div>
                      <label className="text-[10px] text-gray-500 font-bold uppercase tracking-widest block mb-1">Full Street Address</label>
                      <input type="text" value={details.address || ''} onChange={e => setDetails({...details, address: e.target.value})} className="w-full bg-black border border-gray-700 text-white rounded-lg p-3 text-sm outline-none focus:border-cyan-500" placeholder="123 Main St, Rapid City, SD" />
                  </div>
              </div>
          )
          if (subStep === 3) {
              // 🟢 RESTORED: Dynamic Venue Mapping
              const venueTypes = systemCategories.filter(c => c.category_type === 'venue')
              return (
                  <div className="space-y-4 animate-fade-in text-left">
                      <h3 className="text-xl font-bold text-cyan-400">Atmosphere</h3>
                      <div className="flex flex-wrap gap-2">
                          {venueTypes.map(v => {
                              const isSelected = (details.tags || []).includes(v.name)
                              return (
                                  <button 
                                      key={v.id} 
                                      onClick={() => toggleArrayItem('tags', v.name)}
                                      className={`px-3 py-2 rounded-lg border text-xs font-bold transition-all ${isSelected ? 'bg-cyan-600 text-white border-cyan-500' : 'bg-gray-800 text-gray-400 border-gray-700 hover:bg-gray-700'}`}
                                  >
                                      {v.name}
                                  </button>
                              )
                          })}
                      </div>
                  </div>
              )
          }
          if (subStep === 4) return (
              <div className="space-y-4 animate-fade-in text-left">
                  <h3 className="text-xl font-bold text-cyan-400">Contact</h3>
                  <div><label className="text-[10px] text-gray-500 font-bold uppercase tracking-widest block mb-1">Phone Number</label><input type="text" value={details.phone || ''} onChange={e => setDetails({...details, phone: e.target.value})} className="w-full bg-black border border-gray-700 text-white rounded-lg p-3 text-sm outline-none focus:border-cyan-500" /></div>
                  <div><label className="text-[10px] text-gray-500 font-bold uppercase tracking-widest block mb-1">Website URL</label><input type="text" value={details.website || ''} onChange={e => setDetails({...details, website: e.target.value})} className="w-full bg-black border border-gray-700 text-white rounded-lg p-3 text-sm outline-none focus:border-cyan-500" /></div>
              </div>
          )
          if (subStep === 5) return (
              <div className="space-y-4 animate-fade-in text-left">
                  <h3 className="text-xl font-bold text-cyan-400">Pricing</h3>
                  <div className="grid grid-cols-4 gap-2">
                      {['$', '$$', '$$$', '$$$$'].map(price => (
                          <button key={price} onClick={() => setDetails({...details, cost: price})} className={`p-3 rounded-lg border text-sm font-bold transition-all ${details.cost === price ? 'bg-cyan-600 text-white border-cyan-500' : 'bg-gray-800 text-gray-400 border-gray-700 hover:bg-gray-700'}`}>
                              {price}
                          </button>
                      ))}
                  </div>
              </div>
          )
      }

      return (
          <div className="text-center py-8">
              <h3 className="text-2xl font-['Bebas_Neue'] text-white tracking-widest mb-2">Almost Done!</h3>
              <p className="text-gray-400 text-sm">Your profile is ready to launch.</p>
          </div>
      )
  }

  return (
      <div className="min-h-screen flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#090812] border border-gray-800 p-8 rounded-3xl shadow-2xl relative overflow-hidden">
              
              {/* Step 1: Legal & Basic Info */}
              {step === 1 && (
                  <div className="animate-fade-in">
                      <div className="text-center mb-8">
                          <span className="text-5xl mb-4 block">👋</span>
                          <h2 className="text-3xl font-['Bebas_Neue'] text-white tracking-widest mb-2">Welcome to the Scene</h2>
                          <p className="text-gray-400 text-sm">Let's get your profile set up.</p>
                      </div>

                      <div className="space-y-4 text-left">
                          <div>
                              <label className="text-[10px] text-gray-500 font-bold uppercase tracking-widest block mb-1">Real Legal Name</label>
                              <input type="text" value={realName} onChange={e => setRealName(e.target.value)} className="w-full bg-black border border-gray-700 text-white rounded-lg p-3 text-sm outline-none focus:border-blue-500" placeholder="John Doe" />
                          </div>
                          <div>
                              <label className="text-[10px] text-gray-500 font-bold uppercase tracking-widest block mb-1">Date of Birth</label>
                              <input type="date" value={birthDate} onChange={e => setBirthDate(e.target.value)} className="w-full bg-black border border-gray-700 text-white rounded-lg p-3 text-sm outline-none focus:border-blue-500" />
                          </div>
                          
                          <div className="pt-4 border-t border-gray-800 space-y-3">
                              <label className="flex items-center gap-3 cursor-pointer group">
                                  <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${agreeTerms ? 'bg-blue-600 border-blue-500' : 'border-gray-600 group-hover:border-blue-400'}`}>
                                      {agreeTerms && <span className="text-white text-xs">✓</span>}
                                  </div>
                                  <input type="checkbox" className="hidden" checked={agreeTerms} onChange={e => setAgreeTerms(e.target.checked)} />
                                  <span className="text-xs text-gray-400">I agree to the Terms of Service & Privacy Policy</span>
                              </label>
                              
                              <label className="flex items-center gap-3 cursor-pointer group">
                                  <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${agreeAge ? 'bg-blue-600 border-blue-500' : 'border-gray-600 group-hover:border-blue-400'}`}>
                                      {agreeAge && <span className="text-white text-xs">✓</span>}
                                  </div>
                                  <input type="checkbox" className="hidden" checked={agreeAge} onChange={e => setAgreeAge(e.target.checked)} />
                                  <span className="text-xs text-gray-400">I am 21 years of age or older</span>
                              </label>
                          </div>

                          <button 
                              disabled={!agreeTerms || !agreeAge || !realName || !birthDate} 
                              onClick={() => setStep(2)} 
                              className="w-full mt-6 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-800 disabled:text-gray-500 text-white py-4 rounded-xl font-bold uppercase tracking-widest text-xs shadow-[0_0_15px_rgba(37,99,235,0.4)] transition-all"
                          >
                              Continue
                          </button>
                      </div>
                  </div>
              )}

              {/* Step 2: Role Selection */}
              {step === 2 && (
                  <div className="animate-fade-in">
                      <div className="text-center mb-6">
                          <h2 className="text-3xl font-['Bebas_Neue'] text-white tracking-widest mb-2">Choose Your Path</h2>
                          <p className="text-gray-400 text-xs">Specialized roles require admin approval.</p>
                      </div>

                      <div className="space-y-3">
                          {accountTypes.map(type => (
                              <button 
                                  key={type.id}
                                  onClick={() => handleRoleSelection(type.id)}
                                  className="w-full flex items-center gap-4 bg-gray-900 border border-gray-800 hover:border-blue-500/50 p-4 rounded-2xl transition-all text-left group"
                              >
                                  <span className="text-3xl group-hover:scale-110 transition-transform">{type.icon}</span>
                                  <div>
                                      <h4 className="text-white font-bold">{type.title}</h4>
                                      <p className="text-gray-500 text-[10px] uppercase tracking-widest">{type.desc}</p>
                                  </div>
                              </button>
                          ))}
                      </div>
                      
                      <button onClick={() => setStep(1)} className="w-full mt-4 py-4 text-gray-500 font-bold uppercase tracking-widest text-xs hover:text-white transition-colors">
                          Back
                      </button>
                  </div>
              )}

              {/* Step 3: Sub-Flows */}
              {step === 3 && (
                  <div className="animate-fade-in">
                      {accountType !== 'Regular' && (
                          <div className="w-full bg-gray-900 h-1.5 rounded-full mb-6 overflow-hidden">
                              <div className="bg-blue-500 h-full transition-all" style={{ width: `${(subStep / (accountType === 'Host' ? 3 : accountType === 'Venue' ? 5 : accountType === 'Performer' ? 3 : 2)) * 100}%` }}></div>
                          </div>
                      )}

                      {renderSpecializedOnboarding()}

                      {errorMsg && <p className="text-red-500 text-xs font-bold uppercase tracking-widest text-center mt-4 animate-pulse">{errorMsg}</p>}

                      <div className="mt-8 flex gap-3">
                          <button onClick={() => subStep > 1 ? setSubStep(s => s - 1) : setStep(2)} className="flex-1 py-4 border border-gray-700 text-gray-400 rounded-xl font-bold uppercase tracking-widest text-xs hover:bg-gray-800 transition-colors">
                              Back
                          </button>
                          <button onClick={handleNextSubStep} disabled={saving} className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-800 text-white py-4 rounded-xl font-bold uppercase tracking-widest text-xs shadow-lg transition-colors">
                              {saving ? 'Saving...' : (accountType === 'Regular' || (accountType === 'Venue' && subStep === 5) || (accountType === 'Performer' && subStep === 3) || (accountType === 'Host' && subStep === 3)) ? 'Launch Profile' : 'Next'}
                          </button>
                      </div>
                  </div>
              )}
          </div>
      </div>
  )
}