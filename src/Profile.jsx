import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import ThemeEditorModal from './ThemeEditorModal'
import Setlist from './Setlist'
import Repertoire from './Repertoire'
import ProfileHeader from './ProfileHeader'
import HostTracker from './HostTracker'
import ProfileVenue from './ProfileVenue'
import ProfileHost from './ProfileHost'
import ProfilePerformer from './ProfilePerformer'
import SongBook from './Songbook'
import { GRADIENTS } from './themeConstants'
import { toast } from './GlobalToast'

const GEM_STATS = {
  'Quartz':   { mult: 2, uses: 1, color: '#f9a8d4', glow: 'rgba(249,168,212,0.3)' },
  'Amethyst': { mult: 2, uses: 2, color: '#c084fc', glow: 'rgba(192,132,252,0.3)' },
  'Jade':     { mult: 3, uses: 1, color: '#34d399', glow: 'rgba(52,211,153,0.3)' },
  'Emerald':  { mult: 3, uses: 2, color: '#10b981', glow: 'rgba(16,185,129,0.3)' },
  'Sapphire': { mult: 4, uses: 1, color: '#4f8cff', glow: 'rgba(79,140,255,0.3)' },
  'Ruby':     { mult: 2, uses: 5, color: '#f87171', glow: 'rgba(248,113,113,0.3)' },
  'Diamond':  { mult: 4, uses: 4, color: '#67e8f9', glow: 'rgba(103,232,249,0.3)' },
}

const PREF_STYLES = {
  events:  { active: 'bg-[rgba(34,212,200,0.15)] border-[#22d4c8] text-[#22d4c8]', inactive: 'bg-[rgba(255,255,255,0.03)] border-[rgba(255,255,255,0.08)] text-[rgba(255,255,255,0.4)]' },
  venues:  { active: 'bg-[rgba(168,85,247,0.15)] border-[rgba(168,85,247,0.8)] text-[#c084fc]', inactive: 'bg-[rgba(255,255,255,0.03)] border-[rgba(255,255,255,0.08)] text-[rgba(255,255,255,0.4)]' },
  genres:  { active: 'bg-[rgba(245,85,122,0.15)] border-[rgba(245,85,122,0.8)] text-[#f5557a]', inactive: 'bg-[rgba(255,255,255,0.03)] border-[rgba(255,255,255,0.08)] text-[rgba(255,255,255,0.4)]' },
}

function RankBadge({ label, value, color }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.05)',
      backdropFilter: 'blur(16px)',
      border: `1px solid ${color}40`,
      borderRadius: 12,
      padding: '6px 14px',
      textAlign: 'center',
      boxShadow: `0 0 12px ${color}22`,
    }}>
      <span style={{ display: 'block', fontSize: 9, color, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 2 }}>{label}</span>
      <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 20, fontWeight: 800, color: '#fff', lineHeight: 1 }}>{value}</span>
    </div>
  )
}

function SectionCard({ children, accent, style = {} }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.04)',
      backdropFilter: 'blur(20px)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 20,
      padding: '20px 20px',
      position: 'relative',
      overflow: 'hidden',
      ...style,
    }}>
      {accent && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: accent, borderRadius: '20px 20px 0 0' }} />
      )}
      {children}
    </div>
  )
}

function SectionLabel({ children }) {
  return (
    <span style={{ display: 'block', fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', marginBottom: 10 }}>
      {children}
    </span>
  )
}

function ResourcePill({ emoji, label, value, accent }) {
  return (
    <div style={{
      background: `${accent}14`,
      border: `1px solid ${accent}40`,
      borderRadius: 14,
      padding: '10px 6px',
      textAlign: 'center',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 4,
    }}>
      <span style={{ fontSize: 22 }}>{emoji}</span>
      <span style={{ fontWeight: 700, color: accent, fontSize: 15 }}>{value}</span>
      <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: `${accent}99` }}>{label}</span>
    </div>
  )
}

export default function Profile({ session }) {
  const currentUser = session?.user
  const [profile, setProfile] = useState(null)
  const [isEditingTheme, setIsEditingTheme] = useState(false)
  const [showInventory, setShowInventory] = useState(false)
  const [posts, setPosts] = useState([])
  const [newPostText, setNewPostText] = useState('')
  const [friendsCount, setFriendsCount] = useState(0)
  const [setlistTrigger, setSetlistTrigger] = useState(0)

  const [bhnlRank, setBhnlRank] = useState('#--')
  const [ksocialRank, setKsocialRank] = useState('#--')
  const [systemOptions, setSystemOptions] = useState({ venues: [], events: [], genres: [] })
  const [isEditingPrefs, setIsEditingPrefs] = useState(false)
  const [isPrefsExpanded, setIsPrefsExpanded] = useState(false)

  const [showFriendsList, setShowFriendsList] = useState(false)
  const [friendsList, setFriendsList] = useState([])
  const [loadingFriends, setLoadingFriends] = useState(false)

  useEffect(() => {
    if (!session) return
    fetchProfileData()
    const pointListener = supabase.channel('profile-points')
      .on('postgres', { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${session.user.id}` },
        (payload) => setProfile(payload.new)
      ).subscribe()
    return () => supabase.removeChannel(pointListener)
  }, [session])

  const fetchProfileData = async () => {
    const { data: pData } = await supabase.from('profiles').select('*').eq('id', session.user.id).single()
    if (pData) setProfile(pData)

    const { data: connections } = await supabase.from('connections')
      .select('follower_id, target_id')
      .or(`target_id.eq.${session.user.id},follower_id.eq.${session.user.id}`)
      .eq('connection_type', 'friend')
    const uniqueFriends = new Set()
    connections?.forEach(c => {
      if (c.follower_id !== session.user.id) uniqueFriends.add(c.follower_id)
      if (c.target_id !== session.user.id) uniqueFriends.add(c.target_id)
    })
    setFriendsCount(uniqueFriends.size)

    const { data: postData } = await supabase.from('posts').select('*').eq('author_id', session.user.id).order('created_at', { ascending: false })
    if (postData) setPosts(postData)

    const { data: allProfiles } = await supabase.from('profiles').select('id, lifestyle_points, league_monthly')
    if (allProfiles) {
      const sortedBhnl = [...allProfiles].sort((a, b) => (b.lifestyle_points || 0) - (a.lifestyle_points || 0))
      const sortedKsocial = [...allProfiles].sort((a, b) => (b.league_monthly || 0) - (a.league_monthly || 0))
      const bIndex = sortedBhnl.findIndex(p => p.id === session.user.id)
      const kIndex = sortedKsocial.findIndex(p => p.id === session.user.id)
      setBhnlRank(bIndex !== -1 ? `#${bIndex + 1}` : '#--')
      setKsocialRank(kIndex !== -1 ? `#${kIndex + 1}` : '#--')
    }

    const { data: sysData } = await supabase.from('system_categories').select('*')
    if (sysData) {
      setSystemOptions({
        events: sysData.filter(d => d.category_type === 'event').map(d => d.name),
        venues: sysData.filter(d => d.category_type === 'venue').map(d => d.name),
        genres: sysData.filter(d => d.category_type === 'genre').map(d => d.name),
      })
    }
  }

  const handlePostSubmit = async () => {
    if (!newPostText.trim()) return
    const { error } = await supabase.from('posts').insert([{ author_id: session.user.id, content: newPostText, likes: 0, comments: 0 }])
    if (!error) { setNewPostText(''); fetchProfileData() }
  }

  const handleUpdatePrefs = async (type, item) => {
    let current = profile[`pref_${type}`] || []
    if (current.includes(item)) current = current.filter(i => i !== item)
    else current = [...current, item]
    const { error } = await supabase.from('profiles').update({ [`pref_${type}`]: current }).eq('id', session.user.id)
    if (error) { toast.error('Network Error: Could not save preferences.'); return }
    setProfile(prev => ({ ...prev, [`pref_${type}`]: current }))
  }

  const consumeGem = async (gemName) => {
    if (profile.multiplier_uses_left > 0) {
      return alert(`You already have an active ${profile.active_multiplier}x Multiplier! Exhaust it before activating another gem.`)
    }
    const stats = GEM_STATS[gemName]
    const currentGems = profile.inv_gems || {}
    if (!currentGems[gemName] || currentGems[gemName] < 1) return
    currentGems[gemName] -= 1
    const { error } = await supabase.from('profiles').update({
      inv_gems: currentGems,
      active_multiplier: stats.mult,
      multiplier_uses_left: stats.uses,
    }).eq('id', session.user.id)
    if (error) { alert('Network Error: Could not consume gem.'); return }
    alert(`${gemName} Activated! Your next ${stats.uses} actions will be multiplied by ${stats.mult}x!`)
    fetchProfileData()
  }

  const handleOpenFriends = async () => {
    setShowFriendsList(true)
    setLoadingFriends(true)
    const { data: inbound } = await supabase.from('connections').select('follower_id').eq('target_id', session.user.id).eq('connection_type', 'friend')
    const { data: outbound } = await supabase.from('connections').select('target_id').eq('follower_id', session.user.id).eq('connection_type', 'friend')
    const friendIds = new Set([
      ...(inbound?.map(c => c.follower_id) || []),
      ...(outbound?.map(c => c.target_id) || []),
    ])
    if (friendIds.size > 0) {
      const { data: profiles } = await supabase.from('profiles').select('id, username, profile_pic, account_type').in('id', Array.from(friendIds))
      setFriendsList(profiles || [])
    } else {
      setFriendsList([])
    }
    setLoadingFriends(false)
  }

  if (!profile) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 40, height: 40, border: '3px solid rgba(79,140,255,0.2)', borderTopColor: '#4f8cff', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#4f8cff', opacity: 0.7 }}>Loading Identity...</p>
        </div>
      </div>
    )
  }

  const latestPost = posts.length > 0 ? posts[0] : null
  const dynamicSecondary = profile.secondary_color || '#7c3aed'
  const showKaraokeFeatures = ['Regular', 'Singer', 'Host', 'Admin'].includes(profile.account_type)
  const gems = profile.inv_gems || {}
  const items = profile.inv_items || {}

  return (
    <>
      <div className="max-w-2xl mx-auto px-4 pb-32 space-y-4 animate-fade-in" style={{ paddingTop: 8 }}>

        {/* Rank badges + profile header */}
        <div style={{ position: 'relative', paddingTop: 24 }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 100, zIndex: 20, pointerEvents: 'none' }}>
            <RankBadge label="BHNL Rank" value={bhnlRank} color="#4f8cff" />
            <RankBadge label="KSocial Rank" value={ksocialRank} color="#22d4c8" />
          </div>
          <ProfileHeader
            profile={profile}
            latestPost={latestPost}
            friendsCount={friendsCount}
            onEditTheme={() => setIsEditingTheme(true)}
            onOpenFriends={handleOpenFriends}
          />
        </div>

        {/* Inventory CTA */}
        <button
          onClick={() => setShowInventory(true)}
          style={{
            width: '100%',
            background: 'rgba(16,185,129,0.08)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(16,185,129,0.3)',
            borderRadius: 16,
            padding: '14px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            cursor: 'pointer',
            transition: 'all 0.2s',
            color: '#34d399',
            fontWeight: 700,
            fontSize: 12,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            boxShadow: '0 0 20px rgba(16,185,129,0.12)',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(16,185,129,0.15)'; e.currentTarget.style.borderColor = 'rgba(16,185,129,0.6)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(16,185,129,0.08)'; e.currentTarget.style.borderColor = 'rgba(16,185,129,0.3)' }}
        >
          <span style={{ fontSize: 18 }}>🎒</span> Open Inventory & Wallet
        </button>

        {isEditingTheme && (
          <ThemeEditorModal session={session} profile={profile} onClose={() => setIsEditingTheme(false)} onUpdate={setProfile} />
        )}

        {/* Post composer */}
        <SectionCard accent={`linear-gradient(90deg, ${dynamicSecondary}, #4f8cff)`}>
          <h3 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 20, fontWeight: 800, color: '#fff', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 14, marginTop: 6 }}>
            My Updates
          </h3>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="text"
              value={newPostText}
              onChange={e => setNewPostText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handlePostSubmit()}
              placeholder="What's your vibe today?"
              style={{
                flex: 1,
                background: 'rgba(0,0,0,0.3)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 99,
                padding: '10px 18px',
                color: '#fff',
                fontSize: 14,
                outline: 'none',
                transition: 'border-color 0.2s',
              }}
              onFocus={e => e.target.style.borderColor = 'rgba(79,140,255,0.5)'}
              onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
            />
            <button
              onClick={handlePostSubmit}
              style={{
                background: `linear-gradient(135deg, ${dynamicSecondary}, #4f8cff)`,
                border: 'none',
                borderRadius: 99,
                padding: '10px 20px',
                color: '#fff',
                fontWeight: 700,
                fontSize: 11,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                cursor: 'pointer',
                boxShadow: `0 4px 16px ${dynamicSecondary}44`,
                transition: 'opacity 0.2s, transform 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.opacity = '0.85'; e.currentTarget.style.transform = 'scale(1.03)' }}
              onMouseLeave={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'scale(1)' }}
            >
              Post
            </button>
          </div>
        </SectionCard>

        {/* Category preferences accordion */}
        <SectionCard>
          <div
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', userSelect: 'none' }}
            onClick={() => setIsPrefsExpanded(!isPrefsExpanded)}
          >
            <h3 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 16, fontWeight: 700, color: 'rgba(255,255,255,0.75)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              My Vibe
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button
                onClick={e => { e.stopPropagation(); setIsEditingPrefs(!isEditingPrefs); if (!isPrefsExpanded) setIsPrefsExpanded(true) }}
                style={{
                  background: 'rgba(79,140,255,0.12)',
                  border: '1px solid rgba(79,140,255,0.3)',
                  borderRadius: 8,
                  padding: '4px 12px',
                  color: '#4f8cff',
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  transition: 'background 0.2s',
                }}
              >
                {isEditingPrefs ? 'Done' : 'Edit'}
              </button>
              <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 14, transition: 'transform 0.3s', transform: isPrefsExpanded ? 'rotate(180deg)' : 'rotate(0deg)', display: 'inline-block' }}>▼</span>
            </div>
          </div>

          {isPrefsExpanded && (
            <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 14 }} className="animate-fade-in">
              {['events', 'venues', 'genres'].map(type => {
                const labels = { events: 'Event Styles', venues: 'Venue Styles', genres: 'Music Genres' }
                const prefKey = `pref_${type}`
                const options = isEditingPrefs ? systemOptions[type] : (profile[prefKey] || [])
                const styles = PREF_STYLES[type]
                return (
                  <div key={type}>
                    <SectionLabel>{labels[type]}</SectionLabel>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {options.map(item => {
                        const isSelected = (profile[prefKey] || []).includes(item)
                        if (!isEditingPrefs && !isSelected) return null
                        return (
                          <button
                            key={item}
                            onClick={() => isEditingPrefs && handleUpdatePrefs(type, item)}
                            style={{
                              padding: '4px 12px',
                              borderRadius: 99,
                              border: `1px solid`,
                              fontSize: 10,
                              fontWeight: 700,
                              letterSpacing: '0.1em',
                              textTransform: 'uppercase',
                              cursor: isEditingPrefs ? 'pointer' : 'default',
                              transition: 'all 0.2s',
                            }}
                            className={isSelected ? styles.active : styles.inactive}
                          >
                            {item}
                          </button>
                        )
                      })}
                      {options.filter(item => isEditingPrefs || (profile[prefKey] || []).includes(item)).length === 0 && (
                        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', fontStyle: 'italic' }}>Nothing selected yet.</span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </SectionCard>

        {/* Dynamic role dashboards */}
        {profile.account_type === 'Venue' ? (
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 16, marginTop: 8 }}>
            <ProfileVenue profile={profile} isOwner={true} onViewEntity={null} />
          </div>
        ) : profile.account_type === 'Performer' ? (
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 16, marginTop: 8 }}>
            <ProfilePerformer profile={profile} isOwner={true} onViewEntity={null} />
          </div>
        ) : profile.account_type === 'Host' ? (
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 16, marginTop: 8 }}>
            <ProfileHost profile={profile} isOwner={true} onViewEntity={null} />
            <div style={{ marginTop: 16 }}>
              <HostTracker session={session} />
            </div>
          </div>
        ) : (
          showKaraokeFeatures && (
            <div className="animate-fade-in space-y-4">
              <Setlist session={session} isOwner={true} />
              <SectionCard accent="linear-gradient(90deg, #4f8cff, #22d4c8)">
                <SongBook currentUser={currentUser} profileUser={profile} isOwnProfile={true} embedded={true} />
              </SectionCard>
              <Repertoire userId={session.user.id} isOwner={true} canSuggest={false} trigger={setlistTrigger} setTrigger={setSetlistTrigger} />
            </div>
          )
        )}
      </div>

      {/* ── FRIENDS LIST MODAL ── */}
      {showFriendsList && (
        <div
          className="animate-fade-in"
          style={{
            position: 'fixed', inset: 0, background: 'rgba(7,13,26,0.85)',
            backdropFilter: 'blur(20px)', zIndex: 100,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
          }}
        >
          <div style={{
            background: 'rgba(255,255,255,0.04)',
            backdropFilter: 'blur(24px)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 24,
            width: '100%',
            maxWidth: 420,
            maxHeight: '80vh',
            display: 'flex',
            flexDirection: 'column',
            padding: 24,
            boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
            position: 'relative',
          }}>
            <button
              onClick={() => setShowFriendsList(false)}
              style={{
                position: 'absolute', top: 16, right: 16,
                background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: '50%', width: 32, height: 32,
                color: 'rgba(255,255,255,0.6)', fontSize: 14, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.2s',
              }}
            >✕</button>

            <div style={{ marginBottom: 6 }}>
              <div style={{ width: 3, height: 20, background: 'linear-gradient(180deg,#4f8cff,#22d4c8)', borderRadius: 99, display: 'inline-block', marginRight: 10, verticalAlign: 'middle' }} />
              <span style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 18, fontWeight: 800, color: '#fff', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Friends</span>
            </div>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', fontWeight: 600, marginBottom: 16 }}>{friendsCount} connection{friendsCount !== 1 ? 's' : ''}</p>

            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }} className="hide-scrollbar">
              {loadingFriends ? (
                <p style={{ textAlign: 'center', fontSize: 11, color: 'rgba(255,255,255,0.3)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '32px 0' }} className="animate-pulse">
                  Loading...
                </p>
              ) : friendsList.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 0' }}>
                  <p style={{ fontSize: 32, marginBottom: 8 }}>👥</p>
                  <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>No friends yet.</p>
                </div>
              ) : (
                friendsList.map(f => (
                  <div key={f.id} style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 14, padding: '10px 14px',
                    transition: 'border-color 0.2s',
                  }}>
                    <img
                      src={f.profile_pic || `https://api.dicebear.com/7.x/shapes/svg?seed=${f.username}`}
                      alt={f.username}
                      loading="lazy"
                      decoding="async"
                      style={{ width: 42, height: 42, borderRadius: '50%', border: '2px solid rgba(79,140,255,0.3)', objectFit: 'cover', background: '#0e1e3d' }}
                    />
                    <div>
                      <h4 style={{ fontSize: 15, fontWeight: 700, color: '#fff', lineHeight: 1.2 }}>{f.username}</h4>
                      <span style={{
                        fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
                        background: 'rgba(79,140,255,0.15)', border: '1px solid rgba(79,140,255,0.3)',
                        color: '#4f8cff', borderRadius: 6, padding: '2px 6px', display: 'inline-block', marginTop: 3,
                      }}>{f.account_type}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── INVENTORY & WALLET MODAL ── */}
      {showInventory && (
        <div
          className="animate-fade-in"
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(7,13,26,0.9)',
            backdropFilter: 'blur(24px)',
            zIndex: 50, overflowY: 'auto', padding: 16,
          }}
        >
          <div style={{
            maxWidth: 460,
            margin: '40px auto 80px',
            background: 'rgba(255,255,255,0.04)',
            backdropFilter: 'blur(24px)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 24,
            padding: 24,
            boxShadow: '0 0 60px rgba(16,185,129,0.08)',
            position: 'relative',
          }}>
            {/* Accent bar */}
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg, #10b981, #4f8cff, #22d4c8)', borderRadius: '24px 24px 0 0' }} />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
              <div>
                <h2 style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 24, fontWeight: 800, color: '#fff', letterSpacing: '0.05em', textTransform: 'uppercase', lineHeight: 1 }}>Vault</h2>
                <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', marginTop: 4 }}>Inventory & Assets</p>
              </div>
              <button
                onClick={() => setShowInventory(false)}
                style={{
                  background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: '50%', width: 32, height: 32,
                  color: 'rgba(255,255,255,0.6)', fontSize: 14, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >✕</button>
            </div>

            {/* Active multiplier banner */}
            {profile.multiplier_uses_left > 0 && (
              <div style={{
                background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.4)',
                borderRadius: 12, padding: '10px 14px', marginBottom: 16,
                boxShadow: '0 0 16px rgba(16,185,129,0.15)',
                animation: 'pulse-soft 2s ease-in-out infinite',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#34d399' }}>
                  <span>Active Bonus: {profile.active_multiplier}x Pts</span>
                  <span>{profile.multiplier_uses_left} Uses Left</span>
                </div>
              </div>
            )}

            {/* Currency row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
              <div style={{
                background: 'rgba(79,140,255,0.08)', border: '1px solid rgba(79,140,255,0.25)',
                borderRadius: 14, padding: '14px 10px', textAlign: 'center',
              }}>
                <span style={{ display: 'block', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(79,140,255,0.7)', marginBottom: 4 }}>Lifestyle Points</span>
                <span style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 26, fontWeight: 800, color: '#4f8cff' }}>{profile.lifestyle_points || 0} L$</span>
              </div>
              <div style={{
                background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)',
                borderRadius: 14, padding: '14px 10px', textAlign: 'center',
              }}>
                <span style={{ display: 'block', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(16,185,129,0.7)', marginBottom: 4 }}>Available USD</span>
                <span style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 26, fontWeight: 800, color: '#34d399' }}>${profile.cur_usd || '0.00'}</span>
              </div>
            </div>

            {/* Resources */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, paddingBottom: 6, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <SectionLabel>Wallet & Keys</SectionLabel>
                <button
                  onClick={() => window.location.search = '?tab=Shop'}
                  style={{
                    background: 'rgba(79,140,255,0.12)', border: '1px solid rgba(79,140,255,0.25)',
                    borderRadius: 8, padding: '3px 10px', fontSize: 10, fontWeight: 700,
                    letterSpacing: '0.08em', textTransform: 'uppercase', color: '#4f8cff', cursor: 'pointer',
                  }}
                >
                  Shop ↗
                </button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                <ResourcePill emoji="🪵" label="Wood" value={profile.cur_wood || 0} accent="#f59e0b" />
                <ResourcePill emoji="🪨" label="Stone" value={profile.cur_stone || 0} accent="#94a3b8" />
                <ResourcePill emoji="⛓️" label="Iron" value={profile.cur_iron || 0} accent="#9ca3af" />
              </div>
            </div>

            {/* Gems */}
            <div style={{ marginBottom: 20 }}>
              <SectionLabel>Rare Gems</SectionLabel>
              {Object.keys(gems).length === 0 ? (
                <div style={{
                  background: 'rgba(0,0,0,0.2)', borderRadius: 12, padding: '16px 10px',
                  textAlign: 'center', fontSize: 11, color: 'rgba(255,255,255,0.2)',
                  fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
                }}>No gems acquired yet.</div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {Object.entries(gems).map(([gemName, amount]) => {
                    if (amount < 1) return null
                    const stats = GEM_STATS[gemName]
                    return (
                      <div key={gemName} style={{
                        background: `${stats?.glow || 'rgba(255,255,255,0.05)'}`,
                        border: `1px solid ${stats?.color || '#fff'}33`,
                        borderRadius: 14, padding: '12px 12px 10px',
                        display: 'flex', flexDirection: 'column', gap: 6,
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontWeight: 700, color: stats?.color || '#fff', fontSize: 13 }}>{gemName}</span>
                          <span style={{
                            background: 'rgba(255,255,255,0.1)', borderRadius: 6,
                            padding: '2px 7px', fontSize: 11, fontWeight: 700, color: '#fff',
                          }}>×{amount}</span>
                        </div>
                        <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)' }}>
                          Boost: {stats?.mult}× ({stats?.uses} uses)
                        </span>
                        <button
                          onClick={() => consumeGem(gemName)}
                          style={{
                            background: 'rgba(255,255,255,0.07)',
                            border: '1px solid rgba(255,255,255,0.12)',
                            borderRadius: 8, padding: '6px 0',
                            color: '#fff', fontSize: 10, fontWeight: 700,
                            letterSpacing: '0.08em', textTransform: 'uppercase',
                            cursor: 'pointer', transition: 'background 0.2s',
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.13)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.07)'}
                        >
                          Consume
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Items */}
            <div>
              <SectionLabel>Equipment & Items</SectionLabel>
              {Object.keys(items).length === 0 ? (
                <div style={{
                  background: 'rgba(0,0,0,0.2)', borderRadius: 12, padding: '16px 10px',
                  textAlign: 'center', fontSize: 11, color: 'rgba(255,255,255,0.2)',
                  fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
                }}>No items acquired yet.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {Object.entries(items).map(([itemName, amount]) => {
                    if (amount < 1) return null
                    return (
                      <div key={itemName} style={{
                        background: 'rgba(255,255,255,0.04)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: 10, padding: '10px 14px',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      }}>
                        <span style={{ fontWeight: 700, color: '#fff', fontSize: 13 }}>{itemName}</span>
                        <span style={{
                          background: 'rgba(255,255,255,0.08)', borderRadius: 6,
                          padding: '3px 10px', fontSize: 10, fontWeight: 700,
                          letterSpacing: '0.08em', textTransform: 'uppercase',
                          color: 'rgba(255,255,255,0.5)',
                        }}>Qty: {amount}</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
