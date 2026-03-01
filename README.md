diff --git a/README.md b/README.md
index c376920d70e4116bdc7dac38df59bcfcce0f5013..411e40bdbb50b6f183b1fa88d6a05605c87cf57b 100644
--- a/README.md
+++ b/README.md
@@ -1,125 +1,131 @@
 # Doom Wen Discord Bot
 
-A production-grade, multi-server Discord bot with advanced ticketing and commission workflows.
+A production-ready Discord bot for support operations, commission workflows, and community automation across multiple servers.
 
-## Features
+## Overview
 
-- **Multi-Server Support**: Works across multiple Discord servers with per-server configuration
-- **Advanced Ticket System**: Panel-based ticket creation with categories and modal forms
-- **Commission Workflow**: MC Shop server exclusive commission management with freelancer assignment
-- **Welcome System**: Customizable welcome messages with placeholders
-- **Alert System**: BuiltByBit and YouTube upload notifications
-- **Counting System**: Per-server counting channel with validation
-- **Keyword Auto-Replies**: Automatic responses to trigger keywords
-- **Reaction Roles**: Emoji-based role assignment
-- **Stored Embeds**: Reusable embeds for announcements and rules
+Doom Wen is built with TypeScript, Discord.js v14, and MongoDB. It combines structured ticket handling, commission lifecycle tracking, moderation tooling, and engagement systems into one bot.
 
-## Setup
+## Core Systems
 
-### Prerequisites
+- **Ticket System** — Configurable ticket panels, category routing, optional intake modals, participant management, and transcript generation.
+- **Commission Workflow** — Commission-specific ticket flow with claim/start, quote handling, completion confirmation, and dashboard re-posting.
+- **Welcome Automation** — Embed-based welcome messages with placeholders and media support.
+- **YouTube Alerts** — Polling-based upload notifications with ping modes (`none`, `@here`, `@everyone`, or role).
+- **Counting Game** — Managed counting channel with set/reset/disable controls.
+- **Keyword Auto-Replies** — Trigger-response system for recurring questions.
+- **Reusable Embeds** — Save, send, and remove server-specific announcement embeds.
+- **Reaction Roles** — Role assignment system via emoji interactions.
+- **Admin Controls** — Runtime cache reload and dashboard link command.
 
-- Node.js 18+
-- MongoDB (local or Atlas)
-- Discord Bot Token
-- GitHub Token (for transcript hosting)
+## Command Reference
 
-### Installation
+### Ticket & Commission
 
-```bash
-# Clone the repository
-cd doom-wen-discord-bot
+| Command | Purpose |
+|---|---|
+| `/set-ticket-panel` | Create or update the ticket panel message and button behavior. |
+| `/add-category` | Add a ticket category (roles, destination category, commission flag, modal linkage). |
+| `/remove-category` | Remove an existing ticket category. |
+| `/add-modal` | Create an intake modal (up to 3 configurable questions). |
+| `/remove-modal` | Delete a configured modal by ID. |
+| `/close-ticket` | Close the current ticket and trigger transcript handling. |
+| `/ticket-add-user` | Add a user to the current ticket channel. |
+| `/commission-dashboard` | Re-send the commission dashboard in the current commission ticket. |
 
-# Install dependencies
-npm install
+### Community & Notifications
 
-# Copy environment template
-cp .env.example .env
+| Command | Purpose |
+|---|---|
+| `/configure-welcome` | Enable/disable welcome system and configure embed content. |
+| `/set-youtube-channel` | Enable, disable, or inspect YouTube alert configuration. |
+| `/set-counting-channel` | Set counting channel, reset count, or disable counting. |
+| `/reaction-role` | Manage reaction-role messages and emoji-role mappings. |
 
-# Edit .env with your credentials
-```
+### Moderation & Content
 
-### Environment Variables
+| Command | Purpose |
+|---|---|
+| `/add-keyword-reply` | Add a keyword trigger and automatic response. |
+| `/remove-keyword-reply` | Remove a configured keyword trigger. |
+| `/create-embed` | Create and save a reusable embed template. |
+| `/send-embed` | Send a saved embed to a selected channel. |
+| `/remove-embed` | Delete a saved embed template. |
 
-```env
-DISCORD_TOKEN=your_bot_token
-DISCORD_CLIENT_ID=your_client_id
-MONGODB_URI=mongodb://localhost:27017/doom-wen-bot
-OWNER_ID=your_discord_user_id
+### Administration
 
-# GitHub Pages Transcripts
-GITHUB_TOKEN=your_github_pat
-GITHUB_REPO=username/transcript-repo
-TRANSCRIPT_BASE_URL=https://username.github.io/transcript-repo
-```
+| Command | Purpose |
+|---|---|
+| `/admin reload` | Reload bot configuration caches at runtime. |
+| `/dashboard` | Send the Doom Wen dashboard access message. |
 
-### Running
+## Requirements
+
+- Node.js 18+
+- MongoDB instance (local or Atlas)
+- Discord Bot application + token
+- (Optional) GitHub token/repo for transcript publishing
+- (Optional) YouTube API key + channel ID for upload alerts
+
+## Quick Start
 
 ```bash
-# Development
+npm install
+cp .env.example .env
 npm run dev
+```
+
+Production:
 
-# Production
+```bash
 npm run build
 npm start
 ```
 
-## Commands
-
-### Ticket System
-| Command | Description |
-|---------|-------------|
-| `/set-ticket-panel` | Create a ticket panel |
-| `/add-category` | Add a ticket category |
-| `/add-modal` | Create a ticket form |
-
-### Commission (MC Shop Only)
-| Command | Description |
-|---------|-------------|
-| `/set-mcshop-server` | Designate this server as MC Shop (owner only) |
-
-### Configuration
-| Command | Description |
-|---------|-------------|
-| `/configure-welcome` | Set up welcome messages |
-| `/set-builtbybit-channel` | Configure BuiltByBit alerts |
-| `/set-youtube-channel` | Configure YouTube alerts |
-| `/set-counting-channel` | Set up counting channel |
-| `/add-keyword-reply` | Add auto-reply keyword |
-| `/remove-keyword-reply` | Remove auto-reply keyword |
-| `/create-embed` | Create a reusable embed |
-| `/send-embed` | Send a stored embed |
-| `/reaction-role` | Set up reaction roles |
-
-## Architecture
+## Environment Variables
 
-```
+Use `.env.example` as the source of truth. Key groups:
+
+- **Discord:** `DISCORD_TOKEN`, `DISCORD_CLIENT_ID`
+- **Database:** `MONGODB_URI`
+- **Ownership:** `OWNER_ID`
+- **Transcripts:** `GITHUB_TOKEN`, `GITHUB_REPO`, `GITHUB_BRANCH`, `TRANSCRIPT_BASE_URL`
+- **BuiltByBit:** `BUILTBYBIT_PROFILE_ID`, `BUILTBYBIT_API_KEY`
+- **YouTube:** `YOUTUBE_CHANNEL_ID`, `YOUTUBE_API_KEY`
+
+## Project Structure
+
+```text
 src/
-├── index.ts                 # Entry point
-├── config/                  # Configuration
-├── database/                # MongoDB models
-├── commands/                # Slash commands
-├── interactions/            # Button/select/modal handlers
-├── events/                  # Discord event handlers
-├── services/                # Business logic
-├── state/                   # State machines
-├── types/                   # TypeScript types
-└── utils/                   # Utilities
+├── commands/       # Slash command modules
+├── events/         # Discord event listeners
+├── interactions/   # Button/select/modal handlers
+├── services/       # Background/business services
+├── state/          # Ticket/commission state handling
+├── utils/          # Shared utility logic
+└── index.ts        # App bootstrap
 ```
 
-## Commission Workflow
+## Showcase
+
+> Screenshots from `bot-assets/`.
+
+### 1) Dashboard & Configuration
+
+![Dashboard and configuration view](bot-assets/1.png)
+![Dashboard and configuration view 2](bot-assets/2.png)
+
+### 2) Ticket & Commission Flow
 
-1. Customer creates a ticket in a commission category
-2. Freelancers see the ticket and can click "Start Commission"
-3. First freelancer to click is assigned (race-safe)
-4. Freelancer works on commission, can add price/deadline
-5. Freelancer clicks "End Commission"
-6. Customer must confirm completion
-7. Ticket closes and transcript is generated
+![Ticket and commission interface](bot-assets/3.png)
+![Commission interaction sequence](bot-assets/4.png)
 
-## Transcript Hosting
+### 3) Moderation & Utility Features
 
-Transcripts are generated using `discord-html-transcripts` and uploaded to a GitHub repository configured for GitHub Pages. The transcript URL is sent to the user when the ticket closes.
+![Moderation tools view](bot-assets/5.png)
+![Automation systems view](bot-assets/6.png)
+![Additional system showcase](bot-assets/7.png)
 
 ## License
 
 ISC
