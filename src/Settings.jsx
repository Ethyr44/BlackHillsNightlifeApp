import { useState } from 'react'
import { supabase } from './supabaseClient'

export default function Settings({ currentUser, setCurrentUser }) {
  const [editName, setEditName] = useState(currentUser.username)
  const [updateStatus, setUpdateStatus] = useState('')

  const handleSaveName = async () => {
      setUpdateStatus('Saving...')
      const { error } = await supabase
        .from('profiles')
        .update({ username: editName })
        .eq('id', currentUser.id)
        
      if (!error) {
          setCurrentUser({...currentUser, username: editName})
          setUpdateStatus('✅ Username Updated!')
          setTimeout(() => setUpdateStatus(''), 2000)
      } else {
          setUpdateStatus('⚠️ Error saving name.')
      }
  }

  return (
    <div className="max-w-xl mx-auto p-4 mt-4 space-y-4 animate-fade-in">
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 shadow-lg">
          <h2 className="text-xl font-['Bebas_Neue'] text-blue-400 tracking-wider mb-4 border-b border-gray-800 pb-2">Edit Profile</h2>
          <div className="flex flex-col space-y-2">
              <label className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Username</label>
              <input 
                  type="text" 
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="bg-black border border-gray-700 text-white rounded-lg p-3 focus:outline-none focus:border-blue-500"
              />
              <button onClick={handleSaveName} className="bg-blue-600 text-white font-bold py-2 rounded-lg mt-2 hover:bg-blue-500 transition-colors">
                  Save Changes
              </button>
              {updateStatus && <p className="text-xs text-center text-green-400 mt-2">{updateStatus}</p>}
          </div>
      </div>
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 shadow-lg mt-8">
        <h2 className="text-xl font-['Bebas_Neue'] text-red-500 tracking-wider mb-4 border-b border-gray-800 pb-2">Danger Zone</h2>
        <button onClick={() => supabase.auth.signOut()} className="bg-gray-800 text-white font-bold py-3 px-4 rounded-lg w-full mb-4 hover:bg-gray-700">Log Out</button>
      </div>
    </div>
  )
}