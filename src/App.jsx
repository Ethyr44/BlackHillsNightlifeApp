import { useState, useEffect, lazy, Suspense } from 'react'
import { BrowserRouter, useSearchParams } from 'react-router-dom'
import { supabase } from './supabaseClient'
import Auth from './Auth'
import PublicProfile from './PublicProfile'
import Onboarding from './Onboarding'
import VibeCode from './VibeCode'
import SplashScreen from './SplashScreen' 
import Ticker from './Ticker'
import { GlobalToast } from './GlobalToast'
import GlobalHeader from './GlobalHeader'
import BottomNav from './BottomNav'
import BackgroundManager from './BackgroundManager'

// 🟢 NEW: Direct Code Splitting for the flattened navigation
const MainFeed = lazy(() => import('./MainFeed'))
const EventsFeed = lazy(() => import('./EventsFeed')) // Serves as the Venues List
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

const getInitialSplash = () => {
    const hour = new Date().getHours()
    let currentPhase = 'Midnight'
    
    if (hour >= 6 && hour < 10) currentPhase = 'Morning'
    else if (hour >= 10 && hour < 12) currentPhase = 'Day'
    else if (hour >= 12 && hour < 14) currentPhase = 'Noon'
    else if (hour >= 14 && hour < 17) currentPhase = 'Afternoon'
    else if (hour >= 17 && hour < 20) currentPhase = 'Evening'
    else if (hour >= 20 && hour < 24) currentPhase = 'Night'

    const todayStr = new Date().toDateString()
    const cacheKey = `bhnl_splash_${todayStr}`
    const lastPhase = localStorage.getItem(cacheKey)

    if (lastPhase === currentPhase) return false 
    return currentPhase
}

function MainApp() {
  const [searchParams, setSearchParams] = useSearchParams()
  // 🟢 NEW: Default tab is now 'Feed'
  const activeTab = searchParams.get('tab') || "Feed"
  
  const [session, setSession] = useState(null)
  const [currentUser, setCurrentUser] = useState(null)
  const [loading, setLoading] = useState(true)
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

  // 1. You can default this to an empty object now
  const [systemConfig, setSystemConfig] = useState({})

  useEffect(() => {
      async function fetchConfig() {
          const { data } = await supabase.from('system_config').select('page_visibility').maybeSingle()
          if (data && data.page_visibility) {
              setSystemConfig(data.page_visibility)
          }
      }
      fetchConfig()
  }, [])

  const joinSessionId = searchParams.get('join')
  const isGuestMode = searchParams.get('guest') === 'true'

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

  const fetchUser = async () => {
    if (session?.user?.id) {
      const { data } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
      if (data) {
        setCurrentUser(data);
        checkDailyBonus(data);
        
        if (joinSessionId && !isGuestMode) {
            localStorage.setItem('bhnl_joined_session', joinSessionId)
            setSearchParams({ tab: 'KSocial' }, { replace: true })
        }
      }
      setLoading(false);
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
        setSession(session)
        if (!session) setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        setSession(session)
        if (!session) setLoading(false)
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (session) fetchUser();
    const pollInterval = setInterval(() => {
      if (session?.user?.id) {
        supabase.from('profiles').select('*').eq('id', session.user.id).single()
          .then(({ data }) => { if (data) setCurrentUser(data); });
      }
    }, 40000); 
    return () => clearInterval(pollInterval);
  }, [session])

  useEffect(() => {
    const view = searchParams.get('view')
    if (!view) {
        setViewingEntity(null)
        setForceFriendView(false)
    }
    if (activeTab !== 'Search') {
        setSearchResults(null)
        setSearchQuery('')
    }
  }, [searchParams, activeTab])

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
        }
        setSearchParams({ tab: activeTab, view: 'profile' }, { replace: true })
        setViewingEntity({ id: targetId }) 
      }
    }
    handleVibeScan()
  }, [currentUser, searchParams])

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
          { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
        );
      }
    };
    pingLocation();

    return () => { if (watchId) navigator.geolocation.clearWatch(watchId); };
  }, [currentUser]);

  useEffect(() => {
      if (currentUser?.account_type === 'Temp_Crawl' && activeTab !== 'KSocial') {
          supabase.auth.signOut().then(() => { window.location.href = '/?mode=login' })
      }
  }, [activeTab, currentUser])

  async function checkDailyBonus(userProfile) {
      if (!userProfile) return
      const today = new Date()
      const todayString = today.toDateString()
      const lastClaim = userProfile.last_bonus_claim ? new Date(userProfile.last_bonus_claim).toDateString() : null

      if (todayString !== lastClaim) {
          const { data: earnedPts } = await supabase.rpc('trigger_reward', { target_user_id: userProfile.id, action_slug: 'daily_login' })
          await supabase.from('profiles').update({ last_bonus_claim: new Date().toISOString() }).eq('id', userProfile.id)
          showReward('Daily Login Bonus', earnedPts)
      }
  }

  const changeTab = (newTab) => setSearchParams({ tab: newTab })

  const executeSearch = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (searchQuery.trim()) {
      const query = `%${searchQuery}%`
      const { data: pages } = await supabase.from('pages').select('*').ilike('name', query)
      const { data: profiles } = await supabase.from('profiles').select('*').ilike('username', query)
      
      setSearchResults({ pages: pages || [], profiles: profiles || [] })
      setSearchParams({ tab: 'Search' })
    }
  }

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

  if (joinSessionId && isGuestMode) {
      return (
          <div className="min-h-screen bg-[#090812] font-sans selection:bg-yellow-500/30">
              <BackgroundManager />
              <GlobalToast />
              <div className="pt-8">
                  <Suspense fallback={<div className="text-white text-center mt-20">Loading...</div>}>
                      <Live currentUser={null} forceJoinId={joinSessionId} forceGuest={true} />
                  </Suspense>
              </div>
          </div>
      )
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-[#030712]"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div></div>

  if (!session) return <Auth />
  if (session && !currentUser) return <div className="flex justify-center mt-32"><div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div></div>
  
  if (currentUser?.account_status === 'pending' && currentUser?.account_type !== 'Admin') {
      return (
          <div className="min-h-screen bg-[#030712] flex items-center justify-center p-4">
              <div className="bg-[#090812] border border-yellow-500/30 p-8 rounded-3xl text-center max-w-md shadow-[0_0_30px_rgba(234,179,8,0.15)]">
                  <span className="text-6xl mb-4 block animate-pulse">⏳</span>
                  <h2 className="text-3xl font-['Bebas_Neue'] text-white tracking-widest mb-2">Application Pending</h2>
                  <p className="text-gray-400 text-sm mb-6">Your request to become a <strong className="text-blue-400">{currentUser.account_type}</strong> is currently under review by our moderation team.</p>
                  <button onClick={() => supabase.auth.signOut()} className="mt-4 text-xs text-gray-500 font-bold uppercase tracking-widest hover:text-white transition-colors">Sign Out</button>
              </div>
          </div>
      )
  }

  const isCompleted = currentUser?.onboarding_completed || currentUser?.onboarding_complete;
  if ((!isCompleted && currentUser?.account_type !== 'Admin') || testOnboardingType) {
      const isApprovedRole = currentUser?.account_status === 'approved' && ['Host', 'Venue', 'Performer'].includes(currentUser?.account_type)
      return <Onboarding 
          session={session} 
          forcedType={testOnboardingType || (isApprovedRole ? currentUser.account_type : null)}
          onComplete={() => {
              if (testOnboardingType) setTestOnboardingType(null) 
              else {
                  setCurrentUser({ ...currentUser, onboarding_completed: true, onboarding_complete: true })
                  window.location.reload()
              }
          }} 
      />
  }

  const effectiveUser = simulatedRole ? { ...currentUser, account_type: simulatedRole } : currentUser;

  const ALL_TABS = ['Profile', 'Feed', 'Venues', 'Songbook', 'KSocial', 'Map', 'Leagues', 'Shop', 'Settings']

  const getAvailableTabs = () => {
      // 🟢 Admins get everything appended to their Dashboard
      if (effectiveUser?.account_type === 'Admin') {
          return ['Admin Dashboard', ...ALL_TABS]
      }

      // 🟢 Everyone else gets the tabs filtered by the Admin's visibility config
      return ALL_TABS.filter(tab => {
          const configKey = `show${tab}`
          return systemConfig[configKey] !== false // If it's not explicitly false, show it
      })
  }

  const tabs = getAvailableTabs()

  return (
    <div className="min-h-screen bg-transparent text-gray-200 font-['DM_Sans'] pb-20 relative overflow-hidden">
      {simulatedRole && (
          <button 
              onClick={() => setSimulatedRole(null)}
              className="fixed bottom-24 right-4 z-[999] bg-red-600 text-white px-4 py-3 rounded-full font-bold uppercase tracking-widest text-xs shadow-[0_0_20px_rgba(220,38,38,0.5)] animate-bounce"
          >
              Exit {simulatedRole} View
          </button>
      )}
      
      <BackgroundManager />
      <GlobalToast /> 

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

      <GlobalHeader 
          currentUser={effectiveUser}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          executeSearch={executeSearch}
          showNotifications={showNotifications}
          setShowNotifications={setShowNotifications}
          setShowVibeCode={setShowVibeCode}
          onViewEntity={onViewEntity}
          onHomeClick={() => setSearchParams({ tab: 'Feed' })}
      />

      <Ticker />

      <main className="max-w-2xl mx-auto relative z-10 w-full transition-all duration-300 pb-28">
        {viewingEntity ? (
          <PublicProfile 
              entity={viewingEntity} 
              onClose={() => { setSearchParams({ tab: activeTab }) }} 
              currentUser={effectiveUser} 
              forceAccess={forceFriendView ? 'friend' : null} 
          />
        ) : (
          <Suspense fallback={<div className="flex justify-center mt-20"><div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div></div>}>
            <div key={activeTab} className="animate-fade-in w-full h-full mt-4">
              {activeTab === 'Projector' && <Projector />}
              {activeTab === 'Search' && searchResults && (
                <div className="p-4 animate-fade-in">
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
              
              {/* 🟢 NEW: Rendered Flat Tabs */}
              {/* 🟢 FIXED: Changed to 'Admin Dashboard' */}
              {activeTab === 'Admin Dashboard' && <AdminPanel session={session} setSimulatedRole={setSimulatedRole} setShowSplash={setShowSplash} setTestOnboardingType={setTestOnboardingType} />}
              {activeTab === 'Feed' && <MainFeed currentUser={effectiveUser} onViewEntity={onViewEntity} />}
              {activeTab === 'Venues' && <EventsFeed currentUser={effectiveUser} onViewEntity={onViewEntity} />}
              {activeTab === 'Profile' && <Profile session={session} />}
              {activeTab === 'Events' && <Events onViewEntity={onViewEntity} />}
              {activeTab === 'Leagues' && <Leaderboard currentUser={effectiveUser} onViewEntity={onViewEntity} />}
              {activeTab === 'Songbook' && <SongBook currentUser={effectiveUser} />}
              {activeTab === 'Settings' && <Settings currentUser={effectiveUser} setCurrentUser={setCurrentUser} />}
              {activeTab === 'Map' && <Map currentUser={effectiveUser} onViewEntity={onViewEntity} />}
              
              {/* 🟢 Handles the KSocial Tab */}
              {activeTab === 'KSocial' && <Live currentUser={effectiveUser} onViewEntity={onViewEntity} />}
              
              {activeTab === 'Shop' && <Shop currentUser={effectiveUser} />}
            </div>
          </Suspense>
        )}
      </main>

      <BottomNav 
          displayTabs={tabs}
          activeTab={activeTab}
          changeTab={changeTab}
          viewingEntity={viewingEntity}
      />

      {showVibeCode && <VibeCode session={session} onClose={() => setShowVibeCode(false)} />}
      {showSplash && <SplashScreen username={currentUser?.username} phase={showSplash} onComplete={() => setShowSplash(false)} />}
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <MainApp />
    </BrowserRouter>
  )
}