import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

export default function NotificationsMenu({ userId, onClose, onRoute, onMarkRead, onMarkAllRead }) {
    const [notifications, setNotifications] = useState([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetchNotifs()
    }, [userId])

    const fetchNotifs = async () => {
        setLoading(true)
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
        
        // Lazy cleanup of old notifications for this user
        supabase.from('notifications').delete().eq('user_id', userId).lt('created_at', yesterday).then()

        const { data, error } = await supabase
            .from('notifications')
            .select('*')
            .eq('user_id', userId)
            .gte('created_at', yesterday)
            .order('created_at', { ascending: false })
            .limit(15)
        
        if (error) console.error("Fetch Notifs Error:", error)
        if (data) setNotifications(data)
        setLoading(false)
    }

    // 🟢 FIX: A dedicated, robust function to mark all as read
    const handleMarkAllRead = async () => {
        const unreadNotifs = notifications.filter(n => !n.is_read)
        if (unreadNotifs.length === 0) return

        // 1. Optimistic UI Update (Instantly removes the blue dots)
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
        if (onMarkAllRead) onMarkAllRead()

        // 2. Safe Database Commit
        const unreadIds = unreadNotifs.map(n => n.id)
        const { error } = await supabase
            .from('notifications')
            .update({ is_read: true })
            .in('id', unreadIds)

        if (error) {
            console.error("Failed to mark as read in Supabase:", error)
            // Revert UI if DB fails
            fetchNotifs() 
        }
    }

    const handleNotificationClick = async (n) => {
        // If it's unread, mark just this one as read when clicked
        if (!n.is_read) {
            setNotifications(prev => prev.map(notif => notif.id === n.id ? { ...notif, is_read: true } : notif))
            if (onMarkRead) onMarkRead()
            await supabase.from('notifications').update({ is_read: true }).eq('id', n.id)
        }

        if (n.target_type && n.target_id && onRoute) {
            onRoute(n.target_type, n.target_id)
        }
        onClose()
    }

    return (
        <div className="absolute top-16 right-4 w-80 bg-[#0B0F19] border-2 border-gray-800 rounded-3xl shadow-2xl overflow-hidden z-50 animate-slide-up-slow">
            <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-gray-900/50">
                <h3 className="font-['Bebas_Neue'] text-xl text-white tracking-widest">Notifications</h3>
                
                {/* 🟢 NEW: Explicit trigger button to clear out the queue */}
                {notifications.some(n => !n.is_read) && (
                    <button 
                        onClick={handleMarkAllRead}
                        className="text-[9px] text-blue-400 font-bold uppercase tracking-widest hover:text-blue-300 transition-colors bg-blue-900/20 px-2 py-1 rounded"
                    >
                        Mark All Read
                    </button>
                )}
            </div>
            
            <div className="max-h-80 overflow-y-auto hide-scrollbar">
                {loading ? (
                    <p className="p-6 text-center text-xs font-bold uppercase tracking-widest text-gray-500 animate-pulse">Loading...</p>
                ) : notifications.length === 0 ? (
                    <p className="p-6 text-center text-xs font-bold uppercase tracking-widest text-gray-500">No new notifications</p>
                ) : (
                    notifications.map(n => (
                        <div 
                            key={n.id} 
                            onClick={() => handleNotificationClick(n)}
                            className={`p-4 border-b border-gray-800/50 transition-all ${n.target_id ? 'cursor-pointer hover:bg-gray-800' : ''} ${n.is_read ? 'bg-transparent opacity-60' : 'bg-blue-900/10 border-l-2 border-l-blue-500'}`}
                        >
                            <div className="flex justify-between items-start mb-1">
                                <h4 className={`text-[10px] font-bold uppercase tracking-widest ${n.is_read ? 'text-gray-400' : 'text-blue-400'}`}>{n.title}</h4>
                                {!n.is_read && <span className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_#3b82f6]"></span>}
                            </div>
                            <p className={`text-xs mt-1 ${n.is_read ? 'text-gray-500' : 'text-gray-300'}`}>{n.content}</p>
                            <span className="text-[9px] text-gray-600 mt-2 block font-bold">
                                {new Date(n.created_at).toLocaleDateString()} at {new Date(n.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                            </span>
                        </div>
                    ))
                )}
            </div>
        </div>
    )
}