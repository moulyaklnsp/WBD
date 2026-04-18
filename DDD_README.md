# ChessHive - Domain-Driven Design (DDD) Architecture Overview

## Project Overview
**ChessHive** is a comprehensive, full-stack chess tournament and campus community platform. It facilitates role-based workflows for `players`, `coordinators`, `organizers`, and `admins`. The system handles everything from tournament organization and Swiss Pairings to integrated e-commerce (store/wallet flows), live chat, streaming, and announcements. 

This document outlines the software architecture of ChessHive through the lens of Domain-Driven Design (DDD).

---

## 1. Bounded Contexts
Based on the platform's multi-faceted feature set, the domain is logically partitioned into the following **Bounded Contexts**:

### A. Identity & Access Management (IAM) Context
Handles all authentication, authorization, role definitions (`admin`, `organizer`, `coordinator`, `player`), and security.
### B. Tournament Organization Context (Core Domain)
The heart of the application. It governs the entire lifecycle of a tournament, participant enrollment, dynamic matching (Swiss Pairing), game validation, and leaderboards.
### C. E-Commerce & Billing Context
Manages the internal store, user wallets, top-ups, subscriptions, and tournament entry fee processing (Razorpay integration).
### D. Communication & Engagement Context
Handles real-time interactions including live matching overlays, global/match chat, announcements, meetings, and system notifications/emails.
### E. Content Management Context
Manages static and dynamic informational content such as Blogs, Contact Us queries, and static assets (Cloudinary).

---

## 2. Context Mappings
Understanding how the bounded contexts interact with one another:

* **IAM Context $\rightarrow$ [All Contexts] (Customer-Supplier):** Every other context requires the IAM context to identify the actor and validate their role permissions.
* **Tournament Context $\leftrightarrow$ E-Commerce Context (Shared Kernel / Customer-Supplier):** When a player registers for a paid tournament, the Tournament Context invokes the E-Commerce Context to process the transaction.
* **Tournament Context $\rightarrow$ Communication Context (Conformist):** When a tournament round starts or a pairing is created, the Communication Context listens for these events to send WebSockets triggers (live invites) and emails.
* **Content Management Context (Separate Way):** Operates largely independent of the core tournament logic, consumed universally by all users.

---

## 3. Entities, Value Objects, and Domain Services (Per Context)

### A. Identity & Access Management (IAM) Context
* **Entities:**
  * `User`: Represents a uniquely identified individual in the system.
  * `Token`: Represents an active authentication session (Access/Refresh).
* **Value Objects:**
  * `Credentials`: Encrypted password hashes and OTP values.
  * `Role`: Attributes defining system permissions (`admin`, `organizer`, `coordinator`, `player`).
* **Domain Services:**
  * `AuthService`: Manages login, signup, OTP verification, and password resets.
  * `JwtService`: Handles cryptographic token generation and validation.

### B. Tournament Organization Context
* **Entities:**
  * `Tournament`: Represents a scheduled chess event with rules, rounds, and capacity limits.
  * `PlayerProfile`: The domain-specific representation of a user participating in matches.
  * `Team`: A grouping of players competing under a single banner.
* **Value Objects:**
  * `MatchScore`: The structural outcome of a match (e.g., 1-0, 0.5-0.5).
  * `PairingRules`: Parameters dictating how the Swiss algorithm matches players.
* **Domain Services:**
  * `SwissPairingService`: The algorithmic service that calculates next-round pairings based on current standings.
  * `SchedulerService`: Handles automated interval triggers (e.g., starting rounds on time).

### C. E-Commerce & Billing Context
* **Entities:**
  * `Order`: Represents a purchase of a product from the store or a tournament ticket.
  * `Wallet`: Represents a user's stored digital currency/credits.
  * `Product`: An item available in the campus community store.
* **Value Objects:**
  * `CurrencyAmount`: Standardizes monetary values (e.g., INR, USD).
  * `TransactionStatus`: Enum indicating `Pending`, `Success`, `Failed`, or `Refunded`.
* **Domain Services:**
  * `PaymentService` / `RazorpayService`: Interfaces directly with external payment gateways for top-ups and checkouts.

### D. Communication & Engagement Context
* **Entities:**
  * `ChatSession`: Represents a chat room (could be global or match-specific).
  * `Meeting`: Represents a scheduled virtual or physical gathering.
  * `Announcement`: Broad system alerts published by coordinators/admins.
* **Value Objects:**
  * `MessagePayload`: The content, sender, and timestamp of a chat interaction.
* **Domain Services:**
  * `SocketService`: Manages real-time WebSockets connections for instantaneous updates (Live Invites, Chat).
  * `EmailService`: Dispatches OTPs and asynchronous notifications securely.

---

## 4. Aggregates

In Domain-Driven Design, Aggregates ensure consistency boundaries.

1. **User Aggregate (Root: `User`)**
   * **Encapsulates:** `Token`, `Wallet`, `PlayerProfile`.
   * **Consistency Rule:** A wallet cannot exist without an owning user. Role changes must instantly invalidate incompatible tokens.
2. **Tournament Aggregate (Root: `Tournament`)**
   * **Encapsulates:** `Team`, `Match/Pairing`.
   * **Consistency Rule:** Swiss pairings cannot be generated for Round *N+1* until all matches in Round *N* have authoritative `MatchScore` resolutions.
3. **Order Aggregate (Root: `Order`)**
   * **Encapsulates:** External Gateway Identifiers (Razorpay Signature).
   * **Consistency Rule:** An order must be strictly immutable once marked as 'Paid'.

---

## 5. Cardinality Relationships (Entities)

* **User (1) $\leftrightarrow$ (1) Player Profile:** A User has precisely one functional player identity.
* **User (1) $\leftrightarrow$ (1) Wallet:** A User holds one virtual wallet for platform transactions.
* **User (1) $\leftrightarrow$ (N) Orders:** A User can execute multiple store purchases or enrollment transactions.
* **Tournament (1) $\leftrightarrow$ (N) Players/Teams:** A tournament encompasses multiple competing entities.
* **Team (1) $\leftrightarrow$ (N) Players:** A team is composed of multiple individual players.
* **Tournament (1) $\leftrightarrow$ (1) Organizer:** A tournament is officially owned/approved by one Organizer.
* **Tournament (1) $\leftrightarrow$ (N) Coordinators:** A tournament can be managed by multiple delegated Coordinators.

---

*This document was auto-generated as a Domain-Driven Design layout for the ChessHive v1.0.2 system.*