BEGIN;

INSERT INTO "Staff" (
  "id",
  "empId",
  "firstName",
  "lastName",
  "designation",
  "department",
  "phone",
  "email",
  "joiningDate",
  "status",
  "isAvailable",
  "currentWorkload",
  "capacity",
  "shiftStart",
  "shiftEnd",
  "tenantId",
  "unitId",
  "isDeleted",
  "createdAt",
  "updatedAt"
)
VALUES
  (
    '11111111-1111-4111-8111-111111111111',
    'MED-DOC-001',
    'Aarav',
    'Mehta',
    'Doctor',
    'Medical',
    '9000000001',
    'doctor.sample@uec.local',
    CURRENT_TIMESTAMP,
    'Working',
    true,
    0,
    8,
    '09:00',
    '17:00',
    'fc75cbca-5a45-46e9-9905-521d708e5ebe',
    'f7dab772-a5b3-404f-80bc-c5a4f5f03405',
    false,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  ),
  (
    '22222222-2222-4222-8222-222222222222',
    'MED-NUR-001',
    'Ananya',
    'Sharma',
    'Nurse',
    'Nursing',
    '9000000002',
    'nurse.sample@uec.local',
    CURRENT_TIMESTAMP,
    'Working',
    true,
    0,
    10,
    '08:00',
    '16:00',
    'fc75cbca-5a45-46e9-9905-521d708e5ebe',
    'f7dab772-a5b3-404f-80bc-c5a4f5f03405',
    false,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  )
ON CONFLICT ("empId") DO UPDATE SET
  "firstName" = EXCLUDED."firstName",
  "lastName" = EXCLUDED."lastName",
  "designation" = EXCLUDED."designation",
  "department" = EXCLUDED."department",
  "phone" = EXCLUDED."phone",
  "email" = EXCLUDED."email",
  "status" = EXCLUDED."status",
  "isAvailable" = EXCLUDED."isAvailable",
  "capacity" = EXCLUDED."capacity",
  "shiftStart" = EXCLUDED."shiftStart",
  "shiftEnd" = EXCLUDED."shiftEnd",
  "tenantId" = EXCLUDED."tenantId",
  "unitId" = EXCLUDED."unitId",
  "isDeleted" = false,
  "deletedAt" = NULL,
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "Patient" (
  "id",
  "name",
  "tenantId",
  "unitId",
  "createdAt",
  "updatedAt"
)
VALUES (
  '33333333-3333-4333-8333-333333333333',
  'Sample Patient',
  'fc75cbca-5a45-46e9-9905-521d708e5ebe',
  'f7dab772-a5b3-404f-80bc-c5a4f5f03405',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("id") DO UPDATE SET
  "name" = EXCLUDED."name",
  "tenantId" = EXCLUDED."tenantId",
  "unitId" = EXCLUDED."unitId",
  "updatedAt" = CURRENT_TIMESTAMP;

COMMIT;
