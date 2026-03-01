# Doom Wen Discord Bot

A production-grade, multi-server Discord bot with advanced ticketing and commission workflows.

## Features

- **Multi-Server Support**: Works across multiple Discord servers with per-server configuration
- **Advanced Ticket System**: Panel-based ticket creation with categories and modal forms
- **Commission Workflow**: MC Shop server exclusive commission management with freelancer assignment
- **Welcome System**: Customizable welcome messages with placeholders
- **Alert System**: BuiltByBit and YouTube upload notifications
- **Counting System**: Per-server counting channel with validation
- **Keyword Auto-Replies**: Automatic responses to trigger keywords
- **Reaction Roles**: Emoji-based role assignment
- **Stored Embeds**: Reusable embeds for announcements and rules

## Setup

### Prerequisites

- Node.js 18+
- MongoDB (local or Atlas)
- Discord Bot Token
- GitHub Token (for transcript hosting)

### Installation

```bash
# Clone the repository
cd doom-wen-discord-bot

# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Edit .env with your credentials
```

### Environment Variables

```env
DISCORD_TOKEN=your_bot_token
DISCORD_CLIENT_ID=your_client_id
MONGODB_URI=mongodb://localhost:27017/doom-wen-bot
OWNER_ID=your_discord_user_id

# GitHub Pages Transcripts
GITHUB_TOKEN=your_github_pat
GITHUB_REPO=username/transcript-repo
TRANSCRIPT_BASE_URL=https://username.github.io/transcript-repo
```

### Running

```bash
# Development
npm run dev

# Production
npm run build
npm start
```

## Commands

### Ticket System
| Command | Description |
|---------|-------------|
| `/set-ticket-panel` | Create a ticket panel |
| `/add-category` | Add a ticket category |
| `/add-modal` | Create a ticket form |

### Commission (MC Shop Only)
| Command | Description |
|---------|-------------|
| `/set-mcshop-server` | Designate this server as MC Shop (owner only) |

### Configuration
| Command | Description |
|---------|-------------|
| `/configure-welcome` | Set up welcome messages |
| `/set-builtbybit-channel` | Configure BuiltByBit alerts |
| `/set-youtube-channel` | Configure YouTube alerts |
| `/set-counting-channel` | Set up counting channel |
| `/add-keyword-reply` | Add auto-reply keyword |
| `/remove-keyword-reply` | Remove auto-reply keyword |
| `/create-embed` | Create a reusable embed |
| `/send-embed` | Send a stored embed |
| `/reaction-role` | Set up reaction roles |

## Architecture

```
src/
├── index.ts                 # Entry point
├── config/                  # Configuration
├── database/                # MongoDB models
├── commands/                # Slash commands
├── interactions/            # Button/select/modal handlers
├── events/                  # Discord event handlers
├── services/                # Business logic
├── state/                   # State machines
├── types/                   # TypeScript types
└── utils/                   # Utilities
```

## Commission Workflow

1. Customer creates a ticket in a commission category
2. Freelancers see the ticket and can click "Start Commission"
3. First freelancer to click is assigned (race-safe)
4. Freelancer works on commission, can add price/deadline
5. Freelancer clicks "End Commission"
6. Customer must confirm completion
7. Ticket closes and transcript is generated

## Transcript Hosting

Transcripts are generated using `discord-html-transcripts` and uploaded to a GitHub repository configured for GitHub Pages. The transcript URL is sent to the user when the ticket closes.

## License

ISC
