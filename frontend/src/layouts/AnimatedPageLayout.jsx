/**
 * AnimatedPageLayout – Reusable page transition wrapper
 * =====================================================
 * Wraps page components with framer-motion animation for consistent transitions.
 */
import React from 'react';
import { motion } from 'framer-motion';

// Default fade transition
const fadeVariant = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.5 }
};

// Flip transition (used for Login)
const flipVariant = {
  initial: { opacity: 0, rotateY: 90 },
  animate: { opacity: 1, rotateY: 0 },
  exit: { opacity: 0, rotateY: -90 },
  transition: { duration: 0.6 }
};

// Slide-up transition (used for ForgotPassword)
const slideUpVariant = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 },
  transition: { duration: 0.5 }
};

/**
 * @param {Object} props
 * @param {'fade'|'flip'|'slideUp'|'custom'} props.variant - Animation type
 * @param {Object} props.customAnimation - Custom framer-motion props (when variant='custom')
 * @param {React.ReactNode} props.children - Page component
 * @param {Object} props.style - Additional inline styles
 */
export default function AnimatedPageLayout({
  children,
  variant = 'fade',
  customAnimation,
  style = {}
}) {
  let animProps;

  switch (variant) {
    case 'flip':
      animProps = flipVariant;
      break;
    case 'slideUp':
      animProps = slideUpVariant;
      break;
    case 'custom':
      animProps = customAnimation || fadeVariant;
      break;
    case 'fade':
    default:
      animProps = fadeVariant;
      break;
  }

  return (
    <motion.div
      initial={animProps.initial}
      animate={animProps.animate}
      exit={animProps.exit}
      transition={animProps.transition}
      style={{ ...style }}
    >
      {children}
    </motion.div>
  );
}

export { fadeVariant, flipVariant, slideUpVariant };
