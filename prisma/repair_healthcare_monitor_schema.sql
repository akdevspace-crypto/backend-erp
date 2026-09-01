BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'EnquiryStatus') THEN
    CREATE TYPE "EnquiryStatus" AS ENUM ('NEW', 'FOLLOW_UP', 'IN_PROGRESS', 'CLOSED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AllocationStatus') THEN
    CREATE TYPE "AllocationStatus" AS ENUM ('PENDING', 'ALLOCATED', 'ON_HOLD', 'COMPLETED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AllocationType') THEN
    CREATE TYPE "AllocationType" AS ENUM ('HOME_CARE', 'CLINICAL', 'IN_HOUSE', 'OTHERS');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TaskStatus') THEN
    CREATE TYPE "TaskStatus" AS ENUM ('ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'APPROVED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MedicalAssignmentStatus') THEN
    CREATE TYPE "MedicalAssignmentStatus" AS ENUM ('PENDING', 'ASSIGNED', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETED', 'CANCELLED');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "Location" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "state" TEXT NOT NULL,
  "country" TEXT NOT NULL,
  "pincode" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Location_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Location_name_state_country_pincode_key"
  ON "Location"("name", "state", "country", "pincode");
CREATE INDEX IF NOT EXISTS "Location_name_idx" ON "Location"("name");
CREATE INDEX IF NOT EXISTS "Location_state_idx" ON "Location"("state");
CREATE INDEX IF NOT EXISTS "Location_country_idx" ON "Location"("country");

INSERT INTO "Location" ("id", "name", "state", "country", "pincode", "createdAt")
VALUES ('default-location', 'Default Location', 'Default State', 'India', NULL, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET
  "name" = EXCLUDED."name",
  "state" = EXCLUDED."state",
  "country" = EXCLUDED."country",
  "pincode" = EXCLUDED."pincode";

CREATE TABLE IF NOT EXISTS "RefCounter" (
  "id" TEXT NOT NULL,
  "prefix" TEXT NOT NULL,
  "current" INTEGER NOT NULL DEFAULT 0,
  "tenantId" TEXT NOT NULL,
  "unitId" TEXT NOT NULL,
  CONSTRAINT "RefCounter_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "RefCounter_prefix_tenantId_key"
  ON "RefCounter"("prefix", "tenantId");

CREATE TABLE IF NOT EXISTS "Patient" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "unitId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Patient_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Patient_tenantId_idx" ON "Patient"("tenantId");
CREATE INDEX IF NOT EXISTS "Patient_unitId_idx" ON "Patient"("unitId");

CREATE TABLE IF NOT EXISTS "Medication" (
  "id" TEXT NOT NULL,
  "patientId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "dosage" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Medication_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Medication_patientId_idx" ON "Medication"("patientId");

CREATE TABLE IF NOT EXISTS "Nutrition" (
  "id" TEXT NOT NULL,
  "patientId" TEXT NOT NULL,
  "calories" INTEGER NOT NULL,
  "dietPlan" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Nutrition_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Nutrition_patientId_idx" ON "Nutrition"("patientId");

CREATE TABLE IF NOT EXISTS "Enquiry" (
  "id" TEXT NOT NULL,
  "refNo" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "serviceId" TEXT,
  "mode" TEXT,
  "source" TEXT,
  "channelId" TEXT,
  "rawMessage" TEXT,
  "description" TEXT,
  "status" "EnquiryStatus" NOT NULL DEFAULT 'NEW',
  "priority" TEXT,
  "intent" TEXT,
  "sentiment" TEXT,
  "summary" TEXT,
  "urgency" TEXT,
  "isConverted" BOOLEAN DEFAULT false,
  "convertedAt" TIMESTAMP(3),
  "tenantId" TEXT NOT NULL,
  "unitId" TEXT NOT NULL,
  "isDeleted" BOOLEAN NOT NULL DEFAULT false,
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Enquiry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Enquiry_refNo_key" ON "Enquiry"("refNo");
CREATE INDEX IF NOT EXISTS "Enquiry_tenantId_idx" ON "Enquiry"("tenantId");
CREATE INDEX IF NOT EXISTS "Enquiry_unitId_idx" ON "Enquiry"("unitId");
CREATE INDEX IF NOT EXISTS "Enquiry_status_idx" ON "Enquiry"("status");
CREATE INDEX IF NOT EXISTS "Enquiry_createdAt_idx" ON "Enquiry"("createdAt");

CREATE TABLE IF NOT EXISTS "Admission" (
  "id" TEXT NOT NULL,
  "enquiryId" TEXT NOT NULL,
  "patientId" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "unitId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "admittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "dischargedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Admission_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Admission_enquiryId_key" ON "Admission"("enquiryId");
CREATE INDEX IF NOT EXISTS "Admission_tenantId_idx" ON "Admission"("tenantId");
CREATE INDEX IF NOT EXISTS "Admission_unitId_idx" ON "Admission"("unitId");
CREATE INDEX IF NOT EXISTS "Admission_patientId_idx" ON "Admission"("patientId");

CREATE TABLE IF NOT EXISTS "Allocation" (
  "id" TEXT NOT NULL,
  "refNo" TEXT NOT NULL,
  "enquiryId" TEXT NOT NULL,
  "type" "AllocationType" NOT NULL DEFAULT 'HOME_CARE',
  "staffId" TEXT,
  "startDate" TIMESTAMP(3),
  "endDate" TIMESTAMP(3),
  "status" "AllocationStatus" NOT NULL DEFAULT 'PENDING',
  "metadata" JSONB,
  "allocationScore" DOUBLE PRECISION DEFAULT 0,
  "tenantId" TEXT NOT NULL,
  "unitId" TEXT NOT NULL,
  "isDeleted" BOOLEAN NOT NULL DEFAULT false,
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Allocation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Allocation_refNo_key" ON "Allocation"("refNo");
CREATE UNIQUE INDEX IF NOT EXISTS "Allocation_enquiryId_key" ON "Allocation"("enquiryId");
CREATE INDEX IF NOT EXISTS "Allocation_tenantId_idx" ON "Allocation"("tenantId");
CREATE INDEX IF NOT EXISTS "Allocation_unitId_idx" ON "Allocation"("unitId");
CREATE INDEX IF NOT EXISTS "Allocation_status_idx" ON "Allocation"("status");
CREATE INDEX IF NOT EXISTS "Allocation_staffId_idx" ON "Allocation"("staffId");

CREATE TABLE IF NOT EXISTS "Task" (
  "id" TEXT NOT NULL,
  "refNo" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
  "aiSummary" TEXT,
  "aiUrgency" TEXT,
  "enquiryId" TEXT,
  "assigneeId" TEXT,
  "assignedStaffId" TEXT,
  "approvalAuthorityId" TEXT,
  "type" TEXT NOT NULL DEFAULT 'DAILY',
  "dueDate" TIMESTAMP(3),
  "status" "TaskStatus" NOT NULL DEFAULT 'ASSIGNED',
  "completedAt" TIMESTAMP(3),
  "feedbackScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "tenantId" TEXT NOT NULL,
  "unitId" TEXT NOT NULL,
  "isDeleted" BOOLEAN NOT NULL DEFAULT false,
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Task_refNo_key" ON "Task"("refNo");
CREATE INDEX IF NOT EXISTS "Task_tenantId_idx" ON "Task"("tenantId");
CREATE INDEX IF NOT EXISTS "Task_unitId_idx" ON "Task"("unitId");
CREATE INDEX IF NOT EXISTS "Task_status_idx" ON "Task"("status");
CREATE INDEX IF NOT EXISTS "Task_enquiryId_idx" ON "Task"("enquiryId");
CREATE INDEX IF NOT EXISTS "Task_assignedStaffId_idx" ON "Task"("assignedStaffId");

CREATE TABLE IF NOT EXISTS "MedicalAssignment" (
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
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MedicalAssignment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "MedicalAssignment_refNo_key" ON "MedicalAssignment"("refNo");
CREATE INDEX IF NOT EXISTS "MedicalAssignment_tenantId_idx" ON "MedicalAssignment"("tenantId");
CREATE INDEX IF NOT EXISTS "MedicalAssignment_unitId_idx" ON "MedicalAssignment"("unitId");
CREATE INDEX IF NOT EXISTS "MedicalAssignment_staffId_idx" ON "MedicalAssignment"("staffId");
CREATE INDEX IF NOT EXISTS "MedicalAssignment_patientId_idx" ON "MedicalAssignment"("patientId");
CREATE INDEX IF NOT EXISTS "MedicalAssignment_admissionId_idx" ON "MedicalAssignment"("admissionId");
CREATE INDEX IF NOT EXISTS "MedicalAssignment_enquiryId_idx" ON "MedicalAssignment"("enquiryId");
CREATE INDEX IF NOT EXISTS "MedicalAssignment_taskId_idx" ON "MedicalAssignment"("taskId");
CREATE INDEX IF NOT EXISTS "MedicalAssignment_allocationId_idx" ON "MedicalAssignment"("allocationId");

COMMIT;
