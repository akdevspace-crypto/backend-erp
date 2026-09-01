-- Targeted ERP workflow repair for a partially-created database.
-- Creates the missing operational tables without dropping legacy omnichannel tables.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'EnquiryStatus') THEN
    CREATE TYPE public."EnquiryStatus" AS ENUM ('NEW', 'FOLLOW_UP', 'IN_PROGRESS', 'CLOSED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AllocationStatus') THEN
    CREATE TYPE public."AllocationStatus" AS ENUM ('PENDING', 'ALLOCATED', 'ON_HOLD', 'COMPLETED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AllocationType') THEN
    CREATE TYPE public."AllocationType" AS ENUM ('HOME_CARE', 'CLINICAL', 'IN_HOUSE', 'OTHERS');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TaskStatus') THEN
    CREATE TYPE public."TaskStatus" AS ENUM ('ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'APPROVED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ApprovalStatus') THEN
    CREATE TYPE public."ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MedicalAssignmentStatus') THEN
    CREATE TYPE public."MedicalAssignmentStatus" AS ENUM ('PENDING', 'ASSIGNED', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETED', 'CANCELLED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TransactionType') THEN
    CREATE TYPE public."TransactionType" AS ENUM ('INVOICE', 'RECEIPT', 'EXPENSE', 'REFUND');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TransactionStatus') THEN
    CREATE TYPE public."TransactionStatus" AS ENUM ('CREATED', 'PENDING_APPROVAL', 'APPROVED', 'POSTED', 'REJECTED');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public."ClientService" (
  "id" text PRIMARY KEY,
  "code" text NOT NULL UNIQUE,
  "name" text NOT NULL,
  "category" text NOT NULL,
  "price" double precision NOT NULL,
  "status" boolean NOT NULL DEFAULT true,
  "tenantId" text NOT NULL,
  "unitId" text NOT NULL,
  "isDeleted" boolean NOT NULL DEFAULT false,
  "deletedAt" timestamp without time zone,
  "createdAt" timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public."Staff" (
  "id" text PRIMARY KEY,
  "empId" text NOT NULL UNIQUE,
  "firstName" text NOT NULL,
  "lastName" text,
  "designation" text,
  "department" text,
  "phone" text,
  "email" text,
  "joiningDate" timestamp without time zone,
  "status" text NOT NULL DEFAULT 'Working',
  "photoUrl" text,
  "userId" uuid UNIQUE,
  "metadata" jsonb,
  "skills" text[] DEFAULT ARRAY[]::text[],
  "location" text,
  "isAvailable" boolean NOT NULL DEFAULT true,
  "performanceScore" double precision NOT NULL DEFAULT 50,
  "workload" integer NOT NULL DEFAULT 0,
  "currentWorkload" integer NOT NULL DEFAULT 0,
  "latitude" double precision,
  "longitude" double precision,
  "shiftStart" text,
  "shiftEnd" text,
  "capacity" integer NOT NULL DEFAULT 5,
  "stressLevel" double precision NOT NULL DEFAULT 0,
  "lastActiveAt" timestamp without time zone,
  "tenantId" text NOT NULL,
  "unitId" text NOT NULL,
  "isDeleted" boolean NOT NULL DEFAULT false,
  "deletedAt" timestamp without time zone,
  "createdAt" timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public."Client" (
  "id" text PRIMARY KEY,
  "refNo" text NOT NULL UNIQUE,
  "name" text NOT NULL,
  "mobile" text NOT NULL,
  "email" text,
  "address" text,
  "tenantId" text NOT NULL,
  "unitId" text NOT NULL,
  "isDeleted" boolean NOT NULL DEFAULT false,
  "deletedAt" timestamp without time zone,
  "createdAt" timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public."Patient" (
  "id" text PRIMARY KEY,
  "name" text NOT NULL,
  "tenantId" text NOT NULL,
  "unitId" text NOT NULL,
  "createdAt" timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public."Enquiry" (
  "id" text PRIMARY KEY,
  "refNo" text NOT NULL UNIQUE,
  "clientId" text NOT NULL REFERENCES public."Client"("id") ON UPDATE CASCADE,
  "serviceId" text REFERENCES public."ClientService"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "mode" text,
  "source" text,
  "channelId" text,
  "rawMessage" text,
  "description" text,
  "status" public."EnquiryStatus" NOT NULL DEFAULT 'NEW',
  "priority" text,
  "intent" text,
  "sentiment" text,
  "summary" text,
  "urgency" text,
  "isConverted" boolean DEFAULT false,
  "convertedAt" timestamp without time zone,
  "tenantId" text NOT NULL,
  "unitId" text NOT NULL,
  "isDeleted" boolean NOT NULL DEFAULT false,
  "deletedAt" timestamp without time zone,
  "createdAt" timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public."Admission" (
  "id" text PRIMARY KEY,
  "enquiryId" text NOT NULL UNIQUE REFERENCES public."Enquiry"("id") ON UPDATE CASCADE,
  "patientId" text NOT NULL REFERENCES public."Patient"("id") ON UPDATE CASCADE,
  "tenantId" text NOT NULL,
  "unitId" text NOT NULL,
  "status" text NOT NULL DEFAULT 'ACTIVE',
  "admittedAt" timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "dischargedAt" timestamp without time zone,
  "createdAt" timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public."Allocation" (
  "id" text PRIMARY KEY,
  "refNo" text NOT NULL UNIQUE,
  "enquiryId" text NOT NULL UNIQUE REFERENCES public."Enquiry"("id") ON UPDATE CASCADE,
  "type" public."AllocationType" NOT NULL DEFAULT 'HOME_CARE',
  "staffId" text REFERENCES public."Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "startDate" timestamp without time zone,
  "endDate" timestamp without time zone,
  "status" public."AllocationStatus" NOT NULL DEFAULT 'PENDING',
  "metadata" jsonb,
  "allocationScore" double precision DEFAULT 0,
  "tenantId" text NOT NULL,
  "unitId" text NOT NULL,
  "isDeleted" boolean NOT NULL DEFAULT false,
  "deletedAt" timestamp without time zone,
  "createdAt" timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public."Task" (
  "id" text PRIMARY KEY,
  "refNo" text NOT NULL UNIQUE,
  "title" text NOT NULL,
  "description" text,
  "priority" text NOT NULL DEFAULT 'MEDIUM',
  "aiSummary" text,
  "aiUrgency" text,
  "enquiryId" text REFERENCES public."Enquiry"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "assigneeId" uuid REFERENCES public."User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "assignedStaffId" text REFERENCES public."Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "approvalAuthorityId" uuid REFERENCES public."User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "type" text NOT NULL DEFAULT 'DAILY',
  "dueDate" timestamp without time zone,
  "status" public."TaskStatus" NOT NULL DEFAULT 'ASSIGNED',
  "completedAt" timestamp without time zone,
  "feedbackScore" double precision NOT NULL DEFAULT 0,
  "tenantId" text NOT NULL,
  "unitId" text NOT NULL,
  "isDeleted" boolean NOT NULL DEFAULT false,
  "deletedAt" timestamp without time zone,
  "createdAt" timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public."Approval" (
  "id" text PRIMARY KEY,
  "entityType" text NOT NULL,
  "entityId" text NOT NULL,
  "approverId" uuid REFERENCES public."User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "status" public."ApprovalStatus" NOT NULL DEFAULT 'PENDING',
  "comments" text,
  "tenantId" text NOT NULL,
  "unitId" text NOT NULL,
  "isDeleted" boolean NOT NULL DEFAULT false,
  "deletedAt" timestamp without time zone,
  "createdAt" timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public."MedicalAssignment" (
  "id" text PRIMARY KEY,
  "refNo" text NOT NULL UNIQUE,
  "staffId" text NOT NULL REFERENCES public."Staff"("id") ON UPDATE CASCADE,
  "patientId" text REFERENCES public."Patient"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "admissionId" text REFERENCES public."Admission"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "enquiryId" text REFERENCES public."Enquiry"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "taskId" text REFERENCES public."Task"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "allocationId" text REFERENCES public."Allocation"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "dutyType" text NOT NULL DEFAULT 'ROUND',
  "role" text,
  "location" text,
  "startAt" timestamp without time zone NOT NULL,
  "endAt" timestamp without time zone,
  "status" public."MedicalAssignmentStatus" NOT NULL DEFAULT 'ASSIGNED',
  "priority" text NOT NULL DEFAULT 'MEDIUM',
  "notes" text,
  "metadata" jsonb,
  "assignedById" text,
  "tenantId" text NOT NULL,
  "unitId" text NOT NULL,
  "isDeleted" boolean NOT NULL DEFAULT false,
  "deletedAt" timestamp without time zone,
  "createdAt" timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "Staff_tenantId_idx" ON public."Staff"("tenantId");
CREATE INDEX IF NOT EXISTS "Staff_unitId_idx" ON public."Staff"("unitId");
CREATE INDEX IF NOT EXISTS "Client_tenantId_idx" ON public."Client"("tenantId");
CREATE INDEX IF NOT EXISTS "Client_unitId_idx" ON public."Client"("unitId");
CREATE INDEX IF NOT EXISTS "Client_mobile_idx" ON public."Client"("mobile");
CREATE INDEX IF NOT EXISTS "Enquiry_tenantId_idx" ON public."Enquiry"("tenantId");
CREATE INDEX IF NOT EXISTS "Enquiry_unitId_idx" ON public."Enquiry"("unitId");
CREATE INDEX IF NOT EXISTS "Enquiry_status_idx" ON public."Enquiry"("status");
CREATE INDEX IF NOT EXISTS "Enquiry_createdAt_idx" ON public."Enquiry"("createdAt");
CREATE INDEX IF NOT EXISTS "Allocation_tenantId_idx" ON public."Allocation"("tenantId");
CREATE INDEX IF NOT EXISTS "Allocation_unitId_idx" ON public."Allocation"("unitId");
CREATE INDEX IF NOT EXISTS "Allocation_status_idx" ON public."Allocation"("status");
CREATE INDEX IF NOT EXISTS "Task_tenantId_idx" ON public."Task"("tenantId");
CREATE INDEX IF NOT EXISTS "Task_unitId_idx" ON public."Task"("unitId");
CREATE INDEX IF NOT EXISTS "Task_status_idx" ON public."Task"("status");
CREATE INDEX IF NOT EXISTS "Task_enquiryId_idx" ON public."Task"("enquiryId");
CREATE INDEX IF NOT EXISTS "Approval_entityType_entityId_idx" ON public."Approval"("entityType", "entityId");
CREATE INDEX IF NOT EXISTS "Approval_tenantId_idx" ON public."Approval"("tenantId");
CREATE INDEX IF NOT EXISTS "Approval_status_idx" ON public."Approval"("status");
CREATE INDEX IF NOT EXISTS "MedicalAssignment_tenantId_idx" ON public."MedicalAssignment"("tenantId");
CREATE INDEX IF NOT EXISTS "MedicalAssignment_unitId_idx" ON public."MedicalAssignment"("unitId");
CREATE INDEX IF NOT EXISTS "MedicalAssignment_staffId_idx" ON public."MedicalAssignment"("staffId");
CREATE INDEX IF NOT EXISTS "MedicalAssignment_status_idx" ON public."MedicalAssignment"("status");
CREATE INDEX IF NOT EXISTS "MedicalAssignment_startAt_idx" ON public."MedicalAssignment"("startAt");
