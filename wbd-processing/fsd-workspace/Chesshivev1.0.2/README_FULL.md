<xaiArtifact artifact_id="46b5ba91-a3b3-4109-945e-ee011b4f04d1" artifact_version_id="6053d682-1ad0-4dd5-bf38-1a47cf9a21e6" title="README.md" contentType="text/markdown">

# ChessHive.v1.0.2 README

## Group ID
3

## Project Title
ChessHive

## SPOC
- Name:P Moulya 
- Email: moulya.p23@iiits.in  
- Roll No: S20230010170

## Team Members & Roles
- **P. Moulya (Coordinator)**:  
  - Functionalities: Tournament addition, Products addition in store, Showing enrolled players, Pairings, Rankings, Meetings addition  
  - Frontend/UI: Coordinator dashboard pages, Dynamic DOM updates for pairings & rankings  
  - New Functionality: Requesting feedback, Profile deletion/restoration  
  - Status: Completed  

- **Tejaswi (Organizer)**:  
  - Functionalities: Tournament approval, Reviewing product sales, Viewing college stats, Meetings addition, Removal/restoration of coordinators, Profile deletion/restoration, Sales analysis tool  
  - Frontend/UI: Organizer dashboard pages, Sales & stats charts, Dynamic updates  
  - New Functionality: Sales analysis tool, Profile deletion/restoration  
  - Status: Completed  

- **Vivash (Player)**:  
  - Functionalities: Tournament joining (individual & team), Buying products, Viewing pairings & rankings, Profile deletion/restoration, Growth analysis, Subscription management  
  - Frontend/UI: Player dashboard pages, Match pairing views, Rankings display  
  - New Functionality: Peer comparison tool, Profile deletion/restoration  
  - Status: Completed  

- **Neelukumar (Page Routings)**:  
  - Backend Functionalities: Login, Signup, and Contact Us routes; routes for static page rendering and API for page data loading  
  - Frontend/UI: Contact Us page, Login page, Signup page, About Us page, Index (Landing) page  
  - Status: Completed  

- **Ashlesha (Admin)**:  
  - Functionalities: Tournament monitoring, Removal/restoration of organizers, coordinators, and players, Viewing sales and payments reports  
  - Frontend/UI: Admin dashboard pages, Monitoring & reports UI  
  - New Functionality: Player deletion and restoration of coordinators, organizers, and players  
  - Status: Completed  

## How to Run (Local)
### Prerequisites
- Git installed  
- Node.js (v18+) and npm (or yarn)  
- A modern web browser (Chrome/Firefox recommended)  

### Steps
1. Clone the repository:  
   ```
   git clone https://github.com/moulyaklnsp/ChessHive.v1.0.2.git
   ```
2. Navigate to the project directory:  
   ```
   cd ChessHive.v1.0.2
   ```
3. Install dependencies:  
   ```
   npm install
   ```
4. Start the development server:  
   ```
   npm start
   ```
5. Open `http://localhost:3000` in your browser.  

## Key Files and Functions
### Key Files
- **`app.js`**: Main application entry point; initializes Express server, sets up middleware, and routes for all user roles (player, coordinator, admin, organizer).  
- **`player_app.js`**: Handles player-specific frontend logic, including tournament joining, product purchases, viewing pairings/rankings, peer comparison, and profile management.  
- **`coordinator_app.js`**: Manages coordinator-specific frontend logic, including tournament/product addition, enrolled players display, pairings/rankings updates, and feedback requests.  
- **`admin_app.js`**: Implements admin-specific frontend logic for tournament monitoring, user role management (removal/restoration), and sales/payments reports.  
- **`organizer_app.js`**: Handles organizer-specific frontend logic, including tournament approvals, sales analysis, college stats, coordinator management, and dynamic dashboard updates.
## Demo Link & Exact Timestamps
- Demo Link: https://drive.google.com/file/d/1XxVUbfsX9LrncBCGtF0fQfCd7agCQfW1/view?usp=drivesdk
- Timestamps:  
  - 00:00–00:42 — Title slide (Group ID, Project Title, Team lead) and  project business case
  - 00:42–02:14 — Form Validation demo + showed code
  - 02:14–03:36 — Dynamic HTML demo + showed code
  - 03:36–05:54 — Async Data Handling demos (three flows) + network tab shown
  - 05:54–06:50 — Per-member contribution
  - 06:50–07:28 — Wrap-up and where artifacts/evidence are located

## Evidence Locations
- Network Evidence: `\group3_CHESSHIVE_midreview\network_evidence` (screenshots of API calls via browser dev tools)  
- Git Logs: `\group3_CHESSHIVE_midreview\git-logs.txt` (generated via `git log --oneline > git-logs.txt`)  

</xaiArtifact>