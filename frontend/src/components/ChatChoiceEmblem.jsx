import React from 'react';
import { motion } from 'framer-motion';

const defaultShellStyle = {
  width: 172,
  height: 172,
  borderRadius: 26,
  border: '1px solid var(--border-color)',
  background: 'var(--content-bg)',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center'
};

const GlobeNetworkEmblem = () => (
  <svg viewBox="0 0 100 100" width="128" height="128" aria-hidden="true" focusable="false" style={{ overflow: 'visible' }}>
    {/* Globe outline */}
    <circle cx="50" cy="50" r="30" fill="none" stroke="#2b99cc" strokeWidth="4" />

    {/* Globe meridians and parallels */}
    <path d="M50 20 C35 30 35 70 50 80" fill="none" stroke="#2b99cc" strokeWidth="4" />
    <path d="M50 20 C65 30 65 70 50 80" fill="none" stroke="#2b99cc" strokeWidth="4" />
    <path d="M20 50 L80 50" fill="none" stroke="#2b99cc" strokeWidth="4" />
    <path d="M24 35 C35 40 65 40 76 35" fill="none" stroke="#2b99cc" strokeWidth="4" />
    <path d="M24 65 C35 60 65 60 76 65" fill="none" stroke="#2b99cc" strokeWidth="4" />

    {/* Top Left Speech Bubble */}
    <path d="M10 35 C5 35 0 30 0 25 L0 15 C0 10 5 5 10 5 L28 5 C33 5 38 10 38 15 L38 25 C38 30 33 35 28 35 L20 35 L26 45 L15 35 Z" fill="#91d1ba" />
    <circle cx="10" cy="20" r="2" fill="#fff" />
    <circle cx="19" cy="20" r="2" fill="#fff" />
    <circle cx="28" cy="20" r="2" fill="#fff" />

    {/* Top Right Speech Bubble */}
    <path d="M60 25 C55 25 50 20 50 15 L50 0 C50 -5 55 -10 60 -10 L95 -10 C100 -10 105 -5 105 0 L105 15 C105 20 100 25 95 25 L75 25 L65 38 L65 25 Z" fill="#91d1ba" />
    <circle cx="65" cy="7.5" r="2.5" fill="#fff" />
    <circle cx="77.5" cy="7.5" r="2.5" fill="#fff" />
    <circle cx="90" cy="7.5" r="2.5" fill="#fff" />

    {/* Bottom Right Speech Bubble */}
    <path d="M65 85 C60 85 55 80 55 75 L55 65 C55 60 60 55 65 55 L85 55 C90 55 95 60 95 65 L95 75 C95 80 90 85 85 85 L70 85 L60 95 L65 85 Z" fill="#91d1ba" />
    <circle cx="65" cy="70" r="1.5" fill="#fff" />
    <circle cx="75" cy="70" r="1.5" fill="#fff" />
    <circle cx="85" cy="70" r="1.5" fill="#fff" />
  </svg>
);

const PeopleNetworkEmblem = () => (
  <svg viewBox="0 0 100 100" width="128" height="128" aria-hidden="true" focusable="false" style={{ overflow: 'visible' }}>
    {/* Speech Bubble */}
    <path d="M30 40 C30 25 35 20 40 20 L80 20 C85 20 90 25 90 40 L90 50 C90 65 85 70 80 70 L70 70 L80 85 L60 70 C40 70 30 65 30 50 Z" fill="none" stroke="#0072bc" strokeWidth="5" strokeLinejoin="round" />
    <circle cx="50" cy="45" r="4" fill="#0072bc" />
    <circle cx="60" cy="45" r="4" fill="#0072bc" />
    <circle cx="70" cy="45" r="4" fill="#0072bc" />

    {/* Left Person */}
    <circle cx="20" cy="55" r="7" fill="#2c2c2c" />
    <path d="M20 65 L20 85 M5 85 L20 85 L20 65 M20 75 L35 75" fill="none" stroke="#2c2c2c" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M15 95 L20 85 L25 105 M10 70 L5 85 L10 100 L20 100" fill="none" stroke="#2c2c2c" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />

    {/* Table */}
    <path d="M30 75 L70 75" fill="none" stroke="#2c2c2c" strokeWidth="5" strokeLinecap="round" />
    <path d="M50 75 L50 105 L35 105 L65 105" fill="none" stroke="#2c2c2c" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />

    {/* Right Person */}
    <circle cx="80" cy="55" r="7" fill="#2c2c2c" />
    <path d="M80 65 L80 85 M95 85 L80 85 L80 65 M80 75 L65 60" fill="none" stroke="#2c2c2c" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M85 95 L80 85 L75 105 M90 70 L95 85 L90 100 L80 100" fill="none" stroke="#2c2c2c" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export default function ChatChoiceEmblem({ kind = 'global', shellStyle = {} }) {
  const isGlobal = kind === 'global';

  return (
    <span style={{ ...defaultShellStyle, ...shellStyle }} aria-hidden="true">
      <motion.span
        animate={isGlobal ? { rotate: [0, 5, -5, 0] } : { y: [0, -3, 0] }}
        transition={isGlobal ? { duration: 4, repeat: Infinity, ease: 'easeInOut' } : { duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        style={{ display: 'inline-flex', perspective: '1000px', filter: 'drop-shadow(0 0 18px rgba(0,0,0,0.08))' }}
      >
        {isGlobal ? <GlobeNetworkEmblem /> : <PeopleNetworkEmblem />}
      </motion.span>
    </span>
  );
}
