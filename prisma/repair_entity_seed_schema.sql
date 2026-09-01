BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TransactionType') THEN
    CREATE TYPE "TransactionType" AS ENUM ('INVOICE', 'RECEIPT', 'EXPENSE', 'REFUND');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TransactionStatus') THEN
    CREATE TYPE "TransactionStatus" AS ENUM ('CREATED', 'PENDING_APPROVAL', 'APPROVED', 'POSTED', 'REJECTED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TaskStatus') THEN
    CREATE TYPE "TaskStatus" AS ENUM ('ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'APPROVED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ApprovalStatus') THEN
    CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "Permission" (
  "id" TEXT NOT NULL,
  "module" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "description" TEXT,
  "isDeleted" BOOLEAN NOT NULL DEFAULT false,
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Permission_module_action_key" ON "Permission"("module", "action");
CREATE INDEX IF NOT EXISTS "Permission_module_idx" ON "Permission"("module");

CREATE TABLE IF NOT EXISTS "RolePermission" (
  "id" TEXT NOT NULL,
  "roleId" TEXT NOT NULL,
  "permissionId" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "isDeleted" BOOLEAN NOT NULL DEFAULT false,
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "RolePermission_roleId_permissionId_key" ON "RolePermission"("roleId", "permissionId");
CREATE INDEX IF NOT EXISTS "RolePermission_tenantId_idx" ON "RolePermission"("tenantId");

CREATE TABLE IF NOT EXISTS "AccountTransaction" (
  "id" TEXT NOT NULL,
  "refNo" TEXT NOT NULL,
  "allocationId" TEXT,
  "type" "TransactionType" NOT NULL,
  "amount" DOUBLE PRECISION NOT NULL,
  "paymentMode" TEXT,
  "category" TEXT,
  "clientName" TEXT,
  "status" "TransactionStatus" NOT NULL DEFAULT 'CREATED',
  "notes" TEXT,
  "metadata" JSONB,
  "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "tenantId" TEXT NOT NULL,
  "unitId" TEXT NOT NULL,
  "isDeleted" BOOLEAN NOT NULL DEFAULT false,
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AccountTransaction_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "AccountTransaction_refNo_key" ON "AccountTransaction"("refNo");
CREATE INDEX IF NOT EXISTS "AccountTransaction_tenantId_idx" ON "AccountTransaction"("tenantId");
CREATE INDEX IF NOT EXISTS "AccountTransaction_unitId_idx" ON "AccountTransaction"("unitId");
CREATE INDEX IF NOT EXISTS "AccountTransaction_status_idx" ON "AccountTransaction"("status");
CREATE INDEX IF NOT EXISTS "AccountTransaction_type_idx" ON "AccountTransaction"("type");

CREATE TABLE IF NOT EXISTS "Approval" (
  "id" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "approverId" TEXT,
  "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
  "comments" TEXT,
  "tenantId" TEXT NOT NULL,
  "unitId" TEXT NOT NULL,
  "isDeleted" BOOLEAN NOT NULL DEFAULT false,
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Approval_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "Approval_entityType_entityId_idx" ON "Approval"("entityType", "entityId");
CREATE INDEX IF NOT EXISTS "Approval_tenantId_idx" ON "Approval"("tenantId");
CREATE INDEX IF NOT EXISTS "Approval_status_idx" ON "Approval"("status");

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

CREATE TABLE IF NOT EXISTS "Product" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "unitId" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "Product_tenantId_idx" ON "Product"("tenantId");
CREATE INDEX IF NOT EXISTS "Product_unitId_idx" ON "Product"("unitId");

CREATE TABLE IF NOT EXISTS "Stock" (
  "id" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "unitId" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Stock_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Stock_productId_tenantId_unitId_key" ON "Stock"("productId", "tenantId", "unitId");
CREATE INDEX IF NOT EXISTS "Stock_tenantId_idx" ON "Stock"("tenantId");
CREATE INDEX IF NOT EXISTS "Stock_unitId_idx" ON "Stock"("unitId");

CREATE TABLE IF NOT EXISTS "VitalSign" (
  "id" TEXT NOT NULL,
  "patientId" TEXT NOT NULL,
  "bp" TEXT,
  "pulse" INTEGER,
  "temp" DOUBLE PRECISION,
  "spO2" INTEGER,
  "notes" TEXT,
  "recordedById" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "unitId" TEXT NOT NULL,
  "isDeleted" BOOLEAN NOT NULL DEFAULT false,
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VitalSign_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "VitalSign_patientId_idx" ON "VitalSign"("patientId");
CREATE INDEX IF NOT EXISTS "VitalSign_tenantId_idx" ON "VitalSign"("tenantId");

COMMIT;
