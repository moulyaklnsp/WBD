import React from 'react';
import { motion } from 'framer-motion';

export default function AnimatedCard({ children, delay = 0, className = '', style = {} }) {
  return (
    <motion.div
      className={className}
      style={style}
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ 
        duration: 0.6, 
        delay,
        ease: [0.25, 0.46, 0.45, 0.94]
      }}
      whileHover={{ 
        y: -8,
        transition: { duration: 0.3 }
      }}
    >
      {children}
    </motion.div>
  );
}

export function GlassCard({ children, delay = 0, className = '', onClick }) {
  return (
    <motion.div
      className={className}
      onClick={onClick}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ 
        duration: 0.5, 
        delay,
        ease: "easeOut"
      }}
      whileHover={{ 
        scale: 1.02,
        boxShadow: '0 25px 50px rgba(46, 139, 87, 0.3)',
        transition: { duration: 0.3 }
      }}
      whileTap={{ scale: 0.98 }}
      style={{
        background: 'rgba(255, 255, 255, 0.1)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderRadius: '20px',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        padding: '2rem',
        cursor: onClick ? 'pointer' : 'default'
      }} 
    >
      {children}
    </motion.div>
  );
}

export function FloatingButton({ children, onClick, variant = 'primary', delay = 0 }) {
  const variants = {
    primary: {
      background: 'linear-gradient(135deg, #2E8B57 0%, #3CB371 100%)',
      color: '#ffffff'
    },
    secondary: {
      background: 'linear-gradient(135deg, #87CEEB 0%, #5BA8D0 100%)',
      color: '#ffffff'
    },
    outline: {
      background: 'transparent',
      border: '2px solid #2E8B57',
      color: '#2E8B57'
    }
  }; 

  return (
    <motion.button
      onClick={onClick}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      whileHover={{ 
        scale: 1.05,
        boxShadow: '0 10px 30px rgba(46, 139, 87, 0.4)'
      }}
      whileTap={{ scale: 0.95 }}
      style={{
        ...variants[variant],
        padding: '1rem 2.5rem',
        borderRadius: '50px',
        fontSize: '1.1rem',
        fontWeight: '600',
        cursor: 'pointer',
        border: variant === 'outline' ? '2px solid #2E8B57' : 'none',
        fontFamily: "'Cinzel', serif",
        letterSpacing: '1px',
        textTransform: 'uppercase'
      }}
    >
      {children}
    </motion.button>
  );
}
