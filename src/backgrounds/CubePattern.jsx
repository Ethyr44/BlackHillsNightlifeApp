import './CubePattern.css';

export default function CubePattern() {
  return (
    <div className="cube-container">
      <div className="pattern-bg">
        <svg preserveAspectRatio="xMidYMid slice" height="100%" width="100%" className="cube-svg" viewBox="0 0 120 104">
          <defs>
            <linearGradient y2="100%" x2="100%" y1="0%" x1="0%" id="cube-dark">
              <stop stopColor="#232526" offset="0%" />
              <stop stopColor="#414345" offset="100%" />
            </linearGradient>
            <linearGradient y2="0%" x2="100%" y1="100%" x1="0%" id="cube-mid">
              <stop stopColor="#4b6cb7" offset="0%" />
              <stop stopColor="#182848" offset="100%" />
            </linearGradient>
            <linearGradient y2="100%" x2="0%" y1="0%" x1="100%" id="cube-light">
              <stop stopColor="#a8edea" offset="0%" />
              <stop stopColor="#fed6e3" offset="100%" />
            </linearGradient>
          </defs>
        </svg>
      </div>
    </div>
  );
}