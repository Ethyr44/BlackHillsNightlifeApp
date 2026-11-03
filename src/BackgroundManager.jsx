import { memo } from 'react'
import Moonshower from './backgrounds/Moonshower'

const BackgroundManager = memo(function BackgroundManager() {
  // 🟢 THE FIX: Direct static import renders on frame 1 without async flicker
  return (
    <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
      <Moonshower />
    </div>
  )
})

export default BackgroundManager