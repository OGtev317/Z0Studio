ALTER TABLE rooms ADD COLUMN accent_color TEXT NOT NULL DEFAULT 'cyan' CHECK (accent_color IN ('cyan', 'magenta', 'silver', 'violet'));
ALTER TABLE rooms ADD COLUMN cover_style TEXT NOT NULL DEFAULT 'outline' CHECK (cover_style IN ('outline', 'grid', 'spotlight'));
ALTER TABLE rooms ADD COLUMN welcome_note TEXT NOT NULL DEFAULT 'Start here for updates, drops, and room conversations.';
ALTER TABLE rooms ADD COLUMN posting_cadence TEXT NOT NULL DEFAULT 'Weekly room posts and drop updates';
ALTER TABLE rooms ADD COLUMN room_rules TEXT NOT NULL DEFAULT 'Keep it respectful, on-topic, and creator-led.';
