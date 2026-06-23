import { useState, useEffect, Suspense } from 'react'

const bgFiles = import.meta.glob('./backgrounds/*.jsx')

export default function BackgroundManager() {
  const [BgComponent, setBgComponent] = useState(null)

  useEffect(() => {
    const loadBackground = async () => {
      const filePaths = Object.keys(bgFiles)
      if (filePaths.length > 0) {
        try {
          const module = await bgFiles[filePaths[0]]()
          setBgComponent(() => module.default)
        } catch (error) {
          console.error("Failed to load custom background.", error)
        }
      }
    }
    loadBackground()
  }, [])

  if (!BgComponent) return null

  // 🟢 THE FIX: Changed to z-0 and removed opacity constraints
  return (
    <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <Suspense fallback={<div></div>}>
            <BgComponent />
        </Suspense>
    </div>
  )
}