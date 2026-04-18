/**
 * AppRoutes – Centralized Route Configuration
 * =============================================
 * All application routes defined in a single file for easy management.
 * Organized by role: Public, Player, Coordinator, Organizer, Admin.
 */
import React from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import AnimatedPageLayout from '../layouts/AnimatedPageLayout';

// ─── Public Pages ────────────────────────────────────────────────
import Home from '../pages/Home';
import About from '../pages/About';
import Login from '../pages/Login';
import Signup from '../pages/Signup';
import ForgotPassword from '../pages/ForgotPassword';
import SetPassword from '../pages/SetPassword';
import ContactUs from '../pages/ContactUs';
import Blogs from '../pages/Blogs';
import BlogDetail from '../pages/BlogDetail';
import Verify from '../pages/auth/Verify';
import ChessStory from '../pages/ChessStory';
import ErrorPage from '../pages/ErrorPage';

// ─── Player Pages ────────────────────────────────────────────────
import PlayerDashboard from '../pages/player/PlayerDashboard';
import PlayerProfile from '../pages/player/PlayerProfile';
import PlayerTournament from '../pages/player/PlayerTournament';
import PlayerGrowth from '../pages/player/PlayerGrowth';
import PlayerPairings from '../pages/player/PlayerPairings';
import PlayerRankings from '../pages/player/PlayerRankings';
import PlayerSettings from '../pages/player/PlayerSettings';
import PlayerChat from '../pages/player/PlayerChat';
import PlayerStore from '../pages/player/PlayerStore';
import PlayerSubscription from '../pages/player/PlayerSubscription';
import PlayerWatch from '../pages/player/PlayerWatch';
import PlayerTv from '../pages/player/PlayerTv';
import PlayerWallet from '../pages/player/PlayerWallet';

// ─── Coordinator Pages ───────────────────────────────────────────
import CoordinatorDashboard from '../pages/coordinator/CoordinatorDashboard';
import CoordinatorChat from '../pages/coordinator/CoordinatorChat';
import CoordinatorMeetings from '../pages/coordinator/CoordinatorMeetings';
import CoordinatorProfile from '../pages/coordinator/CoordinatorProfile';
import EnrolledPlayers from '../pages/coordinator/EnrolledPlayers';
import FeedbackView from '../pages/coordinator/FeedbackView';
import CoordinatorPairings from '../pages/coordinator/CoordinatorPairings';
import CoordinatorPlayerStats from '../pages/coordinator/CoordinatorPlayerStats';
import CoordinatorRankings from '../pages/coordinator/CoordinatorRankings';
import StoreManagement from '../pages/coordinator/StoreManagement';
import ProductDetails from '../pages/coordinator/ProductDetails';

import TournamentManagement from '../pages/coordinator/TournamentManagement';
import TournamentDetails from '../pages/coordinator/TournamentDetails';
import TournamentComplaints from '../pages/coordinator/TournamentComplaints';
import EventCalendar from '../pages/coordinator/EventCalendar';
import CoordinatorBlogs from '../pages/coordinator/CoordinatorBlogs';
import CoordinatorBlogDetail from '../pages/coordinator/CoordinatorBlogDetail';
import CoordinatorStreamingControl from '../pages/coordinator/CoordinatorStreamingControl';
import CoordinatorChessEvents from '../pages/coordinator/CoordinatorChessEvents';


// ─── Organizer Pages ─────────────────────────────────────────────
import CoordinatorManagement from '../pages/organizer/CoordinatorManagement';
import CoordinatorPerformance from '../pages/organizer/CoordinatorPerformance';
import GrowthAnalysis from '../pages/organizer/GrowthAnalysis';
import Meetings from '../pages/organizer/Meetings';
import OrganizerDashboard from '../pages/organizer/OrganizerDashboard';
import OrganizerProfile from '../pages/organizer/OrganizerProfile';
import OrganizerTournament from '../pages/organizer/OrganizerTournament';
import SalesAnalysis from '../pages/organizer/SalesAnalysis';
import StoreMonitoring from '../pages/organizer/StoreMonitoring';

// ─── Admin Pages ─────────────────────────────────────────────────
import AdminDashboard from '../pages/admin/AdminDashboard';
import AdminTournamentManagement from '../pages/admin/AdminTournamentManagement';
import AdminTournamentDetail from '../pages/admin/AdminTournamentDetail';
import AdminCoordinatorManagement from '../pages/admin/AdminCoordinatorManagement';
import AdminCoordinatorDetail from '../pages/admin/AdminCoordinatorDetail';
import AdminOrganizerManagement from '../pages/admin/AdminOrganizerManagement';
import AdminOrganizerDetail from '../pages/admin/AdminOrganizerDetail';
import AdminPlayerManagement from '../pages/admin/AdminPlayerManagement';
import AdminPlayerDetail from '../pages/admin/AdminPlayerDetail';
import AdminPayments from '../pages/admin/AdminPayments';
import AdminOrganizerAnalytics from '../pages/admin/AdminOrganizerAnalytics';
import AdminGrowthAnalytics from '../pages/admin/AdminGrowthAnalytics';
import AdminAddAdmin from '../pages/admin/AdminAddAdmin';

export default function AppRoutes() {
  const location = useLocation();

  return (
    <Routes location={location} key={location.pathname}>
      {/* ═══ Error Page ═══ */}
      <Route path="/error" element={<ErrorPage />} />

      {/* ═══ Public Routes ═══ */}
      <Route path="/" element={<AnimatedPageLayout><Home /></AnimatedPageLayout>} />
      <Route path="/about" element={<AnimatedPageLayout><About /></AnimatedPageLayout>} />
      <Route path="/story" element={<AnimatedPageLayout><ChessStory /></AnimatedPageLayout>} />
      <Route path="/login" element={
        <AnimatedPageLayout variant="flip" style={{ perspective: 1000 }}>
          <Login />
        </AnimatedPageLayout>
      } />
      <Route path="/signup" element={
        <AnimatedPageLayout
          variant="custom"
          customAnimation={{
            initial: location.state?.swapAnimation ? { opacity: 0, rotateY: -90 } : { opacity: 0 },
            animate: { opacity: 1, rotateY: 0 },
            exit: location.state?.swapAnimation ? { opacity: 0, rotateY: 90 } : { opacity: 0 },
            transition: { duration: location.state?.swapAnimation ? 0.6 : 0.5 }
          }}
          style={{ perspective: 1000 }}
        >
          <Signup />
        </AnimatedPageLayout>
      } />
      <Route path="/forgot-password" element={
        <AnimatedPageLayout variant="slideUp"><ForgotPassword /></AnimatedPageLayout>
      } />
      <Route path="/set-password" element={
        <AnimatedPageLayout variant="slideUp"><SetPassword /></AnimatedPageLayout>
      } />
      <Route path="/verify" element={<AnimatedPageLayout><Verify /></AnimatedPageLayout>} />
      <Route path="/contactus" element={<AnimatedPageLayout><ContactUs /></AnimatedPageLayout>} />
      <Route path="/blogs" element={<AnimatedPageLayout><Blogs /></AnimatedPageLayout>} />
      <Route path="/blogs/:id" element={<AnimatedPageLayout><BlogDetail /></AnimatedPageLayout>} />

      {/* ═══ Player Routes ═══ */}
      <Route path="/player/player_dashboard" element={<AnimatedPageLayout><PlayerDashboard /></AnimatedPageLayout>} />
      <Route path="/player/player_profile" element={<AnimatedPageLayout><PlayerProfile /></AnimatedPageLayout>} />
      <Route path="/player/player_tournament" element={<AnimatedPageLayout><PlayerTournament /></AnimatedPageLayout>} />
      <Route path="/player/growth" element={<AnimatedPageLayout><PlayerGrowth /></AnimatedPageLayout>} />
      <Route path="/player/pairings" element={<AnimatedPageLayout><PlayerPairings /></AnimatedPageLayout>} />
      <Route path="/player/rankings" element={<AnimatedPageLayout><PlayerRankings /></AnimatedPageLayout>} />
      <Route path="/player/settings" element={<AnimatedPageLayout><PlayerSettings /></AnimatedPageLayout>} />
      <Route path="/player/player_chat" element={<AnimatedPageLayout><PlayerChat /></AnimatedPageLayout>} />
      <Route path="/player/store" element={<AnimatedPageLayout><PlayerStore /></AnimatedPageLayout>} />
      <Route path="/player/subscription" element={<AnimatedPageLayout><PlayerSubscription /></AnimatedPageLayout>} />
      <Route path="/player/watch" element={<AnimatedPageLayout><PlayerWatch /></AnimatedPageLayout>} />
      <Route path="/player/tv" element={<AnimatedPageLayout><PlayerTv /></AnimatedPageLayout>} />
      <Route path="/player/wallet" element={<AnimatedPageLayout><PlayerWallet /></AnimatedPageLayout>} />

      {/* ═══ Coordinator Routes ═══ */}
      <Route path="/coordinator/coordinator_dashboard" element={<AnimatedPageLayout><CoordinatorDashboard /></AnimatedPageLayout>} />
      <Route path="/coordinator/coordinator_chat" element={<AnimatedPageLayout><CoordinatorChat /></AnimatedPageLayout>} />
      <Route path="/coordinator/coordinator_meetings" element={<AnimatedPageLayout><CoordinatorMeetings /></AnimatedPageLayout>} />
      <Route path="/coordinator/coordinator_profile" element={<AnimatedPageLayout><CoordinatorProfile /></AnimatedPageLayout>} />
      <Route path="/coordinator/enrolled_players" element={<AnimatedPageLayout><EnrolledPlayers /></AnimatedPageLayout>} />
      <Route path="/coordinator/feedback_view" element={<AnimatedPageLayout><FeedbackView /></AnimatedPageLayout>} />
      <Route path="/coordinator/pairings" element={<AnimatedPageLayout><CoordinatorPairings /></AnimatedPageLayout>} />
      <Route path="/coordinator/player_stats" element={<AnimatedPageLayout><CoordinatorPlayerStats /></AnimatedPageLayout>} />
      <Route path="/coordinator/rankings" element={<AnimatedPageLayout><CoordinatorRankings /></AnimatedPageLayout>} />
      <Route path="/coordinator/store_management" element={<AnimatedPageLayout><StoreManagement /></AnimatedPageLayout>} />
      <Route path="/coordinator/store_management/product/:id" element={<AnimatedPageLayout><ProductDetails /></AnimatedPageLayout>} />
      <Route path="/coordinator/tournament_management" element={<AnimatedPageLayout><TournamentManagement /></AnimatedPageLayout>} />
      <Route path="/coordinator/tournaments/:id" element={<AnimatedPageLayout><TournamentDetails /></AnimatedPageLayout>} />
      <Route path="/coordinator/tournament_complaints" element={<AnimatedPageLayout><TournamentComplaints /></AnimatedPageLayout>} />
      <Route path="/coordinator/event_calendar" element={<AnimatedPageLayout><EventCalendar /></AnimatedPageLayout>} />
      <Route path="/coordinator/global_calendar" element={<AnimatedPageLayout><EventCalendar /></AnimatedPageLayout>} />
      <Route path="/coordinator/blogs" element={<AnimatedPageLayout><CoordinatorBlogs /></AnimatedPageLayout>} />
      <Route path="/coordinator/blogs/:id" element={<AnimatedPageLayout><CoordinatorBlogDetail /></AnimatedPageLayout>} />
      <Route path="/coordinator/streaming_control" element={<AnimatedPageLayout><CoordinatorStreamingControl /></AnimatedPageLayout>} />
      <Route path="/coordinator/chess_events" element={<AnimatedPageLayout><CoordinatorChessEvents /></AnimatedPageLayout>} />
      
      {/* ═══ Organizer Routes ═══ */}
      <Route path="/organizer/coordinator_management" element={<AnimatedPageLayout><CoordinatorManagement /></AnimatedPageLayout>} />
      <Route path="/organizer/coordinator_performance" element={<AnimatedPageLayout><CoordinatorPerformance /></AnimatedPageLayout>} />
      <Route path="/organizer/growth_analysis" element={<AnimatedPageLayout><GrowthAnalysis /></AnimatedPageLayout>} />
      <Route path="/organizer/meetings" element={<AnimatedPageLayout><Meetings /></AnimatedPageLayout>} />
      <Route path="/organizer/organizer_dashboard" element={<AnimatedPageLayout><OrganizerDashboard /></AnimatedPageLayout>} />
      <Route path="/organizer/organizer_profile" element={<AnimatedPageLayout><OrganizerProfile /></AnimatedPageLayout>} />
      <Route path="/organizer/organizer_tournament" element={<AnimatedPageLayout><OrganizerTournament /></AnimatedPageLayout>} />
      <Route path="/organizer/sales_analysis" element={<AnimatedPageLayout><SalesAnalysis /></AnimatedPageLayout>} />
      <Route path="/organizer/store_monitoring" element={<AnimatedPageLayout><StoreMonitoring /></AnimatedPageLayout>} />

      {/* ═══ Admin Routes ═══ */}
      <Route path="/admin/admin_dashboard" element={<AnimatedPageLayout><AdminDashboard /></AnimatedPageLayout>} />
      <Route path="/admin/admin_tournament_management" element={<AnimatedPageLayout><AdminTournamentManagement /></AnimatedPageLayout>} />
      <Route path="/admin/tournament/:id" element={<AnimatedPageLayout><AdminTournamentDetail /></AnimatedPageLayout>} />
      <Route path="/admin/coordinator_management" element={<AnimatedPageLayout><AdminCoordinatorManagement /></AnimatedPageLayout>} />
      <Route path="/admin/coordinator/:email" element={<AnimatedPageLayout><AdminCoordinatorDetail /></AnimatedPageLayout>} />
      <Route path="/admin/organizer_management" element={<AnimatedPageLayout><AdminOrganizerManagement /></AnimatedPageLayout>} />
      <Route path="/admin/organizer/:email" element={<AnimatedPageLayout><AdminOrganizerDetail /></AnimatedPageLayout>} />
      <Route path="/admin/player_management" element={<AnimatedPageLayout><AdminPlayerManagement /></AnimatedPageLayout>} />
      <Route path="/admin/player/:email" element={<AnimatedPageLayout><AdminPlayerDetail /></AnimatedPageLayout>} />
      <Route path="/admin/payments" element={<AnimatedPageLayout><AdminPayments /></AnimatedPageLayout>} />
      <Route path="/admin/growth_analytics" element={<AnimatedPageLayout><AdminGrowthAnalytics /></AnimatedPageLayout>} />
      <Route path="/admin/add_admin" element={<AnimatedPageLayout><AdminAddAdmin /></AnimatedPageLayout>} />


      {/* ═══ Catch-all 404 ═══ */}
      <Route
        path="*"
        element={<Navigate to="/error?title=Not%20Found&message=The%20page%20you%20requested%20does%20not%20exist.&code=404" replace />}
      />
    </Routes>
  );
}
