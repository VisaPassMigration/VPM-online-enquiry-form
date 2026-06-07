-- Add a staff-friendly permanent reference for new intake registrations.
ALTER TABLE "IntakeSubmission" ADD COLUMN "registrationReference" TEXT;

-- PostgreSQL unique indexes allow multiple NULL values, so historical records
-- can remain unbackfilled while new persisted references are protected.
CREATE UNIQUE INDEX "IntakeSubmission_registrationReference_key" ON "IntakeSubmission"("registrationReference");
