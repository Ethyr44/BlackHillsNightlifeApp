import React from 'react'
import './Moonshower.css' // Imports the isolated CSS

export default function Moonshower() {
  return (
    // fixed inset-0 locks it to the screen, z-[-1] pushes it behind the app, pointer-events-none stops it from blocking clicks
    <div className="fixed inset-0 z-[-1] pointer-events-none">
      <div className="uiverse-midnight-sky">
        <div className="sky-canvas">
          <div className="stars stars-1"></div>
          <div className="stars stars-2"></div>
          <div className="stars stars-3"></div>

          <div className="meteor m1"></div>
          <div className="meteor m2"></div>
          <div className="meteor m3"></div>

          <div className="moon"></div>
        </div>
      </div>
    </div>
  )
}