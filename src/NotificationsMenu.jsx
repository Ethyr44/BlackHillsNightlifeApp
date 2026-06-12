import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

export default function NotificationsMenu({ userId, onClose, onRoute, onMarkRead, onMarkAllRead }) {
    const [notifications, setNotifications] = useState([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetchNotifs()

        // 🟢 THE FIX: Actively listen for database changes WHILE the menu is open
        const sub = supabase.channel('active-menu-notifs')
            .on('postgres', { 
                event: '*', 
                schema: 'public', 
                table: 'notifications', 
                filter: `user_id=eq.${userId}` 
            }, () => {
                fetchNotifs() // Re-fetch immediately when a change happens
            })
            .subscribe()

        return () => supabase.removeChannel(sub)
    }, [userId])

    const fetchNotifs = async () => {
        setLoading(true)

        const { data, error } = await supabase
            .from('notifications')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(15)
        
        if (error) console.error("Fetch Notifs Error:", error)
        if (data) setNotifications(data)
        setLoading(false)
    }

    const handleMarkAllRead = async () => {
        const unreadNotifs = notifications.filter(n => !n.is_read)
        if (unreadNotifs.length === 0) return

        const { error } = await supabase
            .from('notifications')
            .update({ is_read: true })
            .in('id', unreadNotifs.map(n => n.id))

        if (!error) {
            setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
            if (onMarkAllRead) onMarkAllRead()
        }
    }

    const handleNotificationClick = async (notif) => {
        if (!notif.is_read) {
            await supabase.from('notifications').update({ is_read: true }).eq('id', notif.id)
            setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, is_read: true } : n))
            if (onMarkRead) onMarkRead()
        }
        if (notif.target_id) {
            onClose()
            onRoute(notif.type, notif.target_id)
        }
    }

    return (
        <div className="absolute top-12 right-0 w-80 bg-[#090812] border border-gray-800 rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.8)] overflow-hidden animate-fade-in z-[200]">
            <div className="p-4 border-b border-gray-800 bg-black/50 flex justify-between items-center">
                <h3 className="text-white font-bold tracking-widest uppercase text-xs">Alerts & Notifs</h3>
                <div className="flex gap-3 items-center">
                    <button onClick={handleMarkAllRead} className="text-[9px] text-blue-500 font-bold uppercase tracking-widest hover:text-blue-400 transition-colors">Mark Read</button>
                    <button onClick={onClose} className="text-gray-500 hover:text-white">✕</button>
                </div>
            </div>

            <div className="max-h-[60vh] overflow-y-auto hide-scrollbar">
                {loading ? (
                    <p className="p-6 text-center text-[10px] font-bold uppercase tracking-widest text-gray-500">Loading...</p>
                ) : notifications.length === 0 ? (
                    <p className="p-6 text-center text-[10px] font-bold uppercase tracking-widest text-gray-500">No new notifications</p>
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
                                {new Date(n.created_at).toLocaleDateString()} at {new Date(n.created_at).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}
                            </span>
                        </div>
                    ))
                )}
            </div>
        </div>
    )
}