import { useState, useEffect } from 'react'

// 🟢 THE HELPER FUNCTION: Import this object into ANY file to trigger a popup!
export const toast = {
    success: (msg) => window.dispatchEvent(new CustomEvent('add-toast', { detail: { msg, type: 'success' } })),
    error: (msg) => window.dispatchEvent(new CustomEvent('add-toast', { detail: { msg, type: 'error' } }))
}

export function GlobalToast() {
    const [toasts, setToasts] = useState([])

    useEffect(() => {
        const handleAddToast = (e) => {
            const id = Date.now()
            const newToast = { id, ...e.detail }
            setToasts(prev => [...prev, newToast])

            // Auto-remove after 4 seconds
            setTimeout(() => {
                setToasts(prev => prev.filter(t => t.id !== id))
            }, 4000)
        }

        window.addEventListener('add-toast', handleAddToast)
        return () => window.removeEventListener('add-toast', handleAddToast)
    }, [])

    if (toasts.length === 0) return null;

    return (
        <div className="fixed top-20 left-0 right-0 z-[9999] flex flex-col items-center gap-2 pointer-events-none px-4">
            {toasts.map(t => (
                <div 
                    key={t.id} 
                    className={`animate-slide-down flex items-center gap-3 px-6 py-3 rounded-full shadow-2xl backdrop-blur-md border ${
                        t.type === 'success' 
                        ? 'bg-green-900/80 border-green-500/50 text-green-100 shadow-[0_0_20px_rgba(34,197,94,0.3)]' 
                        : 'bg-red-900/80 border-red-500/50 text-red-100 shadow-[0_0_20px_rgba(239,68,68,0.3)]'
                    }`}
                >
                    <span className="text-lg">{t.type === 'success' ? '✅' : '⚠️'}</span>
                    <span className="text-xs font-bold uppercase tracking-widest">{t.msg}</span>
                </div>
            ))}
        </div>
    )
}