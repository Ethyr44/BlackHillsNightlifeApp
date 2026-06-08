import { useState } from 'react'

export default function Home({ changeTab, currentUser }) {
    // Tracks which big menu button is currently expanded
    const [expandedMenu, setExpandedMenu] = useState(null)

    const toggleMenu = (menuId) => {
        setExpandedMenu(prev => prev === menuId ? null : menuId)
    }

    // Define the menu structure based on your exact specifications
    const menuData = [
        {
            id: 'social',
            title: 'SOCIAL',
            align: 'left', // Slanted on the right
            color: 'from-blue-600 to-blue-900',
            glow: 'shadow-[0_0_20px_rgba(37,99,235,0.4)]',
            subItems: [
                { label: 'Profile', tab: 'Profile', active: true, icon: '👤' },
                { label: 'Feed', tab: 'Feed', active: true, icon: '📱' },
                { label: 'Notifications', tab: 'Notifs', active: false, icon: '🔔' },
                { label: 'Groups', tab: 'Groups', active: false, icon: '👥' }
            ]
        },
        {
            id: 'local',
            title: 'LOCAL',
            align: 'right', // Slanted on the left
            color: 'from-cyan-500 to-blue-800',
            glow: 'shadow-[0_0_20px_rgba(6,182,212,0.4)]',
            subItems: [
                { label: 'Venues', tab: 'Venues', active: true, icon: '📍' },
                { label: 'Events Calendar', tab: 'Events', active: false, icon: '📅' },
                { label: 'Map', tab: 'Map', active: true, icon: '🗺️' },
                { label: 'Leagues', tab: 'Leagues', active: true, icon: '🏆' }
            ]
        },
        {
            id: 'karaoke',
            title: 'KARAOKE',
            align: 'left', // Slanted on the right
            color: 'from-purple-600 to-pink-700',
            glow: 'shadow-[0_0_20px_rgba(147,51,234,0.4)]',
            subItems: [
                { label: 'KSocial Sessions', tab: 'KSocial', active: true, icon: '🎤' },
                { label: 'Songbook', tab: 'Songbook', active: true, icon: '📚' },
                // 🟢 SWAPPED INVENTORY FOR JOURNAL
                { label: 'Journal', tab: 'Journal', active: true, icon: '📓' }, 
                { label: 'Shop', tab: 'Shop', active: true, icon: '💎' }
            ]
        },
        {
            id: 'options',
            title: 'OPTIONS',
            align: 'right', // Slanted on the left
            color: 'from-gray-700 to-gray-900',
            glow: 'shadow-[0_0_20px_rgba(75,85,99,0.4)]',
            subItems: [
                ...(currentUser?.account_type === 'Admin' ? [{ label: 'Admin Dashboard', tab: 'Admin Dashboard', active: true, icon: '⚙️' }] : []),
                { label: 'Settings', tab: 'Settings', active: true, icon: '🛠️' },
                { label: 'FAQ / Blog', tab: 'FAQ', active: false, icon: '📰' },
                { label: 'About Us / Contact', tab: 'Contact', active: false, icon: '✉️' }
            ]
        }
    ]

    return (
        <div className="max-w-2xl mx-auto px-4 py-6 animate-fade-in pb-32 space-y-6">
            
            {/* Optional Welcome Text */}
            <div className="text-center mb-8">
                <p className="text-gray-400 text-xs font-bold uppercase tracking-widest">Welcome back,</p>
                <h2 className="text-3xl font-['Bebas_Neue'] text-white tracking-widest">{currentUser?.username || 'Guest'}</h2>
            </div>

            {menuData.map((menu) => {
                const isExpanded = expandedMenu === menu.id
                // Define the CSS clip-paths for the angled cuts based on alignment
                const clipStyle = menu.align === 'left' 
                    ? { clipPath: 'polygon(0 0, 100% 0, 85% 100%, 0% 100%)' } 
                    : { clipPath: 'polygon(15% 0, 100% 0, 100% 100%, 0% 100%)' }

                return (
                    <div key={menu.id} className="relative flex flex-col items-center">
                        {/* THE BIG ANGLED BUTTON */}
                        <button 
                            onClick={() => toggleMenu(menu.id)}
                            style={clipStyle}
                            className={`w-full h-24 sm:h-32 bg-gradient-to-r ${menu.color} flex items-center ${menu.align === 'left' ? 'justify-start pl-8 sm:pl-12' : 'justify-end pr-8 sm:pr-12'} transition-all hover:scale-[1.02] active:scale-95 ${menu.glow}`}
                        >
                            <h3 className="text-5xl sm:text-6xl font-['Bebas_Neue'] text-white tracking-widest drop-shadow-md">
                                {menu.title}
                            </h3>
                        </button>

                        {/* THE EXPANDING SUB-MENU GRID */}
                        <div 
                            className={`w-[90%] overflow-hidden transition-all duration-300 ease-in-out ${isExpanded ? 'max-h-[500px] opacity-100 mt-2' : 'max-h-0 opacity-0 mt-0'}`}
                        >
                            <div className="bg-[#090812] border border-gray-800 rounded-b-3xl p-4 grid grid-cols-2 gap-3 shadow-inner">
                                {menu.subItems.map((item, i) => (
                                    <button 
                                        key={i}
                                        disabled={!item.active}
                                        onClick={() => changeTab(item.tab)}
                                        className={`flex flex-col items-center justify-center p-4 rounded-2xl border transition-all ${
                                            item.active 
                                            ? 'bg-black border-gray-700 hover:border-blue-500 hover:bg-gray-900 text-white shadow-md' 
                                            : 'bg-black/50 border-gray-800/50 text-gray-600 cursor-not-allowed'
                                        }`}
                                    >
                                        <span className={`text-3xl mb-2 ${!item.active && 'opacity-50'}`}>{item.icon}</span>
                                        <span className="text-[10px] font-bold uppercase tracking-widest text-center">
                                            {item.label}
                                        </span>
                                        {!item.active && (
                                            <span className="text-[8px] text-blue-500 font-bold uppercase tracking-widest mt-1">Coming Soon</span>
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                )
            })}
        </div>
    )
}