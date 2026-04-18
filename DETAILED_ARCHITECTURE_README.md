# ChessHive: Comprehensive Feature & Domain-Driven Design (DDD) Specification

Welcome to the comprehensive documentation for **ChessHive**, a robust, full-stack chess platform tailored for campus communities. This document provides an exhaustive breakdown of every feature, function, and underlying Domain-Driven Design (DDD) architectural modeling that powers the platform.

---

## Part 1: Exhaustive Feature and Function Breakdown

ChessHive operates on a strict Role-Based Access Control (RBAC) system. The platform provides distinctly different interfaces, features, and capabilities depending on the user's role.

### 1. Public / Anonymous Features
* **Landing & Marketing Pages:** Animated and responsive Home, About Us, and Chess Story pages using Framer Motion.
* **Authentication Flow:** 
  * Registration with email and OTP (One-Time Password) verification.
  * Secure Login utilizing JWT (Access and Refresh tokens).
  * Forgot Password workflow with email OTP validation and secure password reset.
* **Public Content:** Access to the public Blog section detailing platform news and chess strategies.
* **Contact & Support:** A robust Contact Us form that feeds directly to the Admin support queue.

### 2. Player Features
* **Personal Dashboard:** An immersive UI (`AnimatedSidebar`, `ChessBackground`, `PlayerTheme`) displaying rapid overviews of wallet balance, upcoming matches, and active tournaments.
* **Identity & Profile:** Profile management, avatar uploads (via Cloudinary), and personal chess ranking/rating tracking.
* **Tournament Enrollment:** Browse active tournaments, view rule sets, register as an individual (`Player`) or as a `Team`.
* **Gameplay & Pairings:** View automated Swiss Pairings, track live match timers, and submit/verify match results.
* **Live Match Interaction:** Receive real-time WebSocket prompts (`LiveMatchInviteOverlay`) when a coordinator initiates a match.
* **E-Commerce & Store:** Browse campus chess merchandise, manage a shopping cart, and place orders.
* **Digital Wallet & Subscriptions:** Top up the digital wallet using real money (Razorpay/Payment Gateway integration) and purchase premium platform subscriptions.
* **Engagement & Social:** Access live global chat, match-specific chat (`ChatChoiceEmblem`), and submit platform feedback or complaints.
* **Analytics:** View personal growth charts (Win/Loss ratios, ELO progression) powered by Chart.js.

### 3. Coordinator Features (Tournament & Content Managers)
* **Tournament Lifecycle Management (CRUD):** Create, Read, Update, and Delete tournaments. Set capacity, entry fees, and scheduling rules.
* **Pairings & Standings:** Trigger the `SwissPairing` algorithm to automatically generate rounds based on points. Arbitrate match score disputes.
* **Player Logistics:** View enrolled players, manage team compositions, and handle kick/ban behaviors.
* **E-Commerce Operations:** Manage the product catalog, update inventory, process store orders, and resolve customer product complaints.
* **Content Publishing:** Write, edit, and publish blogs, announcements, and global notifications.
* **Event Scheduling:** Maintain the platform calendar, schedule meetings (virtual/physical) for the campus community.
* **Streaming Control:** Manage and broadcast live chess events or TV integrations on the platform.

### 4. Organizer Features (Executive Oversight)
* **Staff Management:** Hire, assign, and manage Coordinators. Assess Coordinator performance.
* **Tournament Approval Workflow:** Review and approve/reject tournament proposals submitted by Coordinators before they go live to Players.
* **Financial & Growth Analytics:** View high-level metrics for ticket sales, store revenue, user growth, and tournament participation trends.
* **Meeting Management:** Schedule high-level administrative meetings using the internal scheduling tools.

### 5. Admin Features (Superusers)
* **System-Wide Dashboard:** God-eye view of active sockets, server health, error logs, and platform operations.
* **Total Role Management:** Ability to create, mutate, or suspend any user, player, coordinator, or organizer.
* **Support Triage:** Manage the Contact Us queue, delegating technical support tickets or responding directly via integrated email services.
* **Global Analytics & Auditing:** Complete visibility into all financial transactions, order histories, and backend request logs.

---

## Part 2: Domain-Driven Design (DDD) Architecture

To manage this complex ecosystem cleanly, the backend is strictly structured around **Bounded Contexts**.

### 1. Bounded Contexts

**A. Identity & Access Management (IAM) Context**
* **Responsibility:** Secure entry, authentication (JWT/OTP), authorization, session management, and role validation.
* **Boundary:** Any request entering the system must pass through IAM (`roleAuth.js`, `errorMiddleware.js`).

**B. Tournament & Matchmaking Context (Core Domain)**
* **Responsibility:** The heartbeat of ChessHive. Manages tournament lifecycles, player registrations, team formations, round generation, and match result validation.
* **Boundary:** Operates heavily around the `TournamentModel.js` and ` swissPairing.js`.

**C. E-Commerce & Billing Context**
* **Responsibility:** Handles monetary value exchange. Covers the internal merchandise store, user digital wallets, Razorpay checkout sessions, and premium subscriptions.
* **Boundary:** Isolated securely so that a failure in the store catalog does not prevent a chess match from occurring.

**D. Social & Communication Context**
* **Responsibility:** Real-time user connectivity. Encompasses WebSocket infrastructures for live chat, match invites, system announcements, and transactional emails.
* **Boundary:** Acts as a generic subdomain, universally responding to event triggers from other contexts.

**E. Content & Platform Management Context**
* **Responsibility:** Manages static and dynamic operational data such as blogs, contact forms, server logs, and file storage links (Cloudinary).

---

### 2. Context Mappings

* **IAM Context $\rightarrow$ [All Contexts] (Customer-Supplier):** All downstream contexts (Tournament, E-Commerce, Communication) rely exclusively on IAM to supply the authenticated `User` context and permissions.
* **Tournament Context $\leftrightarrow$ E-Commerce Context (Shared Kernel / Customer-Supplier):** When a tournament has an entry fee, the Tournament Context issues a request to the E-Commerce Context to deduct from the user's wallet or launch a Razorpay modal. They share a common understanding of a `Transaction`.
* **Tournament Context $\rightarrow$ Communication Context (Conformist):** When the `SchedulerService` starts a new tournament round, the Tournament Context emits an event. The Communication Context conforms to this by instantly broadcasting WebSocket `LiveMatchInviteOverlay` packets to paired players.
* **Content Context $\leftrightarrow$ Communication Context (Shared Kernel):** When a Coordinator creates a Blog or Announcement in the Content Context, the Communication Context detects it and dispatches broad platform notifications.

---

### 3. Entities, Value Objects, and Services (Per Sub-Model)

#### A. Identity & Access Management (IAM) Context
* **Entities:**
  * `User` (Id, Email, PasswordHash, IsVerified) - The root individual.
  * `Token` (Id, UserId, RefreshString, Expiry) - Tracks active login sessions.
* **Value Objects:**
  * `Role` (Enum: Admin, Organizer, Coordinator, Player)
  * `Credentials` (Email + Encrypted Password)
  * `OTP` (6-digit code + Expiry Timestamp)
* **Domain Services:**
  * `AuthService`: Orchestrates the signing up, logging in, and OTP workflows.
  * `JwtService`: Encrypts/Decrypts securely signed JSON Web Tokens.

#### B. Tournament & Matchmaking Context
* **Entities:**
  * `Tournament` (Id, Name, StartDate, Capacity, Status, EntryFee)
  * `Player` (Id, UserId, ELO_Rating, MatchesPlayed) - Domain-specific extension of a User.
  * `Team` (Id, Name, CaptainId, Array<MemberIds>)
* **Value Objects:**
  * `MatchScore` (WhiteScore, BlackScore, IsDraw)
  * `Pairing` (WhitePlayerId, BlackPlayerId, BoardNumber)
  * `TournamentStatus` (Enum: Upcoming, RegistrationOpen, InProgress, Completed)
* **Domain Services:**
  * `SwissPairingService`: Contains the complex mathematical algorithms to match players of similar point standings without repeating matchups.
  * `SchedulerService`: A cron-based service that automatically advances tournament states based on time.

#### C. E-Commerce & Billing Context
* **Entities:**
  * `Order` (Id, UserId, TotalAmount, ProductList, Status)
  * `Product` (Id, Name, SKU, Price, InventoryCount)
  * `Wallet` (Id, UserId, CurrentBalance)
* **Value Objects:**
  * `Currency` (Amount, CurrencyType e.g., INR)
  * `TransactionStatus` (Enum: Pending, Capturing, Success, Failed, Refunded)
* **Domain Services:**
  * `PaymentService`: Aggregates the costs of cart items or tournament fees.
  * `RazorpayService`: Communicates strictly with the external Razorpay API to generate order IDs and verify webhook signatures.

#### D. Social & Communication Context
* **Entities:**
  * `ChatSession` (Id, TournamentId, CustomName) - A specific room.
  * `SystemLog` (Id, Action, Timestamp, ActorId)
* **Value Objects:**
  * `Message` (SenderId, Content, Timestamp)
  * `SocketPayload` (EventName, DataPayload)
* **Domain Services:**
  * `SocketService`: Manages Socket.IO connection pools, room subscriptions, and real-time event emission.
  * `EmailService`: Utilizes node-mailer to send constructed HTML templates (OTPs, Welcome emails).

#### E. Content & Platform Management Context
* **Entities:**
  * `Blog` (Id, AuthorId, Title, HTMLContent, PublishedDate)
  * `StorageFile` (Id, CloudinaryURL, FileType, UploaderId)
* **Value Objects:**
  * `Category` (e.g., 'Strategy', 'News', 'Updates')
* **Domain Services:**
  * `CloudinaryUploadService`: Buffers memory files and streams them to an external CDN.

---

### 4. Cardinality Ratios for Entities

Understanding the relational database mappings underlying MongoDB references:

* **User (1) $\rightarrow$ (1) Player Profile:** A system user represents exactly one chess player.
* **User (1) $\rightarrow$ (1) Wallet:** A user possesses uniquely one financial wallet.
* **User (1) $\rightarrow$ (N) Orders:** A user can make zero to infinite purchases.
* **User (1) $\rightarrow$ (N) Tokens:** A user can be logged in across multiple devices (Laptop, Mobile).
* **Tournament (1) $\rightarrow$ (N) Players:** A tournament hosts multiple players. Map: `Player (N) $\rightarrow$ (M) Tournaments` (Many-to-Many).
* **Team (1) $\rightarrow$ (N) Players:** A team has multiple players, but a player in a specific tournament can only be on *one* team.
* **Tournament (1) $\rightarrow$ (N) ChatSessions:** Usually 1 global chat, and N match-specific chats.
* **Organizer (1) $\rightarrow$ (N) Tournaments:** An organizer can oversee multiple tournaments.
* **Tournament (1) $\rightarrow$ (N) Coordinators:** A tournament can have multiple staff members assigned to it.
* **Order (1) $\rightarrow$ (N) Products:** An order cart can contain multiple unique products.

---

### 5. Aggregates and Aggregate Roots

Aggregates define consistency boundaries ensuring the system state never becomes corrupt during concurrent operations.

**1. The User Aggregate**
* **Root:** `User`
* **Boundary:** Includes `Token`, `Wallet`, and base `Player` statistics.
* **Invariants (Consistency Rules):** 
  * A `Wallet` cannot exist if the `User` is deleted.
  * Financial transactions affecting the `Wallet` must lock the row to prevent race conditions during concurrent top-ups.
  * Changing a User's `Role` must immediately invalidate all associated `Tokens`.

**2. The Tournament Aggregate**
* **Root:** `Tournament`
* **Boundary:** Includes `Team` formations, Enrolled `Players` list, and generated `Pairings`.
* **Invariants (Consistency Rules):** 
  * A `Player` cannot be added to a `Team` unless they are first enrolled in the `Tournament`.
  * The `SwissPairing` algorithm *cannot* be executed for Round N until every `MatchScore` in Round N-1 has been explicitly submitted and validated.
  * Tournament capacity cannot be exceeded; enrollment operations are strictly atomic.

**3. The Order Aggregate**
* **Root:** `Order`
* **Boundary:** Includes specific `Product` pricing snapshots and `TransactionStatus`.
* **Invariants (Consistency Rules):** 
  * The price of items inside an `Order` are snapshotted at the time of creation. If the global `Product` price changes tomorrow, historical `Orders` are unaffected.
  * Once an `Order` reaches `Success` status, it is immutable. Changes can only occur via discrete `Refund` processes.

---

*Generated as the complete Architectural and Domain-Driven Design master document for ChessHive System Engineering.*