-- ============================================================================
-- BLACK HILLS NIGHTLIFE (BHNL) — AUTOMATIC EMAIL NOTIFICATIONS TRIGGER
-- ============================================================================
-- How to set up in 3 steps:
--   1. Create a free account at https://resend.com and generate an API Key
--      (starts with `re_...`). Connect your domain (or use onboarding@resend.dev
--      for testing).
--   2. Replace 're_YOUR_RESEND_API_KEY_HERE' and 'alerts@yourdomain.com' below
--      with your Resend API key and verified sender address.
--   3. Paste and run this script in your Supabase Dashboard -> SQL Editor.
--
-- Once run, EVERY row inserted into `public.notifications` will automatically
-- send a branded dark-mode BHNL email to that user (if they have Email
-- Notifications enabled in Settings).
-- ============================================================================

-- 1. Enable the built-in async HTTP extension in Supabase
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- 2. Add the email_notifications preference column to profiles (defaults to true)
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS email_notifications boolean DEFAULT true;

-- 3. Create the trigger function that emails the user on new notifications
CREATE OR REPLACE FUNCTION public.send_notification_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_resend_api_key text := 're_YOUR_RESEND_API_KEY_HERE'; -- <-- PASTE YOUR RESEND API KEY HERE
  v_sender_email   text := 'Black Hills Nightlife <alerts@blackhillsnightlife.com>'; -- <-- UPDATE SENDER EMAIL
  v_user_email     text;
  v_username       text;
  v_email_enabled  boolean := true;
  v_subject        text;
  v_html           text;
BEGIN
  -- Skip if API key hasn't been configured yet
  IF v_resend_api_key = 're_YOUR_RESEND_API_KEY_HERE' OR v_resend_api_key = '' THEN
    RETURN NEW;
  END IF;

  -- 1. Check user's profile preferences
  SELECT
    username,
    COALESCE(
      email_notifications,
      CASE
        WHEN details ? 'email_notifications' THEN (details ->> 'email_notifications')::boolean
        ELSE true
      END,
      true
    )
  INTO v_username, v_email_enabled
  FROM public.profiles
  WHERE id = NEW.user_id;

  IF NOT COALESCE(v_email_enabled, true) THEN
    RETURN NEW;
  END IF;

  -- 2. Look up user's email from Supabase Auth
  SELECT email INTO v_user_email
  FROM auth.users
  WHERE id = NEW.user_id;

  -- Skip if no email or if it's a dummy debug account
  IF v_user_email IS NULL OR v_user_email LIKE 'debug_%@example.com' THEN
    RETURN NEW;
  END IF;

  v_subject := COALESCE(NULLIF(TRIM(NEW.title), ''), 'New Alert from Black Hills Nightlife');

  v_html := format(
    '<div style="background-color:#070d1a;color:#eef2ff;font-family:Inter,Arial,sans-serif;padding:32px 20px;border-radius:16px;max-width:520px;margin:0 auto;border:1px solid rgba(79,140,255,0.25);">' ||
      '<div style="margin-bottom:20px;">' ||
        '<span style="display:inline-block;background:linear-gradient(135deg,#4f8cff,#2463d4);color:#ffffff;font-weight:900;font-size:14px;padding:6px 12px;border-radius:8px;letter-spacing:0.08em;">BHNL</span>' ||
        '<span style="color:#7e99ba;font-size:12px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;margin-left:10px;">Black Hills Nightlife</span>' ||
      '</div>' ||
      '<h2 style="color:#ffffff;font-size:20px;margin:0 0 12px 0;">%s</h2>' ||
      '<p style="color:#b8d0f0;font-size:15px;line-height:1.6;margin:0 0 24px 0;">%s</p>' ||
      '<a href="https://blackhillsnightlife.com" style="display:inline-block;background:#4f8cff;color:#ffffff;text-decoration:none;font-weight:700;font-size:13px;padding:12px 22px;border-radius:10px;letter-spacing:0.06em;text-transform:uppercase;">Open Black Hills Nightlife</a>' ||
      '<hr style="border:none;border-top:1px solid rgba(255,255,255,0.08);margin:28px 0 12px 0;" />' ||
      '<p style="color:#3d5470;font-size:11px;margin:0;">You received this because Email Notifications are enabled on your BHNL account (%s). You can turn off email alerts anytime in App Settings.</p>' ||
    '</div>',
     COALESCE(NEW.title, 'BHNL Notification'),
    COALESCE(NEW.content, ''),
    COALESCE(v_username, v_user_email)
  );

  -- 3. Dispatch async HTTP POST to Resend API via pg_net
  PERFORM net.http_post(
    url := 'https://api.resend.com/emails',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || v_resend_api_key,
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object(
      'from', v_sender_email,
      'to', jsonb_build_array(v_user_email),
      'subject', v_subject,
      'html', v_html
    )
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Never block in-app notification inserts if email dispatch fails
    RETURN NEW;
END;
$$;

-- 4. Attach Trigger to public.notifications
DROP TRIGGER IF EXISTS trg_send_notification_email ON public.notifications;
CREATE TRIGGER trg_send_notification_email
AFTER INSERT ON public.notifications
FOR EACH ROW
EXECUTE FUNCTION public.send_notification_email();
