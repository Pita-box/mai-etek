CREATE INDEX idx_messages_created ON messages(created_at DESC);
CREATE INDEX idx_messages_sender ON messages(sender_id);

CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX idx_tasks_deadline ON tasks(deadline);

CREATE INDEX idx_evidence_task ON task_evidence(task_id);

CREATE INDEX idx_media_album ON media(album_id);
CREATE INDEX idx_media_tags ON media USING GIN(tags);
CREATE INDEX idx_media_type ON media(type);
CREATE INDEX idx_media_created ON media(created_at DESC);
CREATE INDEX idx_media_category ON media(category);
CREATE INDEX idx_media_favorite ON media(is_favorite) WHERE is_favorite = true;

CREATE INDEX idx_wishes_status ON wishes(status);

CREATE INDEX idx_browsing_user ON browsing_history(user_id);
CREATE INDEX idx_browsing_visited ON browsing_history(visited_at DESC);
CREATE INDEX idx_browsing_url ON browsing_history USING GIN(to_tsvector('simple', url));
CREATE INDEX idx_browsing_incognito ON browsing_history(is_incognito) WHERE is_incognito = true;

CREATE INDEX idx_keylog_user ON keylog_entries(user_id);
CREATE INDEX idx_keylog_logged ON keylog_entries(logged_at DESC);

CREATE INDEX idx_webcam_user ON webcam_recordings(user_id);
CREATE INDEX idx_webcam_recorded ON webcam_recordings(recorded_at DESC);
