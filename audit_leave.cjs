require('dotenv').config();
const { PrismaClient } = require('./src/generated/prisma');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL + (process.env.DATABASE_URL.includes('?') ? '&' : '?') + "connection_limit=1"
    }
  }
});

async function audit() {
  try {
    const allStaff = await prisma.staff.findMany({
      select: { id: true, tenantId: true, unitId: true, metadata: true }
    });

    let staffWithLeaves = 0;
    let totalLeaveRequests = 0;
    const leaveRequestsPerTenant = {};
    const leaveRequestsPerUnit = {};
    let earliestDate = null;
    let latestDate = null;
    const statuses = new Set();
    const leaveTypes = new Set();
    let sampleLeave = null;

    for (const staff of allStaff) {
      if (!staff.metadata) continue;
      const metadata = staff.metadata;
      if (Array.isArray(metadata.leaveRequests) && metadata.leaveRequests.length > 0) {
        staffWithLeaves++;
        totalLeaveRequests += metadata.leaveRequests.length;
        
        leaveRequestsPerTenant[staff.tenantId] = (leaveRequestsPerTenant[staff.tenantId] || 0) + metadata.leaveRequests.length;
        leaveRequestsPerUnit[staff.unitId] = (leaveRequestsPerUnit[staff.unitId] || 0) + metadata.leaveRequests.length;
        
        metadata.leaveRequests.forEach(req => {
            if (!sampleLeave) sampleLeave = req;
            
            statuses.add(req.status);
            leaveTypes.add(req.leaveType);
            
            if (req.startDate) {
                const dateObj = new Date(req.startDate);
                if (!earliestDate || dateObj < earliestDate) earliestDate = dateObj;
                if (!latestDate || dateObj > latestDate) latestDate = dateObj;
            }
        });
      }
    }

    const relationalLeaveRequests = await prisma.leaveRequest.findMany();
    
    console.log("=== JSON INVENTORY ===");
    console.log("Total Staff records:", allStaff.length);
    console.log("Staff records containing leaveRequests:", staffWithLeaves);
    console.log("Total historical JSON leave requests:", totalLeaveRequests);
    console.log("Records per tenant:", leaveRequestsPerTenant);
    console.log("Records per unit:", leaveRequestsPerUnit);
    console.log("Earliest leave date:", earliestDate);
    console.log("Latest leave date:", latestDate);
    console.log("Statuses used in JSON:", Array.from(statuses));
    console.log("Leave types used in JSON:", Array.from(leaveTypes));
    console.log("Sample JSON record:", JSON.stringify(sampleLeave, null, 2));

    console.log("\n=== RELATIONAL TABLE (prisma.leaveRequest) ===");
    console.log("Total rows:", relationalLeaveRequests.length);
    if (relationalLeaveRequests.length > 0) {
        const statusesDb = new Set();
        const typesDb = new Set();
        relationalLeaveRequests.forEach(req => {
            statusesDb.add(req.status);
            typesDb.add(req.leaveType);
        });
        console.log("Statuses in DB:", Array.from(statusesDb));
        console.log("Types in DB:", Array.from(typesDb));
    }

  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}

audit();
