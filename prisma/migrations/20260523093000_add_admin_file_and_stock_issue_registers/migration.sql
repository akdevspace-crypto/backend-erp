CREATE TABLE IF NOT EXISTS "AdminFileRegister" (
    "id" TEXT NOT NULL,
    "group" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "relatedName" TEXT NOT NULL DEFAULT '-',
    "fileNo" TEXT NOT NULL DEFAULT '-',
    "fileName" TEXT NOT NULL DEFAULT '-',
    "maintainedBy" TEXT NOT NULL DEFAULT 'Admin',
    "date" TIMESTAMP(3),
    "issueDate" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3),
    "renewalReminderDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'Not Uploaded',
    "remarks" TEXT,
    "uploadedFileId" TEXT,
    "uploadedFileName" TEXT,
    "uploadedFileUrl" TEXT,
    "uploadedAt" TIMESTAMP(3),
    "tenantId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AdminFileRegister_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AdminFileRegister_tenantId_idx" ON "AdminFileRegister"("tenantId");
CREATE INDEX IF NOT EXISTS "AdminFileRegister_unitId_idx" ON "AdminFileRegister"("unitId");
CREATE INDEX IF NOT EXISTS "AdminFileRegister_group_idx" ON "AdminFileRegister"("group");
CREATE INDEX IF NOT EXISTS "AdminFileRegister_status_idx" ON "AdminFileRegister"("status");

CREATE TABLE IF NOT EXISTS "StockIssueRequest" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "usageType" TEXT NOT NULL,
    "issuedTo" TEXT,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "requestedBy" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectedBy" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "tenantId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StockIssueRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "StockIssueRequest_tenantId_idx" ON "StockIssueRequest"("tenantId");
CREATE INDEX IF NOT EXISTS "StockIssueRequest_unitId_idx" ON "StockIssueRequest"("unitId");
CREATE INDEX IF NOT EXISTS "StockIssueRequest_status_idx" ON "StockIssueRequest"("status");
CREATE INDEX IF NOT EXISTS "StockIssueRequest_productId_idx" ON "StockIssueRequest"("productId");
