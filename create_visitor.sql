CREATE TABLE IF NOT EXISTS "VisitorProfile" (
  "id" TEXT NOT NULL,
  "mobile" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "category" TEXT NOT NULL DEFAULT 'GUEST',
  "company" TEXT,
  "photoUrl" TEXT,
  "email" TEXT,
  "tenantId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "VisitorProfile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "VisitorProfile_tenantId_mobile_key" ON "VisitorProfile"("tenantId", "mobile");
CREATE INDEX IF NOT EXISTS "VisitorProfile_tenantId_idx" ON "VisitorProfile"("tenantId");

CREATE TABLE IF NOT EXISTS "VisitorPass" (
  "id" TEXT NOT NULL,
  "visitorId" TEXT NOT NULL,
  "passType" TEXT NOT NULL DEFAULT 'ONE_TIME',
  "purpose" TEXT,
  "department" TEXT,
  "hostName" TEXT,
  "hostMobile" TEXT,
  "vehicleNo" TEXT,
  "materialDetails" TEXT,
  "checkInAt" TIMESTAMP(3),
  "checkOutAt" TIMESTAMP(3),
  "expectedAt" TIMESTAMP(3),
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "qrCodeUrl" TEXT,
  "tenantId" TEXT NOT NULL,
  "unitId" TEXT,
  "recordedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "VisitorPass_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "VisitorPass_tenantId_idx" ON "VisitorPass"("tenantId");
CREATE INDEX IF NOT EXISTS "VisitorPass_visitorId_idx" ON "VisitorPass"("visitorId");
CREATE INDEX IF NOT EXISTS "VisitorPass_status_idx" ON "VisitorPass"("status");

ALTER TABLE "VisitorPass" ADD CONSTRAINT "VisitorPass_visitorId_fkey" FOREIGN KEY ("visitorId") REFERENCES "VisitorProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
