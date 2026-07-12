import { useEffect, useRef } from 'react'

export default function Moonshower() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: -1 }}>
      {/* Base gradient — rich midnight-to-deep-navy */}
      <div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse 120% 80% at 50% -10%, #1a2d5a 0%, #0e1e3d 35%, #070d1a 70%)',
        }}
      />

      {/* Ambient top glow — warm blue */}
      <div
        className="absolute"
        style={{
          top: '-10%',
          left: '20%',
          right: '20%',
          height: '55%',
          background: 'radial-gradient(ellipse at 50% 0%, rgba(79,140,255,0.13) 0%, transparent 70%)',
          filter: 'blur(24px)',
        }}
      />

      {/* Secondary ambient — cool cyan tint right side */}
      <div
        className="absolute"
        style={{
          top: '0%',
          right: '-10%',
          width: '50%',
          height: '60%',
          background: 'radial-gradient(ellipse at 100% 0%, rgba(34,212,200,0.07) 0%, transparent 65%)',
          filter: 'blur(32px)',
        }}
      />

      {/* Moon */}
      <MoonLayer />

      {/* Stars */}
      <StarField />

      {/* Shooting stars */}
      <ShootingStars />

      {/* Bottom fog — keeps cards legible */}
      <div
        className="absolute bottom-0 left-0 right-0"
        style={{
          height: '30%',
          background: 'linear-gradient(to top, rgba(7,13,26,0.7) 0%, transparent 100%)',
        }}
      />
    </div>
  )
}

function MoonLayer() {
  return (
    <div
      className="absolute"
      style={{ top: '9%', right: '18%' }}
    >
      {/* Outer halo */}
      <div
        style={{
          position: 'absolute',
          inset: '-28px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(200,220,255,0.06) 0%, transparent 70%)',
          filter: 'blur(8px)',
        }}
      />
      {/* Moon body */}
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: '50%',
          background: 'radial-gradient(circle at 38% 38%, #ddeeff 0%, #b8d0f0 45%, #9ab8e0 100%)',
          boxShadow: '0 0 32px 8px rgba(180,210,255,0.18), 0 0 80px 20px rgba(120,170,255,0.08)',
          position: 'relative',
        }}
      >
        {/* Craters */}
        <div style={{ position: 'absolute', top: '22%', left: '30%', width: 9, height: 9, borderRadius: '50%', background: 'rgba(100,130,180,0.22)' }} />
        <div style={{ position: 'absolute', top: '52%', left: '58%', width: 6, height: 6, borderRadius: '50%', background: 'rgba(100,130,180,0.18)' }} />
        <div style={{ position: 'absolute', top: '40%', left: '18%', width: 4, height: 4, borderRadius: '50%', background: 'rgba(100,130,180,0.14)' }} />
      </div>
    </div>
  )
}

function StarField() {
  const stars = generateStars(180)

  return (
    <div className="absolute inset-0">
      {stars.map((star, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: `${star.x}%`,
            top: `${star.y}%`,
            width: star.size,
            height: star.size,
            borderRadius: '50%',
            background: star.color,
            opacity: star.opacity,
            boxShadow: star.size > 1.5 ? `0 0 ${star.size * 2}px ${star.color}` : 'none',
            animation: `twinkle-star ${star.duration}s ease-in-out ${star.delay}s infinite`,
          }}
        />
      ))}

      <style>{`
        @keyframes twinkle-star {
          0%, 100% { opacity: var(--star-base-opacity, 0.7); transform: scale(1); }
          50% { opacity: calc(var(--star-base-opacity, 0.7) * 0.25); transform: scale(0.85); }
        }
      `}</style>
    </div>
  )
}

function ShootingStars() {
  const meteors = [
    { top: '8%',  delay: '0s',   duration: '7s',  width: 100 },
    { top: '20%', delay: '3.5s', duration: '9s',  width: 80  },
    { top: '35%', delay: '6s',   duration: '8s',  width: 120 },
    { top: '14%', delay: '11s',  duration: '10s', width: 90  },
  ]

  return (
    <>
      <style>{`
        @keyframes shoot-star {
          0% { transform: translateX(0) translateY(0) rotate(-22deg); opacity: 0; }
          4% { opacity: 1; }
          18% { transform: translateX(-130vw) translateY(50vh) rotate(-22deg); opacity: 0; }
          100% { transform: translateX(-130vw) translateY(50vh) rotate(-22deg); opacity: 0; }
        }
      `}</style>
      {meteors.map((m, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            top: m.top,
            right: '-5%',
            width: m.width,
            height: 1.5,
            borderRadius: 999,
            background: 'linear-gradient(90deg, rgba(255,255,255,0.9) 0%, rgba(180,210,255,0.6) 40%, transparent 100%)',
            opacity: 0,
            animation: `shoot-star ${m.duration} linear ${m.delay} infinite`,
            boxShadow: '0 0 4px 1px rgba(255,255,255,0.3)',
          }}
        />
      ))}
    </>
  )
}

function generateStars(count) {
  const stars = []
  const rng = mulberry32(42)

  const colors = [
    'rgba(255,255,255,1)',
    'rgba(200,220,255,1)',
    'rgba(180,210,255,1)',
    'rgba(255,240,210,1)',
    'rgba(200,255,240,1)',
  ]

  for (let i = 0; i < count; i++) {
    const size = rng() < 0.12 ? rng() * 1.5 + 1.5 : rng() * 1.2 + 0.4
    stars.push({
      x: rng() * 100,
      y: rng() * 75,
      size,
      opacity: rng() * 0.45 + 0.3,
      color: colors[Math.floor(rng() * colors.length)],
      duration: rng() * 4 + 2.5,
      delay: rng() * 5,
    })
  }
  return stars
}

function mulberry32(seed) {
  let s = seed
  return function () {
    s |= 0; s = s + 0x6D2B79F5 | 0
    let t = Math.imul(s ^ s >>> 15, 1 | s)
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t
    return ((t ^ t >>> 14) >>> 0) / 4294967296
  }
}
