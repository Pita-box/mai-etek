# DomSub Control App - Architecture Plan

> Private DOM/SUB (BDSM culture) relationship management application with real-time monitoring, task management, gamification, and Chrome Extension integration.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Requirements Summary](#2-requirements-summary)
3. [System Architecture](#3-system-architecture)
4. [Technology Stack](#4-technology-stack)
5. [Database Schema](#5-database-schema)
6. [API Architecture](#6-api-architecture)
7. [WebSocket Events](#7-websocket-events)
8. [Chrome Extension Architecture](#8-chrome-extension-architecture)
9. [Key Algorithms & Logic](#9-key-algorithms--logic)
10. [Project Structure](#10-project-structure)
11. [Infrastructure & Deployment](#11-infrastructure--deployment)
12. [Security Considerations](#12-security-considerations)
13. [Development Phases](#13-development-phases)

---

## 1. Project Overview

### Purpose

Private application for a DOM/SUB couple (BDSM dynamic). The SUB fully surrenders control to the DOM, who can monitor, assign tasks, and maintain authority through the app. Requires authentication - not publicly accessible.

### Platforms

| Platform | Type | Priority |
|----------|------|----------|
| **Web App** | Next.js PWA, mobile-first | Phase 1 (primary) |
| **Chrome Extension** | Manifest V3, monitoring & webcam | Phase 4 |
| **Android/iOS App** | React Native (future) | Future phase |

### User Roles

| Role | Description | Permissions |
|------|-------------|-------------|
| **DOM** | Superadmin with full control | Create tasks, approve/reject, manage punishments, view all monitoring data, manage gallery, set rewards |
| **SUB** | Submissive user | Complete tasks, submit evidence, chat, manage wishes, upload media |

---

## 2. Requirements Summary

| Area | Decision |
|------|----------|
| **Registration** | Invite-only (DOM creates account, sends invite to SUB) |
| **Multi-pair** | Single pair only (1 DOM + 1 SUB) |
| **Auth** | Email + password |
| **Chat** | Real-time (WebSocket), full multimedia (text, images, videos, voice) |
| **Encryption** | None (simplified implementation) |
| **Tasks** | Deadline with auto-fail, combined punishments (templates + ad-hoc), full gamification, recurring tasks |
| **Gallery** | 500+ GB storage, original + thumbnail, automatic watermark, advanced filters |
| **Chrome Extension** | Live webcam stream + recording, URL + title + screenshot, keylogger (all inputs) |
| **Notifications** | Telegram Bot |
| **Panic Button** | Yes (irreversible data deletion) |
| **Safe Word** | Yes (SUB can temporarily halt monitoring) |
| **Consent** | No formal consent system |
| **Hosting** | Self-hosted VPS |
| **Timeline** | No rush, quality over speed |
| **Language** | Czech language only (Celý projekt výhradně v českém jazyce) |
| **MVP Scope** | Full MVP (all features including Chrome Extension) |

---

## 3. System Architecture

### High-Level Overview

```
+---------------------------------------------------------------------+
|                          CLIENTS                                     |
|                                                                      |
|  +----------------+  +--------------------+  +--------------------+  |
|  |  Next.js PWA   |  | Chrome Extension   |  | Mobile App (future)|  |
|  |  (Mobile-first)|  |  (Manifest V3)     |  |  React Native      |  |
|  +-------+--------+  +---------+----------+  +----------+---------+  |
+-----------+-----------------+---------------------------+------------+
            |                 |                           |
            v                 v                           v
+---------------------------------------------------------------------+
|                     API GATEWAY (Nginx)                               |
|                  SSL Termination + Rate Limiting                      |
+----------------------------+----------------------------------------+
                             |
            +----------------+----------------+
            v                v                v
   +--------------+  +--------------+  +------------------+
   |  REST API    |  |  WebSocket   |  |  WebRTC Signal   |
   |  (Express)   |  |  Server      |  |  Server (live    |
   |              |  |  (Socket.IO) |  |  webcam stream)  |
   +------+-------+  +------+-------+  +------+-----------+
          |                  |                 |
          v                  v                 v
+---------------------------------------------------------------------+
|                        SUPABASE                                      |
|  +--------------+  +-----------+  +------------+  +---------------+  |
|  | PostgreSQL   |  | Auth      |  | Realtime   |  | Storage       |  |
|  | (Data)       |  | (JWT)     |  | (Subscr.)  |  | (S3-compat.)  |  |
|  +--------------+  +-----------+  +------------+  +---------------+  |
+---------------------------------------------------------------------+
                             |
            +----------------+----------------+
            v                v                v
   +--------------+  +--------------+  +------------------+
   |  MinIO       |  |  Redis       |  |  Telegram Bot    |
   |  (Object     |  |  (Cache,     |  |  API             |
   |  Storage)    |  |  Sessions,   |  |  (Notifications) |
   |  500+ GB     |  |  Queues)     |  |                  |
   +--------------+  +--------------+  +------------------+
                             |
                             v
                    +------------------+
                    |  Worker Queue    |
                    |  (BullMQ)        |
                    |  - Thumbnails    |
                    |  - Watermarks    |
                    |  - Screenshots   |
                    |  - Video transc. |
                    |  - Task expiry   |
                    +------------------+
```

### Data Flow Patterns

```
1. Chat Message Flow:
   Client -> Socket.IO -> Server -> PostgreSQL + MinIO (media)
   Server -> Socket.IO -> Other Client
   Server -> Telegram Bot -> Notification

2. Task Flow:
   DOM creates task -> API -> PostgreSQL -> Socket.IO -> SUB notification
   SUB submits evidence -> API -> MinIO (media) + PostgreSQL
   DOM approves -> API -> Gamification Engine -> PostgreSQL -> Socket.IO + Telegram

3. Monitoring Flow:
   Chrome Extension -> Batch sync (30s) -> API -> PostgreSQL + MinIO (screenshots)
   Extension webcam -> WebRTC signaling -> P2P stream to DOM browser

4. Media Upload Flow:
   Client -> API -> MinIO (original) -> BullMQ worker
   Worker -> Sharp/FFmpeg -> thumbnail + watermark -> MinIO -> PostgreSQL (URLs)
```

---

## 4. Technology Stack

### Core Stack

| Layer | Technology | Reason |
|-------|-----------|--------|
| **Frontend** | Next.js 14+ (App Router) | SSR, API routes, React ecosystem |
| **UI Framework** | Tailwind CSS + shadcn/ui | Rapid development, mobile-first, beautiful components |
| **State Management** | Zustand | Lightweight, simple API |
| **Real-time** | Socket.IO | Chat + notifications, reliable reconnection |
| **Live Video** | WebRTC (simple-peer) | P2P webcam streaming, low latency |
| **Backend** | Express.js + TypeScript | Flexible, Socket.IO integration, shared language |
| **Database** | Supabase (PostgreSQL 15) | Auth, Realtime subscriptions, Row Level Security |
| **Object Storage** | MinIO (self-hosted) | S3-compatible, handles 500+ GB of media |
| **Cache / Queue** | Redis 7 + BullMQ | Session cache, job queue for media processing |
| **Media Processing** | Sharp (images) + FFmpeg (video) | Thumbnails, watermarks, video transcoding |
| **Notifications** | Telegram Bot API (node-telegram-bot-api) | Instant push notifications |
| **Chrome Extension** | Manifest V3, TypeScript, Webpack | Monitoring, keylogger, webcam |
| **Monorepo** | Turborepo + pnpm | Shared packages, parallel builds |
| **Containerization** | Docker + Docker Compose | Simple VPS deployment |
| **Reverse Proxy** | Nginx | SSL termination, rate limiting, static files |
| **CI/CD** | GitHub Actions | Auto deploy on push |

### Key Libraries

| Purpose | Library |
|---------|---------|
| Form handling | react-hook-form + zod |
| Date handling | date-fns |
| File upload | tus-js-client (resumable uploads) |
| Image viewer | react-photo-view |
| Video player | video.js or plyr |
| Charts (stats) | recharts |
| Icons | lucide-react |
| Animations | framer-motion |
| WebRTC | simple-peer |
| Markdown | react-markdown (for task descriptions) |

---

## 5. Database Schema

### Entity Relationship Diagram

```
users 1--* messages
users 1--* tasks (assigned_by / assigned_to)
users 1--* media (uploaded_by)
users 1--* wishes (created_by)
users 1--* browsing_history
users 1--* keylog_entries
users 1--* webcam_recordings
users 1--1 user_stats
users 1--* user_achievements
users 1--* invite_tokens (created_by / used_by)

tasks 1--* task_evidence
tasks 1--* punishments
tasks *--1 tasks (parent_task_id - recurring)

albums 1--* media
achievements 1--* user_achievements
rewards 1--* reward_claims
```

### SQL Schema

```sql
-- ============================================
-- USERS & AUTH
-- ============================================
CREATE TYPE user_role AS ENUM ('dom', 'sub');

CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           VARCHAR(255) UNIQUE NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,
    role            user_role NOT NULL,
    display_name    VARCHAR(100),
    avatar_url      TEXT,
    is_active       BOOLEAN DEFAULT true,
    safe_word_active BOOLEAN DEFAULT false,
    telegram_chat_id BIGINT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE invite_tokens (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token           VARCHAR(64) UNIQUE NOT NULL,
    created_by      UUID REFERENCES users(id),
    used_by         UUID REFERENCES users(id),
    expires_at      TIMESTAMPTZ NOT NULL,
    used_at         TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- CHAT
-- ============================================
CREATE TYPE message_type AS ENUM ('text', 'image', 'video', 'voice', 'system');

CREATE TABLE messages (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id           UUID REFERENCES users(id) NOT NULL,
    type                message_type DEFAULT 'text',
    content             TEXT,
    media_url           TEXT,
    media_thumbnail_url TEXT,
    is_read             BOOLEAN DEFAULT false,
    read_at             TIMESTAMPTZ,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_messages_created ON messages(created_at DESC);
CREATE INDEX idx_messages_sender ON messages(sender_id);

-- ============================================
-- TASKS & GAMIFICATION
-- ============================================
CREATE TYPE task_status AS ENUM (
    'pending', 'in_progress', 'submitted', 
    'approved', 'rejected', 'failed', 'expired'
);
CREATE TYPE task_priority AS ENUM ('low', 'medium', 'high', 'urgent');
CREATE TYPE recurrence_type AS ENUM ('none', 'daily', 'weekly', 'monthly');

CREATE TABLE tasks (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title             VARCHAR(255) NOT NULL,
    description       TEXT,
    assigned_by       UUID REFERENCES users(id) NOT NULL,
    assigned_to       UUID REFERENCES users(id) NOT NULL,
    status            task_status DEFAULT 'pending',
    priority          task_priority DEFAULT 'medium',
    points_reward     INT DEFAULT 0,
    deadline          TIMESTAMPTZ,
    recurrence        recurrence_type DEFAULT 'none',
    recurrence_config JSONB,         -- e.g. {dayOfWeek: [1,3,5], time: "09:00"}
    parent_task_id    UUID REFERENCES tasks(id),  -- for recurring instances
    rating            INT CHECK (rating >= 1 AND rating <= 5),
    dom_feedback      TEXT,
    created_at        TIMESTAMPTZ DEFAULT NOW(),
    updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX idx_tasks_deadline ON tasks(deadline);

CREATE TABLE task_evidence (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id         UUID REFERENCES tasks(id) ON DELETE CASCADE NOT NULL,
    type            VARCHAR(20) NOT NULL,   -- 'text', 'image', 'video'
    content         TEXT,                    -- text comment or media URL
    thumbnail_url   TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_evidence_task ON task_evidence(task_id);

-- PUNISHMENTS
CREATE TABLE punishments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title           VARCHAR(255) NOT NULL,
    description     TEXT,
    severity        INT CHECK (severity >= 1 AND severity <= 5),
    is_template     BOOLEAN DEFAULT false,  -- predefined (library) vs ad-hoc
    task_id         UUID REFERENCES tasks(id),  -- NULL for templates
    created_by      UUID REFERENCES users(id) NOT NULL,
    completed       BOOLEAN DEFAULT false,
    completed_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- GAMIFICATION
CREATE TABLE achievements (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name              VARCHAR(100) NOT NULL,
    description       TEXT,
    icon_url          TEXT,
    points_required   INT,
    tasks_required    INT,
    condition_config  JSONB,         -- flexible achievement conditions
    created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE user_achievements (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID REFERENCES users(id) NOT NULL,
    achievement_id  UUID REFERENCES achievements(id) NOT NULL,
    unlocked_at     TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, achievement_id)
);

CREATE TABLE user_stats (
    user_id         UUID PRIMARY KEY REFERENCES users(id),
    total_points    INT DEFAULT 0,
    level           INT DEFAULT 1,
    tasks_completed INT DEFAULT 0,
    tasks_failed    INT DEFAULT 0,
    current_streak  INT DEFAULT 0,
    longest_streak  INT DEFAULT 0,
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- REWARDS
CREATE TABLE rewards (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title           VARCHAR(255) NOT NULL,
    description     TEXT,
    points_cost     INT NOT NULL,
    is_available    BOOLEAN DEFAULT true,
    created_by      UUID REFERENCES users(id) NOT NULL,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE reward_claims (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reward_id       UUID REFERENCES rewards(id) NOT NULL,
    claimed_by      UUID REFERENCES users(id) NOT NULL,
    approved        BOOLEAN,
    approved_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- GALLERY & MEDIA
-- ============================================
CREATE TABLE albums (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(255) NOT NULL,
    description     TEXT,
    cover_image_url TEXT,
    created_by      UUID REFERENCES users(id) NOT NULL,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE media (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    album_id          UUID REFERENCES albums(id),
    uploaded_by       UUID REFERENCES users(id) NOT NULL,
    type              VARCHAR(20) NOT NULL,     -- 'image', 'video'
    original_url      TEXT NOT NULL,
    thumbnail_url     TEXT,
    watermarked_url   TEXT,
    file_size         BIGINT,
    mime_type         VARCHAR(100),
    width             INT,
    height            INT,
    duration_seconds  INT,                       -- for videos
    tags              TEXT[],                     -- PostgreSQL array
    category          VARCHAR(100),
    rating            INT CHECK (rating >= 1 AND rating <= 5),
    is_favorite       BOOLEAN DEFAULT false,
    metadata          JSONB,                     -- EXIF data, etc.
    created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_media_album ON media(album_id);
CREATE INDEX idx_media_tags ON media USING GIN(tags);
CREATE INDEX idx_media_type ON media(type);
CREATE INDEX idx_media_created ON media(created_at DESC);
CREATE INDEX idx_media_category ON media(category);
CREATE INDEX idx_media_favorite ON media(is_favorite) WHERE is_favorite = true;

-- ============================================
-- SUB'S WISHES
-- ============================================
CREATE TYPE wish_status AS ENUM ('new', 'noted', 'planned', 'fulfilled', 'declined');

CREATE TABLE wishes (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_by      UUID REFERENCES users(id) NOT NULL,
    title           VARCHAR(255) NOT NULL,
    description     TEXT,
    category        VARCHAR(100),
    intensity       INT CHECK (intensity >= 1 AND intensity <= 5),  -- desire level
    status          wish_status DEFAULT 'new',
    dom_notes       TEXT,           -- DOM's private notes (invisible to SUB)
    fulfilled_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_wishes_status ON wishes(status);

-- ============================================
-- MONITORING (Chrome Extension Data)
-- ============================================
CREATE TABLE browsing_history (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id           UUID REFERENCES users(id) NOT NULL,
    url               TEXT NOT NULL,
    title             VARCHAR(500),
    screenshot_url    TEXT,
    is_incognito      BOOLEAN DEFAULT false,
    duration_seconds  INT,
    visited_at        TIMESTAMPTZ NOT NULL,
    created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_browsing_user ON browsing_history(user_id);
CREATE INDEX idx_browsing_visited ON browsing_history(visited_at DESC);
CREATE INDEX idx_browsing_url ON browsing_history USING GIN(to_tsvector('simple', url));
CREATE INDEX idx_browsing_incognito ON browsing_history(is_incognito) WHERE is_incognito = true;

CREATE TABLE keylog_entries (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID REFERENCES users(id) NOT NULL,
    site_url        TEXT,
    element_type    VARCHAR(50),     -- 'input', 'textarea', 'search', 'contenteditable'
    element_name    VARCHAR(100),    -- input name/id attribute
    content         TEXT NOT NULL,
    logged_at       TIMESTAMPTZ NOT NULL,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_keylog_user ON keylog_entries(user_id);
CREATE INDEX idx_keylog_logged ON keylog_entries(logged_at DESC);

CREATE TABLE webcam_recordings (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id           UUID REFERENCES users(id) NOT NULL,
    video_url         TEXT NOT NULL,
    thumbnail_url     TEXT,
    duration_seconds  INT,
    file_size         BIGINT,
    recorded_at       TIMESTAMPTZ NOT NULL,
    created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_webcam_user ON webcam_recordings(user_id);
CREATE INDEX idx_webcam_recorded ON webcam_recordings(recorded_at DESC);

-- ============================================
-- SAFE WORD & PANIC
-- ============================================
CREATE TABLE safe_word_log (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    activated_by    UUID REFERENCES users(id) NOT NULL,
    activated_at    TIMESTAMPTZ DEFAULT NOW(),
    deactivated_at  TIMESTAMPTZ,
    reason          TEXT
);

CREATE TABLE panic_log (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    triggered_by    UUID REFERENCES users(id) NOT NULL,
    data_deleted    JSONB,           -- audit log of what was deleted
    triggered_at    TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 6. API Architecture

### REST API Endpoints

#### Authentication

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| `POST` | `/api/auth/register` | DOM registration | Public |
| `POST` | `/api/auth/login` | Login (both roles) | Public |
| `POST` | `/api/auth/invite` | Generate invite token | DOM only |
| `POST` | `/api/auth/accept-invite` | SUB accepts invitation | Public (with token) |
| `POST` | `/api/auth/logout` | Logout | Authenticated |
| `GET` | `/api/auth/me` | Current user profile | Authenticated |
| `POST` | `/api/auth/refresh` | Refresh JWT token | Authenticated |

#### Chat

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| `GET` | `/api/messages` | Paginated messages list | Authenticated |
| `POST` | `/api/messages` | Send message | Authenticated |
| `DELETE` | `/api/messages/:id` | Delete message | DOM only |
| `POST` | `/api/messages/:id/read` | Mark as read | Authenticated |

#### Tasks

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| `GET` | `/api/tasks` | List tasks (filters: status, priority, date) | Authenticated |
| `POST` | `/api/tasks` | Create task | DOM only |
| `GET` | `/api/tasks/:id` | Get task detail | Authenticated |
| `PUT` | `/api/tasks/:id` | Update task | DOM only |
| `DELETE` | `/api/tasks/:id` | Delete task | DOM only |
| `POST` | `/api/tasks/:id/start` | SUB starts working on task | SUB only |
| `POST` | `/api/tasks/:id/submit` | SUB submits evidence | SUB only |
| `POST` | `/api/tasks/:id/approve` | DOM approves task | DOM only |
| `POST` | `/api/tasks/:id/reject` | DOM rejects task | DOM only |
| `GET` | `/api/tasks/stats` | Task statistics | Authenticated |

#### Task Evidence

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| `POST` | `/api/tasks/:id/evidence` | Add evidence (text/image/video) | SUB only |
| `DELETE` | `/api/evidence/:id` | Remove evidence | SUB only |

#### Punishments

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| `GET` | `/api/punishments` | List all (templates + ad-hoc) | Authenticated |
| `POST` | `/api/punishments` | Create punishment / template | DOM only |
| `PUT` | `/api/punishments/:id` | Update punishment | DOM only |
| `DELETE` | `/api/punishments/:id` | Delete punishment | DOM only |
| `POST` | `/api/punishments/:id/complete` | Mark as completed | Authenticated |

#### Gamification

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| `GET` | `/api/gamification/stats` | Points, level, streak stats | Authenticated |
| `GET` | `/api/gamification/achievements` | All achievements + unlock status | Authenticated |
| `GET` | `/api/gamification/history` | Points history / log | Authenticated |
| `GET` | `/api/rewards` | Available rewards | Authenticated |
| `POST` | `/api/rewards` | Create reward | DOM only |
| `PUT` | `/api/rewards/:id` | Update reward | DOM only |
| `DELETE` | `/api/rewards/:id` | Delete reward | DOM only |
| `POST` | `/api/rewards/:id/claim` | Claim reward (spend points) | SUB only |
| `POST` | `/api/rewards/:id/approve` | Approve claimed reward | DOM only |

#### Gallery & Media

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| `GET` | `/api/albums` | List albums | Authenticated |
| `POST` | `/api/albums` | Create album | Authenticated |
| `PUT` | `/api/albums/:id` | Update album | Authenticated |
| `DELETE` | `/api/albums/:id` | Delete album + all media | DOM only |
| `GET` | `/api/media` | List media (filters: tags, category, type, date, rating, favorite) | Authenticated |
| `GET` | `/api/media/:id` | Get single media detail | Authenticated |
| `POST` | `/api/media/upload` | Upload media (auto thumbnail + watermark) | Authenticated |
| `PUT` | `/api/media/:id` | Update tags, rating, category | Authenticated |
| `DELETE` | `/api/media/:id` | Delete media | DOM only |
| `POST` | `/api/media/:id/favorite` | Toggle favorite | Authenticated |

#### Wishes

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| `GET` | `/api/wishes` | List wishes | Authenticated |
| `POST` | `/api/wishes` | Create wish | SUB only |
| `PUT` | `/api/wishes/:id` | Update wish | SUB only (own) |
| `DELETE` | `/api/wishes/:id` | Delete wish | Authenticated |
| `PUT` | `/api/wishes/:id/status` | Change status (noted/planned/fulfilled/declined) | DOM only |
| `PUT` | `/api/wishes/:id/notes` | Add DOM private notes | DOM only |

#### Monitoring

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| `GET` | `/api/monitoring/history` | Browser history (paginated, filterable) | DOM only |
| `GET` | `/api/monitoring/keylogs` | Keylog entries (paginated, filterable) | DOM only |
| `GET` | `/api/monitoring/recordings` | Webcam recordings | DOM only |
| `POST` | `/api/monitoring/sync` | Chrome Extension batch sync endpoint | SUB only (extension) |
| `GET` | `/api/monitoring/status` | Extension connection status | Authenticated |

#### Safe Word & Panic

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| `POST` | `/api/safe-word/activate` | Activate safe word | SUB only |
| `POST` | `/api/safe-word/deactivate` | Deactivate safe word | Both (mutual) |
| `GET` | `/api/safe-word/status` | Current safe word status | Authenticated |
| `POST` | `/api/panic/trigger` | Irreversible data deletion | Authenticated |

#### Settings

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| `GET` | `/api/settings` | Get settings | Authenticated |
| `PUT` | `/api/settings` | Update settings | Authenticated |
| `PUT` | `/api/settings/telegram` | Configure Telegram integration | Authenticated |
| `PUT` | `/api/settings/profile` | Update profile (name, avatar) | Authenticated |
| `PUT` | `/api/settings/password` | Change password | Authenticated |

---

## 7. WebSocket Events

### Namespaces & Events

#### Chat Namespace: `/chat`

```
Client -> Server:
  message:send          { type: MessageType, content: string, mediaUrl?: string }
  message:typing        { }
  message:stop-typing   { }
  message:read          { messageId: string }

Server -> Client:
  message:new           { message: Message }
  message:typing        { userId: string }
  message:stop-typing   { userId: string }
  message:read          { messageId: string, readAt: string }
  message:deleted       { messageId: string }
```

#### Monitoring Namespace: `/monitoring`

```
Client -> Server (WebRTC Signaling):
  webcam:stream:start     -- SUB initiates stream
  webcam:stream:offer     { sdp: RTCSessionDescription }
  webcam:stream:answer    { sdp: RTCSessionDescription }
  webcam:stream:ice       { candidate: RTCIceCandidate }
  webcam:stream:stop      -- Stop streaming

Server -> Client:
  webcam:stream:request   -- DOM requests live view from SUB
  webcam:stream:ended     -- Stream ended
  monitoring:status       { isActive: boolean, safeWordActive: boolean }
```

#### Notifications Namespace: `/notifications`

```
Server -> Client:
  task:new                { task: Task }
  task:submitted          { taskId: string, evidenceCount: number }
  task:approved           { taskId: string, rating: number, points: number }
  task:rejected           { taskId: string, feedback: string }
  task:expired            { taskId: string, punishment?: Punishment }
  punishment:assigned     { punishment: Punishment }
  achievement:unlocked    { achievement: Achievement }
  reward:claimed          { reward: Reward, claimedBy: string }
  reward:approved         { rewardClaim: RewardClaim }
  wish:status-changed     { wish: Wish }
  safe-word:activated     { activatedBy: string }
  safe-word:deactivated   { }
  user:online             { userId: string }
  user:offline            { userId: string }
```

---

## 8. Chrome Extension Architecture

### Manifest V3 Configuration

```json
{
  "manifest_version": 3,
  "name": "DS Monitor",
  "version": "1.0.0",
  "permissions": [
    "tabs",
    "activeTab",
    "history",
    "storage",
    "alarms",
    "offscreen"
  ],
  "optional_permissions": [
    "tabCapture"
  ],
  "host_permissions": ["<all_urls>"],
  "incognito": "spanning",
  "background": {
    "service_worker": "background.js",
    "type": "module"
  },
  "content_scripts": [{
    "matches": ["<all_urls>"],
    "js": ["content.js"],
    "run_at": "document_idle"
  }],
  "action": {
    "default_popup": "popup.html",
    "default_icon": "icon.png"
  }
}
```

### Extension Components

```
chrome-extension/
├── src/
│   ├── background/
│   │   ├── service-worker.ts      # Main orchestrator
│   │   ├── history-tracker.ts     # Monitors tab navigation (normal + incognito)
│   │   ├── sync-manager.ts        # Batch sync to API every 30s
│   │   └── alarm-handler.ts       # Periodic tasks via chrome.alarms
│   │
│   ├── content/
│   │   ├── keylogger.ts           # Intercepts all input events
│   │   │                          # - input, textarea, contenteditable
│   │   │                          # - search bars, forms
│   │   │                          # - Captures: value, element type, site URL
│   │   └── screenshot.ts          # Captures visible tab as image
│   │                              # - Triggered on page load
│   │                              # - Compressed to JPEG before upload
│   │
│   ├── webcam/
│   │   ├── capture.ts             # MediaRecorder API for recording
│   │   │                          # - Chunks uploaded periodically
│   │   │                          # - Auto-generates thumbnails
│   │   ├── stream.ts              # WebRTC peer connection for live view
│   │   │                          # - Receives signal from server
│   │   │                          # - Creates offer/answer/ICE
│   │   └── offscreen.html         # Offscreen document for camera access
│   │                              # (Manifest V3 requires offscreen doc for 
│   │                              #  persistent media access)
│   │
│   ├── popup/
│   │   ├── popup.html             # Extension popup UI
│   │   ├── popup.ts               # Shows: connection status, safe word toggle,
│   │   │                          #         monitoring stats, login form
│   │   └── popup.css
│   │
│   └── shared/
│       ├── api-client.ts          # Authenticated HTTP client for API
│       ├── storage.ts             # chrome.storage.local wrapper
│       │                          # - Buffers data before sync
│       │                          # - Stores auth tokens
│       ├── config.ts              # API URL, sync interval, etc.
│       └── types.ts               # Shared TypeScript types
```

### Extension Data Flow

```
1. History Tracking:
   Tab navigation event
   -> service-worker captures: URL, title, timestamp, isIncognito
   -> content-script captures: page screenshot (JPEG)
   -> Stored in chrome.storage.local buffer
   -> Batch synced every 30s via POST /api/monitoring/sync

2. Keylogging:
   User types in any input field
   -> content-script captures: value, element type/name, site URL
   -> Debounced (waits 2s after last keystroke)
   -> Stored in chrome.storage.local buffer
   -> Batch synced every 30s

3. Webcam Recording:
   Service worker starts offscreen document
   -> getUserMedia({video: true})
   -> MediaRecorder captures in 30s chunks
   -> Each chunk uploaded to MinIO via API
   -> Metadata stored in PostgreSQL

4. Live Stream (WebRTC):
   DOM clicks "Live View" in web app
   -> Server sends webcam:stream:request to SUB's extension
   -> Extension opens offscreen document
   -> getUserMedia + RTCPeerConnection
   -> SDP offer sent via WebSocket signaling
   -> P2P stream established
   -> DOM sees real-time video in browser

5. Safe Word:
   SUB activates safe word (popup or web app)
   -> Extension immediately stops ALL monitoring
   -> Clears local buffer (unsent data deleted)
   -> Notifies server -> Telegram notification to DOM
   -> Monitoring resumes only when both parties agree
```

---

## 9. Key Algorithms & Logic

### 9.1 Task Expiry Worker

```
Runs via BullMQ repeatable job, EVERY 60 seconds:

PROCEDURE check_expired_tasks():
    expired = SELECT * FROM tasks 
              WHERE status IN ('pending', 'in_progress') 
              AND deadline < NOW()
    
    FOR EACH task IN expired:
        BEGIN TRANSACTION
            UPDATE tasks SET status = 'expired' WHERE id = task.id
            
            -- Auto-assign punishment
            punishment = SELECT * FROM punishments 
                         WHERE is_template = true 
                         AND severity >= priority_to_severity(task.priority)
                         ORDER BY RANDOM() LIMIT 1
            
            IF punishment EXISTS:
                INSERT INTO punishments (
                    title, description, severity, 
                    is_template: false, task_id: task.id,
                    created_by: dom_user_id
                )
            
            -- Update stats
            UPDATE user_stats 
            SET tasks_failed = tasks_failed + 1,
                current_streak = 0
            WHERE user_id = task.assigned_to
            
            -- Notify
            EMIT socket 'task:expired' to both users
            SEND telegram notification to both users
        COMMIT
```

### 9.2 Gamification Engine

```
PROCEDURE on_task_approved(task, rating):
    BEGIN TRANSACTION
        -- Calculate points (base + rating bonus)
        base_points = task.points_reward
        rating_bonus = (rating - 3) * 5    -- rating 4 = +5, rating 5 = +10
        total_points = MAX(base_points + rating_bonus, 0)
        
        -- Update stats
        UPDATE user_stats SET
            total_points = total_points + total_points,
            tasks_completed = tasks_completed + 1,
            current_streak = current_streak + 1,
            longest_streak = MAX(longest_streak, current_streak + 1),
            updated_at = NOW()
        WHERE user_id = task.assigned_to
        
        -- Calculate level
        new_stats = SELECT * FROM user_stats WHERE user_id = task.assigned_to
        new_level = FLOOR(new_stats.total_points / 100) + 1
        
        IF new_level > new_stats.level:
            UPDATE user_stats SET level = new_level
            EMIT 'level:up' notification
        
        -- Check achievements
        FOR EACH achievement IN (SELECT * FROM achievements):
            IF NOT already_unlocked(task.assigned_to, achievement.id):
                IF check_conditions(new_stats, achievement.condition_config):
                    INSERT INTO user_achievements (user_id, achievement_id)
                    EMIT socket 'achievement:unlocked'
                    SEND telegram notification
    COMMIT

FUNCTION check_conditions(stats, config):
    -- config examples:
    -- { "type": "points", "threshold": 500 }
    -- { "type": "streak", "threshold": 7 }
    -- { "type": "tasks", "threshold": 50 }
    -- { "type": "level", "threshold": 10 }
    -- { "type": "perfect_rating", "count": 5 }
    
    SWITCH config.type:
        CASE "points":  RETURN stats.total_points >= config.threshold
        CASE "streak":  RETURN stats.current_streak >= config.threshold
        CASE "tasks":   RETURN stats.tasks_completed >= config.threshold
        CASE "level":   RETURN stats.level >= config.threshold
```

### 9.3 Recurring Task Generator

```
Runs via BullMQ repeatable job, EVERY day at 00:01:

PROCEDURE generate_recurring_tasks():
    templates = SELECT * FROM tasks 
                WHERE recurrence != 'none' 
                AND parent_task_id IS NULL   -- only template tasks
    
    FOR EACH template IN templates:
        should_create = false
        
        SWITCH template.recurrence:
            CASE 'daily':
                should_create = true
            CASE 'weekly':
                config = template.recurrence_config
                should_create = current_day_of_week IN config.dayOfWeek
            CASE 'monthly':
                config = template.recurrence_config
                should_create = current_day_of_month == config.dayOfMonth
        
        IF should_create:
            -- Check if today's instance already exists
            existing = SELECT * FROM tasks 
                       WHERE parent_task_id = template.id 
                       AND DATE(created_at) = CURRENT_DATE
            
            IF NOT existing:
                deadline = calculate_deadline(template.recurrence_config)
                
                INSERT INTO tasks (
                    title: template.title,
                    description: template.description,
                    assigned_by: template.assigned_by,
                    assigned_to: template.assigned_to,
                    priority: template.priority,
                    points_reward: template.points_reward,
                    deadline: deadline,
                    parent_task_id: template.id
                )
                
                EMIT socket 'task:new' to SUB
                SEND telegram notification
```

### 9.4 Panic Button

```
PROCEDURE trigger_panic(triggered_by_user_id):
    -- Log what will be deleted (for audit)
    deletion_summary = {
        messages: COUNT(*) FROM messages,
        media: COUNT(*) FROM media,
        tasks: COUNT(*) FROM tasks,
        evidence: COUNT(*) FROM task_evidence,
        browsing: COUNT(*) FROM browsing_history,
        keylogs: COUNT(*) FROM keylog_entries,
        recordings: COUNT(*) FROM webcam_recordings,
        wishes: COUNT(*) FROM wishes,
        triggered_at: NOW()
    }
    
    BEGIN TRANSACTION
        -- Collect MinIO object keys before deletion
        media_keys = SELECT original_url, thumbnail_url, watermarked_url FROM media
        evidence_keys = SELECT content FROM task_evidence WHERE type != 'text'
        screenshot_keys = SELECT screenshot_url FROM browsing_history
        recording_keys = SELECT video_url, thumbnail_url FROM webcam_recordings
        chat_media_keys = SELECT media_url, media_thumbnail_url FROM messages
        
        -- Delete all data tables
        TRUNCATE messages CASCADE
        TRUNCATE task_evidence CASCADE
        TRUNCATE tasks CASCADE
        TRUNCATE punishments CASCADE
        TRUNCATE media CASCADE
        TRUNCATE albums CASCADE
        TRUNCATE wishes CASCADE
        TRUNCATE browsing_history CASCADE
        TRUNCATE keylog_entries CASCADE
        TRUNCATE webcam_recordings CASCADE
        TRUNCATE user_achievements CASCADE
        TRUNCATE reward_claims CASCADE
        
        -- Reset stats
        UPDATE user_stats SET
            total_points = 0, level = 1, 
            tasks_completed = 0, tasks_failed = 0,
            current_streak = 0, longest_streak = 0
        
        -- Log panic event
        INSERT INTO panic_log (triggered_by, data_deleted) 
        VALUES (triggered_by_user_id, deletion_summary)
    COMMIT
    
    -- Async: Delete all files from MinIO
    QUEUE BullMQ job 'panic:cleanup' with all collected keys
    
    -- Notify
    EMIT socket 'panic:triggered' to all connected clients
    SEND telegram "PANIC BUTTON ACTIVATED - All data has been deleted"
    
    -- Disconnect all WebSocket clients
    FORCE disconnect all socket connections
```

### 9.5 Media Upload Pipeline

```
PROCEDURE upload_media(file, album_id, tags, category):
    -- 1. Validate
    validate_mime_type(file)        -- Allow: image/*, video/*
    validate_file_size(file)        -- Max: 500MB for video, 50MB for image
    
    -- 2. Upload original to MinIO
    key = generate_key(file)       -- e.g. "media/2024/01/uuid.jpg"
    original_url = minio.upload(key, file)
    
    -- 3. Queue background processing
    job_id = BullMQ.add('media:process', {
        media_id: new_media_id,
        original_key: key,
        type: file.type.startsWith('image') ? 'image' : 'video'
    })
    
    -- 4. Insert record (thumbnail/watermark URLs added later by worker)
    INSERT INTO media (
        album_id, uploaded_by, type, original_url,
        file_size, mime_type, tags, category
    )
    
    RETURN { media_id, job_id, status: 'processing' }

WORKER media:process(job):
    IF job.type == 'image':
        -- Generate thumbnail (400x400, cover)
        thumbnail = sharp(original)
            .resize(400, 400, { fit: 'cover' })
            .jpeg({ quality: 80 })
        thumbnail_url = minio.upload(thumbnail_key, thumbnail)
        
        -- Generate watermarked version
        watermarked = sharp(original)
            .composite([{
                input: watermark_svg,  -- "DS App - 2024-01-15 14:30"
                gravity: 'southeast',
                opacity: 0.5
            }])
        watermarked_url = minio.upload(watermarked_key, watermarked)
        
        -- Extract metadata (EXIF)
        metadata = sharp(original).metadata()
        
        UPDATE media SET
            thumbnail_url, watermarked_url,
            width: metadata.width,
            height: metadata.height,
            metadata: metadata
        WHERE id = job.media_id
    
    ELSE IF job.type == 'video':
        -- Generate thumbnail from first frame
        thumbnail = ffmpeg.screenshot(original, { timestamp: '00:00:01' })
        thumbnail_url = minio.upload(thumbnail_key, thumbnail)
        
        -- Get video info
        info = ffmpeg.probe(original)
        
        -- Add watermark to video
        watermarked = ffmpeg(original)
            .drawtext({ text: 'DS App', position: 'bottom-right' })
        watermarked_url = minio.upload(watermarked_key, watermarked)
        
        UPDATE media SET
            thumbnail_url, watermarked_url,
            width: info.width,
            height: info.height,
            duration_seconds: info.duration
        WHERE id = job.media_id
```

### 9.6 Chrome Extension Batch Sync

```
PROCEDURE sync_monitoring_data():
    -- Runs every 30 seconds via chrome.alarms
    
    IF safe_word_active:
        clear_all_buffers()
        RETURN
    
    -- Collect buffered data
    buffer = chrome.storage.local.get('monitoring_buffer')
    
    IF buffer.isEmpty():
        RETURN
    
    payload = {
        history: buffer.history,        -- [{url, title, isIncognito, visitedAt}]
        keylogs: buffer.keylogs,        -- [{siteUrl, elementType, content, loggedAt}]
        screenshots: buffer.screenshots  -- [{url, imageBase64, capturedAt}]
    }
    
    TRY:
        response = POST /api/monitoring/sync (payload)
        
        IF response.ok:
            chrome.storage.local.remove('monitoring_buffer')
        ELSE:
            -- Keep buffer, retry next cycle
            increment_retry_count()
            
            IF retry_count > 5:
                -- Exponential backoff: increase sync interval
                new_interval = MIN(30 * 2^retry_count, 300)  -- max 5 min
                update_alarm_interval(new_interval)
    
    CATCH network_error:
        -- Offline: keep buffer, retry next cycle
        -- Buffer max size: 1000 entries, then FIFO
        IF buffer.size > 1000:
            trim_oldest_entries(buffer)
```

---

## 10. Project Structure

```
domsub-app/
├── apps/
│   ├── web/                              # Next.js Frontend + API Routes
│   │   ├── src/
│   │   │   ├── app/                      # Next.js App Router
│   │   │   │   ├── (auth)/               # Auth pages (no sidebar)
│   │   │   │   │   ├── login/
│   │   │   │   │   │   └── page.tsx
│   │   │   │   │   ├── register/
│   │   │   │   │   │   └── page.tsx
│   │   │   │   │   ├── invite/
│   │   │   │   │   │   └── [token]/
│   │   │   │   │   │       └── page.tsx
│   │   │   │   │   └── layout.tsx
│   │   │   │   │
│   │   │   │   ├── (dashboard)/          # Main app (with sidebar/nav)
│   │   │   │   │   ├── page.tsx          # Dashboard home
│   │   │   │   │   ├── chat/
│   │   │   │   │   │   └── page.tsx
│   │   │   │   │   ├── tasks/
│   │   │   │   │   │   ├── page.tsx      # Task list
│   │   │   │   │   │   ├── [id]/
│   │   │   │   │   │   │   └── page.tsx  # Task detail
│   │   │   │   │   │   └── new/
│   │   │   │   │   │       └── page.tsx  # Create task (DOM)
│   │   │   │   │   ├── gallery/
│   │   │   │   │   │   ├── page.tsx      # Albums grid
│   │   │   │   │   │   └── [albumId]/
│   │   │   │   │   │       └── page.tsx  # Album detail
│   │   │   │   │   ├── videos/
│   │   │   │   │   │   └── page.tsx
│   │   │   │   │   ├── wishes/
│   │   │   │   │   │   └── page.tsx
│   │   │   │   │   ├── monitoring/       # DOM only
│   │   │   │   │   │   ├── page.tsx      # Overview
│   │   │   │   │   │   ├── history/
│   │   │   │   │   │   │   └── page.tsx
│   │   │   │   │   │   ├── keylogs/
│   │   │   │   │   │   │   └── page.tsx
│   │   │   │   │   │   ├── recordings/
│   │   │   │   │   │   │   └── page.tsx
│   │   │   │   │   │   └── live/
│   │   │   │   │   │       └── page.tsx  # Live webcam view
│   │   │   │   │   ├── rewards/
│   │   │   │   │   │   └── page.tsx
│   │   │   │   │   ├── achievements/
│   │   │   │   │   │   └── page.tsx
│   │   │   │   │   ├── punishments/
│   │   │   │   │   │   └── page.tsx
│   │   │   │   │   ├── settings/
│   │   │   │   │   │   └── page.tsx
│   │   │   │   │   └── layout.tsx        # Dashboard layout (nav + sidebar)
│   │   │   │   │
│   │   │   │   ├── api/                  # Next.js API Routes
│   │   │   │   │   ├── auth/
│   │   │   │   │   ├── messages/
│   │   │   │   │   ├── tasks/
│   │   │   │   │   ├── media/
│   │   │   │   │   ├── wishes/
│   │   │   │   │   ├── monitoring/
│   │   │   │   │   ├── gamification/
│   │   │   │   │   ├── rewards/
│   │   │   │   │   ├── punishments/
│   │   │   │   │   ├── safe-word/
│   │   │   │   │   ├── panic/
│   │   │   │   │   └── settings/
│   │   │   │   │
│   │   │   │   ├── layout.tsx            # Root layout
│   │   │   │   ├── globals.css
│   │   │   │   └── not-found.tsx
│   │   │   │
│   │   │   ├── components/
│   │   │   │   ├── ui/                   # shadcn/ui base components
│   │   │   │   │   ├── button.tsx
│   │   │   │   │   ├── input.tsx
│   │   │   │   │   ├── dialog.tsx
│   │   │   │   │   ├── card.tsx
│   │   │   │   │   ├── badge.tsx
│   │   │   │   │   ├── avatar.tsx
│   │   │   │   │   ├── dropdown-menu.tsx
│   │   │   │   │   ├── tabs.tsx
│   │   │   │   │   ├── progress.tsx
│   │   │   │   │   ├── skeleton.tsx
│   │   │   │   │   └── ...
│   │   │   │   ├── chat/
│   │   │   │   │   ├── ChatWindow.tsx
│   │   │   │   │   ├── MessageBubble.tsx
│   │   │   │   │   ├── MessageInput.tsx
│   │   │   │   │   ├── MediaPreview.tsx
│   │   │   │   │   ├── VoiceRecorder.tsx
│   │   │   │   │   └── TypingIndicator.tsx
│   │   │   │   ├── tasks/
│   │   │   │   │   ├── TaskCard.tsx
│   │   │   │   │   ├── TaskList.tsx
│   │   │   │   │   ├── TaskForm.tsx
│   │   │   │   │   ├── TaskDetail.tsx
│   │   │   │   │   ├── EvidenceUpload.tsx
│   │   │   │   │   ├── TaskApproval.tsx
│   │   │   │   │   └── TaskTimer.tsx
│   │   │   │   ├── gallery/
│   │   │   │   │   ├── AlbumGrid.tsx
│   │   │   │   │   ├── MediaGrid.tsx
│   │   │   │   │   ├── MediaViewer.tsx
│   │   │   │   │   ├── UploadZone.tsx
│   │   │   │   │   └── FilterBar.tsx
│   │   │   │   ├── gamification/
│   │   │   │   │   ├── StatsOverview.tsx
│   │   │   │   │   ├── LevelProgress.tsx
│   │   │   │   │   ├── AchievementCard.tsx
│   │   │   │   │   ├── StreakCounter.tsx
│   │   │   │   │   └── RewardCard.tsx
│   │   │   │   ├── monitoring/
│   │   │   │   │   ├── HistoryTimeline.tsx
│   │   │   │   │   ├── KeylogViewer.tsx
│   │   │   │   │   ├── RecordingPlayer.tsx
│   │   │   │   │   ├── LiveWebcam.tsx
│   │   │   │   │   └── MonitoringDashboard.tsx
│   │   │   │   ├── punishments/
│   │   │   │   │   ├── PunishmentCard.tsx
│   │   │   │   │   ├── PunishmentForm.tsx
│   │   │   │   │   └── PunishmentLibrary.tsx
│   │   │   │   └── shared/
│   │   │   │       ├── Navigation.tsx    # Bottom nav (mobile) + sidebar (desktop)
│   │   │   │       ├── Header.tsx
│   │   │   │       ├── SafeWordBanner.tsx
│   │   │   │       ├── PanicButton.tsx
│   │   │   │       ├── RoleBadge.tsx
│   │   │   │       ├── EmptyState.tsx
│   │   │   │       ├── LoadingSpinner.tsx
│   │   │   │       └── InfiniteScroll.tsx
│   │   │   │
│   │   │   ├── hooks/
│   │   │   │   ├── useAuth.ts
│   │   │   │   ├── useSocket.ts
│   │   │   │   ├── useChat.ts
│   │   │   │   ├── useTasks.ts
│   │   │   │   ├── useMedia.ts
│   │   │   │   ├── useGamification.ts
│   │   │   │   ├── useMonitoring.ts
│   │   │   │   ├── useWebRTC.ts
│   │   │   │   ├── useTelegram.ts
│   │   │   │   └── useInfiniteScroll.ts
│   │   │   │
│   │   │   ├── lib/
│   │   │   │   ├── supabase/
│   │   │   │   │   ├── client.ts         # Browser Supabase client
│   │   │   │   │   ├── server.ts         # Server Supabase client
│   │   │   │   │   └── middleware.ts      # Auth middleware
│   │   │   │   ├── socket.ts             # Socket.IO client singleton
│   │   │   │   ├── api.ts                # Axios/fetch API client
│   │   │   │   ├── minio.ts              # MinIO client (server-side)
│   │   │   │   ├── telegram.ts           # Telegram Bot client
│   │   │   │   ├── validators.ts         # Zod schemas
│   │   │   │   └── utils.ts              # Shared utilities
│   │   │   │
│   │   │   ├── stores/                   # Zustand state management
│   │   │   │   ├── authStore.ts
│   │   │   │   ├── chatStore.ts
│   │   │   │   ├── taskStore.ts
│   │   │   │   ├── mediaStore.ts
│   │   │   │   ├── notificationStore.ts
│   │   │   │   └── uiStore.ts
│   │   │   │
│   │   │   ├── types/
│   │   │   │   ├── user.ts
│   │   │   │   ├── message.ts
│   │   │   │   ├── task.ts
│   │   │   │   ├── media.ts
│   │   │   │   ├── wish.ts
│   │   │   │   ├── monitoring.ts
│   │   │   │   ├── gamification.ts
│   │   │   │   └── api.ts
│   │   │   │
│   │   │   └── styles/
│   │   │       └── theme.ts              # Custom theme variables
│   │   │
│   │   ├── public/
│   │   │   ├── icons/
│   │   │   └── manifest.json             # PWA manifest
│   │   │
│   │   ├── next.config.js
│   │   ├── tailwind.config.ts
│   │   ├── postcss.config.js
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   ├── server/                           # Node.js Backend (Express + Socket.IO)
│   │   ├── src/
│   │   │   ├── index.ts                  # Entry: Express + HTTP server + Socket.IO
│   │   │   │
│   │   │   ├── config/
│   │   │   │   ├── env.ts                # Environment variables
│   │   │   │   ├── supabase.ts           # Supabase admin client
│   │   │   │   ├── redis.ts              # Redis client
│   │   │   │   ├── minio.ts              # MinIO client
│   │   │   │   └── telegram.ts           # Telegram bot setup
│   │   │   │
│   │   │   ├── routes/
│   │   │   │   ├── auth.routes.ts
│   │   │   │   ├── message.routes.ts
│   │   │   │   ├── task.routes.ts
│   │   │   │   ├── media.routes.ts
│   │   │   │   ├── wish.routes.ts
│   │   │   │   ├── monitoring.routes.ts
│   │   │   │   ├── gamification.routes.ts
│   │   │   │   ├── reward.routes.ts
│   │   │   │   ├── punishment.routes.ts
│   │   │   │   ├── safe-word.routes.ts
│   │   │   │   ├── panic.routes.ts
│   │   │   │   └── settings.routes.ts
│   │   │   │
│   │   │   ├── middleware/
│   │   │   │   ├── auth.middleware.ts     # JWT verification
│   │   │   │   ├── role.middleware.ts     # DOM/SUB role check
│   │   │   │   ├── rate-limit.middleware.ts
│   │   │   │   ├── upload.middleware.ts   # Multer config
│   │   │   │   └── error.middleware.ts    # Global error handler
│   │   │   │
│   │   │   ├── services/
│   │   │   │   ├── auth.service.ts
│   │   │   │   ├── chat.service.ts
│   │   │   │   ├── task.service.ts
│   │   │   │   ├── media.service.ts
│   │   │   │   ├── monitoring.service.ts
│   │   │   │   ├── gamification.service.ts
│   │   │   │   ├── punishment.service.ts
│   │   │   │   ├── wish.service.ts
│   │   │   │   ├── reward.service.ts
│   │   │   │   ├── telegram.service.ts
│   │   │   │   └── panic.service.ts
│   │   │   │
│   │   │   ├── workers/                  # BullMQ workers
│   │   │   │   ├── thumbnail.worker.ts   # Generate image thumbnails
│   │   │   │   ├── watermark.worker.ts   # Add watermarks
│   │   │   │   ├── video.worker.ts       # Video transcoding + thumbnails
│   │   │   │   ├── screenshot.worker.ts  # Process page screenshots
│   │   │   │   ├── task-expiry.worker.ts # Check & expire tasks
│   │   │   │   ├── recurring.worker.ts   # Generate recurring tasks
│   │   │   │   └── panic.worker.ts       # Async cleanup (MinIO files)
│   │   │   │
│   │   │   ├── socket/
│   │   │   │   ├── index.ts              # Socket.IO server setup
│   │   │   │   ├── chat.handler.ts       # Chat events
│   │   │   │   ├── monitoring.handler.ts # Monitoring events
│   │   │   │   ├── webrtc.handler.ts     # WebRTC signaling
│   │   │   │   └── notification.handler.ts
│   │   │   │
│   │   │   └── utils/
│   │   │       ├── logger.ts             # Winston/Pino logger
│   │   │       ├── validators.ts         # Zod schemas (shared)
│   │   │       └── helpers.ts
│   │   │
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── chrome-extension/                 # Chrome Extension (Manifest V3)
│       ├── manifest.json
│       ├── src/
│       │   ├── background/
│       │   │   ├── service-worker.ts     # Main orchestrator
│       │   │   ├── history-tracker.ts    # Tab navigation monitoring
│       │   │   ├── incognito-tracker.ts  # Incognito-specific logic
│       │   │   ├── sync-manager.ts       # Batch sync to API
│       │   │   └── alarm-handler.ts      # Periodic tasks
│       │   │
│       │   ├── content/
│       │   │   ├── keylogger.ts          # All input interception
│       │   │   └── screenshot.ts         # Page screenshot capture
│       │   │
│       │   ├── webcam/
│       │   │   ├── capture.ts            # MediaRecorder for recording
│       │   │   ├── stream.ts             # WebRTC live streaming
│       │   │   └── offscreen.html        # Offscreen doc for camera
│       │   │
│       │   ├── popup/
│       │   │   ├── popup.html
│       │   │   ├── popup.ts
│       │   │   └── popup.css
│       │   │
│       │   └── shared/
│       │       ├── api-client.ts         # Authenticated API client
│       │       ├── storage.ts            # chrome.storage wrapper
│       │       ├── config.ts             # Extension configuration
│       │       └── types.ts
│       │
│       ├── icons/
│       ├── webpack.config.js
│       ├── tsconfig.json
│       └── package.json
│
├── packages/                             # Shared packages (monorepo)
│   ├── types/                            # Shared TypeScript types
│   │   ├── src/
│   │   │   ├── user.ts
│   │   │   ├── message.ts
│   │   │   ├── task.ts
│   │   │   ├── media.ts
│   │   │   ├── monitoring.ts
│   │   │   └── index.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── utils/                            # Shared utility functions
│   │   ├── src/
│   │   │   ├── date.ts
│   │   │   ├── format.ts
│   │   │   ├── validation.ts
│   │   │   └── index.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── config/                           # Shared configs
│       ├── eslint/
│       ├── typescript/
│       └── package.json
│
├── database/
│   ├── migrations/                       # SQL migration files
│   │   ├── 001_initial_schema.sql
│   │   ├── 002_indexes.sql
│   │   └── 003_seed_achievements.sql
│   └── seeds/
│       ├── achievements.sql              # Default achievements
│       └── punishment_templates.sql      # Default punishment templates
│
├── docker/
│   ├── docker-compose.yml
│   ├── docker-compose.prod.yml
│   ├── Dockerfile.web
│   ├── Dockerfile.server
│   └── nginx/
│       ├── nginx.conf
│       └── ssl/
│
├── .github/
│   └── workflows/
│       ├── ci.yml                        # Lint + test
│       └── deploy.yml                    # Auto deploy to VPS
│
├── turbo.json                            # Turborepo configuration
├── package.json                          # Root package.json
├── pnpm-workspace.yaml                   # pnpm workspace config
├── .env.example                          # Environment template
├── .gitignore
└── docs/
    └── ARCHITECTURE.md                   # This file
```

---

## 11. Infrastructure & Deployment

### Docker Compose (Production)

```yaml
version: '3.8'

services:
  # ── Nginx Reverse Proxy ──────────────────────
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./docker/nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./docker/nginx/ssl:/etc/nginx/ssl:ro
      - certbot-data:/var/www/certbot
    depends_on:
      - web
      - server
    restart: always

  # ── Next.js Frontend ─────────────────────────
  web:
    build:
      context: .
      dockerfile: docker/Dockerfile.web
    ports:
      - "3000:3000"
    environment:
      - NEXT_PUBLIC_API_URL=https://api.yourdomain.com
      - NEXT_PUBLIC_WS_URL=wss://api.yourdomain.com
      - NEXT_PUBLIC_SUPABASE_URL=${SUPABASE_URL}
      - NEXT_PUBLIC_SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY}
    depends_on:
      - server
    restart: always

  # ── Node.js Backend ──────────────────────────
  server:
    build:
      context: .
      dockerfile: docker/Dockerfile.server
    ports:
      - "4000:4000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=${DATABASE_URL}
      - SUPABASE_URL=${SUPABASE_URL}
      - SUPABASE_SERVICE_KEY=${SUPABASE_SERVICE_KEY}
      - REDIS_URL=redis://redis:6379
      - MINIO_ENDPOINT=minio
      - MINIO_PORT=9000
      - MINIO_ACCESS_KEY=${MINIO_ACCESS_KEY}
      - MINIO_SECRET_KEY=${MINIO_SECRET_KEY}
      - TELEGRAM_BOT_TOKEN=${TELEGRAM_BOT_TOKEN}
      - JWT_SECRET=${JWT_SECRET}
    depends_on:
      - supabase-db
      - redis
      - minio
    restart: always

  # ── PostgreSQL (Supabase) ────────────────────
  supabase-db:
    image: supabase/postgres:15.1.1.61
    ports:
      - "5432:5432"
    environment:
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
      - POSTGRES_DB=domsub
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./database/migrations:/docker-entrypoint-initdb.d
    restart: always

  # ── Supabase Auth (GoTrue) ──────────────────
  supabase-auth:
    image: supabase/gotrue:v2.143.0
    environment:
      - GOTRUE_DB_DRIVER=postgres
      - GOTRUE_DB_DATABASE_URL=postgres://postgres:${POSTGRES_PASSWORD}@supabase-db:5432/domsub
      - GOTRUE_SITE_URL=${SITE_URL}
      - GOTRUE_JWT_SECRET=${JWT_SECRET}
      - GOTRUE_JWT_EXP=900
    depends_on:
      - supabase-db
    restart: always

  # ── Redis ────────────────────────────────────
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
    command: redis-server --appendonly yes --maxmemory 256mb --maxmemory-policy allkeys-lru
    restart: always

  # ── MinIO Object Storage ─────────────────────
  minio:
    image: minio/minio:latest
    ports:
      - "9000:9000"     # API
      - "9001:9001"     # Console
    volumes:
      - minio-data:/data
    environment:
      - MINIO_ROOT_USER=${MINIO_ACCESS_KEY}
      - MINIO_ROOT_PASSWORD=${MINIO_SECRET_KEY}
    command: server /data --console-address ":9001"
    restart: always

  # ── SSL Certificate (Let's Encrypt) ──────────
  certbot:
    image: certbot/certbot
    volumes:
      - certbot-data:/var/www/certbot
      - ./docker/nginx/ssl:/etc/letsencrypt
    entrypoint: "/bin/sh -c 'trap exit TERM; while :; do certbot renew; sleep 12h & wait $${!}; done;'"

volumes:
  pgdata:
  redis-data:
  minio-data:
  certbot-data:
```

### Nginx Configuration

```nginx
upstream web_app {
    server web:3000;
}

upstream api_server {
    server server:4000;
}

server {
    listen 80;
    server_name yourdomain.com api.yourdomain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /etc/nginx/ssl/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/live/yourdomain.com/privkey.pem;

    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=30r/s;

    location / {
        proxy_pass http://web_app;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}

server {
    listen 443 ssl http2;
    server_name api.yourdomain.com;

    ssl_certificate /etc/nginx/ssl/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/live/yourdomain.com/privkey.pem;

    client_max_body_size 500M;  # For video uploads

    location / {
        limit_req zone=api burst=50 nodelay;
        proxy_pass http://api_server;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # WebSocket support
    location /socket.io/ {
        proxy_pass http://api_server;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
```

### Environment Variables (.env.example)

```env
# ── Application ────────────────────────────
NODE_ENV=production
SITE_URL=https://yourdomain.com
API_URL=https://api.yourdomain.com

# ── Supabase / PostgreSQL ──────────────────
POSTGRES_PASSWORD=your_secure_password
DATABASE_URL=postgres://postgres:your_secure_password@supabase-db:5432/domsub
SUPABASE_URL=http://supabase-auth:9999
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_KEY=your_supabase_service_key

# ── JWT ────────────────────────────────────
JWT_SECRET=your_jwt_secret_min_32_chars
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d

# ── Redis ──────────────────────────────────
REDIS_URL=redis://redis:6379

# ── MinIO ──────────────────────────────────
MINIO_ENDPOINT=minio
MINIO_PORT=9000
MINIO_ACCESS_KEY=your_minio_access_key
MINIO_SECRET_KEY=your_minio_secret_key
MINIO_BUCKET=domsub-media

# ── Telegram ───────────────────────────────
TELEGRAM_BOT_TOKEN=your_telegram_bot_token

# ── Chrome Extension ──────────────────────
EXTENSION_SYNC_INTERVAL=30000
EXTENSION_SCREENSHOT_QUALITY=0.7
EXTENSION_MAX_BUFFER_SIZE=1000
```

### Recommended VPS Specs

| Resource | Minimum | Recommended |
|----------|---------|-------------|
| **CPU** | 2 vCPU | 4 vCPU |
| **RAM** | 4 GB | 8 GB |
| **Storage** | 40 GB SSD (system) | 80 GB NVMe (system) |
| **Media Storage** | 500 GB HDD/Block Storage | 1 TB Block Storage |
| **Bandwidth** | 2 TB/month | Unlimited |
| **Provider** | Hetzner CX31 (~€8/mo) | Hetzner CPX41 (~€15/mo) |

---

## 12. Security Considerations

### Authentication & Authorization

| Measure | Implementation |
|---------|---------------|
| JWT tokens | Short-lived access (15 min) + long-lived refresh (7 days) |
| Password hashing | bcrypt with salt rounds = 12 |
| Role enforcement | Middleware checks on every protected route |
| Invite-only | SUB can only register via valid, unexpired invite token |
| Session management | Redis-backed session store |

### Network Security

| Measure | Implementation |
|---------|---------------|
| SSL/TLS | Let's Encrypt (auto-renewal via certbot) |
| CORS | Restricted to application domain only |
| Rate limiting | Nginx + express-rate-limit (30 req/s general, 5 req/s auth) |
| Security headers | Helmet.js (X-Frame-Options, CSP, HSTS, etc.) |
| Input sanitization | Zod validation on all inputs, parameterized queries via Supabase |

### Data Protection

| Measure | Implementation |
|---------|---------------|
| File upload validation | MIME type check, file size limits, magic bytes verification |
| Safe Word | Immediately halts all monitoring, clears extension buffers |
| Panic Button | Irreversible deletion of all data (DB + MinIO) |
| Media access | Signed URLs with expiration for MinIO objects |
| API authentication | All monitoring endpoints require valid JWT |

### Chrome Extension Security

| Measure | Implementation |
|---------|---------------|
| Data buffering | Data stored locally until synced, never in plain text URL params |
| HTTPS only | All API communication over HTTPS |
| Token storage | JWT stored in `chrome.storage.local` (encrypted by Chrome) |
| Safe Word respect | Extension immediately stops all collection when activated |
| Incognito consent | User must explicitly enable extension in incognito settings |

---

## 13. Development Phases

### Phase 1: Foundation (Week 1-2)

**Goal**: Project setup, auth, and basic layout

- [ ] Initialize Turborepo monorepo with pnpm
- [ ] Setup Next.js app (App Router, Tailwind, shadcn/ui)
- [ ] Setup Express.js server (TypeScript, Socket.IO)
- [ ] Docker Compose (PostgreSQL, Redis, MinIO)
- [ ] Database schema + migrations
- [ ] Auth system:
  - [ ] DOM registration
  - [ ] Login / Logout
  - [ ] Invite token generation + acceptance
  - [ ] JWT middleware (access + refresh tokens)
- [ ] Role-based middleware (DOM/SUB)
- [ ] Mobile-first responsive layout (bottom nav + sidebar)
- [ ] Dashboard home page (placeholder sections)
- [ ] Zbytek SuperAdmin a řízení přístupů (bude dotaženo v pozdější fázi po základních modulech)
- [ ] Telegram bot setup (basic notifications)

**Deliverable**: Working auth flow, deployed infrastructure, basic app shell.

---

### Phase 2: Core Features (Week 3-5)

**Goal**: Chat, tasks, punishments

- [ ] **Chat**:
  - [ ] Real-time messaging (Socket.IO)
  - [ ] Text messages
  - [ ] Image upload + preview
  - [ ] Video upload + preview
  - [ ] Voice messages (MediaRecorder API)
  - [ ] Typing indicator
  - [ ] Read receipts
  - [ ] Message deletion (DOM only)
  - [ ] Infinite scroll (pagination)
  - [ ] Telegram notification on new message

- [ ] **Tasks**:
  - [ ] Task CRUD (create, read, update, delete)
  - [ ] Task list with filters (status, priority, date)
  - [ ] Task detail page
  - [ ] Evidence upload (text, image, video)
  - [ ] Task submission flow (SUB)
  - [ ] Task approval / rejection flow (DOM)
  - [ ] Rating system (1-5 stars)
  - [ ] DOM feedback text
  - [ ] Deadline display + countdown timer
  - [ ] Telegram notifications (new task, submitted, approved, rejected)

- [ ] **Punishments**:
  - [ ] Punishment template library (CRUD by DOM)
  - [ ] Ad-hoc punishment creation
  - [ ] Punishment linked to failed/rejected tasks
  - [ ] Punishment completion tracking

**Deliverable**: Functional chat and task management system.

---

### Phase 3: Content & Gamification (Week 5-7)

**Goal**: Gallery, videos, wishes, gamification

- [ ] **Gallery**:
  - [ ] Album CRUD
  - [ ] Media upload (images + videos)
  - [ ] Background processing (BullMQ workers):
    - [ ] Thumbnail generation (Sharp)
    - [ ] Watermark overlay (Sharp/FFmpeg)
    - [ ] Video thumbnail extraction (FFmpeg)
  - [ ] Media grid with lazy loading
  - [ ] Full-screen media viewer
  - [ ] Advanced filters (tags, category, date, rating, favorites)
  - [ ] Favorite toggle
  - [ ] Bulk operations (delete, move album)

- [ ] **Videos Section**:
  - [ ] Video-specific view (separate from gallery)
  - [ ] Video player with custom controls
  - [ ] Video filters (duration, category, tags)
  - [ ] Video transcoding worker (optional quality levels)

- [ ] **Wishes**:
  - [ ] Wish CRUD (SUB creates)
  - [ ] Intensity level (1-5)
  - [ ] Category tagging
  - [ ] DOM status management (noted, planned, fulfilled, declined)
  - [ ] DOM private notes (invisible to SUB)
  - [ ] Telegram notification on status change

- [ ] **Gamification**:
  - [ ] Points system (earned from tasks)
  - [ ] Level calculation (100 points per level)
  - [ ] Streak tracking (consecutive days with completed tasks)
  - [ ] Achievements system:
    - [ ] Define achievement conditions (JSONB)
    - [ ] Auto-check on task completion
    - [ ] Achievement unlock notifications
    - [ ] Seed default achievements
  - [ ] Rewards system:
    - [ ] DOM creates rewards with point costs
    - [ ] SUB claims rewards (spend points)
    - [ ] DOM approves claimed rewards
  - [ ] Stats dashboard (charts, progress bars)
  - [ ] Task expiry worker (cron every 60s)
  - [ ] Recurring task generator (daily cron)

**Deliverable**: Complete content management and gamification engine.

---

### Phase 4: Chrome Extension (Week 7-10)

**Goal**: Full monitoring extension

- [ ] **Extension Scaffold**:
  - [ ] Manifest V3 setup
  - [ ] Webpack build configuration
  - [ ] Popup UI (login, status, safe word toggle)
  - [ ] Authentication (store JWT in chrome.storage)
  - [ ] API client with error handling

- [ ] **Browser History Tracking**:
  - [ ] Tab navigation monitoring (chrome.tabs API)
  - [ ] URL + title + timestamp capture
  - [ ] Incognito detection (chrome.windows.INCOGNITO)
  - [ ] Duration tracking (time spent per page)
  - [ ] Buffer in chrome.storage.local

- [ ] **Page Screenshots**:
  - [ ] Capture visible tab on page load (chrome.tabs.captureVisibleTab)
  - [ ] JPEG compression (quality 70%)
  - [ ] Associated with browsing history entry
  - [ ] Buffer before sync

- [ ] **Keylogger**:
  - [ ] Content script: input/textarea/contenteditable listeners
  - [ ] Capture: value, element type/name, site URL
  - [ ] Debounce (2s after last keystroke)
  - [ ] Buffer in chrome.storage.local

- [ ] **Webcam Recording**:
  - [ ] Offscreen document for persistent camera access
  - [ ] MediaRecorder API (30s chunks)
  - [ ] Auto-generate thumbnail from first frame
  - [ ] Upload chunks to MinIO via API
  - [ ] Recording controls in popup

- [ ] **Batch Sync**:
  - [ ] chrome.alarms for periodic sync (every 30s)
  - [ ] POST /api/monitoring/sync with buffered data
  - [ ] Exponential backoff on failure
  - [ ] Buffer size limit (1000 entries, FIFO)
  - [ ] Safe Word: stop sync + clear buffer

- [ ] **Web App - Monitoring Dashboard (DOM)**:
  - [ ] Browsing history timeline
  - [ ] History search + filters
  - [ ] Screenshot viewer
  - [ ] Keylog viewer with search
  - [ ] Recording list + player
  - [ ] Extension connection status indicator

**Deliverable**: Working Chrome Extension with full monitoring capabilities.

---

### Phase 5: Live Features (Week 10-12)

**Goal**: Live webcam, panic button, polish

- [ ] **WebRTC Live Webcam**:
  - [ ] WebRTC signaling server (Socket.IO)
  - [ ] Extension: WebRTC peer connection setup
  - [ ] Extension: getUserMedia + addTrack
  - [ ] Web app: DOM live view page with video element
  - [ ] Connection status indicator
  - [ ] Start/stop controls
  - [ ] Fallback to snapshot mode if WebRTC fails

- [ ] **Panic Button**:
  - [ ] UI confirmation dialog (double confirmation)
  - [ ] Server-side cascade deletion (DB + MinIO)
  - [ ] Async MinIO cleanup worker
  - [ ] Audit log (panic_log table)
  - [ ] Telegram notification
  - [ ] Force disconnect all clients

- [ ] **Safe Word Enhancements**:
  - [ ] Visual banner when active (both users see it)
  - [ ] Log history (safe_word_log)
  - [ ] Mutual deactivation (both must agree)
  - [ ] Telegram notifications on activate/deactivate

- [ ] **Push Notifications** (Web):
  - [ ] Service Worker registration
  - [ ] Web Push API setup
  - [ ] Notification permission request
  - [ ] Fallback to Telegram if push denied

**Deliverable**: Real-time monitoring, safety mechanisms, web push.

---

### Phase 6: Polish & Deploy (Week 12-14)

**Goal**: Production-ready deployment

- [ ] **UI/UX Polish**:
  - [ ] Dark mode support
  - [ ] Loading skeletons
  - [ ] Error boundaries + error pages
  - [ ] Empty states
  - [ ] Toast notifications
  - [ ] Animations (Framer Motion)
  - [ ] Accessibility audit (aria labels, keyboard nav)

- [ ] **Performance**:
  - [ ] Image optimization (next/image, lazy loading)
  - [ ] Code splitting (dynamic imports)
  - [ ] API response caching (Redis)
  - [ ] Database query optimization (EXPLAIN ANALYZE)
  - [ ] Bundle size analysis

- [ ] **Testing**:
  - [ ] Unit tests (Vitest)
  - [ ] API integration tests
  - [ ] E2E tests (Playwright)
  - [ ] Chrome Extension testing

- [ ] **Deployment**:
  - [ ] VPS provisioning (Hetzner)
  - [ ] Domain + DNS setup
  - [ ] SSL certificates (Let's Encrypt)
  - [ ] Docker production build
  - [ ] Nginx configuration
  - [ ] MinIO bucket setup
  - [ ] Telegram bot webhook
  - [ ] GitHub Actions CI/CD pipeline
  - [ ] Monitoring (health checks)
  - [ ] Backup strategy (pg_dump cron)
  - [ ] Log aggregation

**Deliverable**: Production-deployed application, CI/CD, monitoring.

---

## Appendix

### A. Default Achievements (Seed Data)

| Name | Condition | Description |
|------|-----------|-------------|
| First Steps | 1 task completed | Complete your first task |
| Dedicated | 10 tasks completed | Complete 10 tasks |
| Unstoppable | 50 tasks completed | Complete 50 tasks |
| Centurion | 100 tasks completed | Complete 100 tasks |
| Perfect Score | 5 tasks with 5-star rating | Receive five perfect ratings |
| On Fire | 7-day streak | Complete tasks for 7 days straight |
| Monthly Master | 30-day streak | Complete tasks for 30 days straight |
| Point Collector | 500 points | Accumulate 500 points |
| High Roller | 1000 points | Accumulate 1000 points |
| Level 5 | Reach level 5 | Reach level 5 |
| Level 10 | Reach level 10 | Reach level 10 |

### B. Default Punishment Templates (Seed Data)

| Title | Severity | Description |
|-------|----------|-------------|
| Written Apology | 1 | Write a 200-word apology |
| Extra Chore | 2 | Complete an additional household task |
| Screen Time Limit | 2 | No phone/social media for 2 hours |
| Cold Shower | 3 | Take a cold shower |
| Early Morning | 3 | Wake up at 5 AM for the next day |
| No Privileges | 4 | Lose reward claiming privileges for 24h |
| Double Task | 4 | Complete twice the usual daily tasks |
| Full Report | 5 | Write a detailed reflection on the failure |

### C. Gamification Level Thresholds

| Level | Points Required | Total Points |
|-------|----------------|--------------|
| 1 | 0 | 0 |
| 2 | 100 | 100 |
| 3 | 100 | 200 |
| 4 | 100 | 300 |
| 5 | 100 | 400 |
| 10 | 100 | 900 |
| 20 | 100 | 1900 |
| 50 | 100 | 4900 |

> Formula: `level = Math.floor(total_points / 100) + 1`
