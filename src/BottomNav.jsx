export default function BottomNav({ displayTabs, activeTab, changeTab, viewingEntity }) {
  if (viewingEntity) return null

  const getTabIcon = (tab) => {
    switch (tab) {
      case 'Home':       return <HomeIcon />
      case 'Feed':       return <FeedIcon />
      case 'Profile':    return <ProfileIcon />
      case 'Map':        return <MapIcon />
      case 'Venues':     return <VenuesIcon />
      case 'Events':     return <CalendarIcon />
      case 'KSocial':    return <MicIcon />
      case 'Songbook':   return <SongIcon />
      case 'Leagues':    return <TrophyIcon />
      case 'Sports':     return <SportsIcon />
      case 'Journal':    return <JournalIcon />
      case 'Groups':     return <GroupsIcon />
      case 'Community':  return <CommunityIcon />
      case 'Shop':       return <ShopIcon />
      case 'Settings':   return <SettingsIcon />
      case 'Admin Dashboard': return <AdminIcon />
      default:           return <DefaultIcon />
    }
  }

  const isSpecial = (tab) => tab === 'Admin Dashboard'

  return (
    <nav className="fixed bottom-0 left-0 w-full z-[90] pb-safe">
      {/* Blur backdrop */}
      <div className="absolute inset-0 bg-[#070d1a]/90 backdrop-blur-2xl border-t border-white/[0.06]" />
      {/* Top highlight line */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

      <div className="relative max-w-2xl mx-auto px-2">
        <div className="flex items-center overflow-x-auto hide-scrollbar py-2 gap-0.5">
          {displayTabs.map(tab => {
            const active = activeTab === tab
            const special = isSpecial(tab)

            return (
              <button
                key={tab}
                onClick={() => changeTab(tab)}
                className={`
                  relative flex flex-col items-center justify-center gap-[3px]
                  min-w-[56px] flex-shrink-0 px-2 py-2 rounded-2xl
                  transition-all duration-200 group
                  ${active
                    ? special
                      ? 'text-red-400'
                      : 'text-[#4f8cff]'
                    : 'text-white/35 hover:text-white/60 hover:bg-white/[0.04]'
                  }
                `}
              >
                {/* Active background pill */}
                {active && (
                  <span
                    className={`absolute inset-0 rounded-2xl transition-all duration-200 ${
                      special
                        ? 'bg-red-500/10 border border-red-500/20'
                        : 'bg-[#4f8cff]/10 border border-[#4f8cff]/20'
                    }`}
                  />
                )}

                {/* Active glow dot */}
                {active && !special && (
                  <span className="absolute -top-[1px] left-1/2 -translate-x-1/2 w-4 h-[2px] rounded-full bg-[#4f8cff] shadow-[0_0_8px_2px_rgba(79,140,255,0.6)]" />
                )}

                {/* Icon */}
                <span className={`relative z-10 transition-transform duration-200 ${active ? 'scale-110' : 'group-hover:scale-105'}`}>
                  {getTabIcon(tab)}
                </span>

                {/* Label */}
                <span
                  className={`relative z-10 text-[9px] font-semibold uppercase tracking-wider leading-none transition-all duration-200 whitespace-nowrap ${
                    active
                      ? special ? 'text-red-400' : 'text-[#4f8cff]'
                      : 'text-current'
                  }`}
                  style={{ fontFamily: 'Inter, sans-serif' }}
                >
                  {tab === 'Admin Dashboard' ? 'Admin' : tab}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </nav>
  )
}

/* ---- Icon Components ---- */
const sz = 'w-[18px] h-[18px]'

function HomeIcon() {
  return <svg className={sz} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
}
function FeedIcon() {
  return <svg className={sz} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9.5a2 2 0 00-2-2h-2" /></svg>
}
function ProfileIcon() {
  return <svg className={sz} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
}
function MapIcon() {
  return <svg className={sz} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>
}
function VenuesIcon() {
  return <svg className={sz} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
}
function CalendarIcon() {
  return <svg className={sz} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
}
function MicIcon() {
  return <svg className={sz} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
}
function SongIcon() {
  return <svg className={sz} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" /></svg>
}
function TrophyIcon() {
  return <svg className={sz} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" /></svg>
}
function SportsIcon() {
  return <svg className={sz} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}><circle cx={12} cy={12} r={9} /><path strokeLinecap="round" strokeLinejoin="round" d="M12 3c2.5 2.5 4 6 4 9s-1.5 6.5-4 9M12 3c-2.5 2.5-4 6-4 9s1.5 6.5 4 9M3 12h18" /></svg>
}
function JournalIcon() {
  return <svg className={sz} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
}
function GroupsIcon() {
  return <svg className={sz} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
}
function CommunityIcon() {
  return <svg className={sz} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2" /></svg>
}
function ShopIcon() {
  return <svg className={sz} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>
}
function SettingsIcon() {
  return <svg className={sz} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
}
function AdminIcon() {
  return <svg className={sz} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
}
function DefaultIcon() {
  return <svg className={sz} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}><circle cx={12} cy={12} r={9} /></svg>
}
