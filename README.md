# Bluefox Quiz — MVP (Next.js on Vercel, NO Supabase)

An admin-controlled quiz competition platform built strictly with Vercel-native services. Supports up to 8 competitive groups, millisecond-synchronized countdown timers, text/MCQ/video/audio media questions, a live team pass chain, celebratory and wrong sound effects, and an individual rapid-fire round with a numbered question selection board.

---

## 🚀 Architecture Highlights

- **Framework**: Next.js 16 (App Router) + TypeScript + Tailwind CSS
- **Database**: SQLite (via `@libsql/client` & Drizzle ORM) — zero-config local `file:sqlite.db`
- **Real-Time Client Sync**: SWR polling (`refreshInterval: 1000`)
- **Timer Synchronization**: Absolute `timer_ends_at` server timestamp with local client-side 250ms countdown interpolation
- **Admin Authentication**: Single `ADMIN_PIN` environment variable with encrypted iron-session cookies
- **Media Storage**: Vercel Blob (`@vercel/blob`) with video (`muted autoPlay playsInline controls`) and audio (`controls autoPlay`)
- **Sound Effects**: Static MP3 audio assets (`clap.mp3`, `wrong.mp3`, `tick.mp3`) with Web Audio API synthesizer fallbacks

---

## 📦 Project Setup

### 1. Configure Environment Variables
Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```

Populate the environment variables:
```env
# SQLite Database: Local file (zero-config, works immediately)
DATABASE_URL="file:sqlite.db"

# Or for cloud deployment on Vercel:
# DATABASE_URL="libsql://your-db.turso.io"
# DATABASE_AUTH_TOKEN="your-token"

# Vercel Blob Read/Write Token (From Vercel Storage -> Blob)
BLOB_READ_WRITE_TOKEN=""

# Admin Host Authentication PIN
ADMIN_PIN="bluefox2026"

# Iron session encryption key (minimum 32 characters)
SESSION_SECRET="bluefox_quiz_secure_session_secret_key_at_least_32_chars"
```

### 2. Push Database Schema to SQLite
Run Drizzle Kit to create the tables in your SQLite database:
```bash
npm run db:push
# or: npx drizzle-kit push
```

### 3. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🎮 How the Game Works

### Phase 1: Admin Host & Room Creation
- Navigate to `/admin/login` and enter your `ADMIN_PIN` (default: `bluefox2026`).
- Create a room name (e.g., "Championship Finals").
- You will be redirected to `/admin/room/[roomId]`. The big, bold 6-character room code (e.g. `BLUFOX`) is displayed on screen.

### Phase 2: Contestants Join (Up to 8 Groups)
- Contestants open `/join` on their devices or phones.
- Enter the 6-character room code and group name (e.g., "Team Alpha") with optional member names.
- The system enforces a strict 8-group maximum and assigns a `joinOrder` (1 to 8).
- Contestants are automatically routed to `/play/[roomId]`. Their contestant ID is safely persisted in `localStorage`.

### Phase 3: Synchronized Game State & Timers
- Every screen polls `/api/rooms/[roomId]/state` every 1 second.
- Answers (`correctAnswer`) are automatically stripped from the state API for contestant screens.
- When the host starts a timer, `timerEndsAt` is saved as an absolute timestamp. Every screen computes `remaining = timer_ends_at - now` locally every 250ms for smooth countdowns.

### Phase 4: Question Bank Editor
- From the host panel, click **Question Bank** (`/admin/room/[roomId]/questions`).
- Create Text, MCQ, Video, or Audio questions.
- Upload video/audio files directly to Vercel Blob or paste a direct public media URL.
- Configure points (default: 10), timer overrides, round type (Normal vs Rapid Fire), and tile numbers.

### Phase 5: Normal Round & Host Controls
- Host clicks **Show to Room** on a question.
- Host starts the timer (customizable seconds, e.g. 15s, 30s, 60s).
- Host buttons:
  - **CORRECT**: Awards points to active group, triggers `clap.mp3` fanfare and confetti celebration, marks question done.
  - **WRONG**: Triggers `wrong.mp3` buzzer.
  - **PASS**: Advances turn to the next group in rotation.
  - **Rotate Next Turn**: Advances turn manually.

### Phase 6: PASS Button & 00:00 Auto-Pass Authority
- The **PASS QUESTION** button appears on the contestant's screen **only** when it is their group's active turn and the timer is running.
- When a contestant presses PASS, it POSTs to `/api/pass`.
- **00:00 Auto-Pass**: The host screen serves as the single authority. When the host clock reaches 00:00, it automatically triggers `passQuestion` to prevent race conditions.
- When all groups have passed a question, it automatically closes with 0 points.

### Phase 7: Sound Effects & Audio Unlock
- Due to modern browser autoplay policies, a **"Tap to enable sound effects 🔊"** button is provided on all screens.
- Web Audio API synthesizers serve as automatic fallbacks for celebratory fanfare, buzzers, and clock ticks if audio files are blocked.

### Phase 8: Rapid Fire Round
- Host switches the room round to **Rapid Fire**.
- Host selects a group and member name to activate an individual turn.
- A numbered board of interactive tiles appears (`RapidFireBoard`).
- The active player taps an unused numbered tile on their screen (or the host clicks on their behalf).
- The question is revealed and the rapid-fire countdown starts immediately.
- Once finished, host can fold the individual's points back into the group score using **Credit to Group**.

### Phase 9: Live Leaderboard & Finish
- Real-time ranking of groups with scores and turn badges.
- Host can make manual +/- point adjustments if needed.
- Host clicks **Finish Game** to reveal the podium standings and champion celebration.

---

## 🚢 Deploying to Vercel

1. Push your repository to GitHub.
2. In Vercel, import your repository:
   - Go to **Storage -> Marketplace -> Neon** to attach Neon Postgres (automatically adds `DATABASE_URL`).
   - Go to **Storage -> Blob** to attach Vercel Blob (automatically adds `BLOB_READ_WRITE_TOKEN`).
3. Add Environment Variables in Project Settings:
   - `ADMIN_PIN`: Secret host PIN
   - `SESSION_SECRET`: 32+ character random secret string
4. Deploy!
5. After first deployment, run `npx drizzle-kit push` locally or connect your Neon console to push the schema tables.
