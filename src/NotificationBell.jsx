import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

export default function NotificationBell({ userId }) {
    const [notifications, setNotifications] = useState([])
    const [isOpen, setIsOpen] = useState(false)

    // Count how many are unread to trigger the red dot
    const unreadCount = notifications.filter(n => !n.is_read).length

    useEffect(() => {
        if (!userId) return

        // Fetch initial notifications
        const fetchNotifications = async () => {
            const { data } = await supabase
                .from('notifications')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
                .limit(20)
            if (data) setNotifications(data)
        }
        
        fetchNotifications()

        // Realtime listener: Instantly updates the bell if they earn points while looking at the screen!
        const sub = supabase.channel('realtime-notifications')
            .on('postgres', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, (payload) => {
                setNotifications(prev => [payload.new, ...prev])
            }).subscribe()

        return () => supabase.removeChannel(sub)
    }, [userId])

    // When they open the menu, mark everything as read to clear the red dot
    const toggleMenu = async () => {
        setIsOpen(!isOpen)
        if (!isOpen && unreadCount > 0) {
            // Update UI instantly
            setNotifications(notifications.map(n => ({ ...n, is_read: true })))
            // Update Database in the background
            await supabase.from('notifications').update({ is_read: true }).eq('user_id', userId).eq('is_read', false)
        }
    }

    return (
        <div className="relative">
            {/* The Bell Button */}
            <button onClick={toggleMenu} className="relative p-2 text-gray-400 hover:text-white transition-colors">
                <span className="text-2xl">🔔</span>
                {/* THE RED DOT */}
                {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 w-3 h-3 bg-red-500 border-2 border-[#090812] rounded-full animate-pulse"></span>
                )}
            </button>

            {/* The Dropdown Menu */}
            {isOpen && (
                <div className="absolute right-0 mt-2 w-72 bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl z-[100] overflow-hidden animate-fade-in">
                    <div className="bg-black/50 p-3 border-b border-gray-800">
                        <h3 className="text-sm font-bold uppercase tracking-widest text-white">Notifications</h3>
                    </div>
                    
                    <div className="max-h-80 overflow-y-auto">
                        {notifications.length === 0 ? (
                            <p className="p-4 text-xs text-gray-500 text-center font-bold uppercase tracking-widest">No new alerts</p>
                        ) : (
                            notifications.map(notif => (
                                <div key={notif.id} className={`p-4 border-b border-gray-800 text-sm ${notif.is_read ? 'text-gray-400' : 'text-white bg-blue-900/10'}`}>
                                    {notif.content}
                                    <span className="block text-[9px] uppercase tracking-widest text-gray-600 mt-1">
                                        {new Date(notif.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                    </span>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}