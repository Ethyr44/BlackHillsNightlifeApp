import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import AdminPages from './AdminPages'
import AdminEvents from './AdminEvents'
import AdminShop from './AdminShop'
import AdminEconomy from './AdminEconomy'
import AdminSocial from './AdminSocial'
import AdminCategories from './AdminCategories'
import AdminConfig from './AdminConfig'
import AdminTicker from './AdminTicker'
import AdminDebug from './AdminDebug'
import AdminUsers from './AdminUsers'

export default function AdminPanel({ session, setSimulatedRole, setShowSplash, setTestOnboardingType }) {
  const [activeTab, setActiveTab] = useState('Shop')
  const [activeModal, setActiveModal] = useState(null) // 'categories', 'venues', 'events'

  return (
    <div className="p-4 mt-4 animate-fade-in pb-12">
      
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <button onClick={() => setActiveModal('categories')} className="bg-gray-800 p-4 rounded-xl text-blue-400 font-bold">Manage Categories</button>
        <button onClick={() => setActiveModal('venues')} className="bg-gray-800 p-4 rounded-xl text-blue-400 font-bold">Manage Venues</button>
        <button onClick={() => setActiveModal('events')} className="bg-gray-800 p-4 rounded-xl text-blue-400 font-bold">Manage Events</button>
      </div>

      {/* Tab Navigation */}
      <div className="flex bg-gray-900 border border-gray-800 rounded-xl p-1 mb-8 overflow-x-auto hide-scrollbar">
        {['Shop', 'Economy', 'Social', 'App Text', 'Users', 'Visibility', 'Debug'].map(tab => (
          <button 
            key={tab} onClick={() => setActiveTab(tab)}
            className={`flex-1 py-3 px-6 rounded-lg text-xs font-bold uppercase tracking-widest transition-all whitespace-nowrap ${
                activeTab === tab 
                ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30' 
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Component Rendering */}
      {activeTab === 'Shop' && <AdminShop />}
      {activeTab === 'Economy' && <AdminEconomy />}
      {activeTab === 'Social' && <AdminSocial />}
      {activeTab === 'App Text' && <AdminConfig />}
      {activeTab === 'Users' && <AdminUsers />}
      {activeTab === 'Visibility' && <AdminVisibility />}
      {activeTab === 'Debug' && <AdminDebug setSimulatedRole={setSimulatedRole} setShowSplash={setShowSplash} setTestOnboardingType={setTestOnboardingType} />}

      {activeModal && (
        <div className="fixed inset-0 bg-black/90 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#090812] w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl border border-gray-800 p-6 relative hide-scrollbar">
            {/* Close Button */}
            <button 
              onClick={() => setActiveModal(null)} 
              className="absolute top-4 right-4 bg-red-900/30 text-red-500 px-4 py-2 rounded-lg font-bold uppercase tracking-widest text-xs z-10"
            >
              Close
            </button>

            {/* Render the specific component */}
            {activeModal === 'categories' && <AdminCategories />}
            {activeModal === 'venues' && <AdminPages />}
            {activeModal === 'events' && <AdminEvents />}
          </div>
        </div>
      )}
    </div>
  )
}

// 🟢 NEW: The missing Admin UI for toggling mini-pages
function AdminVisibility() {
    const [config, setConfig] = useState(null)

    useEffect(() => {
        const loadConfig = async () => {
            const { data } = await supabase.from('system_config').select('page_visibility').single()
            if (data) setConfig(data.page_visibility)
        }
        loadConfig()
    }, [])

    const toggleVisibility = async (key) => {
        const newConfig = { ...config, [key]: !config[key] }
        setConfig(newConfig)
        await supabase.from('system_config').update({ page_visibility: newConfig }).eq('id', 1)
    }

    if (!config) return <div className="text-white font-bold p-4">Loading Setup...</div>

    return (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 animate-fade-in">
            <h3 className="text-xl font-bold text-white mb-6 uppercase tracking-widest">Mini-Page Visibility Toggles</h3>
            <p className="text-xs text-gray-500 mb-6">Standard users will not see hidden mini-pages, but Admins retain full access.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {Object.keys(config).map(key => (
                    <button
                        key={key}
                        onClick={() => toggleVisibility(key)}
                        className={`p-4 rounded-xl font-bold uppercase tracking-widest text-xs flex justify-between items-center transition-all ${
                            config[key]
                            ? 'bg-blue-600/20 text-blue-400 border border-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.2)]'
                            : 'bg-black/50 text-gray-500 border border-gray-800 hover:border-gray-600'
                        }`}
                    >
                        <span>{key.replace('show', '')} Page</span>
                        <span>{config[key] ? 'VISIBLE' : 'HIDDEN'}</span>
                    </button>
                ))}
            </div>
        </div>
    )
}