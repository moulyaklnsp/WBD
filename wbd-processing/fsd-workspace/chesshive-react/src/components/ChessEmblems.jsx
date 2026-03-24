import React, { useEffect, useRef } from "react";
import { gsap } from "gsap";

export const KnightEmblem = ({ isLoading = false, size = 120 }) => {
  const knightRef = useRef(null);
  const glowRef = useRef(null);
  const rotationRef = useRef(null);

  useEffect(() => {
    if (isLoading && knightRef.current) {
      rotationRef.current = gsap.to(knightRef.current, {
        rotation: 360,
        duration: 2,
        ease: "power1.inOut",
        repeat: -1,
        transformOrigin: "center center"
      });
      
      gsap.to(glowRef.current, {
        opacity: 0.3,
        scale: 1.2,
        duration: 1,
        ease: "power2.inOut",
        repeat: -1,
        yoyo: true
      });
    } else if (rotationRef.current) {
      rotationRef.current.kill();
      gsap.to(knightRef.current, { rotation: 0, duration: 0.5 });
    }

    return () => {
      if (rotationRef.current) rotationRef.current.kill();
    };
  }, [isLoading]);

  return (
    <div style={{ position: 'relative', width: size, height: size, margin: '0 auto' }}>
      <div
        ref={glowRef}
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: size * 1.3,
          height: size * 1.3,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(46, 139, 87, 0.4) 0%, transparent 70%)',
          opacity: 0.2
        }}
      />
      <svg
        ref={knightRef}
        viewBox="0 0 100 100"
        width={size}
        height={size}
        style={{ display: 'block' }}
      >
        <defs>
          <linearGradient id="knightGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#2E8B57" />
            <stop offset="50%" stopColor="#3CB371" />
            <stop offset="100%" stopColor="#228B22" />
          </linearGradient>
          <filter id="knightGlow">
            <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        <circle cx="50" cy="50" r="45" fill="none" stroke="url(#knightGradient)" strokeWidth="2" opacity="0.3"/>
        <g filter="url(#knightGlow)">
          <path
            d="M35 80 L35 65 L30 60 L30 50 C30 45 32 40 38 35 
               L35 30 L40 32 L45 25 C50 18 55 15 60 15 
               C68 15 72 22 72 30 L72 35 L68 40 L68 50 
               L72 55 L72 65 L65 80 Z"
            fill="url(#knightGradient)"
            stroke="#FFFDD0"
            strokeWidth="1.5"
          />
          <ellipse cx="58" cy="28" rx="4" ry="5" fill="#FFFDD0" opacity="0.9"/>
          <path d="M42 45 Q50 48 58 45" stroke="#FFFDD0" strokeWidth="1" fill="none" opacity="0.6"/>
          <ellipse cx="62" cy="50" rx="2" ry="3" fill="#FFFDD0" opacity="0.4"/>
        </g>
      </svg>
    </div>
  );
};

export const PawnEmblem = ({ isLoading = false, size = 100 }) => {
  const pawnRef = useRef(null);
  const glowRef = useRef(null);
  const rotationRef = useRef(null);

  useEffect(() => {
    if (isLoading && pawnRef.current) {
      rotationRef.current = gsap.to(pawnRef.current, {
        rotation: 360,
        duration: 2,
        ease: "power1.inOut",
        repeat: -1,
        transformOrigin: "center center"
      });
      
      gsap.to(glowRef.current, {
        opacity: 0.4,
        scale: 1.15,
        duration: 0.8,
        ease: "power2.inOut",
        repeat: -1,
        yoyo: true
      });
    } else if (rotationRef.current) {
      rotationRef.current.kill();
      gsap.to(pawnRef.current, { rotation: 0, duration: 0.5 });
    }

    return () => {
      if (rotationRef.current) rotationRef.current.kill();
    };
  }, [isLoading]);

  return (
    <div style={{ position: 'relative', width: size, height: size, margin: '0 auto' }}>
      <div
        ref={glowRef}
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: size * 1.3,
          height: size * 1.3,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255, 215, 0, 0.4) 0%, transparent 70%)',
          opacity: 0.2
        }}
      />
      <svg
        ref={pawnRef}
        viewBox="0 0 100 100"
        width={size}
        height={size}
        style={{ display: 'block' }}
      >
        <defs>
          <linearGradient id="pawnGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFD700" />
            <stop offset="50%" stopColor="#FFA500" />
            <stop offset="100%" stopColor="#DAA520" />
          </linearGradient>
          <filter id="pawnGlow">
            <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        <circle cx="50" cy="50" r="45" fill="none" stroke="url(#pawnGradient)" strokeWidth="2" opacity="0.3"/>
        <g filter="url(#pawnGlow)">
          <circle cx="50" cy="25" r="12" fill="url(#pawnGradient)" stroke="#FFFDD0" strokeWidth="1.5"/>
          <path
            d="M42 35 Q50 42 58 35 L60 50 L65 55 L65 62 L35 62 L35 55 L40 50 Z"
            fill="url(#pawnGradient)"
            stroke="#FFFDD0"
            strokeWidth="1.5"
          />
          <path
            d="M32 62 L32 70 Q32 75 35 78 L65 78 Q68 75 68 70 L68 62 Z"
            fill="url(#pawnGradient)"
            stroke="#FFFDD0"
            strokeWidth="1.5"
          />
          <ellipse cx="50" cy="22" rx="3" ry="2" fill="#FFFDD0" opacity="0.4"/>
        </g>
      </svg>
    </div>
  );
};

export default { KnightEmblem, PawnEmblem };
