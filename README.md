# Linq Health Clinic — AI Messaging Concierge

An AI-powered medical clinic receptionist built on the **Linq messaging platform**. Patients interact naturally via SMS/RCS to book, manage, and cancel appointments — while clinic staff monitor everything through a real-time admin dashboard.

## Architecture

```
Patient's Phone ──SMS/RCS──▶ Linq Partner API ──Webhook──▶ Express Backend
                                                               │
                                    ┌──────────────────────────┤
                                    │                          │
                              Google Gemini AI          In-Memory Store
                           (Caroline – Receptionist)    (Appointments DB)
                                    │                          │
                                    │                     REST API
                                    │                   /api/appointments
                                    │                   /api/stats
                                    │                          │
                                    │               Next.js Admin Dashboard
                                    │               (Real-time polling UI)
                                    │
                              Linq Partner API ──SMS──▶ Patient's Phone
                           (AI response + Reminders)
```

## Features

### 🤖 AI Receptionist (Caroline)
- Powered by **Google Gemini 2.5 Flash** with full conversation memory per chat session
- Collects patient details (Full Name, Age, Gender, Address) naturally through conversation
- Validates appointment times against clinic hours (Mon–Fri, 8 AM – 5 PM)
- **Action Extraction**: Parses hidden `[SYSTEM_BOOKING]` and `[SYSTEM_CANCEL]` tags from AI output to trigger real backend operations
- Out-of-bounds filtering: Politely redirects non-clinic questions

### 📋 Appointment Management
- Full booking flow with patient intake
- In-memory appointment storage with REST API (`GET /api/appointments`, `GET /api/stats`)
- Cancel/reschedule support via natural language

### ⏰ Automated Reminders
- Sends a follow-up SMS **60 seconds** after booking (configurable)
- Skips reminder if appointment was cancelled before the timer fires

### 📊 Admin Dashboard (Next.js)
- **Dashboard View**: Stats cards (total, confirmed, cancelled, service types) + appointments table
- **Calendar View**: Monthly calendar grid with patient names on their scheduled days
- **Patients View**: Deduplicated patient directory with visit counts and details
- **Click-to-expand**: Click any appointment row to see full patient details in a modal
- **Live polling**: Auto-refreshes every 5 seconds
- Resilient fetching — gracefully handles backend restarts

## Tech Stack

| Layer     | Technology                          |
|-----------|-------------------------------------|
| Backend   | Node.js, Express, TypeScript        |
| AI/LLM    | Google Gemini 2.5 Flash             |
| Messaging | Linq Partner API (v3, SMS/RCS)      |
| Frontend  | Next.js 16, React 19, TypeScript    |
| Styling   | CSS Modules (light theme)           |

## Project Structure

```
Linq_Project/
├── server.ts            # Express backend: webhook, AI, REST API, reminders
├── linqClient.ts        # Linq Partner API wrapper (send messages)
├── testSend.ts          # Quick test script for sending messages
├── package.json
├── tsconfig.json
├── .env                 # Environment variables (not committed)
├── README.md
└── dashboard/           # Next.js admin dashboard
    └── app/
        ├── layout.tsx
        ├── globals.css
        ├── page.tsx         # Main dashboard with 3 views
        └── page.module.css  # Styles
```

## Setup

### 1. Backend

```bash
npm install
```

Create a `.env` file:

```env
LINQ_API_KEY=your_linq_partner_api_key
LINQ_SANDBOX_NUMBER=+14153598688
LLM_API_KEY=your_google_gemini_api_key
PORT=3000
```

Start the server:

```bash
npm start
```

### 2. Admin Dashboard

```bash
cd dashboard
npm install
npm run dev
```

Dashboard runs at `http://localhost:3001`.

### 3. Webhook Setup

Expose port 3000 to the internet using a tunneling service:

```bash
# Option A: Smee.io (recommended)
npx smee-client --url https://smee.io/your-channel --target http://localhost:3000/webhook

# Option B: Localtunnel
npx localtunnel --port 3000

# Option C: ngrok
ngrok http 3000
```

Set the webhook URL in the [Linq Dashboard](https://dashboard.linqapp.com/) with the `message.received` event.

## Demo Flow

1. Text **"Hi, I need a teeth cleaning"** to the sandbox number
2. Caroline (AI) asks for preferred day/time, then collects name, age, gender, address
3. Appointment is confirmed and stored — appears on the dashboard instantly
4. **60 seconds later**, patient receives a reminder SMS
5. Patient can text **"Cancel my appointment"** — status updates to cancelled on the dashboard

## API Endpoints

| Method | Endpoint            | Description                          |
|--------|---------------------|--------------------------------------|
| GET    | `/`                 | Health check                         |
| POST   | `/webhook`          | Linq webhook receiver                |
| GET    | `/api/appointments` | All appointments (sorted by recent)  |
| GET    | `/api/stats`        | Summary stats (total, confirmed, etc)|
