# Discord Bot - Client Guide & Documentation

This document serves as a complete guide for your custom Discord bot. It covers everything from core features and workflows to testing procedures and permissions.

---

## **1. Bot Overview**

This is a multi-purpose professional Discord bot designed to manage **customer support tickets, commission workflows, and community engagement**. It replaces the need for multiple separate bots by combining these features into one cohesive system.

### **Key Capabilities**
*   **Ticket System:** Advanced support ticket management with categories, transcripts, and modals.
*   **Commission System:** A dedicated workflow for freelancers to quote prices/deadlines and for clients to accept/reject them, tracking the entire project lifecycle.
*   **Automated Moderation:** Keyword auto-replies and reusable embeds.
*   **Community Engagement:** Counting channel, clean welcome messages, reaction roles, and YouTube upload alerts.

---

## **2. Core Systems**

### **Ticket System**
The backbone of user support. You can create multiple "Ticket Panels" (e.g., General Support, Commissions, Billing). Users click a button to open a private channel. Staff can claim, manage, and close these tickets.

### **Commission System**
A specialized layer on top of tickets. When a user opens a commission ticket:
1.  They discuss requirements with a freelancer.
2.  The freelancer submits a **formal quote** (Price & Deadline).
3.   The client gets a clean dashboard to **Accept** or **Reject** the quote.
4.  Once accepted, the commission is "Active".
5.  Upon completion, the freelancer requests confirmation, and the client "Confirms Completion" to close the deal.

### **Counting System**
A fun minigame channel where users must count up (1, 2, 3...) sequentially.
*   **Strict Rules:** If someone counts wrong or counts twice in a row, the bot deletes the message or resets the count (configurable).
*   **Milestones:** Celebrates when the server reaches 100, 200, etc.

### **YouTube Alerts**
Automatically posts a notification when a specific YouTube channel uploads a new video. You can configure it to ping `@everyone`, `@here`, or a specific role.

### **Welcome System**
Sends a customizable welcome message (with an image/embed) to a specific channel whenever a new member joins the server.

### **Reaction Roles**
Allows users to self-assign roles (like "Announcements", "Events") by reacting to a message with an emoji.

### **Keyword Auto-Replies**
The bot listens for specific words or phrases (e.g., "IP address", "When is wipe?") and automatically replies with a pre-set message.

### **Embed Builder**
Create, store, and send professional-looking messages (Embeds) to any channel without needing code.

---

## **3. Command Reference**

### **Ticket & Commission Management**
| Command | Usage | Description |
| :--- | :--- | :--- |
| `/set-ticket-panel` | Admin | Creates the main "Open Ticket" message with a dropdown for categories. |
| `/add-category` | Admin | Adds a new category (e.g. "Graphics") to a ticket panel. |
| `/remove-category` | Admin | Removes a category from a panel. |
| `/add-modal` | Admin | Adds a form (questions) that pops up when opening a ticket. |
| `/remove-modal` | Admin | Removes the form from a category. |
| `/close-ticket` | Staff/User | Closes the current ticket and generates a transcript. |
| `/ticket-add-user` | Staff | Adds another user to a private ticket channel. |

### **Community Features**
| Command | Usage | Description |
| :--- | :--- | :--- |
| `/set-counting-channel` | Admin | Sets the channel for the counting game. Options to reset count or disable. |
| `/set-youtube-channel` | Admin | Links a YouTube channel for new video alerts. |
| `/configure-welcome` | Admin | Sets the welcome channel and background image for new members. |
| `/reaction-role setup` | Admin | Creates a new message for users to react to. |
| `/reaction-role add` | Admin | Adds a role + emoji pair to a reaction role message. |

### **Moderation & Tools**
| Command | Usage | Description |
| :--- | :--- | :--- |
| `/create-embed` | Admin | Builds a custom embed message and saves it with a name. |
| `/send-embed` | Admin | Sends a saved embed to a channel. |
| `/add-keyword-reply` | Admin | Adds an auto-reply for a specific phrase. |
| `/remove-keyword-reply` | Admin | Deletes an auto-reply. |

---

## **4. Ticket Workflow (User Perspective)**

1.  **Open:** User goes to the Support channel and selects a category (e.g., "General Support") from the dropdown.
2.  **Form (Optional):** If configured, a form pops up asking for details (e.g., "Describe your issue").
3.  **Channel Created:** A private channel `#ticket-user-001` is created. Only the user and Staff can see it.
4.  **Support:** Staff helps the user.
5.  **Close:** Either party clicks **"Close Ticket"**.
6.  **Transcript:** The ticket is deleted, and a relentless HTML transcript file is DM'd to the user and saved in a log channel.

---

## **5. Commission Workflow (Detailed)**

This is the system's most powerful feature designed for freelancers/agencies.

**Phase 1: Inquiry**
*   Client opens a ticket in a **Commission Category**.
*   Client and Freelancer discuss the project scope.

**Phase 2: The Quote**
*   Freelancer clicks the **"Start Commission"** button.
*   A form appears asking for **Price** (e.g., "$50") and **Deadline** (e.g., "3 days").
*   The bot posts a **Quote Dashboard** in the chat.
*   **State:** `QUOTE_SUBMITTED`

**Phase 3: Agreement**
*   The Client sees the quote details.
*   Client clicks **"Accept Quote"**. (Or "Reject" to negotiate).
*   Bot updates status to **Authorized/Active**.
*   **State:** `ACTIVE`

**Phase 4: Work & Pings**
*   Freelancer starts working.
*   If the client disappears, the Freelancer can click **"Ping Freelancers"** (or similar alert) to get attention (with a built-in cooldown to prevent spam).

**Phase 5: Completion**
*   Freelancer clicks **"End Commission"** (or "Mark Complete").
*   Bot asks the Client to confirm.
*   Client clicks **"Confirm Completion"**.
*   **Result:** Ticket closes, transcript saved, and the commission is logged as successful.

---

## **6. Permissions & Roles**

*   **Administrator:** Has full access to all `/` commands. Can configure panels, alerts, and settings.
*   **Staff Roles:** (Configured per ticket category) Can see tickets, reply to users, and manage the workflow.
*   **Freelancer Roles:** (Configured per commission category) specifically notified for commissions. Can issue quotes.
*   **Ticket Owner:** Can only see their own ticket, close it, or accept/reject quotes. They cannot see other tickets or admin commands.

> **Note:** The bot manages channel permissions automatically. When a ticket opens, it specifically denies `@everyone` and permits the `User` + `Staff Roles`.

---

## **7. Alerts & Automation**

*   **YouTube:** The bot checks for new videos periodically. When found, it posts the link.
    *   *Ping Options:* None, `@everyone`, `@here`, or a specific Role.
*   **Counting:** Automatic enforcement. If a user ruins the count (e.g., types "5" after "3"), the bot reacts with ❌ and resets the count to 0 (if enabled). High scores are tracked.
*   **Keyword Replies:** Checks every message. If it contains a keyword, the bot replies instantly. Useful for FAQs.

---

## **8. What You Should Test**

Use this checklist to verify the bot is ready for your server:

- [ ] **Support Ticket:** Create a ticket, type a message, and close it. Check if you get the transcript DM.
- [ ] **Commission Flow:**
    - [ ] Create a commission ticket.
    - [ ] Have a staff member "Start Commission" and set a price.
    - [ ] As the client, click "Accept Quote".
    - [ ] As staff, click "End Commission".
    - [ ] As client, "Confirm Completion".
- [ ] **Permission Check:** Try to use `/set-ticket-panel` with a non-admin account (should fail).
- [ ] **Counting:** Go to the counting channel, type "1", then "2". Then have the same account type "3" (should fail/warn users cannot count twice in a row).
- [ ] **Keywords:** Type a trigger phrase in chat.

---

## **9. Notes & Limitations**

*   **Transcripts:** Are generated as downloadable HTML files. They look exactly like the Discord chat history.
*   **Demo Mode:** Ensure you set up the roles (Support Role, Freelancer Role) in your server *before* configuring the ticket panel categories, as the bot needs to know which roles to add to the tickets.
*   **Safety:** The bot will never delete the actual database of commissions even if a ticket is closed, ensuring you have a permanent record of past jobs.
