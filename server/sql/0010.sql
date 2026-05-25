-- Guest comments support
-- Make user_id optional, add guest name/email/website and approved flag

ALTER TABLE comments ADD COLUMN guest_name text DEFAULT '';
ALTER TABLE comments ADD COLUMN guest_email text DEFAULT '';
ALTER TABLE comments ADD COLUMN guest_website text DEFAULT '';
ALTER TABLE comments ADD COLUMN approved integer DEFAULT 1 NOT NULL;
