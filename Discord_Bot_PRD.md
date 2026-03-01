# Multi-Server Discord Bot – Full Specification & Context

## 1. High-Level Overview
This project is a **fully custom Discord bot** designed for **multi-server usage**, with **most configuration done directly inside Discord** using:
- Slash commands
- Buttons
- Select menus (dropdowns)
- Modals

❌ No web dashboard  
✅ MongoDB for persistent storage  
✅ Reusable across different servers  
✅ Special logic for one designated **MC Shop server**

The bot is modular and should be built like a **SaaS-style system**, not a simple utility bot.

---

## 2. Core Features (Global)

### 2.1 Welcome System
- Customizable welcome embed:
  - Text
  - Image
  - Colors
  - Fields
- Fully configurable per server via Discord commands
- Sent when a user joins

---

### 2.2 BuiltByBit Update Alerts
- Webhook-based (single BuiltByBit profile)
- Channel-selectable per server
- Toggleable (on/off)
- Sends alerts when a new resource/plugin is uploaded

---

### 2.3 YouTube Alerts
- Channel-selectable
- Sends message/embed when a new video is uploaded

---

### 2.4 Counting System
- Per-server counting channel
- Must validate correct next number
- Reset logic on failure (optional future extension)

---

### 2.5 Keyword-Based Auto Replies
- Configurable keyword → response
- Stored in MongoDB
- Simple string match (no regex required)
- Per server

---

### 2.6 Embedded Rules & Announcement Messages
- Admin can create stored embeds
- Re-sendable via command
- Used for rules, info, announcements

---

### 2.7 Reaction Roles
- Embed + reaction → role mapping
- Fully configurable in Discord
- Per server

---

## 3. Advanced Ticket System (Core System)

### 3.1 General Rules
- Multi-server compatible
- Users are limited to:
  **1 open ticket per category**
- Multiple ticket panels can exist:
  - In different channels
  - With different dropdown options

---

### 3.2 Ticket Panels
- Button-based panel message
- Setup command example:
  `/set-ticket-panel`
- Panel contains:
  - Button to open ticket flow
  - Dropdown (select menu) for category selection

Each panel stores:
- Channel ID
- Allowed categories
- Panel ID (unique per server)

---

### 3.3 Categories
Each category defines:
- Discord category ID (existing category)
- Emoji (shown in ticket name)
- Behavior flags
- Assigned freelancer roles
- Linked modal (form)

Categories **can share the same modal** if configured to do so.

---

### 3.4 Modals (Forms)
- Fully configurable questions
- Stored in MongoDB
- Triggered after category selection
- Answers are:
  - Posted inside the ticket channel
  - Included in transcript

---

### 3.5 Ticket Creation Flow
1. User clicks panel button
2. User selects category from dropdown
3. Bot checks:
   - If user already has an open ticket in this category → deny
4. Modal opens
5. Ticket channel is created:
   - Name: `<emoji> username`
   - Under selected Discord category
6. Bot sends:
   - Embed with all form answers
   - Pings assigned admins/freelancers
   - Action buttons (context-dependent)

---

## 4. Commission System (MC Shop Server Only)

### 4.1 MC Shop Identification
- A specific **server ID** is stored in DB
- Commission logic is enabled ONLY for this server

---

### 4.2 Commission Categories
Only categories marked as `commission: true` will:
- Show commission buttons
- Enable commission workflow

Other categories (support, general, etc.):
- Do NOT show commission buttons

---

### 4.3 Buttons Inside Commission Tickets
- Close Ticket
- Ping Freelancers
  - Manual
  - 12-hour cooldown
- Start Commission
- End Commission

---

### 4.4 Freelancer Assignment Logic
- Only users with assigned freelancer roles can start commissions
- **First freelancer to click “Start Commission” becomes assigned**
- Assignment is stored in MongoDB
- Buttons disable for other freelancers once assigned

---

### 4.5 Start Commission Flow
1. Freelancer clicks “Start Commission”
2. Modal opens:
   - Price
   - Deadline
3. Commission state becomes `ACTIVE`
4. Ticket restrictions:
   - User cannot close the ticket
   - Only assigned freelancer can end commission

---

### 4.6 End Commission Flow
1. Assigned freelancer clicks “End Commission”
2. Bot sends confirmation message
3. Customer must confirm completion
4. Only after confirmation:
   - Ticket can close

---

### 4.7 Overrides
- A **hardcoded owner ID**:
  - Can force close
  - Can override commission state
- Admins cannot override unless explicitly coded later

---

## 5. Ticket Closure & Transcripts

### 5.1 Closure Behavior
When a ticket is closed:
1. Generate HTML transcript using:
   `discord-html-transcripts`
2. Upload transcript (GitHub Pages integration)
3. Send transcript link/file to user
4. Delete ticket channel

Transcript is the **single source of truth** for logs.

---

## 6. Data Storage (MongoDB)

All data must be stored per server:
- Ticket panels
- Categories
- Modals
- Open tickets
- Commission state
- Assigned freelancers
- Keyword replies
- Welcome configs
- Alert configs

Design schemas for **scalability and reuse**.

---

## 7. Configuration Philosophy
- Most configuration happens inside Discord
- Some values are intentionally static:
  - Owner override ID
  - MongoDB connection
  - BuiltByBit webhook logic
  - Transcript hosting setup

Goal: **Convenience without sacrificing reliability**

---

## 8. Architectural Notes (Important)
- Treat this as a **state machine**:
  - Ticket states
  - Commission states
- Strict permission checks on every interaction
- Buttons & modals must validate state before acting
- Avoid race conditions (especially Start Commission)

This is a **commercial-grade bot**, not a hobby project.

---

## 9. Non-Goals
- No web dashboard
- No prefix commands
- No full regex auto-reply system
- No multi-profile BuiltByBit support (single profile only)

---

## 10. End Goal
A reusable, scalable, high-end Discord bot suitable for:
- Commission servers
- Support servers
- Future client reuse
