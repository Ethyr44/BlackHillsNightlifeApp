import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

const CustomSwitch = ({ id, checked, onChange }) => (
  <div className="w-48 aspect-video rounded-xl has-[:checked]:bg-[#3a3347] bg-[#ebe6ef] border-4 border-[#121331] transform scale-[0.55] origin-right transition-colors">
    <div className="flex h-full w-full px-2 items-center gap-x-2">
      <div className="w-6 h-6 flex-shrink-0 rounded-full border-4 border-[#121331]"></div>
      <label htmlFor={id} className="has-[:checked]:scale-x-[-1] w-full h-10 border-4 border-[#121331] rounded cursor-pointer relative block">
        <input type="checkbox" id={id} className="hidden" checked={checked} onChange={onChange} />
        <div className="w-full h-full bg-[#f24c00] relative overflow-hidden">
          <div className="w-0 h-0 z-20 border-l-[24px] border-l-transparent border-r-[24px] border-r-transparent border-t-[20px] border-t-[#121331] relative">
            <div className="w-0 h-0 absolute border-l-[18px] border-l-transparent border-r-[18px] border-r-transparent border-t-[15px] border-t-[#e44901] -top-5 -left-[18px]"></div>
          </div>
          <div className="w-[24px] h-9 z-10 absolute top-[9px] left-0 bg-[#f24c00] border-r-2 border-b-4 border-[#121331] transform skew-y-[39deg]"></div>
          <div className="w-[25px] h-9 z-10 absolute top-[9px] left-[24px] bg-[#c44002] border-r-4 border-l-2 border-b-4 border-[#121331] transform skew-y-[-39deg]"></div>
        </div>
      </label>
      <div className="w-6 h-1 flex-shrink-0 bg-[#121331] rounded-full"></div>
    </div>
  </div>
)

export default function Settings({ currentUser, setCurrentUser }) {
  const [editName, setEditName] = useState(currentUser?.username || '')
  const [updateStatus, setUpdateStatus] = useState('')

  // Pull existing preferences from LocalStorage
  const [locationEnabled, setLocationEnabled] = useState(() => localStorage.getItem('bhnl_location_enabled') === 'true')
  const [notificationsEnabled, setNotificationsEnabled] = useState(() => localStorage.getItem('bhnl_notifications_enabled') === 'true')

  const handleSaveName = async () => {
      setUpdateStatus('Saving...')
      const { error } = await supabase.from('profiles').update({ username: editName }).eq('id', currentUser.id)
      if (!error) {
          setCurrentUser({...currentUser, username: editName})
          setUpdateStatus('✅ Username Updated!')
          setTimeout(() => setUpdateStatus(''), 2000)
      } else {
          setUpdateStatus('⚠️ Error saving name.')
      }
  }

  const handleSignOut = async () => {
      if(window.confirm("Are you sure you want to sign out?")) {
          await supabase.auth.signOut()
          window.location.href = '/' 
      }
  }

  // 🟢 NEW: Secure Account Deletion
  const handleDeleteAccount = async () => {
      // 1st Safety Check
      const confirm1 = window.confirm("Are you absolutely sure you want to delete your account? This will permanently erase your profile, points, and vault.")
      if (!confirm1) return

      // 2nd Safety Check
      const confirm2 = window.confirm("FINAL WARNING: This action cannot be undone. Are you sure you want to proceed?")
      if (!confirm2) return

      setUpdateStatus('Deleting account...')
      
      try {
          // Call the secure Database Function we created
          const { error } = await supabase.rpc('delete_user')
          if (error) throw error

          // Wipe local memory and log out
          localStorage.removeItem('bhnl_location_enabled')
          localStorage.removeItem('bhnl_notifications_enabled')
          await supabase.auth.signOut()
          window.location.href = '/' 
      } catch (err) {
          alert(`Error deleting account: ${err.message}`)
          setUpdateStatus('')
      }
  }

  const handleLocationToggle = () => {
      if (!locationEnabled) {
          if (!navigator.geolocation) return alert("Location services are not supported by your browser.")

          navigator.geolocation.getCurrentPosition(
              async (position) => {
                  const { latitude, longitude } = position.coords
                  const { error } = await supabase.from('profiles').update({ current_lat: latitude, current_lng: longitude, last_active: new Date().toISOString() }).eq('id', currentUser.id)
                  
                  if (error) {
                      alert("Error linking location: " + error.message)
                      return
                  }

                  setLocationEnabled(true)
                  localStorage.setItem('bhnl_location_enabled', 'true')
                  alert("Location linked! You are now visible on the BHNL Map.")
              },
              (error) => {
                  alert(`Location access denied: ${error.message}. Please check your phone's settings.`)
                  setLocationEnabled(false)
              },
              { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
          )
      } else {
          supabase.from('profiles').update({ current_lat: null, current_lng: null }).eq('id', currentUser.id).then(({ error }) => {
              if (error) {
                  alert("Error unlinking location: " + error.message)
                  return
              }
              setLocationEnabled(false)
              localStorage.setItem('bhnl_location_enabled', 'false')
          })
      }
  }

  const handleNotificationToggle = async () => {
      if (!notificationsEnabled) {
          if (!('Notification' in window)) {
              alert("Push notifications are not supported by this browser.")
              return
          }
          
          const permission = await Notification.requestPermission()
          
          if (permission === 'granted') {
              setNotificationsEnabled(true)
              localStorage.setItem('bhnl_notifications_enabled', 'true')
              alert("Push notifications enabled! You will now receive background alerts.")
          } else {
              alert("Permission denied. You may need to manually enable notifications for this site in your browser settings.")
              setNotificationsEnabled(false)
              localStorage.setItem('bhnl_notifications_enabled', 'false')
          }
      } else {
          setNotificationsEnabled(false)
          localStorage.setItem('bhnl_notifications_enabled', 'false')
      }
  }

  return (
    <div className="max-w-2xl mx-auto p-4 mt-4 animate-fade-in pb-32">
      <h2 className="text-5xl font-['Bebas_Neue'] text-blue-400 tracking-wider mb-8 drop-shadow-[0_0_10px_rgba(59,130,246,0.8)] text-center">
         Settings
      </h2>

      <div className="space-y-8">
          
          <div className="bg-[#090812] border-2 border-gray-800 rounded-3xl p-6 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-400 to-cyan-400"></div>
              <h3 className="text-2xl font-['Bebas_Neue'] text-white tracking-widest mb-4">Edit Profile</h3>
              <div className="flex flex-col space-y-2">
                  <label className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Username</label>
                  <input 
                      type="text" 
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="bg-black/60 border border-gray-700 text-white rounded-xl p-4 focus:outline-none focus:border-blue-500 transition-colors"
                  />
                  <button onClick={handleSaveName} className="bg-blue-600 text-white font-bold py-3 rounded-xl mt-2 hover:bg-blue-500 transition-colors uppercase tracking-widest text-xs shadow-[0_0_15px_rgba(59,130,246,0.3)]">
                      Save Username
                  </button>
                  {updateStatus && <p className="text-xs text-center text-green-400 mt-2 font-bold uppercase tracking-widest">{updateStatus}</p>}
              </div>
          </div>

          <div className="bg-[#090812] border-2 border-gray-800 rounded-3xl p-6 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-purple-600"></div>
              <h3 className="text-2xl font-['Bebas_Neue'] text-white tracking-widest mb-6">Permissions</h3>

              <div className="space-y-3">
                  <div className="flex justify-between items-center bg-black/40 p-4 rounded-2xl border border-gray-800/50">
                      <div className="pr-4">
                          <h4 className="text-sm font-bold text-white mb-1">Location Services</h4>
                          <p className="text-[10px] text-gray-500 uppercase tracking-widest leading-snug">Allow BHNL to find nearby venues and events.</p>
                      </div>
                      <CustomSwitch 
                         id="loc-switch" 
                         checked={locationEnabled} 
                         onChange={handleLocationToggle} 
                      />
                  </div>

                  <div className="flex justify-between items-center bg-black/40 p-4 rounded-2xl border border-gray-800/50">
                      <div className="pr-4">
                          <h4 className="text-sm font-bold text-white mb-1">Push Notifications</h4>
                          <p className="text-[10px] text-gray-500 uppercase tracking-widest leading-snug">Get alerted when your turn is up on stage.</p>
                      </div>
                      <CustomSwitch 
                         id="notif-switch" 
                         checked={notificationsEnabled} 
                         onChange={handleNotificationToggle} 
                      />
                  </div>
              </div>
          </div>

          <div className="bg-[#090812] border-2 border-red-900/30 rounded-3xl p-6 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500 to-red-900"></div>
              <h3 className="text-2xl font-['Bebas_Neue'] text-red-500 tracking-widest mb-6">Account</h3>
              <div className="bg-black/40 p-4 rounded-2xl border border-red-900/30 mb-6">
                  <p className="text-gray-400 text-xs">Signed in as <strong className="text-white">{currentUser?.email || 'User'}</strong></p>
              </div>
              
              <button onClick={handleSignOut} className="w-full bg-red-900/20 text-red-500 hover:bg-red-600 hover:text-white border border-red-500/50 font-bold uppercase tracking-widest text-sm py-4 rounded-xl transition-all shadow-[0_0_15px_rgba(239,68,68,0.2)]">
                 Sign Out
              </button>

              {/* 🟢 NEW: Discreet but clear Delete Account Button */}
              <div className="mt-6 text-center">
                  <button onClick={handleDeleteAccount} className="text-[10px] font-bold uppercase tracking-widest text-gray-600 hover:text-red-500 transition-colors underline decoration-gray-600 hover:decoration-red-500 underline-offset-4">
                      Permanently Delete Account
                  </button>
              </div>
          </div>

      </div>
    </div>
  )
}