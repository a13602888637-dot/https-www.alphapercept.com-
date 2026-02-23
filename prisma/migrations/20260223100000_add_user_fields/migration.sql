-- Add new fields to User table
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "username" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "firstName" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lastName" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "imageUrl" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "metadata" JSONB;

-- Create indexes for new fields
CREATE INDEX IF NOT EXISTS "User_username_idx" ON "User"("username");
CREATE INDEX IF NOT EXISTS "User_createdAt_idx" ON "User"("createdAt");

-- Update existing records with default values (optional)
-- UPDATE "User" SET "metadata" = '{}' WHERE "metadata" IS NULL;