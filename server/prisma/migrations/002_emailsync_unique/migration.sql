-- Remove old non-unique index and add unique constraint on EmailSync.userId
DROP INDEX IF EXISTS "EmailSync_userId_idx";
ALTER TABLE "EmailSync" ADD CONSTRAINT "EmailSync_userId_key" UNIQUE ("userId");
