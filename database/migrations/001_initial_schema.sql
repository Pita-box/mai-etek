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
    recurrence_config JSONB,
    parent_task_id    UUID REFERENCES tasks(id),
    rating            INT CHECK (rating >= 1 AND rating <= 5),
    dom_feedback      TEXT,
    created_at        TIMESTAMPTZ DEFAULT NOW(),
    updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE task_evidence (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id         UUID REFERENCES tasks(id) ON DELETE CASCADE NOT NULL,
    type            VARCHAR(20) NOT NULL,
    content         TEXT,
    thumbnail_url   TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- PUNISHMENTS
CREATE TABLE punishments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title           VARCHAR(255) NOT NULL,
    description     TEXT,
    severity        INT CHECK (severity >= 1 AND severity <= 5),
    is_template     BOOLEAN DEFAULT false,
    task_id         UUID REFERENCES tasks(id),
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
    condition_config  JSONB,
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
    type              VARCHAR(20) NOT NULL,
    original_url      TEXT NOT NULL,
    thumbnail_url     TEXT,
    watermarked_url   TEXT,
    file_size         BIGINT,
    mime_type         VARCHAR(100),
    width             INT,
    height            INT,
    duration_seconds  INT,
    tags              TEXT[],
    category          VARCHAR(100),
    rating            INT CHECK (rating >= 1 AND rating <= 5),
    is_favorite       BOOLEAN DEFAULT false,
    metadata          JSONB,
    created_at        TIMESTAMPTZ DEFAULT NOW()
);

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
    intensity       INT CHECK (intensity >= 1 AND intensity <= 5),
    status          wish_status DEFAULT 'new',
    dom_notes       TEXT,
    fulfilled_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

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

CREATE TABLE keylog_entries (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID REFERENCES users(id) NOT NULL,
    site_url        TEXT,
    element_type    VARCHAR(50),
    element_name    VARCHAR(100),
    content         TEXT NOT NULL,
    logged_at       TIMESTAMPTZ NOT NULL,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

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
    data_deleted    JSONB,
    triggered_at    TIMESTAMPTZ DEFAULT NOW()
);
