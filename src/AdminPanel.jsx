import { useState } from 'react'
import AdminPages from './AdminPages'
import AdminEvents from './AdminEvents'
import AdminShop from './AdminShop'
import AdminEconomy from './AdminEconomy'
import AdminSocial from './AdminSocial'
import AdminCategories from './AdminCategories'
import AdminConfig from './AdminConfig'
import AdminTicker from './AdminTicker'

export default function AdminPanel() {
  const [activeTab, setActiveTab] = useState('Pages')

  return (
    <div className="p-4 mt-4 animate-fade-in pb-12">
      
      {/* Tab Navigation */}
      <div className="flex bg-gray-900 border border-gray-800 rounded-xl p-1 mb-8 overflow-x-auto hide-scrollbar">
        {/* 🟢 ADDED 'Categories' TO THIS ARRAY */}
        {['Pages', 'Events', 'Shop', 'Economy', 'Social', 'Categories', 'App Text'].map(tab => (
          <button 
            key={tab} onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2 px-4 rounded-lg text-xs font-bold uppercase tracking-widest transition-all whitespace-nowrap ${
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
      {activeTab === 'Pages' && <AdminPages />}
      {activeTab === 'Events' && <AdminEvents />}
      {activeTab === 'Shop' && <AdminShop />}
      {activeTab === 'Economy' && <AdminEconomy />}
      {activeTab === 'Social' && <AdminSocial />}
      {/* 🟢 ADDED THIS RENDER CONDITION */}
      {activeTab === 'Categories' && <AdminCategories />}
      {activeTab === 'App Text' && <AdminConfig />}
    </div>
  )
}