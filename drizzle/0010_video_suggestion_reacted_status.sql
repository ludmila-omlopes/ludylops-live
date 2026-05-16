DO $$
DECLARE
  constraint_record record;
BEGIN
  IF to_regclass('public.video_suggestions') IS NULL THEN
    RAISE EXCEPTION 'Tabela public.video_suggestions não encontrada.';
  END IF;

  FOR constraint_record IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = to_regclass('public.video_suggestions')
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%status%'
  LOOP
    EXECUTE format(
      'ALTER TABLE public.video_suggestions DROP CONSTRAINT %I',
      constraint_record.conname
    );
  END LOOP;
END $$;
--> statement-breakpoint
ALTER TABLE "video_suggestions"
  ADD CONSTRAINT "video_suggestions_status_check"
  CHECK ("status" IN ('open', 'accepted', 'reacted', 'rejected'));
