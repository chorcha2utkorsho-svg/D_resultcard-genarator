import React from 'react';

interface SchoolLogoProps {
  customLogoUrl?: string;
  className?: string;
  size?: number;
}

export const SchoolLogo: React.FC<SchoolLogoProps> = ({ customLogoUrl, className = '', size = 96 }) => {
  if (customLogoUrl) {
    return (
      <img
        src={customLogoUrl}
        alt="School Logo"
        className={`object-contain rounded-full ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }

  // Vector emblem accurately reflecting D-Likon Model Academy's official crest from the attached document
  return (
    <div className={`relative inline-flex items-center justify-center select-none ${className}`} style={{ width: size, height: size }}>
      <svg
        viewBox="0 0 200 200"
        className="w-full h-full drop-shadow-sm"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="laurelGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#4338ca" />
            <stop offset="50%" stopColor="#6366f1" />
            <stop offset="100%" stopColor="#7c3aed" />
          </linearGradient>
          <linearGradient id="sunGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#ea580c" />
          </linearGradient>
          <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
            <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodOpacity="0.2" />
          </filter>
        </defs>

        {/* Outer Laurel Wreath Ring */}
        <circle cx="100" cy="85" r="75" fill="none" stroke="#4f46e5" strokeWidth="3" strokeDasharray="5,3" />
        
        {/* Decorative Laurel Leaves around circle */}
        {Array.from({ length: 24 }).map((_, i) => {
          const angle = (i * 15 * Math.PI) / 180;
          const x = 100 + 74 * Math.cos(angle);
          const y = 85 + 74 * Math.sin(angle);
          const rot = (i * 15) + 45;
          return (
            <ellipse
              key={i}
              cx={x}
              cy={y}
              rx="6"
              ry="3"
              fill="#6366f1"
              transform={`rotate(${rot} ${x} ${y})`}
              opacity="0.85"
            />
          );
        })}

        {/* Inner Gold / Orange Radiance Ring */}
        <circle cx="100" cy="85" r="62" fill="#fff" stroke="#ea580c" strokeWidth="4" />
        <circle cx="100" cy="85" r="58" fill="#fff" stroke="#fcd34d" strokeWidth="2" strokeDasharray="3,2" />

        {/* Sun rays radiating from behind book */}
        <g stroke="#f59e0b" strokeWidth="1.5" opacity="0.6">
          <line x1="100" y1="80" x2="100" y2="40" />
          <line x1="100" y1="80" x2="80" y2="45" />
          <line x1="100" y1="80" x2="120" y2="45" />
          <line x1="100" y1="80" x2="65" y2="55" />
          <line x1="100" y1="80" x2="135" y2="55" />
        </g>

        {/* Rising Sun Arc */}
        <path d="M 80 75 A 20 20 0 0 1 120 75 Z" fill="url(#sunGrad)" />

        {/* Open Book in the center */}
        <g id="open-book">
          {/* Left Page */}
          <path
            d="M 100 82 C 90 76 75 75 66 79 L 66 98 C 75 94 90 95 100 101 Z"
            fill="#eff6ff"
            stroke="#1e3a8a"
            strokeWidth="2.5"
          />
          {/* Right Page */}
          <path
            d="M 100 82 C 110 76 125 75 134 79 L 134 98 C 125 94 110 95 100 101 Z"
            fill="#eff6ff"
            stroke="#1e3a8a"
            strokeWidth="2.5"
          />
          {/* Book Spine */}
          <line x1="100" y1="82" x2="100" y2="101" stroke="#1e3a8a" strokeWidth="2.5" />
          {/* Page lines */}
          <line x1="72" y1="84" x2="93" y2="84" stroke="#93c5fd" strokeWidth="1.5" />
          <line x1="72" y1="89" x2="93" y2="89" stroke="#93c5fd" strokeWidth="1.5" />
          <line x1="72" y1="94" x2="90" y2="94" stroke="#93c5fd" strokeWidth="1.5" />
          <line x1="107" y1="84" x2="128" y2="84" stroke="#93c5fd" strokeWidth="1.5" />
          <line x1="107" y1="89" x2="128" y2="89" stroke="#93c5fd" strokeWidth="1.5" />
          <line x1="107" y1="94" x2="125" y2="94" stroke="#93c5fd" strokeWidth="1.5" />
        </g>

        {/* Established Text */}
        <text
          x="100"
          y="114"
          textAnchor="middle"
          fontSize="9"
          fontWeight="bold"
          fill="#dc2626"
          fontFamily="system-ui, sans-serif"
        >
          স্থাপিতঃ ২০১৮
        </text>

        {/* Curved Academy Name in Top Inner Arc */}
        <path id="topTextArc" d="M 52,90 A 50,50 0 1,1 148,90" fill="none" />
        <text fontSize="10.5" fontWeight="bold" fill="#b91c1c" textAnchor="middle">
          <textPath href="#topTextArc" startOffset="50%">
            ডি-লিকন মডেল একাডেমী
          </textPath>
        </text>

        {/* Bottom Ribbon / Banner */}
        <g transform="translate(0, 15)">
          <path
            d="M 30,145 L 50,135 L 50,150 L 30,160 Z"
            fill="#6d28d9"
            stroke="#4c1d95"
            strokeWidth="1"
          />
          <path
            d="M 170,145 L 150,135 L 150,150 L 170,160 Z"
            fill="#6d28d9"
            stroke="#4c1d95"
            strokeWidth="1"
          />
          <path
            d="M 45,137 C 80,146 120,146 155,137 L 150,154 C 118,162 82,162 50,154 Z"
            fill="#7c3aed"
            stroke="#4c1d95"
            strokeWidth="1.5"
          />
          <text
            x="100"
            y="148"
            textAnchor="middle"
            fontSize="8"
            fontWeight="bold"
            letterSpacing="0.8"
            fill="#ffffff"
            fontFamily="Arial, sans-serif"
          >
            D-Likon Model Academy
          </text>
        </g>
      </svg>
    </div>
  );
};
