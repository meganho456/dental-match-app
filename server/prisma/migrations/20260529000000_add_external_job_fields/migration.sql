-- Add external job ingestion fields to JobPosting
ALTER TABLE "JobPosting" ADD COLUMN "isExternal" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "JobPosting" ADD COLUMN "externalSource" TEXT;
ALTER TABLE "JobPosting" ADD COLUMN "originalUrl" TEXT;
CREATE UNIQUE INDEX "JobPosting_originalUrl_key" ON "JobPosting"("originalUrl");
