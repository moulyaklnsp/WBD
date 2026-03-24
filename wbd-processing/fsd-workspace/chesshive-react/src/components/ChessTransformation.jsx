import React, { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";

const chessPieces = [
  { name: "Pawn", symbol: "♙", description: "The humble beginning" },
  { name: "Knight", symbol: "♘", description: "Learning to leap forward" },
  { name: "Bishop", symbol: "♗", description: "Finding your diagonal path" },
  { name: "Rook", symbol: "♖", description: "Building your fortress" },
  { name: "Queen", symbol: "♕", description: "Mastering all directions" },
  { name: "King", symbol: "♔", description: "Becoming the legend" }
];

const ChessTransformation = ({ autoPlay = true, speed = 2 }) => {
  const [currentPiece, setCurrentPiece] = useState(0);
  const containerRef = useRef(null);
  const pieceRef = useRef(null);
  const textRef = useRef(null);
  const progressRef = useRef(null);

  useEffect(() => {
    if (!autoPlay) return;

    const timeline = gsap.timeline({ repeat: -1 });

    chessPieces.forEach((_, index) => {
      timeline.to({}, {
        duration: speed,
        onStart: () => {
          gsap.to(pieceRef.current, {
            scale: 0,
            rotationY: 180,
            opacity: 0,
            duration: 0.4,
            ease: "power2.in",
            onComplete: () => {
              setCurrentPiece(index);
              gsap.fromTo(pieceRef.current, 
                { scale: 0, rotationY: -180, opacity: 0 },
                { scale: 1, rotationY: 0, opacity: 1, duration: 0.6, ease: "back.out(1.7)" }
              );
            }
          });

          gsap.fromTo(textRef.current,
            { y: 20, opacity: 0 },
            { y: 0, opacity: 1, duration: 0.5, delay: 0.5 }
          );

          gsap.fromTo(progressRef.current,
            { scaleX: 0 },
            { scaleX: 1, duration: speed - 0.5, ease: "none", delay: 0.5 }
          );
        }
      });
    });

    return () => timeline.kill();
  }, [autoPlay, speed]);

  const piece = chessPieces[currentPiece];

  return (
    <div
      ref={containerRef}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
        background: 'rgba(7, 19, 39, 0.8)',
        borderRadius: '20px',
        border: '1px solid rgba(46, 139, 87, 0.3)',
        backdropFilter: 'blur(10px)'
      }}
    >
      <div
        ref={pieceRef}
        style={{
          fontSize: '6rem',
          marginBottom: '1rem',
          textShadow: '0 0 30px rgba(46, 139, 87, 0.6)',
          color: '#FFFDD0'
        }}
      >
        {piece.symbol}
      </div>

      <div ref={textRef} style={{ textAlign: 'center' }}>
        <h3 style={{
          fontFamily: "'Cinzel', serif",
          fontSize: '1.8rem',
          color: '#2E8B57',
          marginBottom: '0.5rem',
          textShadow: '0 0 10px rgba(46, 139, 87, 0.3)'
        }}>
          {piece.name}
        </h3>
        <p style={{
          color: 'rgba(255, 253, 208, 0.7)',
          fontSize: '1.1rem',
          fontStyle: 'italic'
        }}>
          {piece.description}
        </p>
      </div>

      <div style={{
        width: '200px',
        height: '4px',
        background: 'rgba(46, 139, 87, 0.2)',
        borderRadius: '2px',
        marginTop: '1.5rem',
        overflow: 'hidden'
      }}>
        <div
          ref={progressRef}
          style={{
            width: '100%',
            height: '100%',
            background: 'linear-gradient(90deg, #2E8B57, #3CB371)',
            transformOrigin: 'left',
            transform: 'scaleX(0)'
          }}
        />
      </div>

      <div style={{
        display: 'flex',
        gap: '0.5rem',
        marginTop: '1rem'
      }}>
        {chessPieces.map((p, idx) => (
          <div
            key={p.name}
            style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              background: idx === currentPiece ? '#2E8B57' : 'rgba(46, 139, 87, 0.3)',
              transition: 'all 0.3s ease'
            }}
          />
        ))}
      </div>
    </div>
  );
};

export const ChessTransformationStory = () => {
  const sectionRefs = useRef([]);
  const [visibleSections, setVisibleSections] = useState([]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const index = sectionRefs.current.indexOf(entry.target);
            if (!visibleSections.includes(index)) {
              setVisibleSections(prev => [...prev, index]);
              gsap.fromTo(entry.target,
                { opacity: 0, y: 80, scale: 0.9 },
                { 
                  opacity: 1, 
                  y: 0, 
                  scale: 1,
                  duration: 1.2,
                  ease: "power3.out"
                }
              );
            }
          }
        });
      },
      { threshold: 0.2 }
    );

    sectionRefs.current.forEach(ref => {
      if (ref) observer.observe(ref);
    });

    return () => observer.disconnect();
  }, [visibleSections]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4rem' }}>
      {chessPieces.map((piece, idx) => (
        <div
          key={piece.name}
          ref={el => sectionRefs.current[idx] = el}
          style={{
            opacity: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '3rem',
            flexDirection: idx % 2 === 0 ? 'row' : 'row-reverse',
            padding: '2rem',
            background: 'rgba(7, 19, 39, 0.6)',
            borderRadius: '20px',
            border: '1px solid rgba(46, 139, 87, 0.2)'
          }}
        >
          <div style={{
            fontSize: '8rem',
            textShadow: '0 0 40px rgba(46, 139, 87, 0.5)',
            color: '#FFFDD0'
          }}>
            {piece.symbol}
          </div>
          <div style={{ maxWidth: '400px' }}>
            <h3 style={{
              fontFamily: "'Cinzel', serif",
              fontSize: '2.5rem',
              color: '#2E8B57',
              marginBottom: '1rem'
            }}>
              Chapter {idx + 1}: {piece.name}
            </h3>
            <p style={{
              color: 'rgba(255, 253, 208, 0.8)',
              fontSize: '1.2rem',
              lineHeight: 1.8
            }}>
              {piece.description}. Every grandmaster once stood where you stand now. 
              The journey of a thousand moves begins with a single step forward.
            </p>
          </div>
        </div>
      ))}
    </div>
  );
};

export default ChessTransformation;
