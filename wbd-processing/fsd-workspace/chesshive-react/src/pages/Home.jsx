import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import ChessBackground from "../components/ChessBackground";
import AnimatedSidebar from "../components/AnimatedSidebar";
import { GlassCard, FloatingButton } from "../components/AnimatedCard";

const TESTIMONIALS = [
  {
    image: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e",
    name: "Alex Thompson",
    rating: "★★★★★",
    text: "The community here is incredible! I've improved my game significantly through the daily challenges and tournaments."
  },
  {
    image: "https://images.unsplash.com/photo-1494790108377-be9c29b29330",
    name: "Emma Chen",
    rating: "★★★★★",
    text: "ChessHive has transformed how I approach the game. The mentorship program is exceptional!"
  },
  {
    image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d",
    name: "David Kumar",
    rating: "★★★★★",
    text: "From beginner to tournament player, ChessHive has been there every step of the way. Amazing platform!"
  }
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
      delayChildren: 0.3
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: "easeOut" }
  }
};

const chessPieceVariants = {
  hidden: { opacity: 0, scale: 0.5, rotate: -180 },
  visible: {
    opacity: 1,
    scale: 1,
    rotate: 0,
    transition: { duration: 0.8, ease: "easeOut" }
  }
};

function FeatureCard({ icon, title, description, delay }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6 }}
      whileHover={{ y: -10, scale: 1.02 }}
      style={{
        background: 'rgba(46, 139, 87, 0.15)',
        backdropFilter: 'blur(10px)',
        borderRadius: '20px',
        padding: '2rem',
        border: '1px solid rgba(46, 139, 87, 0.3)',
        textAlign: 'center'
      }}
    >
      <motion.div
        initial={{ scale: 0 }}
        whileInView={{ scale: 1 }}
        viewport={{ once: true }}
        transition={{ type: "spring", stiffness: 200 }}
        style={{
          fontSize: '3rem',
          marginBottom: '1rem',
          color: '#2E8B57'
        }}
      >
        {icon}
      </motion.div>
      <h3 style={{ 
        color: '#FFFDD0', 
        fontFamily: "'Cinzel', serif",
        marginBottom: '0.8rem',
        fontSize: '1.3rem'
      }}>
        {title}
      </h3>
      <p style={{ 
        color: 'rgba(255, 253, 208, 0.7)',
        lineHeight: '1.6',
        fontSize: '0.95rem'
      }}>
        {description}
      </p>
    </motion.div>
  );
}

function TestimonialCard({ image, name, rating, text, delay }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -30 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 30 }}
      transition={{ duration: 0.6 }}
      whileHover={{ scale: 1.03 }}
      style={{
        background: 'rgba(255, 253, 208, 0.95)',
        borderRadius: '20px',
        padding: '1.5rem',
        boxShadow: '0 10px 40px rgba(0, 0, 0, 0.2)'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '1rem' }}>
        <motion.img
          src={image}
          alt={name}
          whileHover={{ scale: 1.1 }}
          style={{
            width: '60px',
            height: '60px',
            borderRadius: '50%',
            objectFit: 'cover',
            border: '3px solid #2E8B57'
          }}
        />
        <div>
          <h4 style={{ margin: 0, color: '#333', fontFamily: "'Cinzel', serif" }}>{name}</h4>
          <div style={{ color: '#FFD700', fontSize: '1.2rem' }}>{rating}</div>
        </div>
      </div>
      <p style={{ 
        color: '#555', 
        fontStyle: 'italic', 
        lineHeight: '1.6',
        margin: 0
      }}>
        "{text}"
      </p>
    </motion.div>
  );
}

export default function Home() {
  const navigate = useNavigate();

  // Memoize to keep references stable for effects.
  const testimonials = useMemo(() => TESTIMONIALS, []);

  const [activeIndex, setActiveIndex] = useState(0);
  // Direction: 1 = forward (next), -1 = backward (prev)
  const [direction, setDirection] = useState(1);

  const variants = {
    enter: (dir) => ({ x: dir > 0 ? 140 : -140, opacity: 0, scale: 0.99 }),
    center: { x: 0, opacity: 1, scale: 1 },
    exit: (dir) => ({ x: dir > 0 ? -140 : 140, opacity: 0, scale: 0.99 }),
  };

  // Auto-advance testimonials every 6 seconds (forward)
  useEffect(() => {
    const timer = setInterval(() => {
      setDirection(1);
      setActiveIndex(i => (i + 1) % testimonials.length);
    }, 6000);
    return () => clearInterval(timer);
  }, [testimonials.length]);

  // Preload testimonial images once to prevent decode/network jank during transitions.
  useEffect(() => {
    testimonials.forEach((t) => {
      const img = new Image();
      img.src = t.image;
    });
  }, [testimonials]);

  useEffect(() => {
    document.body.style.overflow = 'auto';
    document.body.style.background = '#071327';
    return () => {
      document.body.style.overflow = '';
      document.body.style.background = '';
    };
  }, []);

  return (
    <AnimatePresence>
      <div style={{ minHeight: '100vh', position: 'relative' }}>
        <ChessBackground />
        <AnimatedSidebar />

        <motion.main
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          style={{
            padding: '40px',
            minHeight: '100vh',
            position: 'relative',
            zIndex: 1
          }}
        >
          <motion.div
            variants={itemVariants}
            style={{ textAlign: 'center', marginBottom: '3rem' }}
          >
            <motion.h1
              initial={{ opacity: 0, y: -50 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              style={{
                fontFamily: "'Cinzel', serif",
                fontSize: 'clamp(2.5rem, 6vw, 4.5rem)',
                color: '#FFFDD0',
                textShadow: '0 0 30px rgba(46, 139, 87, 0.5)',
                marginBottom: '0.5rem',
                letterSpacing: '3px'
              }}
            >
              Welcome to ChessHive
            </motion.h1>
            <motion.div
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ delay: 0.5, duration: 0.8 }}
              style={{
                height: '3px',
                background: 'linear-gradient(90deg, transparent, #2E8B57, transparent)',
                maxWidth: '400px',
                margin: '0 auto'
              }}
            />
          </motion.div>

          <GlassCard delay={0.4} className="hero-glass">
            <motion.div 
              style={{ 
                display: 'flex', 
                justifyContent: 'center', 
                gap: '4rem',
                flexWrap: 'wrap',
                marginBottom: '2rem'
              }}
            >
              <motion.div
                variants={chessPieceVariants}
                whileHover={{ 
                  scale: 1.2, 
                  rotate: -10,
                  color: '#87CEEB',
                  textShadow: '0 0 30px rgba(135, 206, 235, 0.8)'
                }}
                onClick={() => navigate('/login')}
                style={{
                  textAlign: 'center',
                  cursor: 'pointer'
                }}
              >
                <div style={{
                  fontSize: '5rem',
                  color: '#FFFDD0',
                  textShadow: '0 0 20px rgba(46, 139, 87, 0.5)',
                  transition: 'all 0.3s ease'
                }}>
                  ♕
                </div>
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.8 }}
                  style={{
                    fontFamily: "'Cinzel', serif",
                    color: '#FFFDD0',
                    fontSize: '1.1rem',
                    letterSpacing: '2px'
                  }}
                >
                  LOGIN
                </motion.span>
              </motion.div>

              <motion.div
                variants={chessPieceVariants}
                whileHover={{ 
                  scale: 1.2, 
                  rotate: 10,
                  color: '#87CEEB',
                  textShadow: '0 0 30px rgba(135, 206, 235, 0.8)'
                }}
                onClick={() => navigate('/signup')}
                style={{
                  textAlign: 'center',
                  cursor: 'pointer'
                }}
              >
                <div style={{
                  fontSize: '5rem',
                  color: '#FFFDD0',
                  textShadow: '0 0 20px rgba(46, 139, 87, 0.5)',
                  transition: 'all 0.3s ease'
                }}>
                  ♔
                </div>
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.9 }}
                  style={{
                    fontFamily: "'Cinzel', serif",
                    color: '#FFFDD0',
                    fontSize: '1.1rem',
                    letterSpacing: '2px'
                  }}
                >
                  SIGN UP
                </motion.span>
              </motion.div>
            </motion.div>

            <motion.h2
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1 }}
              style={{
                textAlign: 'center',
                fontFamily: "'Cinzel', serif",
                color: '#87CEEB',
                fontSize: 'clamp(1.2rem, 3vw, 1.8rem)',
                fontWeight: '400',
                textShadow: '0 0 15px rgba(135, 206, 235, 0.3)'
              }}
            >
              Bringing Chess Passionates from Campuses to the Board
            </motion.h2>
          </GlassCard>

          <motion.div
            variants={itemVariants}
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '1.5rem',
              marginTop: '3rem'
            }}
          >
            <FeatureCard
              icon="🌍"
              title="Play Anywhere"
              description="Connect and play with chess enthusiasts from campuses worldwide, anytime."
              delay={0.6}
            />
            <FeatureCard
              icon="🏆"
              title="Compete & Win"
              description="Join tournaments, climb rankings, and prove your skills against top players."
              delay={0.7}
            />
            <FeatureCard
              icon="📚"
              title="Learn & Grow"
              description="Access coaching, lessons, and resources to improve your game strategy."
              delay={0.8}
            />
            <FeatureCard
              icon="🤝"
              title="Community"
              description="Be part of a vibrant chess community with players of all skill levels."
              delay={0.9}
            />
          </motion.div>

          <motion.section
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.2, duration: 0.6 }}
            style={{ marginTop: '4rem' }}
          >
            <GlassCard>
              <motion.h2
                style={{
                  textAlign: 'center',
                  fontFamily: "'Cinzel', serif",
                  color: '#FFFDD0',
                  fontSize: '2rem',
                  marginBottom: '2rem'
                }}
              >
                What Our Community Says
              </motion.h2>
              
              <div style={{ position: 'relative', minHeight: '240px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                <AnimatePresence initial={false} custom={direction} mode="wait">
                  {testimonials.map((t, idx) => idx === activeIndex && (
                    <motion.div
                      key={t.name}
                      custom={direction}
                      variants={variants}
                      initial="enter"
                      animate="center"
                      exit="exit"
                      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                      style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', willChange: 'transform, opacity', transform: 'translateZ(0)' }}
                    >
                      <div style={{ width: '100%', maxWidth: '720px' }}>
                        <TestimonialCard {...t} />
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>

              <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '1rem' }}>
                {testimonials.map((_, i) => (
                  <div
                    key={i}
                    onClick={() => { setDirection(i > activeIndex ? 1 : -1); setActiveIndex(i); }}
                    style={{
                      width: i === activeIndex ? 14 : 10,
                      height: i === activeIndex ? 14 : 10,
                      borderRadius: '50%',
                      background: i === activeIndex ? 'var(--gaming-yellow)' : 'rgba(255,255,255,0.2)',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  />
                ))}
              </div>
            </GlassCard>
          </motion.section>

          <motion.section
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.6 }}
            style={{
              marginTop: '4rem',
              textAlign: 'center',
              paddingBottom: '4rem'
            }}
          >
            <GlassCard>
              <h2 style={{
                fontFamily: "'Cinzel', serif",
                color: '#FFFDD0',
                fontSize: '2rem',
                marginBottom: '1.5rem'
              }}>
                Ready to Make Your Move?
              </h2>
              <p style={{
                color: 'rgba(255, 253, 208, 0.8)',
                maxWidth: '600px',
                margin: '0 auto 2rem',
                lineHeight: '1.8'
              }}>
                Join thousands of chess enthusiasts from campuses around the world. 
                Play, learn, compete, and shop – all in one place!
              </p>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
                <FloatingButton onClick={() => navigate('/signup')} delay={1.7}>
                  Get Started
                </FloatingButton>
                <FloatingButton onClick={() => navigate('/about')} variant="secondary" delay={1.8}>
                  Learn More
                </FloatingButton>
              </div>
            </GlassCard>
          </motion.section>
        </motion.main>
      </div>
    </AnimatePresence>
  );
}
