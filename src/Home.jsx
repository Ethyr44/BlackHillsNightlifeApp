import { useState } from 'react'

const MENUS = [
  {
    id: 'social',
    title: 'Social',
    subtitle: 'Connect & Share',
    gradient: 'from-[#4f8cff] to-[#2463d4]',
    glow: 'rgba(79,140,255,0.25)',
    icon: <SocialIcon />,
    items: [
      { label: 'Profile',  tab: 'Profile',  icon: <ProfileIcon />,  active: true },
      { label: 'Feed',     tab: 'Feed',     icon: <FeedIcon />,     active: true },
      { label: 'Journal',  tab: 'Journal',  icon: <JournalIcon />,  active: true },
      { label: 'Groups',   tab: 'Groups',   icon: <GroupsIcon />,   active: true },
    ],
  },
  {
    id: 'local',
    title: 'Local',
    subtitle: 'Explore the Hills',
    gradient: 'from-[#22d4c8] to-[#0e8a85]',
    glow: 'rgba(34,212,200,0.22)',
    icon: <LocalIcon />,
    items: [
      { label: 'Map',       tab: 'Map',       icon: <MapIcon />,       active: true },
      { label: 'Venues',    tab: 'Venues',    icon: <VenueIcon />,     active: true },
      { label: 'Events',    tab: 'Events',    icon: <CalIcon />,       active: true },
      { label: 'Community', tab: 'Community', icon: <CommunityIcon />, active: true },
    ],
  },
  {
    id: 'live',
    title: 'Live',
    subtitle: 'Hit the Stage',
    gradient: 'from-[#f5557a] to-[#9b2be8]',
    glow: 'rgba(245,85,122,0.22)',
    icon: <LiveIcon />,
    items: [
      { label: 'Songbook', tab: 'Songbook', icon: <SongIcon />,   active: true },
      { label: 'Sports',   tab: 'Sports',   icon: <SportsIcon />, active: true },
      { label: 'KSocial',  tab: 'KSocial',  icon: <MicIcon />,    active: true },
      { label: 'Leagues',  tab: 'Leagues',  icon: <TrophyIcon />, active: true },
    ],
  },
  {
    id: 'options',
    title: 'Options',
    subtitle: 'Gear & Settings',
    gradient: 'from-[#8a94a6] to-[#4a5568]',
    glow: 'rgba(138,148,166,0.18)',
    icon: <OptionsIcon />,
    items: [
      { label: 'Shop',     tab: 'Shop',     icon: <ShopIcon />,     active: true },
      { label: 'About',    tab: 'FAQ',      icon: <AboutIcon />,    active: true },
      { label: 'Settings', tab: 'Settings', icon: <SettingsIcon />, active: true },
      { label: 'Admin',    tab: 'Admin Dashboard', icon: <AdminIcon />, active: true },
    ],
  },
]

export default function Home({ changeTab, currentUser }) {
  const [open, setOpen] = useState(null)

  const isAdmin = currentUser?.account_type === 'Admin'

  return (
    <div className="max-w-2xl mx-auto px-4 pt-6 pb-32 animate-fade-in-up">

      {/* Welcome header */}
      <div className="text-center mb-8">
        <img
          src="/BHNLLogo512x512.png"
          alt="BHNL"
          className="w-20 h-20 mx-auto mb-4 rounded-3xl object-cover shadow-[0_8px_32px_rgba(79,140,255,0.18)] border border-white/[0.08]"
        />
        <p className="text-sm text-white/50 font-medium mb-1" style={{ fontFamily: 'Inter, sans-serif' }}>
          Welcome back,
        </p>
        <h2
          className="text-3xl font-bold text-white tracking-tight"
          style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
        >
          {currentUser?.username || 'Guest'}
        </h2>
      </div>

      {/* Hub grid */}
      <div className="space-y-3">
        {MENUS.filter(m => isAdmin || m.id !== 'options' || true).map(menu => {
          const isOpen = open === menu.id
          return (
            <div key={menu.id}>
              {/* Hub card button */}
              <button
                onClick={() => setOpen(isOpen ? null : menu.id)}
                className="w-full group relative overflow-hidden rounded-2xl transition-all duration-200 active:scale-[0.985]"
                style={{
                  boxShadow: isOpen
                    ? `0 0 0 1px rgba(255,255,255,0.12), 0 8px 32px ${menu.glow}`
                    : '0 0 0 1px rgba(255,255,255,0.06)',
                }}
              >
                {/* Gradient fill */}
                <div className={`absolute inset-0 bg-gradient-to-br ${menu.gradient} opacity-[0.14] transition-opacity duration-200 group-hover:opacity-[0.22] ${isOpen ? '!opacity-[0.22]' : ''}`} />
                {/* Border */}
                <div className="absolute inset-0 rounded-2xl border border-white/[0.08]" />

                <div className="relative flex items-center justify-between px-5 py-4">
                  <div className="flex items-center gap-4">
                    {/* Icon circle */}
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br ${menu.gradient} shadow-lg flex-shrink-0`}>
                      <span className="text-white">{menu.icon}</span>
                    </div>
                    <div className="text-left">
                      <h3
                        className="text-base font-semibold text-white leading-tight"
                        style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                      >
                        {menu.title}
                      </h3>
                      <p className="text-xs text-white/45 mt-0.5" style={{ fontFamily: 'Inter, sans-serif' }}>
                        {menu.subtitle}
                      </p>
                    </div>
                  </div>
                  {/* Chevron */}
                  <svg
                    className={`w-4 h-4 text-white/40 transition-transform duration-200 ${isOpen ? 'rotate-180 text-white/70' : ''}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </button>

              {/* Expanded submenu */}
              <div
                className="overflow-hidden transition-all duration-300 ease-out"
                style={{ maxHeight: isOpen ? 320 : 0, opacity: isOpen ? 1 : 0 }}
              >
                <div className="pt-2 grid grid-cols-2 gap-2">
                  {menu.items.map(item => {
                    if (!isAdmin && item.tab === 'Admin Dashboard') return null
                    return (
                      <button
                        key={item.tab}
                        disabled={!item.active}
                        onClick={() => changeTab(item.tab)}
                        className={`
                          flex items-center gap-3 px-4 py-3 rounded-xl border transition-all duration-150 text-left
                          ${item.active
                            ? 'bg-white/[0.04] border-white/[0.08] text-white hover:bg-white/[0.08] hover:border-white/[0.14] active:scale-[0.97]'
                            : 'bg-white/[0.02] border-white/[0.04] text-white/25 cursor-not-allowed'
                          }
                        `}
                      >
                        <span className={`flex-shrink-0 ${item.active ? 'text-white/60' : 'text-white/20'}`}>
                          {item.icon}
                        </span>
                        <div>
                          <span
                            className="text-sm font-medium block leading-tight"
                            style={{ fontFamily: 'Inter, sans-serif' }}
                          >
                            {item.label}
                          </span>
                          {!item.active && (
                            <span className="text-[9px] font-semibold uppercase tracking-wider text-[#4f8cff]/50 mt-0.5 block">
                              Soon
                            </span>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ---- Icon helpers ---- */
const IC = ({ children }) => <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>{children}</svg>

function SocialIcon() {
  return <IC><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></IC>
}
function LocalIcon() {
  return <IC><path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></IC>
}
function LiveIcon() {
  return <IC><path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></IC>
}
function OptionsIcon() {
  return <IC><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></IC>
}
function ProfileIcon() { return <IC><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></IC> }
function FeedIcon() { return <IC><path strokeLinecap="round" strokeLinejoin="round" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9.5a2 2 0 00-2-2h-2" /></IC> }
function JournalIcon() { return <IC><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></IC> }
function GroupsIcon() { return <IC><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></IC> }
function MapIcon() { return <IC><path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></IC> }
function VenueIcon() { return <IC><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></IC> }
function CalIcon() { return <IC><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></IC> }
function CommunityIcon() { return <IC><path strokeLinecap="round" strokeLinejoin="round" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2" /></IC> }
function SongIcon() { return <IC><path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" /></IC> }
function SportsIcon() { return <IC><circle cx={12} cy={12} r={9} /><path strokeLinecap="round" strokeLinejoin="round" d="M12 3c2.5 2.5 4 6 4 9s-1.5 6.5-4 9M12 3c-2.5 2.5-4 6-4 9s1.5 6.5 4 9M3 12h18" /></IC> }
function MicIcon() { return <IC><path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></IC> }
function TrophyIcon() { return <IC><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" /></IC> }
function ShopIcon() { return <IC><path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></IC> }
function AboutIcon() { return <IC><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></IC> }
function SettingsIcon() { return <IC><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></IC> }
function AdminIcon() { return <IC><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></IC> }
