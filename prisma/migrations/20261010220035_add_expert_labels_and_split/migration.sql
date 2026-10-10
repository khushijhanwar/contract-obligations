-- CreateEnum
CREATE TYPE "DatasetSplit" AS ENUM ('dev', 'heldout');

-- AlterTable
ALTER TABLE "documents" ADD COLUMN     "split" "DatasetSplit";

-- CreateTable
CREATE TABLE "expert_labels" (
    "id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "field_name" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "start_offset" INTEGER NOT NULL,
    "end_offset" INTEGER NOT NULL,

    CONSTRAINT "expert_labels_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "expert_labels_document_id_field_name_idx" ON "expert_labels"("document_id", "field_name");

-- AddForeignKey
ALTER TABLE "expert_labels" ADD CONSTRAINT "expert_labels_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
