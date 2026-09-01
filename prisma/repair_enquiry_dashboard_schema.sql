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
END $$;

CREATE TABLE IF NOT EXISTS "Staff" (
  "id" TEXT NOT NULL,
  "empId" TEXT NOT NULL,
  "firstName" TEXT NOT NULL,
  "lastName" TEXT,
  "designation" TEXT,
  "department" TEXT,
  "phone" TEXT,
  "email" TEXT,
  "joiningDate" TIMESTAMP(3),
  "status" TEXT NOT NULL DEFAULT 'Working',
  "photoUrl" TEXT,
  "userId" TEXT,
  "metadata" JSONB,
  "skills" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "location" TEXT,
  "isAvailable" BOOLEAN NOT NULL DEFAULT true,
  "performanceScore" DOUBLE PRECISION NOT NULL DEFAULT 50,
  "workload" INTEGER NOT NULL DEFAULT 0,
  "currentWorkload" INTEGER NOT NULL DEFAULT 0,
  "latitude" DOUBLE PRECISION,
  "longitude" DOUBLE PRECISION,
  "shiftStart" TEXT,
  "shiftEnd" TEXT,
  "capacity" INTEGER NOT NULL DEFAULT 5,
  "stressLevel" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "lastActiveAt" TIMESTAMP(3),
  "tenantId" TEXT NOT NULL,
  "unitId" TEXT NOT NULL,
  "isDeleted" BOOLEAN NOT NULL DEFAULT false,
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Staff_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Staff_empId_key" ON "Staff"("empId");
CREATE UNIQUE INDEX IF NOT EXISTS "Staff_userId_key" ON "Staff"("userId");
CREATE INDEX IF NOT EXISTS "Staff_tenantId_idx" ON "Staff"("tenantId");
CREATE INDEX IF NOT EXISTS "Staff_unitId_idx" ON "Staff"("unitId");

CREATE TABLE IF NOT EXISTS "Client" (
  "id" TEXT NOT NULL,
  "refNo" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "mobile" TEXT NOT NULL,
  "email" TEXT,
  "address" TEXT,
  "tenantId" TEXT NOT NULL,
  "unitId" TEXT NOT NULL,
  "isDeleted" BOOLEAN NOT NULL DEFAULT false,
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Client_refNo_key" ON "Client"("refNo");
CREATE INDEX IF NOT EXISTS "Client_tenantId_idx" ON "Client"("tenantId");
CREATE INDEX IF NOT EXISTS "Client_unitId_idx" ON "Client"("unitId");
CREATE INDEX IF NOT EXISTS "Client_mobile_idx" ON "Client"("mobile");

CREATE TABLE IF NOT EXISTS "ClientService" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "price" DOUBLE PRECISION NOT NULL,
  "status" BOOLEAN NOT NULL DEFAULT true,
  "tenantId" TEXT NOT NULL,
  "unitId" TEXT NOT NULL,
  "isDeleted" BOOLEAN NOT NULL DEFAULT false,
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ClientService_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ClientService_code_key" ON "ClientService"("code");
CREATE INDEX IF NOT EXISTS "ClientService_tenantId_idx" ON "ClientService"("tenantId");
CREATE INDEX IF NOT EXISTS "ClientService_unitId_idx" ON "ClientService"("unitId");

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

CREATE TABLE IF NOT EXISTS "FollowUp" (
  "id" TEXT NOT NULL,
  "enquiryId" TEXT NOT NULL,
  "notes" TEXT,
  "scheduledAt" TIMESTAMP(3),
  "actualAt" TIMESTAMP(3),
  "channel" TEXT DEFAULT 'CALL',
  "response" BOOLEAN NOT NULL DEFAULT false,
  "converted" BOOLEAN NOT NULL DEFAULT false,
  "responseAt" TIMESTAMP(3),
  "outcome" TEXT DEFAULT 'PENDING',
  "variant" TEXT,
  "successScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "clientInterest" TEXT,
  "readyToPayAmount" DOUBLE PRECISION,
  "paymentMode" TEXT,
  "nextFollowupStatus" TEXT,
  "tenantId" TEXT NOT NULL,
  "unitId" TEXT NOT NULL,
  "isDeleted" BOOLEAN NOT NULL DEFAULT false,
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FollowUp_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "FollowUp_tenantId_idx" ON "FollowUp"("tenantId");
CREATE INDEX IF NOT EXISTS "FollowUp_unitId_idx" ON "FollowUp"("unitId");
CREATE INDEX IF NOT EXISTS "FollowUp_scheduledAt_idx" ON "FollowUp"("scheduledAt");

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

CREATE TABLE IF NOT EXISTS "AutomationScore" (
  "id" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "module" TEXT NOT NULL,
  "score" DOUBLE PRECISION NOT NULL,
  "label" TEXT NOT NULL,
  "probability" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "historyScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "factors" JSONB,
  "tenantId" TEXT NOT NULL,
  "unitId" TEXT NOT NULL,
  "complaintId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AutomationScore_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AutomationScore_entityId_module_key" ON "AutomationScore"("entityId", "module");
CREATE INDEX IF NOT EXISTS "AutomationScore_tenantId_idx" ON "AutomationScore"("tenantId");
CREATE INDEX IF NOT EXISTS "AutomationScore_unitId_idx" ON "AutomationScore"("unitId");
CREATE INDEX IF NOT EXISTS "AutomationScore_entityId_idx" ON "AutomationScore"("entityId");
CREATE INDEX IF NOT EXISTS "AutomationScore_complaintId_idx" ON "AutomationScore"("complaintId");

CREATE TABLE IF NOT EXISTS "RefCounter" (
  "id" TEXT NOT NULL,
  "prefix" TEXT NOT NULL,
  "current" INTEGER NOT NULL DEFAULT 0,
  "tenantId" TEXT NOT NULL,
  "unitId" TEXT NOT NULL,
  CONSTRAINT "RefCounter_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "RefCounter_prefix_tenantId_key" ON "RefCounter"("prefix", "tenantId");

COMMIT;
