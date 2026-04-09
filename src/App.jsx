import { useState, useEffect, lazy, Suspense } from 'react'
import { supabase } from './supabaseClient'
import Auth from './Auth'
import PublicProfile from './PublicProfile'
import Onboarding from './Onboarding'
import VibeCode from './VibeCode'
import NotificationsMenu from './NotificationsMenu'
import SplashScreen from './SplashScreen' 

// Code Splitting: These only download when the user clicks the tab
const FYP = lazy(() => import('./FYP'))
const Profile = lazy(() => import('./Profile'))
const Leaderboard = lazy(() => import('./Leaderboard'))
const Events = lazy(() => import('./Events'))
const AdminPanel = lazy(() => import('./AdminPanel'))
const Map = lazy(() => import('./Map'))
const Live = lazy(() => import('./Live'))
const Shop = lazy(() => import('./Shop'))
const Settings = lazy(() => import('./Settings'))
const SongBook = lazy(() => import('./Songbook'))
const Projector = lazy(() => import('./Projector'))

export default function App() {
  const [session, setSession] = useState(null)
  const [currentUser, setCurrentUser] = useState(null)
  
  // 🟢 GLOBAL RADAR SWEEP: Updates GPS every 60 seconds if enabled
  useEffect(() => {
    if (!currentUser) return;

    const pingLocation = () => {
      const isEnabled = localStorage.getItem('bhnl_location_enabled') === 'true';
      if (isEnabled && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          async (position) => {
             const { latitude, longitude } = position.coords;
             await supabase.from('profiles').update({ 
                 current_lat: latitude, 
                 current_lng: longitude,
                 last_active: new Date().toISOString()
             }).eq('id', currentUser.id);
          },
          (err) => console.error("Radar Sweep Error:", err),
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
      }
    };

    // Ping once immediately, then start the 60-second loop
    pingLocation();
    const intervalId = setInterval(pingLocation, 60000);
    
    return () => clearInterval(intervalId);
  }, [currentUser]);
  
  const [activeTab, setActiveTab] = useState(() => {
      const params = new URLSearchParams(window.location.search)
      return params.get('tab') || 'FYP'
  })
  const [viewingEntity, setViewingEntity] = useState(null)
  const [showSplash, setShowSplash] = useState(false)
  
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState(null)
  const [showVibeCode, setShowVibeCode] = useState(false)

  const [rewardToast, setRewardToast] = useState(null) 
  const [notificationToast, setNotificationToast] = useState(null) 
  const [showNotifications, setShowNotifications] = useState(false) 
  const [forceFriendView, setForceFriendView] = useState(false)

  const showReward = (title, points) => {
      if (points > 0) {
          setRewardToast({ title, points })
          setTimeout(() => setRewardToast(null), 5000)
      }
  }

  // 1. The Once-Per-Time-Block Splash Screen Logic
  useEffect(() => {
      const hour = new Date().getHours()
      const date = new Date().toDateString()
      let currentPhase = 'Midnight'
      
      if (hour >= 6 && hour < 10) currentPhase = 'Morning'
      else if (hour >= 10 && hour < 12) currentPhase = 'Day'
      else if (hour >= 12 && hour < 14) currentPhase = 'Noon'
      else if (hour >= 14 && hour < 17) currentPhase = 'Afternoon'
      else if (hour >= 17 && hour < 20) currentPhase = 'Evening'
      else if (hour >= 20 && hour < 24) currentPhase = 'Night'

      const timeBlockKey = `${date}-${currentPhase}`
      const lastSeen = localStorage.getItem('bhnl_last_splash')

      if (lastSeen !== timeBlockKey) {
          setShowSplash(currentPhase) 
          localStorage.setItem('bhnl_last_splash', timeBlockKey)
      }
  }, [])

  // 2. Auth Listener
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setSession(session))
    return () => subscription.unsubscribe()
  }, [])

  // 3. User Fetch & Daily Bonus Trigger
  useEffect(() => {
    if (session) {
      supabase.from('profiles').select('*').eq('id', session.user.id).single()
        .then(({ data }) => {
            if (data) {
              setCurrentUser(data)
              checkDailyBonus(data)
            }
        })
    }
  }, [session])

  // 4. Mobile Hardware Back Button Interceptor
  useEffect(() => {
    const handlePopState = (event) => {
      if (event.state && event.state.tab) {
        setActiveTab(event.state.tab)
      } else {
        setActiveTab('FYP') 
      }
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  // 5. Active Native Push Notifications (Supabase Realtime)
  useEffect(() => {
    if (!currentUser) return

    const notifSubscription = supabase.channel('realtime-notifs')
      .on('postgres', {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${currentUser.id}` 
      }, (payload) => {
          const newNotif = payload.new
          
          // Check the toggle switch memory
          const pushEnabled = localStorage.getItem('bhnl_notifications_enabled') === 'true'

          // Only fire the OS notification if they turned the switch ON
          if (pushEnabled && 'Notification' in window && Notification.permission === 'granted') {
              new Notification('BHNL Alert', {
                  body: newNotif.content,
                  icon: '/vite.svg', 
                  vibrate: [200, 100, 200] 
              })
          } else {
              // If switch is off (or permissions denied), just show the in-app blue toast
              setNotificationToast(`🔔 Alert: ${newNotif.content}`)
              setTimeout(() => setNotificationToast(null), 5000)
          }
      })
      .subscribe()

    return () => supabase.removeChannel(notifSubscription)
  }, [currentUser])

  // 6. 2-Way VibeCode Connection Interceptor
  useEffect(() => {
    const handleVibeScan = async () => {
      if (!currentUser) return
      const params = new URLSearchParams(window.location.search)
      const targetId = params.get('connect')

      if (targetId && targetId !== currentUser.id) {
        const { data: existing } = await supabase.from('connections').select('id').eq('follower_id', currentUser.id).eq('target_id', targetId).maybeSingle()

        if (!existing) {
            await supabase.from('connections').insert([
                { follower_id: currentUser.id, target_id: targetId, connection_type: 'friend' },
                { follower_id: targetId, target_id: currentUser.id, connection_type: 'friend' }
            ])
            
            const { data: earnedPts } = await supabase.rpc('trigger_reward', { target_user_id: currentUser.id, action_slug: 'scan_vibecode' })
            showReward('VibeCode Scanned!', earnedPts)
        }
        window.history.replaceState({}, document.title, `/?tab=${activeTab}`)
        setViewingEntity({ id: targetId }) 
      }
    }
    handleVibeScan()
  }, [currentUser])

  // Helpers
  const checkDailyBonus = async (userProfile) => {
      if (!userProfile) return
      const today = new Date()
      const todayString = today.toDateString()
      const lastClaim = userProfile.last_bonus_claim ? new Date(userProfile.last_bonus_claim).toDateString() : null

      if (todayString !== lastClaim) {
          // 1. Trigger the Daily Points
          const { data: earnedPts } = await supabase.rpc('trigger_reward', { target_user_id: userProfile.id, action_slug: 'daily_login' })
          await supabase.from('profiles').update({ last_bonus_claim: new Date().toISOString() }).eq('id', userProfile.id)
          showReward('Daily Login Bonus', earnedPts)

          // 2. 🟢 THE NEW EVENT MATCHING RADAR 🟢
          if (userProfile.pref_events && userProfile.pref_events.length > 0) {
              // Fetch all approved events
              const { data: allEvents } = await supabase.from('events').select('*').eq('status', 'approved')
              
              if (allEvents) {
                  // Filter down to events happening EXACTLY today (explicit date OR recurring day of week)
                  const dayOfWeek = today.getDay()
                  const activeToday = allEvents.filter(e => {
                      const eDate = new Date(e.event_date)
                      if (e.recurring_weekly) return eDate.getDay() === dayOfWeek
                      return eDate.toDateString() === todayString
                  })

                  // Cross-reference today's active events with the user's preferences
                  const matchedEvents = activeToday.filter(e => userProfile.pref_events.includes(e.event_type))

                  if (matchedEvents.length > 0) {
                      // Grab the unique event types they matched with (e.g., "Karaoke & Trivia")
                      const matchNames = [...new Set(matchedEvents.map(m => m.event_type))].join(' & ')
                      
                      // Drop the alert straight into their notification inbox!
                      await supabase.from('notifications').insert([{
                          user_id: userProfile.id,
                          content: `🎉 Heads up! There are ${matchedEvents.length} ${matchNames} events happening tonight in the Black Hills! Check the Lineup.`
                      }])
                  }
              }
          }
      }
  }

  const changeTab = (newTab) => {
    window.history.pushState({ tab: newTab }, '', `?tab=${newTab}`)
    setViewingEntity(null)
    setForceFriendView(false) 
    setSearchResults(null)
    setSearchQuery('')
    setActiveTab(newTab)
  }

  const executeSearch = async (e) => {
    if (e.key === 'Enter' && searchQuery.trim()) {
      const query = `%${searchQuery}%`
      const { data: pages } = await supabase.from('pages').select('*').ilike('name', query)
      const { data: profiles } = await supabase.from('profiles').select('*').ilike('username', query)
      
      setSearchResults({ pages: pages || [], profiles: profiles || [] })
      setViewingEntity(null)
      setForceFriendView(false)
      setActiveTab('Search')
    }
  }

  const onViewEntity = async (name) => {
    if (!name) return
    const { data: page } = await supabase.from('pages').select('*').ilike('name', name).single()
    if (page) return setViewingEntity(page)
    const { data: profile } = await supabase.from('profiles').select('*').ilike('username', name).single()
    if (profile) return setViewingEntity(profile)
    alert("This entity hasn't been added to the directory yet!")
  }

  // Pre-Render Checks
  if (!session) return <Auth />
  if (session && !currentUser) return <div className="flex justify-center mt-32"><div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div></div>
  if (currentUser && currentUser.onboarding_complete === false) {
    return <Onboarding session={session} onComplete={() => setCurrentUser({...currentUser, onboarding_complete: true})} />
  }

  const baseTabs = ["FYP", "Profile", "Songbook", "Leagues", "Live", "Settings"]
  const tabs = currentUser?.account_type === 'Admin' ? ["Admin Console", ...baseTabs] : baseTabs

  const SuspenseLoader = () => (
    <div className="flex justify-center mt-20">
      <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#030712] text-gray-200 font-['DM_Sans'] pb-20 relative">
      
      {/* 🎁 THE UNIVERSAL REWARD TOAST 🎁 */}
      {rewardToast && (
        <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-[600] animate-fade-in">
            <div className="bg-gradient-to-r from-yellow-600 via-orange-500 to-yellow-600 p-[2px] rounded-full shadow-[0_0_30px_rgba(234,179,8,0.4)]">
                <div className="bg-black/95 backdrop-blur-xl px-6 py-3 rounded-full flex items-center gap-4">
                    <div className="text-3xl animate-bounce">🎁</div>
                    <div>
                        <p className="text-white font-bold text-[10px] uppercase tracking-widest shadow-black">{rewardToast.title}</p>
                        <p className="text-yellow-400 font-['Bebas_Neue'] text-3xl leading-none tracking-wider drop-shadow-[0_0_10px_rgba(250,204,21,0.8)]">
                            +{rewardToast.points} PTS
                        </p>
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* 🔔 FALLBACK NOTIFICATION TOAST 🔔 */}
      {notificationToast && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-[600] animate-fade-in">
            <div className="bg-blue-600 border border-blue-400 px-6 py-3 rounded-full shadow-[0_0_20px_rgba(59,130,246,0.6)]">
                <p className="text-white text-sm font-bold">{notificationToast}</p>
            </div>
        </div>
      )}

      <nav className="bg-gray-900/95 backdrop-blur-md sticky top-0 z-50 border-b border-gray-800 shadow-[0_4px_30px_rgba(0,0,0,0.5)]">
        <div className="max-w-2xl mx-auto p-4 flex gap-3 items-center justify-between">
          <h1 className="font-['Bebas_Neue'] text-3xl tracking-widest text-blue-500 drop-shadow-[0_0_8px_rgba(59,130,246,0.8)] hidden sm:block">BHNL</h1>
          
          <div className="flex-1 relative mx-2">
            <input 
              type="text" placeholder="Search users, venues, acts" value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)} onKeyDown={executeSearch}
              className="w-full bg-black border border-gray-700 text-white rounded-full py-2 px-4 pl-10 focus:outline-none focus:border-blue-500 transition-all text-sm"
            />
            <span className="absolute left-4 top-2.5 text-gray-500">🔍</span>
          </div>

          <div className="relative">
             <button onClick={() => setShowNotifications(!showNotifications)} className="text-2xl hover:scale-110 transition-transform bg-gray-800 w-10 h-10 rounded-full flex items-center justify-center border border-gray-700">
                🔔
             </button>
             {showNotifications && <NotificationsMenu userId={currentUser.id} onClose={() => setShowNotifications(false)} />}
          </div>
        </div>
        
        <div className="max-w-2xl mx-auto px-4 flex overflow-x-auto hide-scrollbar border-t border-gray-800">
          <div className="flex gap-1 py-2">
            {tabs.map(tab => (
              <button
                key={tab} onClick={() => changeTab(tab)}
                className={`px-4 py-2 rounded-full text-sm font-bold tracking-widest uppercase transition-all whitespace-nowrap ${
                  activeTab === tab && !viewingEntity ? (tab === 'Admin Console' ? 'bg-red-900/20 text-red-500 border border-red-500/50 shadow-[0_0_10px_rgba(239,68,68,0.2)]' : 'bg-blue-600/20 text-blue-400 border border-blue-500/50 shadow-[0_0_10px_rgba(59,130,246,0.2)]') : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
      </nav>

      <main className="max-w-2xl mx-auto">
        {viewingEntity ? (
          <PublicProfile 
            entity={viewingEntity} 
            onClose={() => { setViewingEntity(null); setForceFriendView(false); }} 
            currentUser={currentUser} 
            forceAccess={forceFriendView ? 'friend' : null} 
          />
        ) : (
          <Suspense fallback={<SuspenseLoader />}>
            {/* THE FADE WRAPPER */}
            <div key={activeTab} className="animate-fade-in w-full h-full">
              {activeTab === 'Projector' && <Projector />}
              {activeTab === 'Search' && searchResults && (
                <div className="p-4 mt-4 animate-fade-in">
                  <h2 className="text-3xl font-['Bebas_Neue'] text-blue-400 mb-6">Search Results</h2>
                  {searchResults.pages.length === 0 && searchResults.profiles.length === 0 && <p className="text-gray-500 italic">No matches found.</p>}
                  <div className="space-y-4">
                    {searchResults.profiles.map(user => (
                      <div key={user.id} onClick={() => setViewingEntity(user)} className="bg-gray-900 p-4 rounded-xl border border-gray-800 cursor-pointer hover:border-blue-500 transition-colors flex items-center gap-4">
                         <img src={user.profile_pic || `https://api.dicebear.com/7.x/shapes/svg?seed=${user.username}`} className="w-12 h-12 rounded-full border border-gray-700 object-cover bg-black" alt={user.username} />
                         <div>
                           <h4 className="font-bold text-white text-lg">{user.username}</h4>
                         </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {activeTab === 'FYP' && <FYP currentUser={currentUser} />}
              {activeTab === 'Admin Console' && <AdminPanel session={session} />}
              {activeTab === 'Profile' && <Profile session={session} />}
              {activeTab === 'Events' && <Events onViewEntity={onViewEntity} />}
              {activeTab === 'Leagues' && <Leaderboard />}
              {activeTab === 'Songbook' && <SongBook currentUser={currentUser} />}
              {activeTab === 'Settings' && <Settings currentUser={currentUser} setCurrentUser={setCurrentUser} />}
              {activeTab === 'Map' && <Map onViewEntity={onViewEntity} />}
              {activeTab === 'Live' && <Live currentUser={currentUser} />}
              {activeTab === 'Shop' && <Shop currentUser={currentUser} />}
            </div>
          </Suspense>
        )}
      </main>

      {showVibeCode && <VibeCode session={session} onClose={() => setShowVibeCode(false)} />}

      {!showVibeCode && (
        <button 
          onClick={() => setShowVibeCode(true)}
          className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-[#090812] text-white w-16 h-16 rounded-full shadow-[0_0_20px_rgba(59,130,246,0.6)] border-2 border-blue-500 flex items-center justify-center hover:scale-110 transition-transform z-50 group"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 text-blue-400 group-hover:text-white transition-colors">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0 1 3.75 9.375v-4.5ZM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 0 1-1.125-1.125v-4.5ZM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0 1 13.5 9.375v-4.5Z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 6.75h.75v.75h-.75v-.75ZM6.75 16.5h.75v.75h-.75v-.75ZM16.5 6.75h.75v.75h-.75v-.75ZM13.5 13.5h.75v.75h-.75v-.75ZM13.5 19.5h.75v.75h-.75v-.75ZM19.5 13.5h.75v.75h-.75v-.75ZM19.5 19.5h.75v.75h-.75v-.75ZM16.5 16.5h.75v.75h-.75v-.75Z" />
          </svg>
        </button>
      )}

      {showSplash && (
        <SplashScreen 
          username={currentUser?.username}
          phase={showSplash} 
          onComplete={() => setShowSplash(false)} 
        />
      )}
    </div>
  )
}