import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

export default function NotificationsMenu({ userId, onClose }) {
    const [notifications, setNotifications] = useState([])

    useEffect(() => {
        const fetchNotifs = async () => {
            const { data } = await supabase
                .from('notifications')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
                .limit(10)
            if (data) setNotifications(data)
        }
        fetchNotifs()
    }, [userId])

    return (
        <div className="absolute top-12 right-0 w-80 bg-[#090812] border border-gray-700 rounded-2xl shadow-[0_0_30px_rgba(0,0,0,0.8)] z-[200] overflow-hidden animate-fade-in">
            <div className="p-3 border-b border-gray-800 flex justify-between items-center bg-black/50">
                <h3 className="font-['Bebas_Neue'] text-xl text-blue-400 tracking-widest">Notifications</h3>
                <button onClick={onClose} className="text-gray-500 hover:text-white w-6 h-6 rounded-full bg-gray-800 flex items-center justify-center text-xs">✕</button>
            </div>
            <div className="max-h-80 overflow-y-auto">
                {notifications.length === 0 ? (
                    <p className="p-6 text-center text-xs font-bold uppercase tracking-widest text-gray-500">No new notifications</p>
                ) : (
                    notifications.map(n => (
                        <div key={n.id} className="p-4 border-b border-gray-800/50 hover:bg-gray-800/50 transition-colors">
                            <h4 className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">{n.title}</h4>
                            <p className="text-sm text-gray-300 mt-1">{n.content}</p>
                            <span className="text-[9px] text-gray-600 mt-2 block">{new Date(n.created_at).toLocaleDateString()}</span>
                        </div>
                    ))
                )}
            </div>
        </div>
    )
}