-- server/prisma/migrations/001_init/migration.sql
-- CreateTable: User
CREATE TABLE "User" (
    "id"             TEXT NOT NULL,
    "email"          TEXT NOT NULL,
    "name"           TEXT NOT NULL,
    "googleId"       TEXT,
    "avatar"         TEXT,
    "refreshToken"   TEXT,
    "accessToken"    TEXT,
    "profile"        JSONB,
    "gmailConnected" BOOLEAN NOT NULL DEFAULT false,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_email_key"    ON "User"("email");
CREATE UNIQUE INDEX "User_googleId_key" ON "User"("googleId");
CREATE INDEX        "User_email_idx"    ON "User"("email");
CREATE INDEX        "User_googleId_idx" ON "User"("googleId");

-- CreateTable: Application
CREATE TABLE "Application" (
    "id"              TEXT NOT NULL,
    "userId"          TEXT NOT NULL,
    "company"         TEXT NOT NULL,
    "role"            TEXT NOT NULL,
    "platform"        TEXT NOT NULL,
    "status"          TEXT NOT NULL DEFAULT 'applied',
    "applyUrl"        TEXT,
    "salary"          TEXT,
    "location"        TEXT,
    "notes"           TEXT,
    "appliedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL,
    "replyDetected"   BOOLEAN NOT NULL DEFAULT false,
    "replyType"       TEXT,
    "replyEmailId"    TEXT,
    "replyDetectedAt" TIMESTAMP(3),
    "replySnippet"    TEXT,
    CONSTRAINT "Application_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Application_userId_idx"    ON "Application"("userId");
CREATE INDEX "Application_status_idx"    ON "Application"("status");
CREATE INDEX "Application_appliedAt_idx" ON "Application"("appliedAt");

ALTER TABLE "Application" ADD CONSTRAINT "Application_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: Job
CREATE TABLE "Job" (
    "id"              TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "externalId"      TEXT,
    "title"           TEXT NOT NULL,
    "company"         TEXT NOT NULL,
    "platform"        TEXT NOT NULL,
    "location"        TEXT,
    "salary"          TEXT,
    "salaryMin"       DOUBLE PRECISION,
    "salaryMax"       DOUBLE PRECISION,
    "applyUrl"        TEXT NOT NULL,
    "postedAt"        TIMESTAMP(3),
    "tags"            TEXT[] DEFAULT '{}',
    "isRemote"        BOOLEAN NOT NULL DEFAULT false,
    "experienceLevel" TEXT,
    "description"     TEXT,
    "companyLogo"     TEXT,
    "jobType"         TEXT,
    "fetchedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "active"          BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Job_externalId_key"   ON "Job"("externalId") WHERE "externalId" IS NOT NULL;
CREATE INDEX        "Job_platform_idx"     ON "Job"("platform");
CREATE INDEX        "Job_fetchedAt_idx"    ON "Job"("fetchedAt");
CREATE INDEX        "Job_company_title_idx" ON "Job"("company", "title");

-- CreateTable: EmailSync
CREATE TABLE "EmailSync" (
    "id"           TEXT NOT NULL,
    "userId"       TEXT NOT NULL,
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "totalFetched" INTEGER NOT NULL DEFAULT 0,
    "totalMatched" INTEGER NOT NULL DEFAULT 0,
    "status"       TEXT NOT NULL DEFAULT 'idle',
    "errorMsg"     TEXT,
    CONSTRAINT "EmailSync_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EmailSync_userId_idx" ON "EmailSync"("userId");

ALTER TABLE "EmailSync" ADD CONSTRAINT "EmailSync_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: Notification
CREATE TABLE "Notification" (
    "id"        TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "userId"    TEXT NOT NULL,
    "type"      TEXT NOT NULL,
    "title"     TEXT NOT NULL,
    "message"   TEXT NOT NULL,
    "read"      BOOLEAN NOT NULL DEFAULT false,
    "metadata"  JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Notification_userId_read_idx" ON "Notification"("userId", "read");

ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: Session
CREATE TABLE "Session" (
    "id"        TEXT NOT NULL,
    "userId"    TEXT NOT NULL,
    "data"      TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Session_userId_idx" ON "Session"("userId");

ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
