import '@testing-library/jest-dom';

const originalWarn = console.warn;
console.warn = (...args) => {
  if (typeof args[0] === 'string' && args[0].includes('React Router Future Flag Warning')) return;
  originalWarn(...args);
};

// Keep test output clean from app debug logs.
console.debug = () => {};

// Make framer-motion a no-op in tests (avoids animation timing + unsupported DOM props).
jest.mock('framer-motion', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const React = require('react');

  const createMotionComponent = (Tag) =>
    React.forwardRef(({ children, ...props }, ref) => {
      const {
        initial,
        animate,
        exit,
        transition,
        whileHover,
        whileTap,
        variants,
        layoutId,
        layout,
        ...domProps
      } = props;
      return React.createElement(Tag, { ...domProps, ref }, children);
    });

  const motion = new Proxy(
    {},
    {
      get: (_target, key) => createMotionComponent(key),
    }
  );

  return {
    __esModule: true,
    AnimatePresence: ({ children }) => React.createElement(React.Fragment, null, children),
    motion,
  };
});
