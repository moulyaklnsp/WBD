import React, { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useNavigate } from "react-router-dom";
import ChessBackground from "../components/ChessBackground";
import AnimatedSidebar from "../components/AnimatedSidebar";
import ChessTransformation, { ChessTransformationStory } from "../components/ChessTransformation";

gsap.registerPlugin(ScrollTrigger);

export default function ChessStory() {
  const navigate = useNavigate();
  const heroRef = useRef(null);
  const titleRef = useRef(null);
  const subtitleRef = useRef(null);
  const ctaRef = useRef(null);

  useEffect(() => {
    document.body.style.overflow = 'auto';
    document.body.style.background = '#071327';

    const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

    tl.fromTo(titleRef.current,
      { y: 100, opacity: 0, scale: 0.8 },
      { y: 0, opacity: 1, scale: 1, duration: 1.5 }
    )
    .fromTo(subtitleRef.current,
      { y: 50, opacity: 0 },
      { y: 0, opacity: 1, duration: 1 },
      "-=0.8"
    )
    .fromTo(ctaRef.current,
      { y: 30, opacity: 0, scale: 0.9 },
      { y: 0, opacity: 1, scale: 1, duration: 0.8 },
      "-=0.5"
    );

    gsap.to(heroRef.current, {
      backgroundPosition: "50% 100%",
      scrollTrigger: {
        trigger: heroRef.current,
        start: "top top",
        end: "bottom top",
        scrub: true
      }
    });

    return () => {
      document.body.style.overflow = '';
      document.body.style.background = '';
    };
  }, []);

  return (
    <div style={{ minHeight: '100vh', position: 'relative' }}>
      <ChessBackground />
      <AnimatedSidebar />

      <motion.main
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
        style={{
          marginLeft: '280px',
          minHeight: '100vh',
          position: 'relative',
          zIndex: 1
        }}
      >
        <section
          ref={heroRef}
          style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '4rem 2rem',
            textAlign: 'center',
            background: 'radial-gradient(ellipse at center, rgba(46, 139, 87, 0.1) 0%, transparent 70%)'
          }}
        >
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ duration: 1.2, type: "spring", bounce: 0.4 }}
            style={{
              fontSize: '8rem',
              marginBottom: '2rem',
              textShadow: '0 0 60px rgba(46, 139, 87, 0.6)',
              color: '#FFFDD0'
            }}
          >
            ♔
          </motion.div>

          <h1
            ref={titleRef}
            style={{
              fontFamily: "'Cinzel', serif",
              fontSize: 'clamp(2.5rem, 6vw, 5rem)',
              color: '#FFFDD0',
              marginBottom: '1.5rem',
              textShadow: '0 0 30px rgba(46, 139, 87, 0.5)',
              letterSpacing: '0.1em'
            }}
          >
            The Journey of a Champion
          </h1>

          <p
            ref={subtitleRef}
            style={{
              fontSize: 'clamp(1rem, 2vw, 1.5rem)',
              color: 'rgba(255, 253, 208, 0.7)',
              maxWidth: '700px',
              lineHeight: 1.8,
              marginBottom: '3rem'
            }}
          >
            From a humble pawn to the mighty king, witness the transformation 
            that awaits every player who dares to dream big on the 64 squares.
          </p>

          <div ref={ctaRef}>
            <motion.button
              whileHover={{ scale: 1.05, boxShadow: '0 0 30px rgba(46, 139, 87, 0.6)' }}
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate('/signup')}
              style={{
                padding: '1.2rem 3rem',
                fontSize: '1.2rem',
                fontFamily: "'Cinzel', serif",
                background: 'linear-gradient(135deg, #2E8B57, #228B22)',
                border: 'none',
                borderRadius: '50px',
                color: '#FFFDD0',
                cursor: 'pointer',
                boxShadow: '0 10px 30px rgba(46, 139, 87, 0.3)'
              }}
            >
              Begin Your Story
            </motion.button>
          </div>

          <motion.div
            animate={{ y: [0, 10, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
            style={{
              position: 'absolute',
              bottom: '3rem',
              fontSize: '2rem',
              color: 'rgba(255, 253, 208, 0.5)'
            }}
          >
            ↓
          </motion.div>
        </section>

        <section style={{
          padding: '6rem 2rem',
          background: 'linear-gradient(180deg, transparent 0%, rgba(7, 19, 39, 0.9) 20%)'
        }}>
          <motion.h2
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            style={{
              textAlign: 'center',
              fontFamily: "'Cinzel', serif",
              fontSize: 'clamp(2rem, 4vw, 3rem)',
              color: '#2E8B57',
              marginBottom: '4rem',
              textShadow: '0 0 20px rgba(46, 139, 87, 0.3)'
            }}
          >
            The Evolution Continues
          </motion.h2>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            style={{
              display: 'flex',
              justifyContent: 'center',
              marginBottom: '6rem'
            }}
          >
            <ChessTransformation autoPlay={true} speed={2.5} />
          </motion.div>
        </section>

        <section style={{
          padding: '4rem 2rem',
          maxWidth: '1000px',
          margin: '0 auto'
        }}>
          <motion.h2
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            style={{
              textAlign: 'center',
              fontFamily: "'Cinzel', serif",
              fontSize: 'clamp(2rem, 4vw, 3rem)',
              color: '#FFFDD0',
              marginBottom: '4rem'
            }}
          >
            Your Story Unfolds
          </motion.h2>

          <ChessTransformationStory />
        </section>

        <section style={{
          padding: '6rem 2rem',
          textAlign: 'center',
          background: 'radial-gradient(ellipse at center bottom, rgba(46, 139, 87, 0.15) 0%, transparent 70%)'
        }}>
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
          >
            <h2 style={{
              fontFamily: "'Cinzel', serif",
              fontSize: 'clamp(2rem, 4vw, 3.5rem)',
              color: '#FFFDD0',
              marginBottom: '2rem',
              textShadow: '0 0 20px rgba(46, 139, 87, 0.4)'
            }}>
              Ready to Write Your Legend?
            </h2>

            <p style={{
              fontSize: '1.3rem',
              color: 'rgba(255, 253, 208, 0.7)',
              maxWidth: '600px',
              margin: '0 auto 3rem',
              lineHeight: 1.8
            }}>
              Join thousands of players who have transformed their game. 
              Your journey from pawn to king starts now.
            </p>

            <div style={{ display: 'flex', gap: '1.5rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => navigate('/signup')}
                style={{
                  padding: '1rem 2.5rem',
                  fontSize: '1.1rem',
                  fontFamily: "'Cinzel', serif",
                  background: 'linear-gradient(135deg, #2E8B57, #228B22)',
                  border: 'none',
                  borderRadius: '50px',
                  color: '#FFFDD0',
                  cursor: 'pointer',
                  boxShadow: '0 10px 30px rgba(46, 139, 87, 0.3)'
                }}
              >
                Start Your Journey
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => navigate('/login')}
                style={{
                  padding: '1rem 2.5rem',
                  fontSize: '1.1rem',
                  fontFamily: "'Cinzel', serif",
                  background: 'transparent',
                  border: '2px solid #2E8B57',
                  borderRadius: '50px',
                  color: '#2E8B57',
                  cursor: 'pointer'
                }}
              >
                Continue Playing
              </motion.button>
            </div>
          </motion.div>
        </section>

        <footer style={{
          padding: '2rem',
          textAlign: 'center',
          borderTop: '1px solid rgba(46, 139, 87, 0.2)',
          color: 'rgba(255, 253, 208, 0.5)',
          fontSize: '0.9rem'
        }}>
          <p>ChessHive - Where Champions Are Made</p>
        </footer>
      </motion.main>
    </div>
  );
}
