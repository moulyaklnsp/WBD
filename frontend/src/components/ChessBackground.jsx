import React, { useMemo } from 'react';
import { motion } from 'framer-motion';

const chessPieces = ['♔', '♕', '♖', '♗', '♘', '♙'];
const colors = ['#2E8B57', '#87CEEB', '#3CB371', '#6CB4D4'];

const useReducedMotion = () => {
  return typeof window !== 'undefined' && 
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
};

function FloatingPiece({ piece, index, total, startY, duration, delay, size }) {
  const startX = (index / total) * 100;
  const color = colors[index % colors.length];

  return (
    <motion.div
      initial={{ 
        x: `${startX}vw`,
        y: `${startY}vh`,
        opacity: 0,
        scale: 0.5
      }}
      animate={{
        y: [startY + 'vh', (startY - 30) + 'vh', (startY + 120) + 'vh'],
        x: [startX + 'vw', (startX + 10) + 'vw', (startX - 5) + 'vw'],
        rotate: [0, 180, 360],
        opacity: [0, 0.15, 0.2, 0.15, 0],
        scale: [0.5, 1, 1, 0.8]
      }}
      transition={{
        duration: duration,
        repeat: Infinity,
        delay: delay,
        ease: 'linear'
      }}
      style={{
        position: 'absolute',
        fontSize: `${size}rem`,
        color: color,
        pointerEvents: 'none',
        textShadow: `0 0 20px ${color}`,
        zIndex: 0
      }}
    >
      {piece}
    </motion.div>
  );
}

function GlowOrb({ index, reducedMotion }) {
  const positions = [
    { x: '20%', y: '30%' },
    { x: '80%', y: '20%' },
    { x: '60%', y: '70%' },
    { x: '30%', y: '80%' },
    { x: '70%', y: '50%' }
  ];
  const pos = positions[index % positions.length];
  const color = index % 2 === 0 ? 'rgba(46, 139, 87, 0.15)' : 'rgba(135, 206, 235, 0.1)';

  return (
    <motion.div
      style={{
        position: 'absolute',
        left: pos.x,
        top: pos.y,
        width: '300px',
        height: '300px',
        borderRadius: '50%',
        background: `radial-gradient(circle, ${color} 0%, transparent 70%)`,
        pointerEvents: 'none',
        transform: 'translate(-50%, -50%)'
      }}
      animate={reducedMotion ? {} : {
        scale: [1, 1.3, 1],
        opacity: [0.3, 0.6, 0.3]
      }}
      transition={{
        duration: 4 + index,
        repeat: Infinity,
        ease: 'easeInOut',
        delay: index * 0.5
      }}
    />
  );
}

function GridLines({ reducedMotion }) {
  return (
    <motion.div
      style={{
        position: 'absolute',
        bottom: 0,
        left: '50%',
        transform: 'translateX(-50%) perspective(500px) rotateX(60deg)',
        width: '150%',
        height: '40%',
        backgroundImage: `
          linear-gradient(rgba(46, 139, 87, 0.1) 1px, transparent 1px),
          linear-gradient(90deg, rgba(46, 139, 87, 0.1) 1px, transparent 1px)
        `,
        backgroundSize: '50px 50px',
        opacity: 0.5,
        pointerEvents: 'none'
      }}
      animate={reducedMotion ? {} : {
        backgroundPosition: ['0px 0px', '0px 50px']
      }}
      transition={{
        duration: 3,
        repeat: Infinity,
        ease: 'linear'
      }}
    />
  );
}

const MemoizedParticleField = React.memo(function ParticleField({ particles, reducedMotion }) {
  if (reducedMotion) return null;
  
  return (
    <>
      {particles.map(p => (
        <motion.div
          key={p.id}
          style={{
            position: 'absolute',
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: `${p.size}px`,
            height: `${p.size}px`,
            borderRadius: '50%',
            backgroundColor: '#87CEEB',
            pointerEvents: 'none'
          }}
          animate={{
            opacity: [0, 0.6, 0],
            scale: [0.5, 1, 0.5]
          }}
          transition={{
            duration: p.duration,
            repeat: Infinity,
            delay: p.delay
          }}
        />
      ))}
    </>
  );
});

export default function ChessBackground({ wallpaperUrl } = {}) {
  const reducedMotion = useReducedMotion();
  
  const pieceData = useMemo(() => 
    Array.from({ length: 15 }, (_, i) => ({
      id: i,
      piece: chessPieces[i % chessPieces.length],
      startY: Math.random() * 100,
      duration: 20 + Math.random() * 15,
      delay: Math.random() * 10,
      size: 1.5 + Math.random() * 1.5
    })), []);

  const particles = useMemo(() => 
    Array.from({ length: 30 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: 2 + Math.random() * 3,
      duration: 3 + Math.random() * 4,
      delay: Math.random() * 5
    })), []);

  const baseBackground = wallpaperUrl
    ? `linear-gradient(135deg, rgba(7, 19, 39, 0.88) 0%, rgba(10, 22, 40, 0.75) 35%, rgba(13, 26, 45, 0.72) 65%, rgba(7, 19, 39, 0.9) 100%), url(${wallpaperUrl})`
    : 'linear-gradient(135deg, #071327 0%, #0a1628 30%, #0d1a2d 60%, #071327 100%)';

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      zIndex: 0,
      pointerEvents: 'none',
      backgroundImage: baseBackground,
      backgroundSize: wallpaperUrl ? 'cover' : undefined,
      backgroundPosition: wallpaperUrl ? 'center' : undefined,
      backgroundRepeat: wallpaperUrl ? 'no-repeat' : undefined,
      overflow: 'hidden'
    }}>
      <GridLines reducedMotion={reducedMotion} />
      
      {[0, 1, 2, 3, 4].map(i => (
        <GlowOrb key={i} index={i} reducedMotion={reducedMotion} />
      ))}
      
      <MemoizedParticleField particles={particles} reducedMotion={reducedMotion} />
      
      {!reducedMotion && pieceData.map((data, i) => (
        <FloatingPiece 
          key={data.id} 
          piece={data.piece}
          index={i}
          total={15}
          startY={data.startY}
          duration={data.duration}
          delay={data.delay}
          size={data.size}
        />
      ))}
      
      <motion.div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: '30%',
          background: 'linear-gradient(to top, rgba(7, 19, 39, 0.8), transparent)',
          pointerEvents: 'none'
        }}
      />
      
      <motion.div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '20%',
          background: 'linear-gradient(to bottom, rgba(7, 19, 39, 0.5), transparent)',
          pointerEvents: 'none'
        }}
      />
    </div>
  );
}
