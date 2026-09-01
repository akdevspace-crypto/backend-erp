require('dotenv').config();
const { PrismaClient } = require('./src/generated/prisma');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL + (process.env.DATABASE_URL.includes('?') ? '&' : '?') + "connection_limit=1"
    }
  }
});

async function verify() {
  try {
    const backupPath = path.join(__dirname, 'staff_metadata_backup.json');
    const backupData = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
    
    let expectedLogs = [];
    backupData.forEach(s => {
      const logs = s.metadata?.attendance?.logs || [];
      logs.forEach(log => {
        expectedLogs.push({ staffId: s.id, ...log });
      });
    });

    const migratedLogs = await prisma.attendanceLog.findMany({
      where: { method: 'Migration' }
    });

    console.log(`1. Migrated rows count: ${migratedLogs.length} (Expected: ${expectedLogs.length})`);

    const currentStaff = await prisma.staff.findMany({
      select: { id: true, metadata: true, tenantId: true, unitId: true }
    });

    let errors = [];

    // Verify Staff.metadata is unchanged
    for (const b of backupData) {
      const c = currentStaff.find(s => s.id === b.id);
      if (JSON.stringify(b.metadata) !== JSON.stringify(c.metadata)) {
        errors.push(`Metadata changed for Staff ${b.id}`);
      }
    }
    console.log(`2. Staff metadata unchanged: ${errors.length === 0 ? 'PASSED' : 'FAILED'}`);

    // Verify AttendanceLog records
    let duplicateCheck = new Set();
    for (const ml of migratedLogs) {
      const key = `${ml.staffId}_${ml.date.toISOString()}`;
      if (duplicateCheck.has(key)) {
        errors.push(`Duplicate AttendanceLog found: ${key}`);
      }
      duplicateCheck.add(key);

      const ogStaff = currentStaff.find(s => s.id === ml.staffId);
      if (ml.tenantId !== ogStaff.tenantId) errors.push(`Tenant mismatch for log ${ml.id}`);
      if (ml.unitId !== ogStaff.unitId) errors.push(`Unit mismatch for log ${ml.id}`);

      const meta = ml.metadata || {};
      if (!meta.status) errors.push(`Missing status in metadata for log ${ml.id}`);
    }
    console.log(`3. Verification of tenant/unit/metadata and duplicates: ${errors.length === 0 ? 'PASSED' : 'FAILED'}`);
    
    if (errors.length > 0) {
      console.error(errors);
    } else {
      console.log(`\nALL VERIFICATIONS PASSED.`);
    }

  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

verify();
