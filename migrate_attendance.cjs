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

async function runMigration() {
  const isExecute = process.argv.includes('--execute');
  console.log(`Starting migration... Mode: ${isExecute ? 'EXECUTE' : 'DRY-RUN'}`);

  try {
    const staffRecords = await prisma.staff.findMany({
      select: { id: true, empId: true, tenantId: true, unitId: true, metadata: true }
    });

    // 1. Create Backup
    const backupPath = path.join(__dirname, 'staff_metadata_backup.json');
    if (!fs.existsSync(backupPath)) {
      const backupData = staffRecords.map(s => ({
        id: s.id,
        metadata: s.metadata
      }));
      fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2));
      console.log(`Backup created at: ${backupPath} with ${backupData.length} records.`);
    } else {
      console.log(`Backup already exists at: ${backupPath}. Skipping backup creation.`);
    }

    let expectedInsertions = [];
    let expectedSkips = [];

    for (const staff of staffRecords) {
      const metadata = staff.metadata || {};
      const attendance = metadata.attendance || {};
      const logs = attendance.logs || [];

      for (const log of logs) {
        if (!log.date) continue; // safety

        // Check if AttendanceLog already exists
        const existing = await prisma.attendanceLog.findFirst({
          where: {
            staffId: staff.id,
            date: new Date(log.date)
          }
        });

        const mapping = {
          staffId: staff.id,
          date: new Date(log.date),
          checkIn: log.checkIn ? new Date(log.checkIn) : null,
          checkOut: log.checkOut ? new Date(log.checkOut) : null,
          method: "Migration",
          metadata: {
            status: log.status,
            note: log.note
          },
          tenantId: staff.tenantId,
          unitId: staff.unitId,
          createdAt: log.updatedAt ? new Date(log.updatedAt) : new Date(),
          updatedAt: log.updatedAt ? new Date(log.updatedAt) : new Date(),
        };

        if (existing) {
          expectedSkips.push({ log, reason: 'Already exists in AttendanceLog' });
        } else {
          expectedInsertions.push(mapping);
        }
      }
    }

    console.log(`\n--- DRY RUN RESULTS ---`);
    console.log(`Records to insert: ${expectedInsertions.length}`);
    console.log(`Records to skip: ${expectedSkips.length}`);
    
    if (expectedInsertions.length > 0) {
      console.log(`\nSample insertion:`, JSON.stringify(expectedInsertions[0], null, 2));
    }

    if (isExecute) {
      console.log(`\nExecuting migration...`);
      let inserted = 0;
      let failed = 0;
      
      for (const record of expectedInsertions) {
        try {
          await prisma.attendanceLog.create({
            data: record
          });
          inserted++;
        } catch (e) {
          console.error(`Failed to insert record for staff ${record.staffId} on ${record.date}:`, e.message);
          failed++;
        }
      }
      
      console.log(`\n--- EXECUTION RESULTS ---`);
      console.log(`Inserted: ${inserted}`);
      console.log(`Failed: ${failed}`);
    } else {
      console.log(`\nRun with --execute to perform migration.`);
    }

  } catch (err) {
    console.error("Migration error:", err);
  } finally {
    await prisma.$disconnect();
  }
}

runMigration();
