import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

const accountTypes = [
  { id: 'Regular', icon: '👤', title: 'Regular', desc: 'Just here to vibe, vote, and explore.' },
  { id: 'Singer', icon: '🎤', title: 'Singer', desc: 'I want to build setlists and hit the stage.' },
  { id: 'Performer', icon: '🎸', title: 'Performer', desc: 'I perform original music or live bands.' },
  { id: 'Host', icon: '🎧', title: 'Host', desc: 'I run karaoke or trivia events.' },
  { id: 'Venue', icon: '🏛️', title: 'Venue', desc: 'I manage a bar, club, or event space.' }
]

const PERFORMER_ACTS = ['Band', 'Musician', 'DJ', 'Troupe', 'Actor/Actress', 'Artist']

export default function Onboarding({ session, onComplete, forcedType = null }) {
  const [step, setStep] = useState(forcedType ? 3 : 1)
  const [subStep, setSubStep] = useState(1) // 🟢 NEW: Handles multi-page flows for complex roles
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  // Form State (Preserved)
  const [agreeTerms, setAgreeTerms] = useState(false)
  const [agreeAge, setAgreeAge] = useState(false)
  const [accountType, setAccountType] = useState(forcedType || 'Regular')
  const [fullName, setFullName] = useState('')
  const [username, setUsername] = useState('')
  const [zodiac, setZodiac] = useState('')
  
  const [prefEvents, setPrefEvents] = useState([])
  const [prefVenues, setPrefVenues] = useState([])
  const [prefGenres, setPrefGenres] = useState([])

  // Dynamic Options from system_categories (Preserved)
  const [options, setOptions] = useState({ events: [], venues: [], genres: [] })

  // 🟢 NEW: Complex Role States
  const [venueData, setVenueData] = useState({ name: '', address: '', phone: '', email: '', fb: '', web: '', ig: '', x: '', tiktok: '', styles: [], events: [], genres: [] })
  const [perfData, setPerfData] = useState({ name: '', actType: '', genres: [], links: { fb: '', ig: '', tiktok: '', soundcloud: '', spotify: '', web: '', x: '', threads: '', yt: '', twitch: '' } })
  const [hostData, setHostData] = useState({ name: '', agency: '', stageName: '', city: '', events: [] })

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

  // Helpers for Complex Roles
  const toggleNestedArray = (stateObj, setStateObj, key, item) => {
      const currentArr = stateObj[key]
      const newArr = currentArr.includes(item) ? currentArr.filter(i => i !== item) : [...currentArr, item]
      setStateObj({ ...stateObj, [key]: newArr })
  }
  const updateNestedField = (stateObj, setStateObj, key, value) => {
      setStateObj({ ...stateObj, [key]: value })
  }
  const updateDeepLink = (key, value) => {
      setPerfData({ ...perfData, links: { ...perfData.links, [key]: value } })
  }

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
      setSubStep(1) // Reset substep just in case
  }

  // 🟢 NEW: Validation Routing for Step 4
  const handleNextSubStep = () => {
      if (accountType === 'Venue') {
          if (subStep === 1 && (!venueData.name || !venueData.address || !venueData.phone)) return setErrorMsg("Please fill out all required fields (*).")
          if (subStep === 3 && venueData.styles.length < 2) return setErrorMsg("Please select at least 2 Venue Styles.")
          if (subStep === 4 && venueData.events.length < 2) return setErrorMsg("Please select at least 2 Event Types.")
          if (subStep === 5) return finishOnboarding()
          setErrorMsg(''); setSubStep(s => s + 1)
      } 
      else if (accountType === 'Performer') {
          if (subStep === 1 && (!perfData.name || !perfData.actType)) return setErrorMsg("Name and Act Type are required.")
          if (subStep === 1) {
              setErrorMsg('');
              if (['Troupe', 'Actor/Actress', 'Artist'].includes(perfData.actType)) setSubStep(3)
              else setSubStep(2)
          } 
          else if (subStep === 2) {
              if (perfData.genres.length < 1) return setErrorMsg("Please select at least 1 Genre.")
              setErrorMsg(''); setSubStep(3)
          }
          else if (subStep === 3) {
              const hasLink = Object.values(perfData.links).some(link => link.trim() !== '')
              if (!hasLink) return setErrorMsg("Please provide at least 1 link.")
              return finishOnboarding()
          }
      }
      else if (accountType === 'Host') {
          if (subStep === 1 && (!hostData.name || !hostData.stageName || !hostData.city)) return setErrorMsg("Please fill out all required fields (*).")
          if (subStep === 2) {
              if (hostData.events.length < 1) return setErrorMsg("Please select at least 1 Event Type.")
              return finishOnboarding()
          }
          setErrorMsg(''); setSubStep(s => s + 1)
      }
      else {
          // Regular & Singer (Preserved exactly as your logic dictated)
          if (prefGenres.length < 2) return setErrorMsg("Please select at least 2 genres.")
          return finishOnboarding()
      }
  }

  const renderSpecializedOnboarding = () => {
      if (accountType === 'Venue') {
          return (
              <div className="space-y-4">
                  <h2 className="text-3xl font-['Bebas_Neue'] text-blue-400 tracking-wider text-center">
                      {subStep === 1 && "Venue Info"}
                      {subStep === 2 && "Social Presence"}
                      {subStep === 3 && "Venue Style"}
                      {subStep === 4 && "Events Hosted"}
                      {subStep === 5 && "Music Vibe"}
                  </h2>
                  
                  {subStep === 1 && (
                      <div className="space-y-3">
                          <input type="text" placeholder="Venue Name *" value={venueData.name} onChange={e => updateNestedField(venueData, setVenueData, 'name', e.target.value)} className="w-full bg-black border border-gray-800 text-white p-4 rounded-xl outline-none focus:border-blue-500" />
                          <input type="text" placeholder="Address *" value={venueData.address} onChange={e => updateNestedField(venueData, setVenueData, 'address', e.target.value)} className="w-full bg-black border border-gray-800 text-white p-4 rounded-xl outline-none focus:border-blue-500" />
                          <input type="tel" placeholder="Phone Number *" value={venueData.phone} onChange={e => updateNestedField(venueData, setVenueData, 'phone', e.target.value)} className="w-full bg-black border border-gray-800 text-white p-4 rounded-xl outline-none focus:border-blue-500" />
                          <input type="email" placeholder="Business Email" value={venueData.email} onChange={e => updateNestedField(venueData, setVenueData, 'email', e.target.value)} className="w-full bg-black border border-gray-800 text-white p-4 rounded-xl outline-none focus:border-blue-500" />
                      </div>
                  )}
                  
                  {subStep === 2 && (
                      <div className="space-y-3">
                          {['Website', 'Facebook', 'Instagram', 'X (Twitter)', 'TikTok'].map(platform => {
                              const key = platform === 'Website' ? 'web' : platform === 'Facebook' ? 'fb' : platform === 'Instagram' ? 'ig' : platform === 'X (Twitter)' ? 'x' : 'tiktok'
                              return <input key={key} type="text" placeholder={`${platform} URL/Handle`} value={venueData[key]} onChange={e => updateNestedField(venueData, setVenueData, key, e.target.value)} className="w-full bg-black border border-gray-800 text-white p-4 rounded-xl outline-none focus:border-blue-500" />
                          })}
                      </div>
                  )}

                  {subStep === 3 && (
                      <div className="flex flex-wrap gap-2 justify-center mt-4">
                          {options.venues.map(cat => (
                              <button key={cat} onClick={() => toggleNestedArray(venueData, setVenueData, 'styles', cat)} className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest border transition-all ${venueData.styles.includes(cat) ? 'bg-blue-600 text-white border-blue-500 shadow-[0_0_15px_rgba(37,99,235,0.4)]' : 'bg-black text-gray-400 border-gray-800 hover:border-gray-600'}`}>{cat}</button>
                          ))}
                      </div>
                  )}

                  {subStep === 4 && (
                      <div className="flex flex-wrap gap-2 justify-center mt-4">
                          {options.events.map(cat => (
                              <button key={cat} onClick={() => toggleNestedArray(venueData, setVenueData, 'events', cat)} className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest border transition-all ${venueData.events.includes(cat) ? 'bg-purple-600 text-white border-purple-500 shadow-[0_0_15px_rgba(147,51,234,0.4)]' : 'bg-black text-gray-400 border-gray-800 hover:border-gray-600'}`}>{cat}</button>
                          ))}
                      </div>
                  )}

                  {subStep === 5 && (
                      <div className="flex flex-wrap gap-2 justify-center mt-4">
                          {options.genres.map(cat => (
                              <button key={cat} onClick={() => toggleNestedArray(venueData, setVenueData, 'genres', cat)} className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest border transition-all ${venueData.genres.includes(cat) ? 'bg-[#ff2d78] text-white border-[#ff2d78] shadow-[0_0_15px_rgba(255,45,120,0.4)]' : 'bg-black text-gray-400 border-gray-800 hover:border-gray-600'}`}>{cat}</button>
                          ))}
                          <p className="w-full text-center text-gray-500 text-[10px] mt-4 uppercase tracking-widest">(Optional - You can skip this)</p>
                      </div>
                  )}
              </div>
          )
      }

      if (accountType === 'Performer') {
          return (
              <div className="space-y-4">
                  <h2 className="text-3xl font-['Bebas_Neue'] text-purple-400 tracking-wider text-center">
                      {subStep === 1 && "Act Info"}
                      {subStep === 2 && "Primary Genres"}
                      {subStep === 3 && "Booking Links"}
                  </h2>

                  {subStep === 1 && (
                      <div className="space-y-4">
                          <input type="text" placeholder="Performer / Act Name *" value={perfData.name} onChange={e => updateNestedField(perfData, setPerfData, 'name', e.target.value)} className="w-full bg-black border border-gray-800 text-white p-4 rounded-xl outline-none focus:border-purple-500" />
                          <div className="pt-2">
                              <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2 block">Select Act Type *</label>
                              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                  {PERFORMER_ACTS.map(act => (
                                      <button key={act} onClick={() => updateNestedField(perfData, setPerfData, 'actType', act)} className={`p-3 rounded-lg text-[10px] font-bold uppercase tracking-widest border transition-all ${perfData.actType === act ? 'bg-purple-600 text-white border-purple-500' : 'bg-black text-gray-500 border-gray-800'}`}>{act}</button>
                                  ))}
                              </div>
                          </div>
                      </div>
                  )}

                  {subStep === 2 && (
                      <div className="flex flex-wrap gap-2 justify-center mt-4">
                          {options.genres.map(cat => (
                              <button key={cat} onClick={() => toggleNestedArray(perfData, setPerfData, 'genres', cat)} className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest border transition-all ${perfData.genres.includes(cat) ? 'bg-[#ff2d78] text-white border-[#ff2d78]' : 'bg-black text-gray-400 border-gray-800'}`}>{cat}</button>
                          ))}
                      </div>
                  )}

                  {subStep === 3 && (
                      <div className="space-y-3 h-64 overflow-y-auto pr-2 hide-scrollbar">
                          <p className="text-center text-[10px] text-gray-400 uppercase tracking-widest mb-2">Provide at least 1 link *</p>
                          {Object.keys(perfData.links).map(platform => (
                              <input key={platform} type="text" placeholder={`${platform.toUpperCase()} URL`} value={perfData.links[platform]} onChange={e => updateDeepLink(platform, e.target.value)} className="w-full bg-black border border-gray-800 text-white p-4 rounded-xl outline-none focus:border-purple-500" />
                          ))}
                      </div>
                  )}
              </div>
          )
      }

      if (accountType === 'Host') {
          return (
              <div className="space-y-4">
                  <h2 className="text-3xl font-['Bebas_Neue'] text-[#00f5ff] tracking-wider text-center">
                      {subStep === 1 && "Host Profile"}
                      {subStep === 2 && "Events Managed"}
                  </h2>

                  {subStep === 1 && (
                      <div className="space-y-3">
                          <input type="text" placeholder="Full Name *" value={hostData.name} onChange={e => updateNestedField(hostData, setHostData, 'name', e.target.value)} className="w-full bg-black border border-gray-800 text-white p-4 rounded-xl outline-none focus:border-[#00f5ff]" />
                          <input type="text" placeholder="Stage Name / Alias *" value={hostData.stageName} onChange={e => updateNestedField(hostData, setHostData, 'stageName', e.target.value)} className="w-full bg-black border border-gray-800 text-white p-4 rounded-xl outline-none focus:border-[#00f5ff]" />
                          <input type="text" placeholder="Agency Name (Optional)" value={hostData.agency} onChange={e => updateNestedField(hostData, setHostData, 'agency', e.target.value)} className="w-full bg-black border border-gray-800 text-white p-4 rounded-xl outline-none focus:border-[#00f5ff]" />
                          <input type="text" placeholder="Primary City *" value={hostData.city} onChange={e => updateNestedField(hostData, setHostData, 'city', e.target.value)} className="w-full bg-black border border-gray-800 text-white p-4 rounded-xl outline-none focus:border-[#00f5ff]" />
                      </div>
                  )}

                  {subStep === 2 && (
                      <div className="flex flex-wrap gap-2 justify-center mt-4">
                          {options.events.map(cat => (
                              <button key={cat} onClick={() => toggleNestedArray(hostData, setHostData, 'events', cat)} className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest border transition-all ${hostData.events.includes(cat) ? 'bg-[#00f5ff] text-black border-[#00f5ff]' : 'bg-black text-gray-400 border-gray-800'}`}>{cat}</button>
                          ))}
                      </div>
                  )}
              </div>
          )
      }

      // Default (Regular / Singer - PRESERVED EXACTLY)
      return (
          <div className="animate-fade-in">
              <h2 className="text-3xl font-['Bebas_Neue'] text-blue-400 mb-2 tracking-wider text-center">Which Music Genres describe your Taste?</h2>
              <p className="text-center text-gray-500 text-xs font-bold uppercase tracking-widest mb-6">Pick at least 2 ({prefGenres.length}/2)</p>
              <div className="flex flex-wrap justify-center gap-3 mb-8">
                  {options.genres.length === 0 ? <p className="text-red-500 text-xs">No genres found in database. Admins must add them.</p> : options.genres.map(item => (
                      <button key={item} onClick={() => toggleSelection(prefGenres, setPrefGenres, item)} className={`px-4 py-2 rounded-full border text-xs font-bold uppercase tracking-widest transition-all ${prefGenres.includes(item) ? 'bg-[#ff2d78]/20 border-[#ff2d78] text-[#ff2d78]' : 'bg-gray-900 border-gray-800 text-gray-500 hover:border-gray-600'}`}>
                          {item}
                      </button>
                  ))}
              </div>
          </div>
      )
  }

  const finishOnboarding = async () => {
      setSaving(true)
      const finalUsername = username.trim()
      
      // 🟢 BUG 2 FIX: If 'forcedType' exists, they were already approved by an Admin.
      // Do not downgrade them back to pending!
      const requiresApproval = ['Venue', 'Performer', 'Host'].includes(accountType)
      const finalStatus = (requiresApproval && !forcedType) ? 'pending' : 'approved'

      // Package JSON Details
      let detailsPayload = {}
      if (accountType === 'Venue') detailsPayload = venueData
      if (accountType === 'Performer') detailsPayload = perfData
      if (accountType === 'Host') detailsPayload = hostData

      // Update Profile
      const { error } = await supabase.from('profiles').update({
          username: finalUsername,
          full_name: fullName.trim(),
          account_type: accountType,
          account_status: finalStatus, // 🟢 Applies safe status
          zodiac_sign: zodiac,
          pref_events: prefEvents,
          pref_venues: prefVenues,
          pref_genres: prefGenres,
          details: detailsPayload, 
          onboarding_complete: true // 🟢 Reverted back to your original working DB column name
      }).eq('id', session.user.id)

      // 🟢 SILENT CRASH FIX: Stop and display the exact database error if one occurs!
      if (error) {
          setErrorMsg(`Database Error: ${error.message}`)
          setSaving(false)
          return
      }

      // 🟢 FEED FIX: Only inject the welcome post if this is their very first time applying
      if (!forcedType) {
          let welcomeMessage = `${finalUsername} has joined the scene!`
          if (accountType === 'Host') welcomeMessage = `🎤 New Host Alert: ${finalUsername} has joined the scene!`
          if (accountType === 'Admin') welcomeMessage = `⚙️ Admin ${finalUsername} has authenticated.`

          await supabase.from('posts').insert([{
              author_id: session.user.id,
              content: welcomeMessage
          }])
      }

      setSaving(false)
      onComplete()
  }

  return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center p-4">
        
        {/* STEP 1: AGREEMENTS (Preserved) */}
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

        {/* STEP 2: ACCOUNT TYPE (Preserved) */}
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

        {/* STEP 3: NAMES (Preserved) */}
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
                </div>

                <button onClick={handleUsernameCheck} disabled={saving} className="w-full bg-blue-600 hover:bg-blue-500 text-white py-4 rounded-xl font-bold uppercase tracking-widest transition-colors">
                    {saving ? 'Verifying...' : 'Check Availability'}
                </button>
            </div>
        )}

        {/* STEP 4: SPECIALIZED ONBOARDING (Modified for subSteps) */}
        {step === 4 && (
          <div className="bg-[#090812] border-2 border-gray-800 p-8 rounded-3xl w-full max-w-lg shadow-2xl animate-fade-in relative overflow-hidden">
              
              {/* Progress Indicator for complex flows */}
              {['Venue', 'Performer', 'Host'].includes(accountType) && (
                  <div className="absolute top-0 left-0 h-1 bg-gray-800 w-full">
                      <div className="h-full bg-blue-500 transition-all duration-300" style={{ width: `${(subStep / (accountType === 'Venue' ? 5 : accountType === 'Performer' ? 3 : 2)) * 100}%` }}></div>
                  </div>
              )}

              {/* Render the specialized UI */}
              {renderSpecializedOnboarding()}

              {errorMsg && <p className="text-red-500 text-xs font-bold uppercase tracking-widest text-center mt-4 animate-pulse">{errorMsg}</p>}

              <div className="mt-8 flex gap-3">
                  <button 
                      onClick={() => subStep > 1 ? setSubStep(s => s - 1) : setStep(3)} 
                      className="flex-1 py-4 border border-gray-700 text-gray-400 rounded-xl font-bold uppercase tracking-widest text-xs hover:bg-gray-800 transition-colors"
                  >
                      Back
                  </button>
                  <button 
                      onClick={handleNextSubStep} 
                      disabled={saving}
                      className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-800 text-white py-4 rounded-xl font-bold uppercase tracking-widest text-xs shadow-lg transition-colors"
                  >
                      {saving ? 'Saving...' : (accountType === 'Regular' || accountType === 'Singer' || (accountType === 'Venue' && subStep === 5) || (accountType === 'Performer' && subStep === 3) || (accountType === 'Host' && subStep === 2)) ? 'Complete Profile' : 'Next'}
                  </button>
              </div>
          </div>
        )}
    </div>
  )
}