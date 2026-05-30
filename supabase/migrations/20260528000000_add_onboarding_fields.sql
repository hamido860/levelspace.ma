-- Add new cycle and language option fields to profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS selected_cycle text,
  ADD COLUMN IF NOT EXISTS selected_language_option text;

-- Update the trigger function to enforce the lock on the new fields as well
CREATE OR REPLACE FUNCTION enforce_academic_lock()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Prevent non-admin users from resetting onboarding_completed
  IF OLD.onboarding_completed = true AND NEW.onboarding_completed = false AND OLD.role != 'admin' THEN
    RAISE EXCEPTION 'Cannot undo onboarding_completed.';
  END IF;

  -- Prevent non-admin users from changing academic fields after onboarding
  IF OLD.onboarding_completed = true AND OLD.role != 'admin' THEN
    IF (NEW.selected_grade IS DISTINCT FROM OLD.selected_grade) OR
       (NEW.selected_bac_track IS DISTINCT FROM OLD.selected_bac_track) OR
       (NEW.selected_cycle IS DISTINCT FROM OLD.selected_cycle) OR
       (NEW.selected_language_option IS DISTINCT FROM OLD.selected_language_option) THEN
      RAISE EXCEPTION 'Academic identity is locked after onboarding.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
