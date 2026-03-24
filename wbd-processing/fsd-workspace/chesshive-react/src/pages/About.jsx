import React, { useEffect } from "react";
import { motion } from "framer-motion";
import ChessBackground from "../components/ChessBackground";
import AnimatedSidebar from "../components/AnimatedSidebar";
import { GlassCard } from "../components/AnimatedCard";

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

function FeatureCard({ icon, title, description, delay }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.6 }}
      whileHover={{ y: -10, scale: 1.03 }}
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
        animate={{ scale: 1 }}
        transition={{ delay: delay + 0.2, type: "spring", stiffness: 200 }}
        style={{
          fontSize: '3rem',
          marginBottom: '1rem'
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

function StatCard({ value, label, delay }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay, duration: 0.5 }}
      whileHover={{ scale: 1.05 }}
      style={{
        textAlign: 'center',
        padding: '2rem'
      }}
    >
      <motion.div
        style={{
          fontSize: '3rem',
          fontWeight: '700',
          fontFamily: "'Cinzel', serif",
          background: 'linear-gradient(135deg, #2E8B57, #87CEEB)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text'
        }}
      >
        {value}
      </motion.div>
      <p style={{ color: 'rgba(255, 253, 208, 0.7)', marginTop: '0.5rem' }}>{label}</p>
    </motion.div>
  );
}

export default function About() {
  useEffect(() => {
    document.body.style.overflow = 'auto';
    document.body.style.background = '#071327';
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
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        style={{
          padding: '60px 40px 40px 40px',
          minHeight: '100vh',
          position: 'relative',
          zIndex: 1,
          maxWidth: '1200px',
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center'
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
              fontSize: 'clamp(2.5rem, 6vw, 4rem)',
              color: '#FFFDD0',
              textShadow: '0 0 30px rgba(46, 139, 87, 0.5)',
              marginBottom: '0.5rem',
              letterSpacing: '3px'
            }}
          >
            About ChessHive
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

        <GlassCard delay={0.4}>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            style={{ textAlign: 'center' }}
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.5, type: "spring" }}
              style={{ fontSize: '4rem', marginBottom: '1.5rem' }}
            >
              ♔ ♕ ♖
            </motion.div>
            <h2 style={{
              fontFamily: "'Cinzel', serif",
              color: '#87CEEB',
              fontSize: '2rem',
              marginBottom: '1.5rem'
            }}>
              Our Mission
            </h2>
            <p style={{
              color: 'rgba(255, 253, 208, 0.9)',
              fontSize: '1.2rem',
              lineHeight: '1.8',
              maxWidth: '800px',
              margin: '0 auto'
            }}>
              At ChessHive, we aim to create a thriving community of passionate chess players 
              from various campuses. Whether you are a beginner or an expert, we provide a 
              platform to refine your skills, compete in tournaments, and connect with fellow enthusiasts.
            </p>
          </motion.div>
        </GlassCard>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            gap: '1rem',
            marginTop: '3rem',
            marginBottom: '3rem'
          }}
        >
          <GlassCard delay={0.9}>
            <div style={{ display: 'flex', justifyContent: 'space-around', flexWrap: 'wrap' }}>
              <StatCard value="10K+" label="Active Players" delay={1} />
              <StatCard value="500+" label="Tournaments" delay={1.1} />
              <StatCard value="100+" label="Colleges" delay={1.2} />
              <StatCard value="50+" label="Expert Mentors" delay={1.3} />
            </div>
          </GlassCard>
        </motion.div>

        <motion.section
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
        >
          <h2 style={{
            fontFamily: "'Cinzel', serif",
            color: '#FFFDD0',
            fontSize: '2rem',
            textAlign: 'center',
            marginBottom: '2rem'
          }}>
            Why Choose Us?
          </h2>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '1.5rem'
          }}>
            <FeatureCard
              icon="🏆"
              title="Tournaments"
              description="Participate in campus-wide and inter-college tournaments with exciting prizes and recognition."
              delay={1.1}
            />
            <FeatureCard
              icon="♟️"
              title="Expert Mentorship"
              description="Connect with experienced players and mentors who can guide you to chess mastery."
              delay={1.2}
            />
            <FeatureCard
              icon="📅"
              title="Regular Events"
              description="Stay updated with upcoming events, workshops, and chess meetups in your area."
              delay={1.3}
            />
            <FeatureCard
              icon="🤝"
              title="Community"
              description="Engage with an active and supportive chess community that helps each other grow."
              delay={1.4}
            />
            <FeatureCard
              icon="📊"
              title="Track Progress"
              description="Monitor your improvement with detailed statistics and performance analytics."
              delay={1.5}
            />
            <FeatureCard
              icon="🛒"
              title="Chess Store"
              description="Access quality chess equipment, books, and accessories through our integrated store."
              delay={1.6}
            />
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.7 }}
          style={{ marginTop: '4rem', paddingBottom: '4rem' }}
        >
          <GlassCard>
            <div style={{ textAlign: 'center' }}>
              <h2 style={{
                fontFamily: "'Cinzel', serif",
                color: '#FFFDD0',
                fontSize: '2rem',
                marginBottom: '1.5rem'
              }}>
                Join the Hive Today
              </h2>
              <p style={{
                color: 'rgba(255, 253, 208, 0.8)',
                maxWidth: '600px',
                margin: '0 auto 2rem',
                lineHeight: '1.8'
              }}>
                Be part of a growing community of chess enthusiasts. Whether you want to 
                improve your game, compete in tournaments, or simply enjoy playing chess 
                with like-minded people, ChessHive is your destination.
              </p>
              <motion.a
                href="/signup"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                style={{
                  display: 'inline-block',
                  background: 'linear-gradient(135deg, #2E8B57 0%, #3CB371 100%)',
                  color: '#ffffff',
                  padding: '1rem 2.5rem',
                  borderRadius: '50px',
                  fontSize: '1.1rem',
                  fontWeight: '600',
                  textDecoration: 'none',
                  fontFamily: "'Cinzel', serif",
                  letterSpacing: '1px',
                  textTransform: 'uppercase',
                  boxShadow: '0 10px 30px rgba(46, 139, 87, 0.4)'
                }}
              >
                Get Started
              </motion.a>
            </div>
          </GlassCard>
        </motion.section>
      </motion.main>
    </div>
  );
}
