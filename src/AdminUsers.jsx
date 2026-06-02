import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

export default function AdminUsers() {
    const [pendingUsers, setPendingUsers] = useState([])
    const [searchQuery, setSearchQuery] = useState('')
    const [searchResults, setSearchResults] = useState([])
    const [loadingId, setLoadingId] = useState(null)

    useEffect(() => {
        fetchPendingApprovals()
    }, [])

    // --- 1. PENDING APPROVALS LOGIC ---
    const fetchPendingApprovals = async () => {
        // 🟢 FIX: Removed 'created_at' from the select and order clauses to prevent crashes
        const { data, error } = await supabase
            .from('profiles')
            .select('id, username, account_type, account_status, details')
            .eq('account_status', 'pending')
        
        // 🟢 FIX: Added explicit error logging so we are never blind
        if (error) {
            console.error("Fetch Pending Error:", error)
            alert("Error loading pending users: " + error.message)
            return
        }

        if (data) setPendingUsers(data)
    }

    const handleApproval = async (userId, action) => {
        setLoadingId(userId)
        
        if (action === 'approve') {
            const { error } = await supabase.from('profiles').update({ account_status: 'approved' }).eq('id', userId)
            if (error) alert("Error approving user: " + error.message)
            
            await supabase.from('notifications').insert([{
                user_id: userId,
                title: '✅ Account Approved!',
                content: 'Welcome to Black Hills Nightlife. Your account has been officially approved by the Admin.'
            }])
        } else {
            const { error } = await supabase.from('profiles').update({ account_type: 'Regular', account_status: 'approved' }).eq('id', userId)
            if (error) alert("Error rejecting user: " + error.message)
            
            await supabase.from('notifications').insert([{
                user_id: userId,
                title: '❌ Request Denied',
                content: 'Your request for a specialized account was denied. You have been placed in a Regular user tier.'
            }])
        }
        
        await fetchPendingApprovals()
        setLoadingId(null)
    }

    // --- 2. USER ROLE OVERRIDE LOGIC ---
    const searchUsers = async (e) => {
        e.preventDefault()
        if (!searchQuery.trim()) return
        
        const { data, error } = await supabase
            .from('profiles')
            .select('id, username, account_type, account_status')
            .ilike('username', `%${searchQuery}%`)
            .limit(10)
            
        if (error) alert("Search Error: " + error.message)
        if (data) setSearchResults(data)
    }

    const forceRoleChange = async (userId, newRole) => {
        if (!window.confirm(`Force change this user to ${newRole}?`)) return
        
        setLoadingId(userId)
        const { error } = await supabase.from('profiles').update({ 
            account_type: newRole, 
            account_status: 'approved' 
        }).eq('id', userId)
        
        if (error) alert("Role Update Error: " + error.message)
        
        setSearchResults(prev => prev.map(u => u.id === userId ? { ...u, account_type: newRole, account_status: 'approved' } : u))
        setLoadingId(null)
    }

    return (
        <div className="space-y-8 animate-fade-in pb-10">
            
            {/* SECTION 1: PENDING APPROVALS */}
            <div className="bg-yellow-900/10 border border-yellow-500/30 p-6 rounded-3xl">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-2xl font-['Bebas_Neue'] text-yellow-500 tracking-widest">Pending Approvals</h3>
                    <span className="bg-yellow-500 text-black px-3 py-1 rounded-full text-xs font-bold">{pendingUsers.length}</span>
                </div>

                {pendingUsers.length === 0 ? (
                    <div className="text-center p-8 bg-black/40 border border-gray-800 rounded-2xl">
                        <p className="text-gray-500 text-xs font-bold uppercase tracking-widest">No pending account requests.</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {pendingUsers.map(user => {
                            // 🟢 FIX: Extract the requested entity name from the JSON payload
                            const entityName = user.account_type === 'Host' 
                                ? user.details?.stageName 
                                : user.details?.name;

                            return (
                                <div key={user.id} className="bg-black/60 border border-gray-700 p-4 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <h4 className="text-white font-bold text-lg">{user.username}</h4>
                                            <span className="bg-purple-900/50 text-purple-400 border border-purple-500/50 text-[9px] px-2 py-0.5 rounded font-bold uppercase tracking-widest">
                                                Req: {user.account_type}
                                            </span>
                                        </div>
                                        
                                        {/* 🟢 FIX: Display the extracted details so Admin knows what they are approving */}
                                        {entityName && (
                                            <p className="text-xs text-blue-400 mb-1">
                                                Applying as: <span className="font-bold text-white">{entityName}</span>
                                            </p>
                                        )}

                                        <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">
                                            Status: Waiting for Review
                                        </p>
                                    </div>

                                    <div className="flex gap-2 w-full sm:w-auto">
                                        <button 
                                            onClick={() => handleApproval(user.id, 'reject')}
                                            disabled={loadingId === user.id}
                                            className="flex-1 sm:flex-none border border-red-900/50 text-red-500 hover:bg-red-900/30 px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors"
                                        >
                                            Reject
                                        </button>
                                        <button 
                                            onClick={() => handleApproval(user.id, 'approve')}
                                            disabled={loadingId === user.id}
                                            className="flex-1 sm:flex-none bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors shadow-[0_0_10px_rgba(22,163,74,0.3)]"
                                        >
                                            Approve
                                        </button>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>

            {/* SECTION 2: FORCE ROLE OVERRIDE */}
            <div className="bg-gray-900 border border-gray-800 p-6 rounded-3xl">
                <h3 className="text-2xl font-['Bebas_Neue'] text-blue-400 tracking-widest mb-2">User Management</h3>
                <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-6">Search users to view or overwrite their account type.</p>
                
                <form onSubmit={searchUsers} className="flex gap-2 mb-6">
                    <input 
                        type="text" 
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="Search username..." 
                        className="flex-1 bg-black border border-gray-700 text-white p-4 rounded-xl outline-none focus:border-blue-500 text-sm"
                    />
                    <button type="submit" className="bg-blue-600 hover:bg-blue-500 text-white px-6 rounded-xl font-bold uppercase tracking-widest text-xs transition-colors">
                        Search
                    </button>
                </form>

                <div className="space-y-3">
                    {searchResults.map(user => (
                        <div key={user.id} className="bg-black/40 border border-gray-800 p-4 rounded-xl flex flex-col sm:flex-row justify-between items-center gap-4">
                            <div className="text-left w-full sm:w-auto">
                                <h4 className="text-white font-bold">{user.username}</h4>
                                <span className={`text-[9px] px-2 py-0.5 rounded font-bold uppercase tracking-widest ${user.account_status === 'pending' ? 'bg-yellow-900/30 text-yellow-500' : 'bg-green-900/30 text-green-500'}`}>
                                    Status: {user.account_status}
                                </span>
                            </div>

                            <div className="flex items-center gap-2 w-full sm:w-auto">
                                <select 
                                    value={user.account_type}
                                    onChange={(e) => forceRoleChange(user.id, e.target.value)}
                                    disabled={loadingId === user.id}
                                    className="w-full sm:w-auto bg-gray-900 border border-gray-700 text-white rounded-lg p-2 text-[10px] font-bold uppercase tracking-widest outline-none focus:border-blue-500"
                                >
                                    <option value="Regular">Regular</option>
                                    <option value="Singer">Singer</option>
                                    <option value="Venue">Venue</option>
                                    <option value="Performer">Performer</option>
                                    <option value="Host">Host</option>
                                    <option value="Admin">Admin</option>
                                </select>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

        </div>
    )
}