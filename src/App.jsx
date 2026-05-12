import { useState, useEffect, lazy, Suspense } from 'react'
import { BrowserRouter, useSearchParams } from 'react-router-dom'
import { supabase } from './supabaseClient'
import Auth from './Auth'
import PublicProfile from './PublicProfile'
import Onboarding from './Onboarding'
import VibeCode from './VibeCode'
import SplashScreen from './SplashScreen' 
import TopNav from './TopNav'
import Ticker from './Ticker'

// THE GLOBAL BACKGROUND
import Moonshower from './backgrounds/Moonshower'

// Code Splitting
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

// Calculate Splash Screen status synchronously to prevent initial UI flash
const getInitialSplash = () => {
    const hour = new Date().getHours()
    let currentPhase = 'Midnight'
    
    if (hour >= 6 && hour < 10) currentPhase = 'Morning'
    else if (hour >= 10 && hour < 12) currentPhase = 'Day'
    else if (hour >= 12 && hour < 14) currentPhase = 'Noon'
    else if (hour >= 14 && hour < 17) currentPhase = 'Afternoon'
    else if (hour >= 17 && hour < 20) currentPhase = 'Evening'
    else if (hour >= 20 && hour < 24) currentPhase = 'Night'

    // 🟢 NEW: Check if they've already seen this specific phase today
    const todayStr = new Date().toDateString()
    const cacheKey = `bhnl_splash_${todayStr}`
    const lastPhase = localStorage.getItem(cacheKey)

    if (lastPhase === currentPhase) {
        return false // Skip splash, already saw it for this time of day!
    }

    return currentPhase
}

// --- INNER APP LOGIC ---
function MainApp() {
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = searchParams.get('tab') || "What's Boppin"
  
  const [session, setSession] = useState(null)
  const [currentUser, setCurrentUser] = useState(null)
  const [viewingEntity, setViewingEntity] = useState(null)
  const [showSplash, setShowSplash] = useState(getInitialSplash)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState(null)
  const [showVibeCode, setShowVibeCode] = useState(false)
  const [rewardToast, setRewardToast] = useState(null) 
  const [notificationToast, setNotificationToast] = useState(null) 
  const [showNotifications, setShowNotifications] = useState(false) 
  const [forceFriendView, setForceFriendView] = useState(false)

  const [simulatedRole, setSimulatedRole] = useState(null)
  const [testOnboardingType, setTestOnboardingType] = useState(null)

  // 🟢 NEW: When splash mounts, save it to local storage so it doesn't run again this phase
  useEffect(() => {
      if (showSplash && typeof showSplash === 'string') {
          const todayStr = new Date().toDateString()
          localStorage.setItem(`bhnl_splash_${todayStr}`, showSplash)
      }
  }, [showSplash])

  const showReward = (title, points) => {
      if (points > 0) {
          setRewardToast({ title, points })
          setTimeout(() => setRewardToast(null), 5000)
      }
  }

  // Add this navigation helper function right above your useEffects
  const navigateToProfile = async (userId) => {
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', userId).single();
      if (profile) {
          setViewingEntity(profile);
          setSearchParams({ tab: activeTab, view: 'profile' });
      }
  };

  const fetchUser = async () => {
    if (session?.user?.id) {
      const { data } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
      if (data) {
        setCurrentUser(data);
        checkDailyBonus(data);
      }
    }
  };

  // 2. Auth Listener
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setSession(session))
    return () => subscription.unsubscribe()
  }, [])

  // 3. User Fetch & Daily Bonus Trigger
  useEffect(() => {
    if (session) {
      fetchUser();
    }

    // THE 40-SECOND SILENT POLL
    // This updates their L$, Inventory, and database status in the background
    const pollInterval = setInterval(() => {
      if (session?.user?.id) {
        supabase.from('profiles').select('*').eq('id', session.user.id).single()
          .then(({ data }) => {
            if (data) setCurrentUser(data);
          });
      }
    }, 40000); // 40 seconds

    return () => clearInterval(pollInterval);
  }, [session])

  // 4. FIX #1 & #3: Hardware Back Button Interceptor (React Router Native)
  useEffect(() => {
    const view = searchParams.get('view')
    if (!view) {
        // If the URL drops the ?view parameter (e.g. hitting the back button), close overlays safely
        setViewingEntity(null)
        setForceFriendView(false)
    }
    if (activeTab !== 'Search') {
        setSearchResults(null)
        setSearchQuery('')
    }
  }, [searchParams, activeTab])

  // 5. Active Native Push Notifications (Supabase Realtime)
  useEffect(() => {
    if (!currentUser) return

    const notifSubscription = supabase.channel('realtime-notifs')
      .on('postgres', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${currentUser.id}` }, (payload) => {
          const newNotif = payload.new
          const pushEnabled = localStorage.getItem('bhnl_notifications_enabled') === 'true'

          if (pushEnabled && 'Notification' in window && Notification.permission === 'granted') {
              new Notification('BHNL Alert', { body: newNotif.content, icon: '/vite.svg', vibrate: [200, 100, 200] })
          } else {
              setNotificationToast(`🔔 Alert: ${newNotif.content}`)
              setTimeout(() => setNotificationToast(null), 5000)
          }
      }).subscribe()

    return () => supabase.removeChannel(notifSubscription)
  }, [currentUser])

  // 6. 2-Way VibeCode Connection Interceptor
  useEffect(() => {
    const handleVibeScan = async () => {
      if (!currentUser) return
      const targetId = searchParams.get('connect')

      if (targetId && targetId !== currentUser.id) {
        const { data: existing } = await supabase.from('connections').select('id').eq('follower_id', currentUser.id).eq('target_id', targetId).maybeSingle()

        if (!existing) {
            await supabase.from('connections').insert([
                { follower_id: currentUser.id, target_id: targetId, connection_type: 'friend' },
                { follower_id: targetId, target_id: currentUser.id, connection_type: 'friend' }
            ])
            const { data: earnedPts } = await supabase.rpc('trigger_reward', { target_user_id: currentUser.id, action_slug: 'scan_vibecode' })
            showReward('VibeCode Scanned!', earnedPts)

            await supabase.from('notifications').insert([
                { user_id: currentUser.id, title: 'New Connection', content: `You successfully connected with a new friend!` },
                { user_id: targetId, title: 'VibeCode Scanned', content: `${currentUser.username} just scanned your VibeCode and connected with you!` }
            ])
        }
        // Wipe 'connect' from the URL but keep the active tab, and open their profile
        setSearchParams({ tab: activeTab, view: 'profile' }, { replace: true })
        setViewingEntity({ id: targetId }) 
      }
    }
    handleVibeScan()
  }, [currentUser, searchParams])

  // 7. FIX #4: GLOBAL RADAR SWEEP (Battery Optimized)
  useEffect(() => {
    if (!currentUser) return;
    let watchId;
    let lastUpdateTime = 0;

    const pingLocation = () => {
      const isEnabled = localStorage.getItem('bhnl_location_enabled') === 'true';
      if (isEnabled && navigator.geolocation) {
        watchId = navigator.geolocation.watchPosition(
          async (position) => {
             const now = Date.now();
             // Throttles the database updates to max once per 60 seconds to save battery & DB reads
             if (now - lastUpdateTime >= 60000) {
                 lastUpdateTime = now;
                 const { latitude, longitude } = position.coords;
                 await supabase.from('profiles').update({ 
                     current_lat: latitude, 
                     current_lng: longitude, 
                     last_active: new Date().toISOString() 
                 }).eq('id', currentUser.id);
             }
          },
          (err) => console.error("Radar Sweep Error:", err),
          { enableHighAccuracy: true, maximumAge: 60000, timeout: 10000 }
        );
      }
    };
    pingLocation();

    return () => {
      if (watchId) navigator.geolocation.clearWatch(watchId);
    };
  }, [currentUser]);

  // 8. SECURITY TRAPDOOR for Temp Users
  useEffect(() => {
      if (currentUser?.account_type === 'Temp_Crawl' && activeTab !== 'Live') {
          // Security Breach Detected: Nuke the session and redirect
          supabase.auth.signOut().then(() => {
              window.location.href = '/?mode=login'
          })
      }
  }, [activeTab, currentUser])

  // Helpers
  async function checkDailyBonus(userProfile) {
      if (!userProfile) return
      const today = new Date()
      const todayString = today.toDateString()
      const lastClaim = userProfile.last_bonus_claim ? new Date(userProfile.last_bonus_claim).toDateString() : null

      if (todayString !== lastClaim) {
          const { data: earnedPts } = await supabase.rpc('trigger_reward', { target_user_id: userProfile.id, action_slug: 'daily_login' })
          await supabase.from('profiles').update({ last_bonus_claim: new Date().toISOString() }).eq('id', userProfile.id)
          showReward('Daily Login Bonus', earnedPts)

          await supabase.from('notifications').insert([{ user_id: userProfile.id, title: 'Daily Login', content: `You received ${earnedPts || 50} Lifestyle Points for your daily check-in!` }])

          if (userProfile.pref_events && userProfile.pref_events.length > 0) {
              const { data: allEvents } = await supabase.from('events').select('*').eq('status', 'approved')
              if (allEvents) {
                  const dayOfWeek = today.getDay()
                  const activeToday = allEvents.filter(e => {
                      const eDate = new Date(e.event_date)
                      return e.recurring_weekly ? eDate.getDay() === dayOfWeek : eDate.toDateString() === todayString
                  })
                  const matchedEvents = activeToday.filter(e => userProfile.pref_events.includes(e.event_type))

                  if (matchedEvents.length > 0) {
                      const matchNames = [...new Set(matchedEvents.map(m => m.event_type))].join(' & ')
                      await supabase.from('notifications').insert([{ user_id: userProfile.id, title: 'Suggested Events', content: `🎉 Heads up! There are ${matchedEvents.length} ${matchNames} events happening tonight in the Black Hills! Check the Lineup.` }])
                  }
              }
          }
      }
  }

  const changeTab = (newTab) => {
    // Utilize React Router to push the new tab to browser history
    setSearchParams({ tab: newTab })
  }

  const executeSearch = async (e) => {
    if (e.key === 'Enter' && searchQuery.trim()) {
      const query = `%${searchQuery}%`
      const { data: pages } = await supabase.from('pages').select('*').ilike('name', query)
      const { data: profiles } = await supabase.from('profiles').select('*').ilike('username', query)
      
      setSearchResults({ pages: pages || [], profiles: profiles || [] })
      setSearchParams({ tab: 'Search' })
    }
  }

  // FIX #2: Safe Database Search for view entity
  const onViewEntity = async (name) => {
    if (!name) return
    const { data: page } = await supabase.from('pages').select('*').ilike('name', name).limit(1).maybeSingle()
    if (page) {
        setViewingEntity(page)
        setSearchParams({ tab: activeTab, view: 'profile' })
        return
    }
    const { data: profile } = await supabase.from('profiles').select('*').ilike('username', name).limit(1).maybeSingle()
    if (profile) {
        setViewingEntity(profile)
        setSearchParams({ tab: activeTab, view: 'profile' })
        return
    }
    alert("This entity hasn't been added to the directory yet!")
  }

  // Pre-Render Checks
  if (!session) return <Auth />
  if (session && !currentUser) return <div className="flex justify-center mt-32"><div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div></div>
  if (!currentUser?.onboarding_complete || testOnboardingType) {
    return (
        <Onboarding 
            session={session} 
            forcedType={testOnboardingType}
            onComplete={() => {
                if (testOnboardingType) {
                    setTestOnboardingType(null) // Simply close the tester
                } else {
                    fetchUser() // Standard real-user onboarding completion
                }
            }} 
        />
    )
  }

  // 🟢 FIXED: The Pending Status Trapdoor (Admins are immune!)
  if (currentUser?.account_status === 'pending' && currentUser?.account_type !== 'Admin') {
      return (
          <div className="min-h-screen bg-[#030712] flex items-center justify-center p-4 animate-fade-in">
              <div className="bg-[#090812] border border-yellow-500/30 p-8 rounded-3xl max-w-md text-center shadow-[0_0_30px_rgba(234,179,8,0.15)]">
                  <div className="text-6xl mb-6 animate-pulse">⏳</div>
                  <h2 className="text-3xl font-['Bebas_Neue'] text-white tracking-widest mb-4">Account Pending</h2>
                  <p className="text-gray-400 text-sm mb-6 leading-relaxed">
                      Account Registration Request Submitted! App Access Pending Admin Approval.
                  </p>
                  <p className="text-yellow-500/80 text-xs font-bold uppercase tracking-widest bg-yellow-900/20 p-4 rounded-xl border border-yellow-500/20">
                      This process usually takes about 5-10 minutes. Thank you for your patience!
                  </p>
                  <button onClick={() => supabase.auth.signOut().then(() => window.location.reload())} className="mt-8 text-gray-500 text-[10px] font-bold uppercase tracking-widest hover:text-white transition-colors">
                      Sign Out
                  </button>
              </div>
          </div>
      )
  }

  // 🟢 NEW: If simulating a role, inject it. Otherwise use the real user.
  const effectiveUser = simulatedRole 
    ? { ...currentUser, account_type: simulatedRole } 
    : currentUser;

  const tabs = effectiveUser?.account_type === 'Admin' 
    ? ['Admin Console', 'Profile', "What's Boppin", 'Live', 'Leagues', 'Songbook', 'Settings']
    : ['Profile', "What's Boppin", 'Live', 'Leagues', 'Songbook', 'Settings']

  return (
    <div className="min-h-screen bg-transparent text-gray-200 font-['DM_Sans'] pb-20 relative overflow-hidden">

      {/* 🟢 NEW: The Simulation Escape Hatch */}
      {simulatedRole && (
          <button 
              onClick={() => setSimulatedRole(null)}
              className="fixed bottom-24 right-4 z-[999] bg-red-600 text-white px-4 py-3 rounded-full font-bold uppercase tracking-widest text-xs shadow-[0_0_20px_rgba(220,38,38,0.5)] animate-bounce"
          >
              Exit {simulatedRole} View
          </button>
      )}
      
      <Moonshower />

      {/* 🎁 REWARD TOASTS 🎁 */}
      {rewardToast && (
        <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-[600] animate-fade-in">
            <div className="bg-gradient-to-r from-yellow-600 via-orange-500 to-yellow-600 p-[2px] rounded-full shadow-[0_0_30px_rgba(234,179,8,0.4)]">
                <div className="bg-black/95 backdrop-blur-xl px-6 py-3 rounded-full flex items-center gap-4">
                    <div className="text-3xl animate-bounce">🎁</div>
                    <div>
                        <p className="text-white font-bold text-[10px] uppercase tracking-widest shadow-black">{rewardToast.title}</p>
                        <p className="text-yellow-400 font-['Bebas_Neue'] text-3xl leading-none tracking-wider drop-shadow-[0_0_10px_rgba(250,204,21,0.8)]">+{rewardToast.points} PTS</p>
                    </div>
                </div>
            </div>
        </div>
      )}
      {notificationToast && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-[600] animate-fade-in">
            <div className="bg-blue-600 border border-blue-400 px-6 py-3 rounded-full shadow-[0_0_20px_rgba(59,130,246,0.6)]">
                <p className="text-white text-sm font-bold">{notificationToast}</p>
            </div>
        </div>
      )}

      <TopNav 
          currentUser={effectiveUser}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          executeSearch={executeSearch}
          showNotifications={showNotifications}
          setShowNotifications={setShowNotifications}
          setShowVibeCode={setShowVibeCode}
          tabs={tabs}
          activeTab={activeTab}
          changeTab={changeTab}
          viewingEntity={viewingEntity}
      />

      <Ticker />

      <main 
        className="max-w-2xl mx-auto relative z-10"
        style={{ paddingBottom: 'calc(10rem + env(safe-area-inset-bottom, 0px))' }}
      >
        {viewingEntity ? (
          <PublicProfile 
              entity={viewingEntity} 
              onClose={() => { setSearchParams({ tab: activeTab }) }} 
              currentUser={effectiveUser} 
              forceAccess={forceFriendView ? 'friend' : null} 
          />
        ) : (
          <Suspense fallback={<div className="flex justify-center mt-20"><div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div></div>}>
            <div key={activeTab} className="animate-fade-in w-full h-full">
              {activeTab === 'Projector' && <Projector />}
              {activeTab === 'Search' && searchResults && (
                <div className="p-4 mt-4 animate-fade-in">
                  <h2 className="text-3xl font-['Bebas_Neue'] text-blue-400 mb-6">Search Results</h2>
                  {searchResults.pages.length === 0 && searchResults.profiles.length === 0 && <p className="text-gray-500 italic">No matches found.</p>}
                  <div className="space-y-4">
                    {searchResults.profiles.map(user => (
                      <div key={user.id} onClick={() => onViewEntity(user.username)} className="bg-gray-900 p-4 rounded-xl border border-gray-800 cursor-pointer hover:border-blue-500 transition-colors flex items-center gap-4">
                         <img src={user.profile_pic || `https://api.dicebear.com/7.x/bottts/svg?seed=${user.username}`} className="w-12 h-12 rounded-full border border-gray-700 object-cover bg-black" alt={user.username} referrerPolicy="no-referrer" onError={(e) => { e.target.onerror = null; e.target.src = `https://api.dicebear.com/7.x/bottts/svg?seed=${user.username}` }} />
                         <h4 className="font-bold text-white text-lg">{user.username}</h4>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {activeTab === "What's Boppin" && <FYP currentUser={effectiveUser} onViewEntity={onViewEntity} />}
              {activeTab === 'Admin Console' && <AdminPanel session={session} setSimulatedRole={setSimulatedRole} setShowSplash={setShowSplash} setTestOnboardingType={setTestOnboardingType} />}
              {activeTab === 'Profile' && <Profile session={session} />}
              {activeTab === 'Events' && <Events onViewEntity={onViewEntity} />}
              {activeTab === 'Leagues' && <Leaderboard onViewEntity={onViewEntity} />}
              {activeTab === 'Songbook' && <SongBook currentUser={effectiveUser} />}
              {activeTab === 'Settings' && <Settings currentUser={effectiveUser} setCurrentUser={setCurrentUser} />}
              {activeTab === 'Map' && <Map currentUser={effectiveUser} onViewEntity={onViewEntity} />}
              {activeTab === 'Live' && <Live currentUser={effectiveUser} onViewEntity={onViewEntity} />}
              {activeTab === 'Shop' && <Shop currentUser={effectiveUser} />}
            </div>
          </Suspense>
        )}
      </main>

      {showVibeCode && <VibeCode session={session} onClose={() => setShowVibeCode(false)} />}

      {showSplash && <SplashScreen username={currentUser?.username} phase={showSplash} onComplete={() => setShowSplash(false)} />}
    </div>
  )
}

// --- APP WRAPPER FOR REACT ROUTER ---
export default function App() {
  return (
    <BrowserRouter>
      <MainApp />
    </BrowserRouter>
  )
}