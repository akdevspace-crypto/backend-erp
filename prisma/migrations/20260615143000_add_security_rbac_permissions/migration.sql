INSERT INTO "Permission" (
    "id",
    "module",
    "action",
    "description",
    "isDeleted",
    "createdAt",
    "updatedAt"
)
VALUES
    ('permission-security-read', 'SECURITY', 'READ', 'View security registers, reports, and OTP logs', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('permission-security-create', 'SECURITY', 'CREATE', 'Create gate entries and security OTP requests', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('permission-security-update', 'SECURITY', 'UPDATE', 'Complete gate movements and verify security OTPs', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("module", "action") DO UPDATE
SET
    "description" = EXCLUDED."description",
    "isDeleted" = false,
    "deletedAt" = NULL,
    "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "RolePermission" (
    "id",
    "roleId",
    "permissionId",
    "tenantId",
    "isDeleted",
    "createdAt",
    "updatedAt"
)
SELECT
    md5(r."id" || p."id"),
    r."id",
    p."id",
    r."tenantId",
    false,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "Role" r
CROSS JOIN "Permission" p
WHERE lower(r."name") = 'security supervisor'
  AND r."isDeleted" = false
  AND p."module" = 'SECURITY'
  AND p."action" IN ('READ', 'CREATE', 'UPDATE')
ON CONFLICT ("roleId", "permissionId") DO UPDATE
SET
    "tenantId" = EXCLUDED."tenantId",
    "isDeleted" = false,
    "deletedAt" = NULL,
    "updatedAt" = CURRENT_TIMESTAMP;
