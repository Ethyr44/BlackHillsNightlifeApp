import { useState } from 'react'
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
        {['Shop', 'Economy', 'Social', 'App Text', 'Users', 'Debug'].map(tab => (
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