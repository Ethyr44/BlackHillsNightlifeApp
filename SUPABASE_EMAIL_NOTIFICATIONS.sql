-- ============================================================================
-- BLACK HILLS NIGHTLIFE (BHNL) — AUTOMATIC EMAIL NOTIFICATIONS TRIGGER
-- ============================================================================
-- Note: Replace 'YOUR_RESEND_API_KEY_HERE' inside the Supabase SQL Editor only
-- (do not commit your live `re_...` API key to GitHub).
-- ============================================================================

-- 1. Enable pg_net
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. Ensure email_notifications column exists
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS email_notifications boolean DEFAULT true;

-- 3. Trigger Function that emails the user on new notifications
CREATE OR REPLACE FUNCTION public.send_notification_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, net, extensions
AS $$
DECLARE
  v_resend_api_key text := 'YOUR_RESEND_API_KEY_HERE';
  v_sender_email   text := 'Black Hills Nightlife <alerts@blackhillsnightlife.com>';
  v_user_email     text;
  v_username       text;
  v_email_enabled  boolean := true;
  v_subject        text;
  v_html           text;
BEGIN
  IF v_resend_api_key = 'YOUR_RESEND_API_KEY_HERE' OR v_resend_api_key = '' THEN
    RETURN NEW;
  END IF;

  -- 1. Check user's profile preferences safely
  SELECT
    username,
    COALESCE(email_notifications, true)
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
    body := jsonb_build_object(
      'from', v_sender_email,
      'to', jsonb_build_array(v_user_email),
      'subject', v_subject,
      'html', v_html
    ),
    params := '{}'::jsonb,
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || v_resend_api_key,
      'Content-Type', 'application/json'
    )
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_send_notification_email ON public.notifications;
CREATE TRIGGER trg_send_notification_email
AFTER INSERT ON public.notifications
FOR EACH ROW
EXECUTE FUNCTION public.send_notification_email();
