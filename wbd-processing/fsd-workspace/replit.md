# ChessHive

## Overview
ChessHive is a chess community platform designed to bring chess enthusiasts from campuses together. The platform supports multiple user roles including players, coordinators, organizers, and admins.

## Project Structure

```
├── chesshive-react/     # React frontend (Create React App)
│   ├── src/
│   │   ├── pages/       # Page components organized by role
│   │   │   ├── admin/   # Admin management pages
│   │   │   ├── coordinator/  # Coordinator features
│   │   │   ├── organizer/    # Organizer features
│   │   │   ├── player/       # Player features
│   │   │   └── auth/         # Authentication pages
│   │   ├── features/    # Redux slices for state management
│   │   ├── components/  # Reusable components (AnimatedSidebar, ChessBackground, AnimatedCard, GlassCard)
│   │   └── hooks/       # Custom React hooks
│   └── public/          # Static assets
│
└── Chesshivev1.0.2/     # Node.js/Express backend (not active)
```

## Running the Application

The React frontend runs on port 5000 and is configured as the main workflow.

### Development
- Frontend starts automatically via the "React Frontend" workflow
- Uses Create React App with React 19
- State management with Redux Toolkit
- Routing with React Router v6

### Deployment
- Configured as a static deployment
- Build command: `cd chesshive-react && npm run build`
- Serves from: `chesshive-react/build`

## Technologies
- React 19
- Redux Toolkit
- React Router v6
- Axios for API calls
- Chart.js for data visualization
- Framer Motion for animations

## UI Design (Updated Dec 2024)
- Dark theme with gradient background (#071327 to #0d1a2d)
- Glassmorphism effect on cards (frosted glass look)
- Color palette:
  - Primary accent: Sea Green (#2E8B57)
  - Secondary accent: Sky Blue (#87CEEB)
  - Text: Cream (#FFFDD0)
- Typography: Cinzel font for headings, Inter for body text
- Animated sidebar with hover effects
- Floating chess piece animations in background
- Reduced motion support for accessibility

## Reusable Components
- `AnimatedSidebar`: Slide-in navigation with hover animations
- `ChessBackground`: Animated background with floating chess pieces and glowing orbs
- `AnimatedCard`: Cards with enter/exit animations
- `GlassCard`: Glassmorphism-styled card component
- `ChessEmblems`: 2D SVG chess emblems (Knight and Pawn) with GSAP rotation animations during loading states
- `ChessTransformation`: Animated piece transformation sequence (pawn to knight to bishop to rook to queen to king) with GSAP timelines

## Storytelling Experience (Dec 2024)
- New `/story` route with igloo.inc-inspired GSAP animations
- Login page features rotating 2D Knight emblem during authentication
- Signup page features rotating 2D Pawn emblem during registration
- Chess piece evolution story with scroll-triggered animations
- Intersection Observer-based reveal animations for story sections

## Notes
- The backend (`Chesshivev1.0.2`) is present but not running. The React app proxies API requests to localhost:3000, which will show connection errors until a backend is configured.
- ESLint warnings exist for unused variables in some player components.
