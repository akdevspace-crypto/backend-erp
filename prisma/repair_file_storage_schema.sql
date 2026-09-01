CREATE TABLE IF NOT EXISTS "FileStorage" (
    "id" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "tenantId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FileStorage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "FileStorage_tenantId_idx" ON "FileStorage"("tenantId");
CREATE INDEX IF NOT EXISTS "FileStorage_unitId_idx" ON "FileStorage"("unitId");
