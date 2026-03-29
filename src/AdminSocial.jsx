import { useState } from 'react'
import { supabase } from './supabaseClient'

export default function AdminSocial() {
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState(null)

  // YOUR PERMANENT META TOKEN
  const FB_TOKEN = "EAANCLPkZBTfYBRHKFzrYfugrLgJewKtrKb0YU3JitwOoqnNs01JeCBNYqPH1Gbjq8sjkWlCP7FWaXJQ33sWX21gDMfBeUEQZAISAB4QtTLd4NWCRdVS1ka4shS2C7Yduf2arH4VCL4yFv6K7iDNQMuXlqC8RtDuEBfagyRkZA6U50rUWEEgQXNLxHwqc9MMjAZDZD"

  const handleSync = async () => {
    setSyncing(true)
    setSyncResult("Connecting to Meta Graph API...")
    
    try {
       const accountRes = await fetch(`https://graph.facebook.com/v19.0/me/accounts?access_token=${FB_TOKEN}`)
       const accountData = await accountRes.json()

       if (accountData.error) throw new Error(accountData.error.message)
       if (!accountData.data || accountData.data.length === 0) throw new Error("No Facebook Pages found attached to this token.")

       const pageId = accountData.data[0].id
       const pageToken = accountData.data[0].access_token

       // Fetch with attachments to get shared venue flyers
       const feedRes = await fetch(`https://graph.facebook.com/v19.0/${pageId}/feed?fields=id,message,created_time,full_picture,permalink_url,attachments&access_token=${pageToken}`)
       const fbData = await feedRes.json()

       if (fbData.error) throw new Error(fbData.error.message)

       const { data: { user } } = await supabase.auth.getUser()

       let added = 0
       let skipped = 0

       for (const post of fbData.data) {
          
          let attachmentText = null;
          if (post.attachments && post.attachments.data && post.attachments.data.length > 0) {
              const attachment = post.attachments.data[0];
              attachmentText = attachment.description || attachment.title || null;
          }

          const postText = post.message || attachmentText || null;

          if (!postText && !post.full_picture) continue;

          const { data: existing } = await supabase.from('posts').select('id').eq('fb_post_id', post.id).maybeSingle()

          if (existing) {
              skipped++
              continue
          }

          const payload = {
              author_id: user.id, 
              content: postText, 
              image_url: post.full_picture || null,
              external_link: post.permalink_url || null,
              fb_post_id: post.id,
              created_at: post.created_time,
              likes: 0,
              comments: 0
          }

          const { error: insertError } = await supabase.from('posts').insert([payload])
          
          if (insertError) {
              console.error("Database Rejection:", insertError)
              throw new Error(`Database rejected post: ${insertError.message}`)
          }
          
          added++
       }
       
       setSyncResult(`✅ Sync Complete! Added ${added} new posts to the FYP. Skipped ${skipped} existing posts.`)
    } catch (err) {
       console.error("FB Sync Error:", err)
       setSyncResult(`⚠️ Error: ${err.message}`)
    }
    setSyncing(false)
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="bg-gray-900 p-6 rounded-xl border border-gray-800 relative overflow-hidden">
        <div className="absolute -right-20 -top-20 w-64 h-64 bg-blue-600/10 rounded-full blur-3xl pointer-events-none"></div>
        
        <h3 className="text-3xl font-['Bebas_Neue'] text-blue-400 mb-2 tracking-wider flex items-center gap-3">
          <svg className="w-8 h-8 text-blue-500" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.469h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.469h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
          Facebook Auto-Sync
        </h3>
        <p className="text-sm text-gray-400 mb-8 max-w-xl">
          Pull the latest posts, shared flyers, and updates directly from the Black Hills Nightlife Facebook page and inject them into the app's FYP.
        </p>
        
        <div className="bg-black/50 border border-gray-800 p-6 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-6 relative z-10">
            <div>
                <h4 className="text-white font-bold text-lg mb-1">Manual Feed Sync</h4>
                <p className="text-xs text-gray-500 uppercase tracking-widest font-bold">Pulls the last 25 posts from Meta</p>
            </div>
            
            <button 
                onClick={handleSync} 
                disabled={syncing}
                className="w-full sm:w-auto bg-blue-600 hover:bg-blue-500 disabled:bg-blue-900/50 disabled:text-blue-400 text-white font-bold py-4 px-8 rounded-xl uppercase tracking-widest text-sm transition-all shadow-[0_0_20px_rgba(59,130,246,0.3)] hover:shadow-[0_0_30px_rgba(59,130,246,0.5)] flex items-center justify-center gap-2"
            >
                {syncing ? (
                    <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> Syncing...</>
                ) : (
                    '📥 Pull Latest Posts'
                )}
            </button>
        </div>

        {syncResult && (
            <div className={`mt-6 p-4 rounded-xl border text-sm font-bold tracking-wide text-center animate-fade-in ${syncResult.includes('Error') ? 'bg-red-900/20 border-red-500/30 text-red-400' : 'bg-green-900/20 border-green-500/30 text-green-400'}`}>
                {syncResult}
            </div>
        )}
      </div>
    </div>
  )
}