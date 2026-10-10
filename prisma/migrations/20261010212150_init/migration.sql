-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('uploaded', 'processing', 'extracted', 'failed');

-- CreateEnum
CREATE TYPE "ExtractionStatus" AS ENUM ('pending', 'approved', 'corrected');

-- CreateEnum
CREATE TYPE "ReviewAction" AS ENUM ('approved', 'corrected');

-- CreateTable
CREATE TABLE "documents" (
    "id" UUID NOT NULL,
    "filename" TEXT NOT NULL,
    "content_hash" TEXT NOT NULL,
    "raw_text" TEXT NOT NULL,
    "status" "DocumentStatus" NOT NULL DEFAULT 'uploaded',
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "extractions" (
    "id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "field_name" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "source_clause" TEXT NOT NULL,
    "start_offset" INTEGER NOT NULL,
    "end_offset" INTEGER NOT NULL,
    "confidence" DOUBLE PRECISION,
    "model" TEXT NOT NULL,
    "prompt_version" TEXT NOT NULL,
    "status" "ExtractionStatus" NOT NULL DEFAULT 'pending',

    CONSTRAINT "extractions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" UUID NOT NULL,
    "extraction_id" UUID NOT NULL,
    "action" "ReviewAction" NOT NULL,
    "old_value" TEXT,
    "new_value" TEXT,
    "reviewer" TEXT NOT NULL,
    "reviewed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "llm_runs" (
    "id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "model" TEXT NOT NULL,
    "prompt_version" TEXT NOT NULL,
    "input_tokens" INTEGER NOT NULL DEFAULT 0,
    "output_tokens" INTEGER NOT NULL DEFAULT 0,
    "cost" DECIMAL(10,6) NOT NULL DEFAULT 0,
    "latency_ms" INTEGER NOT NULL,
    "success" BOOLEAN NOT NULL,
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "llm_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "documents_content_hash_key" ON "documents"("content_hash");

-- CreateIndex
CREATE UNIQUE INDEX "extractions_document_id_field_name_prompt_version_key" ON "extractions"("document_id", "field_name", "prompt_version");

-- CreateIndex
CREATE INDEX "llm_runs_document_id_idx" ON "llm_runs"("document_id");

-- AddForeignKey
ALTER TABLE "extractions" ADD CONSTRAINT "extractions_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_extraction_id_fkey" FOREIGN KEY ("extraction_id") REFERENCES "extractions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "llm_runs" ADD CONSTRAINT "llm_runs_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
