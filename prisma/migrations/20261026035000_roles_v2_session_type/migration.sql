-- Rôles V2 : type de séance obligatoire (discovery, training, group_class, assessment, private)
UPDATE "TrainingSession" SET "type" = 'training'
WHERE "type" IS NULL OR "type" NOT IN ('discovery', 'training', 'group_class', 'assessment', 'private');

ALTER TABLE "TrainingSession" ALTER COLUMN "type" SET DEFAULT 'training';
ALTER TABLE "TrainingSession" ALTER COLUMN "type" SET NOT NULL;

CREATE INDEX "TrainingSession_gymId_type_startAt_idx" ON "TrainingSession"("gymId", "type", "startAt");
