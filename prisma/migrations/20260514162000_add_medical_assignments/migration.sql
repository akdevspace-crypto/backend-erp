-- CreateEnum
CREATE TYPE "MedicalAssignmentStatus" AS ENUM ('PENDING', 'ASSIGNED', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "MedicalAssignment" (
    "id" TEXT NOT NULL,
    "refNo" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "patientId" TEXT,
    "admissionId" TEXT,
    "enquiryId" TEXT,
    "taskId" TEXT,
    "allocationId" TEXT,
    "dutyType" TEXT NOT NULL DEFAULT 'ROUND',
    "role" TEXT,
    "location" TEXT,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3),
    "status" "MedicalAssignmentStatus" NOT NULL DEFAULT 'ASSIGNED',
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "notes" TEXT,
    "metadata" JSONB,
    "assignedById" TEXT,
    "tenantId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MedicalAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MedicalAssignment_refNo_key" ON "MedicalAssignment"("refNo");

-- CreateIndex
CREATE INDEX "MedicalAssignment_tenantId_idx" ON "MedicalAssignment"("tenantId");

-- CreateIndex
CREATE INDEX "MedicalAssignment_unitId_idx" ON "MedicalAssignment"("unitId");

-- CreateIndex
CREATE INDEX "MedicalAssignment_staffId_idx" ON "MedicalAssignment"("staffId");

-- CreateIndex
CREATE INDEX "MedicalAssignment_patientId_idx" ON "MedicalAssignment"("patientId");

-- CreateIndex
CREATE INDEX "MedicalAssignment_admissionId_idx" ON "MedicalAssignment"("admissionId");

-- CreateIndex
CREATE INDEX "MedicalAssignment_enquiryId_idx" ON "MedicalAssignment"("enquiryId");

-- CreateIndex
CREATE INDEX "MedicalAssignment_taskId_idx" ON "MedicalAssignment"("taskId");

-- CreateIndex
CREATE INDEX "MedicalAssignment_allocationId_idx" ON "MedicalAssignment"("allocationId");

-- CreateIndex
CREATE INDEX "MedicalAssignment_status_idx" ON "MedicalAssignment"("status");

-- CreateIndex
CREATE INDEX "MedicalAssignment_startAt_idx" ON "MedicalAssignment"("startAt");

-- AddForeignKey
ALTER TABLE "MedicalAssignment" ADD CONSTRAINT "MedicalAssignment_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicalAssignment" ADD CONSTRAINT "MedicalAssignment_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicalAssignment" ADD CONSTRAINT "MedicalAssignment_admissionId_fkey" FOREIGN KEY ("admissionId") REFERENCES "Admission"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicalAssignment" ADD CONSTRAINT "MedicalAssignment_enquiryId_fkey" FOREIGN KEY ("enquiryId") REFERENCES "Enquiry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicalAssignment" ADD CONSTRAINT "MedicalAssignment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicalAssignment" ADD CONSTRAINT "MedicalAssignment_allocationId_fkey" FOREIGN KEY ("allocationId") REFERENCES "Allocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
