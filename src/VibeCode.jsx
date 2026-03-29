import React, { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

export default function VibeCode({ session, onClose }) {
  const [activeTab, setActiveTab] = useState('display') 
  const [profile, setProfile] = useState(null)

  useEffect(() => {
    async function loadData() {
      const { data } = await supabase.from('profiles').select('*').eq('id', session.user.id).single()
      setProfile(data)
    }
    loadData()
  }, [session])

  // THE MAGIC: This creates a direct URL back to your app with a hidden "connect" parameter
  const generateQRUrl = () => {
    if (!profile) return ''
    const baseUrl = window.location.origin
    return `${baseUrl}/?connect=${profile.id}`
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-blue-600/20 blur-[100px] rounded-full pointer-events-none"></div>

      <div className="bg-[#090812] border-2 border-blue-500/30 w-full max-w-md rounded-3xl overflow-hidden shadow-[0_0_40px_rgba(59,130,246,0.2)] relative z-10 flex flex-col max-h-[90vh]">
        
        <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-black/50">
          <h2 className="text-3xl font-['Bebas_Neue'] text-blue-400 tracking-wider">VIBE CODE</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white bg-gray-800 hover:bg-gray-700 w-8 h-8 rounded-full flex items-center justify-center transition-colors">✕</button>
        </div>

        <div className="p-6 flex-1 overflow-y-auto flex flex-col items-center w-full">
          {!profile ? (
             <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          ) : (
            <div className="flex flex-col items-center text-center space-y-6 w-full">
              
              <div className="bg-white p-4 rounded-2xl shadow-[0_0_30px_rgba(59,130,246,0.3)]">
                <img 
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(generateQRUrl())}&color=090812&bgcolor=ffffff`} 
                  alt="My Vibe Code" 
                  className="w-56 h-56"
                />
              </div>

              <div>
                <h4 className="text-3xl font-['Bebas_Neue'] text-blue-400 tracking-wider mt-2">{profile.username}</h4>
                <p className="text-xs text-gray-500 uppercase tracking-widest mt-1">Have a friend scan this with their phone's native camera</p>
              </div>

              <div className="w-full bg-gray-900/50 border border-gray-800 rounded-xl p-4 mt-4">
                  <h5 className="text-white font-bold uppercase tracking-widest text-[10px] mb-2 text-left text-gray-400">How to Scan:</h5>
                  <ol className="text-left text-xs text-gray-300 space-y-2 list-decimal list-inside">
                      <li>Close the BHNL App.</li>
                      <li>Open your phone's native Camera app.</li>
                      <li>Point it at a VibeCode or KSocial Live Link.</li>
                      <li>Tap the link that appears on your screen!</li>
                  </ol>
              </div>

            </div>
          )}
        </div>
      </div>
    </div>
  )
}