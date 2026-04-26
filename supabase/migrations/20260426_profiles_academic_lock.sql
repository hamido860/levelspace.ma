-- Add academic identity lock columns to profiles table
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS onboarding_completed boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS selected_grade text,
  ADD COLUMN IF NOT EXISTS selected_bac_track text;

-- Create trigger function to enforce academic field lock after onboarding
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
       (NEW.selected_bac_track IS DISTINCT FROM OLD.selected_bac_track) THEN
      RAISE EXCEPTION 'Academic identity is locked after onboarding.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Drop trigger if it exists to avoid conflicts
DROP TRIGGER IF EXISTS lock_academic_fields ON profiles;

-- Create trigger
CREATE TRIGGER lock_academic_fields
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION enforce_academic_lock();
