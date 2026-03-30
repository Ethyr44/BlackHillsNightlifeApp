import { useState, useEffect, lazy, Suspense } from 'react'
import { supabase } from './supabaseClient'
import Auth from './Auth'
import PublicProfile from './PublicProfile'
import Onboarding from './Onboarding'
import VibeCode from './VibeCode'
import NotificationsMenu from './NotificationsMenu'

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
const SongBook = lazy(() => import('./SongBook'))

export default function App() {
  const [session, setSession] = useState(null)
  const [currentUser, setCurrentUser] = useState(null)
  
  const [activeTab, setActiveTab] = useState('FYP')
  const [viewingEntity, setViewingEntity] = useState(null)
  
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState(null)
  const [showVibeCode, setShowVibeCode] = useState(false)

  const [friendToast, setFriendToast] = useState(null)
  const [showNotifications, setShowNotifications] = useState(false) 
  const [forceFriendView, setForceFriendView] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setSession(session))
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (session) {
      supabase.from('profiles').select('*').eq('id', session.user.id).single()
        .then(({ data }) => {
            setCurrentUser(data)
            checkForConnection(data) 
        })
    }
  }, [session])

  const checkForConnection = async (userProfile) => {
      const urlParams = new URLSearchParams(window.location.search)
      const connectId = urlParams.get('connect')

      if (connectId && connectId !== userProfile.id) {
          window.history.replaceState({}, document.title, window.location.pathname)

          const { data: newFriend } = await supabase.from('profiles').select('*').eq('id', connectId).single()
          
          if (newFriend) {
              const { data: existingConns } = await supabase.from('connections')
                  .select('status')
                  .eq('follower_id', userProfile.id)
                  .eq('following_id', connectId)

              const isAlreadyFriend = existingConns && existingConns.some(c => c.status === 'friend')

              if (!isAlreadyFriend) {
                  // Replaced 4 client queries with 1 secure server transaction
                  const { error } = await supabase.rpc('establish_friendship', {
                      user_a: userProfile.id,
                      user_b: connectId,
                      user_a_name: userProfile.username
                  })

                  if (error) console.error("Error making connection:", error)
              }

              setForceFriendView(true)
              setViewingEntity(newFriend)
              setFriendToast(`🎉 You are now Friends with ${newFriend.username}!`)
              setTimeout(() => setFriendToast(null), 4000)
          }
      }
  }

  if (!session) return <Auth />
  if (session && !currentUser) return <div className="flex justify-center mt-32"><div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div></div>
  if (currentUser && currentUser.onboarding_complete === false) {
    return <Onboarding session={session} onComplete={() => setCurrentUser({...currentUser, onboarding_complete: true})} />
  }

  const baseTabs = ["FYP", "Profile", "Songbook", "Events", "Leaderboard", "Live", "Shop", "Map", "Settings"]
  const tabs = currentUser?.account_type === 'Admin' ? ["Admin Console", ...baseTabs] : baseTabs

  const handleTabSwitch = (tab) => {
    setViewingEntity(null)
    setForceFriendView(false) 
    setSearchResults(null)
    setSearchQuery('')
    setActiveTab(tab)
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

  // Loading spinner for lazy components
  const SuspenseLoader = () => (
    <div className="flex justify-center mt-20">
      <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#030712] text-gray-200 font-['DM_Sans'] pb-20 relative">
      {friendToast && (
          <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-[200] bg-green-500 text-white px-6 py-3 rounded-full shadow-[0_0_30px_rgba(34,197,94,0.5)] font-bold text-sm uppercase tracking-widest animate-bounce whitespace-nowrap">
              {friendToast}
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
                key={tab} onClick={() => handleTabSwitch(tab)}
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
            {activeTab === 'Leaderboard' && <Leaderboard />}
            {activeTab === 'Songbook' && <SongBook currentUser={currentUser} />}
            {activeTab === 'Settings' && <Settings currentUser={currentUser} setCurrentUser={setCurrentUser} />}
            {activeTab === 'Map' && <Map onViewEntity={onViewEntity} />}
            {activeTab === 'Live' && <Live currentUser={currentUser} />}
            {activeTab === 'Shop' && <Shop currentUser={currentUser} />}
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
    </div>
  )
}