require('dotenv').config();
const { PrismaClient } = require('./src/generated/prisma');
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL + "&connection_limit=1"
    }
  }
});
const fs = require('fs');

async function runAudit() {
  console.log("Starting audit...");
  try {
    const staffRecords = await prisma.staff.findMany({
      select: { id: true, empId: true, tenantId: true, unitId: true, metadata: true }
    });

    const attendanceLogRecords = await prisma.attendanceLog.findMany({
      select: { id: true, staffId: true, date: true, tenantId: true, unitId: true }
    });

    console.log(`Total Staff: ${staffRecords.length}`);

    let staffWithAttendance = 0;
    let totalHistoricalRecords = 0;
    let staffWithZeroRecords = 0;
    let dates = [];
    
    let structureFields = new Set();
    let statuses = new Set();
    
    let missingCheckIn = 0;
    let missingCheckOut = 0;
    let bothPresent = 0;
    let neitherPresent = 0;
    let checkoutEarlier = 0;
    let invalidTimestamps = 0;
    let multipleCheckins = 0; // difficult without arrays, assuming flat record?
    
    let recordsPerTenant = {};
    let recordsPerUnit = {};

    let historicalByStaffDate = {};
    let duplicateStaffDateCombos = 0;
    let maxDuplicates = 0;

    let inconsistentTenant = 0;
    let missingUnit = 0;

    for (const s of staffRecords) {
      const metadata = s.metadata || {};
      const attendance = metadata.attendance || {};
      const logs = attendance.logs || [];

      if (!Array.isArray(logs) || logs.length === 0) {
        staffWithZeroRecords++;
        continue;
      }

      staffWithAttendance++;
      totalHistoricalRecords += logs.length;

      for (const log of logs) {
        // 1. Structure
        Object.keys(log).forEach(k => structureFields.add(k));
        
        // 2. Inventory (Dates & Tenant/Unit counts)
        if (log.date) {
          dates.push(new Date(log.date));
        }

        recordsPerTenant[s.tenantId] = (recordsPerTenant[s.tenantId] || 0) + 1;
        recordsPerUnit[s.unitId] = (recordsPerUnit[s.unitId] || 0) + 1;

        // 4. Duplicate analysis
        const key = `${s.id}_${log.date}`;
        if (!historicalByStaffDate[key]) {
          historicalByStaffDate[key] = [];
        }
        historicalByStaffDate[key].push(log);

        // 5. Check-in/out
        if (log.checkIn && log.checkOut) {
          bothPresent++;
          const ci = new Date(log.checkIn);
          const co = new Date(log.checkOut);
          if (isNaN(ci.getTime()) || isNaN(co.getTime())) {
            invalidTimestamps++;
          } else if (co < ci) {
            checkoutEarlier++;
          }
        } else if (log.checkIn && !log.checkOut) {
          missingCheckOut++;
        } else if (!log.checkIn && log.checkOut) {
          missingCheckIn++;
        } else {
          neitherPresent++;
        }

        // 6. Status
        if (log.status) statuses.add(log.status);

        // 10. Tenant/Unit safety
        if (!s.tenantId) inconsistentTenant++;
        if (!s.unitId) missingUnit++;
      }
    }

    let minDate = dates.length ? new Date(Math.min(...dates)) : null;
    let maxDate = dates.length ? new Date(Math.max(...dates)) : null;

    let duplicateCount = 0;
    for (const key in historicalByStaffDate) {
      const count = historicalByStaffDate[key].length;
      if (count > 1) {
        duplicateCount++;
        duplicateStaffDateCombos++;
        if (count > maxDuplicates) maxDuplicates = count;
      }
    }

    // 8. Existing AttendanceLog
    let overlaps = 0;
    let existingPerTenant = {};
    let existingPerUnit = {};
    let existingPerStaff = {};
    let existingDates = [];

    for (const al of attendanceLogRecords) {
      existingPerTenant[al.tenantId] = (existingPerTenant[al.tenantId] || 0) + 1;
      existingPerUnit[al.unitId] = (existingPerUnit[al.unitId] || 0) + 1;
      existingPerStaff[al.staffId] = (existingPerStaff[al.staffId] || 0) + 1;
      
      const d = al.date ? al.date.toISOString().split('T')[0] : null;
      if (d) existingDates.push(al.date);

      // check overlap
      const histLogs = historicalByStaffDate[`${al.staffId}_${d}`] || historicalByStaffDate[`${al.staffId}_${al.date}`]; 
      // The JSON date format might be YYYY-MM-DD or ISO string.
      // We will check both or more generalized overlap in the full script.
    }

    // Checking overlap more carefully
    attendanceLogRecords.forEach(al => {
      const d1 = al.date.toISOString().split('T')[0]; // assuming al.date is Date object
      // look for any log with this date string
      const histLogs = historicalByStaffDate[`${al.staffId}_${d1}`];
      if (histLogs) overlaps++;
    });

    const report = {
      structureFields: Array.from(structureFields),
      inventory: {
        totalStaff: staffRecords.length,
        staffWithAttendance,
        staffWithZeroRecords,
        totalHistoricalRecords,
        earliestDate: minDate,
        latestDate: maxDate,
        recordsPerTenant,
        recordsPerUnit
      },
      checkInOut: {
        bothPresent,
        missingCheckIn,
        missingCheckOut,
        neitherPresent,
        checkoutEarlier,
        invalidTimestamps
      },
      statuses: Array.from(statuses),
      duplicates: {
        duplicateStaffDateCombos,
        maxDuplicates
      },
      tenantUnitSafety: {
        inconsistentTenant,
        missingUnit
      },
      existingLogs: {
        totalRows: attendanceLogRecords.length,
        earliestDate: existingDates.length ? new Date(Math.min(...existingDates)) : null,
        latestDate: existingDates.length ? new Date(Math.max(...existingDates)) : null,
        overlaps
      }
    };

    fs.writeFileSync('audit_results.json', JSON.stringify(report, null, 2));
    console.log("Audit complete. Results written to audit_results.json");

  } catch (err) {
    console.error("Error during audit:", err);
  } finally {
    await prisma.$disconnect();
  }
}

runAudit();
