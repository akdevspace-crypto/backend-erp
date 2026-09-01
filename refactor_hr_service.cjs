const fs = require('fs');
const path = require('path');

const servicePath = path.resolve(__dirname, 'src/modules/hr/service.js');
let code = fs.readFileSync(servicePath, 'utf8');

// 1. Add resolveLocalFacilityDate helper
if (!code.includes('resolveLocalFacilityDate')) {
    code = code.replace(
        "const toDateOnly = (dateStr) => {",
        "const resolveLocalFacilityDate = () => {\n    const now = new Date();\n    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;\n};\n\nconst toDateOnly = (dateStr) => {"
    );
}

// 2. Refactor resolvePayrollSnapshot
const payrollRegex = /const resolvePayrollSnapshot = \(staff, monthRange\) => \{[\s\S]*?return \{[\s\S]*?\};\n\};/;
const newPayrollFunction = `const resolvePayrollSnapshot = (staff, monthRange) => {
    const metadata = parseMetadata(staff.metadata);
    const payrollMeta = metadata.payroll && typeof metadata.payroll === 'object' ? metadata.payroll : {};
    const relationalLogs = Array.isArray(staff.attendanceLogs) ? staff.attendanceLogs : [];
    const relationalLeaveRequests = Array.isArray(staff.leaveRequests) ? staff.leaveRequests : [];
    
    const combinedLeaveRequestsMap = new Map();
    relationalLeaveRequests.forEach(req => combinedLeaveRequestsMap.set(req.id, {
        ...req,
        fromDate: toDateOnly(req.startDate),
        toDate: toDateOnly(req.endDate)
    }));
    const leaveRequests = Array.from(combinedLeaveRequestsMap.values());
    
    const monthLogsMap = new Map();
    relationalLogs.forEach((log) => {
        const d = toDateOnly(log.date);
        if (d && d >= monthRange.startDate && d <= monthRange.endDate) {
            monthLogsMap.set(d, {
                status: log.status || 'Present',
                checkIn: log.checkIn,
                checkOut: log.checkOut
            });
        }
    });
    const monthLogs = Array.from(monthLogsMap.values());
    const presentDays = monthLogs.filter((log) => {
        const status = String(log?.status || '').trim().toUpperCase();
        return status === 'PRESENT' || Boolean(log?.checkIn || log?.checkOut);
    }).length;

    const workingDaysRaw = Number(payrollMeta.workingDays);
    const workingDays = !Number.isNaN(workingDaysRaw) && workingDaysRaw > 0 ? workingDaysRaw : 22;
    const leaveDays = calculateApprovedLeaveDays(leaveRequests, monthRange);
    const absentDays = Math.max(0, workingDays - presentDays - leaveDays);

    return {
        workingDays,
        presentDays,
        leaveDays,
        absentDays
    };
};`;
code = code.replace(payrollRegex, newPayrollFunction);

// 3. Refactor resolveAttendanceSnapshot
const attendanceRegex = /const resolveAttendanceSnapshot = \(staff, targetDate\) => \{[\s\S]*?return \{[\s\S]*?\};\n\};/;
const newAttendanceFunction = `const resolveAttendanceSnapshot = (staff, targetDate) => {
    const relationalLog = Array.isArray(staff.attendanceLogs)
        ? staff.attendanceLogs.find((log) => toDateOnly(log.date) === targetDate)
        : null;

    let checkInRaw = null;
    let checkOutRaw = null;
    let inferredStatus = null;

    if (relationalLog) {
        checkInRaw = relationalLog.checkIn;
        checkOutRaw = relationalLog.checkOut;
        inferredStatus = relationalLog.status;
    }

    const lastActiveDate = toDateOnly(staff.lastActiveAt);
    const inferredPresent = Boolean(checkInRaw || checkOutRaw || lastActiveDate === targetDate);
    let status = inferredStatus || (inferredPresent ? 'Present' : 'Absent');
    if (status === 'Present' && checkOutRaw && staff.shiftEnd) {
        const normalizedCheckOut = formatTimeValue(checkOutRaw);
        const normalizedShiftEnd = formatTimeValue(staff.shiftEnd);
        if (normalizedCheckOut !== '-' && normalizedShiftEnd !== '-' && normalizedCheckOut !== normalizedShiftEnd) {
            const checkOutDate = new Date(\`1970-01-01T\${String(checkOutRaw).slice(0, 8)}\`);
            const shiftEndDate = new Date(\`1970-01-01T\${String(staff.shiftEnd).slice(0, 8)}\`);
            if (!Number.isNaN(checkOutDate.getTime()) && !Number.isNaN(shiftEndDate.getTime()) && checkOutDate > shiftEndDate) {
                status = 'Present (Overtime)';
            }
        }
    }

    return {
        id: staff.id,
        empId: staff.empId,
        name: \`\${staff.firstName} \${staff.lastName}\`.trim(),
        date: targetDate,
        checkIn: formatTimeValue(checkInRaw),
        checkOut: formatTimeValue(checkOutRaw),
        status: inferredPresent || status === 'Present (Overtime)' ? status : 'Absent'
    };
};`;
code = code.replace(attendanceRegex, newAttendanceFunction);

// 4. Refactor getMyAttendanceLogs
const getMyRegex = /export const getMyAttendanceLogs = async \(tenantId, userId, options = \{\}\) => \{[\s\S]*?return sortedLogs;\n\};/;
const newGetMyFunction = `export const getMyAttendanceLogs = async (tenantId, userId, options = {}) => {
    const targetDate = toDateOnly(options.date) || resolveLocalFacilityDate();
    const staff = await prisma.staff.findFirst({
        where: { tenantId, userId, isDeleted: false },
        select: {
            id: true,
            empId: true,
            firstName: true,
            lastName: true,
            lastActiveAt: true,
            shiftEnd: true,
            attendanceLogs: true
        }
    });

    if (!staff) {
        throw buildHttpError('No staff profile is linked to this login', 404);
    }

    const relationalLogs = Array.isArray(staff.attendanceLogs) ? staff.attendanceLogs : [];
    
    const allDates = new Set();
    relationalLogs.forEach(log => allDates.add(toDateOnly(log.date)));
    allDates.add(targetDate);
    
    const sortedLogs = Array.from(allDates)
        .map(date => resolveAttendanceSnapshot(staff, date))
        .filter(log => log.checkIn !== '-' || log.checkOut !== '-' || log.status !== 'Absent' || log.date === targetDate)
        .sort((a, b) => String(b.date).localeCompare(String(a.date)));
        
    return sortedLogs;
};`;
code = code.replace(getMyRegex, newGetMyFunction);

// 5. Refactor markMyAttendance
const markMyRegex = /export const markMyAttendance = async \(tenantId, userId, data\) => \{[\s\S]*?return resolveAttendanceSnapshot\(updatedStaff, today\);\n\};/;
const newMarkMyFunction = `export const markMyAttendance = async (tenantId, userId, data) => {
    const today = resolveLocalFacilityDate();
    const now = new Date();
    // UTC midnight date for database insertion
    const todayUTCDate = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));

    const staff = await prisma.staff.findFirst({
        where: { tenantId, userId, isDeleted: false },
        select: {
            id: true,
            empId: true,
            firstName: true,
            lastName: true,
            lastActiveAt: true,
            shiftEnd: true,
            unitId: true,
            attendanceLogs: {
                where: { date: todayUTCDate }
            }
        }
    });

    if (!staff) {
        throw buildHttpError('No staff profile is linked to this login', 404);
    }

    const existingLog = staff.attendanceLogs.length > 0 ? staff.attendanceLogs[0] : null;
    let checkIn = existingLog?.checkIn || null;
    let checkOut = existingLog?.checkOut || null;

    if (data.action === 'CHECK_IN') {
        if (checkIn) throw buildHttpError('Attendance already checked in for today');
        checkIn = now;
    }

    if (data.action === 'CHECK_OUT') {
        if (!checkIn) throw buildHttpError('Check in before checking out');
        if (checkOut) throw buildHttpError('Attendance already checked out for today');
        if (now < checkIn) throw buildHttpError('Check out time cannot be earlier than check in time');
        checkOut = now;
    }

    const logMetadata = existingLog?.metadata && typeof existingLog.metadata === 'object' ? existingLog.metadata : {};
    logMetadata.note = data.note || logMetadata.note || '';

    // UPSERT LOGIC
    await prisma.attendanceLog.upsert({
        where: {
            staffId_date: {
                staffId: staff.id,
                date: todayUTCDate
            }
        },
        update: {
            checkIn,
            checkOut,
            status: 'Present',
            metadata: logMetadata,
            updatedAt: now
        },
        create: {
            staffId: staff.id,
            date: todayUTCDate,
            checkIn,
            checkOut,
            status: 'Present',
            method: 'MANUAL',
            metadata: logMetadata,
            tenantId,
            unitId: staff.unitId || tenantId,
            createdAt: now,
            updatedAt: now
        }
    });

    const updatedStaff = await prisma.staff.update({
        where: { id: staff.id },
        data: { lastActiveAt: now },
        select: {
            id: true,
            empId: true,
            firstName: true,
            lastName: true,
            lastActiveAt: true,
            shiftEnd: true,
            attendanceLogs: {
                where: { date: todayUTCDate }
            }
        }
    });

    return resolveAttendanceSnapshot(updatedStaff, today);
};`;
code = code.replace(markMyRegex, newMarkMyFunction);

fs.writeFileSync(servicePath, code, 'utf8');
console.log('Successfully updated service.js');
