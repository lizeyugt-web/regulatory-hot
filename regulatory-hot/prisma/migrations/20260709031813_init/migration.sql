-- CreateTable
CREATE TABLE "events" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "rawItemId" TEXT NOT NULL,
    "titleOriginal" TEXT NOT NULL,
    "titleCn" TEXT NOT NULL DEFAULT '',
    "titleLang" TEXT NOT NULL,
    "summaryOriginal" TEXT NOT NULL DEFAULT '',
    "summaryCn" TEXT NOT NULL DEFAULT '',
    "contentOriginal" TEXT,
    "contentCn" TEXT,
    "contentHint" TEXT,
    "contentType" TEXT NOT NULL DEFAULT 'text',
    "url" TEXT NOT NULL,
    "permalink" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "sourceName" TEXT NOT NULL,
    "sourceLevel" TEXT NOT NULL,
    "sourceCountry" TEXT NOT NULL DEFAULT '',
    "sourceFeed" TEXT NOT NULL DEFAULT '',
    "sourceDesc" TEXT NOT NULL DEFAULT '',
    "category" TEXT NOT NULL,
    "subCategory" TEXT NOT NULL DEFAULT '[]',
    "tags" TEXT NOT NULL DEFAULT '[]',
    "affectedRegions" TEXT NOT NULL DEFAULT '[]',
    "scores" TEXT NOT NULL DEFAULT '{}',
    "finalScore" REAL NOT NULL DEFAULT 0,
    "importance" INTEGER NOT NULL DEFAULT 3,
    "aiStatus" TEXT NOT NULL DEFAULT 'pending',
    "aiModel" TEXT NOT NULL DEFAULT '',
    "aiTranslateModel" TEXT NOT NULL DEFAULT '',
    "aiReason" TEXT NOT NULL DEFAULT '',
    "aiCost" REAL NOT NULL DEFAULT 0,
    "aiAnalyzedAt" TEXT,
    "selected" INTEGER NOT NULL DEFAULT 0,
    "isLead" INTEGER NOT NULL DEFAULT 0,
    "publishedAt" TEXT NOT NULL,
    "crawledAt" TEXT NOT NULL,
    "created_at" TEXT NOT NULL DEFAULT '',
    "updated_at" TEXT NOT NULL DEFAULT '',
    "isSocial" INTEGER NOT NULL DEFAULT 0,
    "readCount" INTEGER NOT NULL DEFAULT 0,
    "likeCount" INTEGER NOT NULL DEFAULT 0,
    "coverUrl" TEXT NOT NULL DEFAULT '',
    "clusterId" TEXT,
    "clusterSize" INTEGER NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "sources" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL DEFAULT '',
    "type" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT '',
    "region" TEXT NOT NULL DEFAULT '',
    "level" TEXT NOT NULL DEFAULT 'T2',
    "enabled" INTEGER NOT NULL DEFAULT 1,
    "endpoints" TEXT NOT NULL DEFAULT '[]',
    "config" TEXT NOT NULL DEFAULT '{}',
    "created_at" TEXT NOT NULL DEFAULT '',
    "updated_at" TEXT NOT NULL DEFAULT ''
);

-- CreateTable
CREATE TABLE "crawl_logs" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "source_id" TEXT NOT NULL,
    "started_at" TEXT NOT NULL,
    "finished_at" TEXT,
    "status" TEXT NOT NULL DEFAULT 'running',
    "items_total" INTEGER NOT NULL DEFAULT 0,
    "items_new" INTEGER NOT NULL DEFAULT 0,
    "items_dup" INTEGER NOT NULL DEFAULT 0,
    "error_msg" TEXT,
    "duration_ms" INTEGER,
    "created_at" TEXT NOT NULL DEFAULT ''
);

-- CreateTable
CREATE TABLE "ai_analyses" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "event_id" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "task" TEXT NOT NULL,
    "input_tokens" INTEGER NOT NULL DEFAULT 0,
    "output_tokens" INTEGER NOT NULL DEFAULT 0,
    "cost" REAL NOT NULL DEFAULT 0,
    "duration_ms" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'success',
    "error_msg" TEXT,
    "created_at" TEXT NOT NULL DEFAULT ''
);

-- CreateIndex
CREATE UNIQUE INDEX "events_url_key" ON "events"("url");

-- CreateIndex
CREATE INDEX "events_sourceId_idx" ON "events"("sourceId");

-- CreateIndex
CREATE INDEX "events_publishedAt_idx" ON "events"("publishedAt");

-- CreateIndex
CREATE INDEX "events_category_idx" ON "events"("category");

-- CreateIndex
CREATE INDEX "events_aiStatus_idx" ON "events"("aiStatus");

-- CreateIndex
CREATE INDEX "events_sourceLevel_idx" ON "events"("sourceLevel");

-- CreateIndex
CREATE INDEX "crawl_logs_source_id_idx" ON "crawl_logs"("source_id");

-- CreateIndex
CREATE INDEX "ai_analyses_event_id_idx" ON "ai_analyses"("event_id");
