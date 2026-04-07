import { useState, useEffect, Suspense } from 'react'

// This tells Vite to automatically find any .jsx files in the backgrounds folder
const bgFiles = import.meta.glob('./backgrounds/*.jsx')

export default function BackgroundManager() {
  const [BgComponent, setBgComponent] = useState(null)

  useEffect(() => {
    const loadBackground = async () => {
      const filePaths = Object.keys(bgFiles)
      
      // If the folder has at least one file, load the first one!
      if (filePaths.length > 0) {
        try {
          const module = await bgFiles[filePaths[0]]()
          setBgComponent(() => module.default)
        } catch (error) {
          console.error("Failed to load custom background. Defaulting to standard dark mode.", error)
        }
      }
    }
    
    loadBackground()
  }, [])

  // If the folder is empty or the file is broken, return nothing (defaults to standard dark mode)
  if (!BgComponent) return null

  return (
    <div className="fixed inset-0 z-[-1] pointer-events-none opacity-80">
        <Suspense fallback={<div></div>}>
            <BgComponent />
        </Suspense>
    </div>
  )
}