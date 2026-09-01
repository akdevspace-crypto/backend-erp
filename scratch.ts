import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const admin = await prisma.user.findUnique({
    where: { id: "fd4b67d6-e6f0-410b-aff4-1dd4c5a67755" }
  });
  
  if (admin) {
    const staff = await prisma.staff.create({
      data: {
        tenantId: admin.tenantId,
        unitId: "f7dab772-a5b3-404f-80bc-c5a4f5f03405", // Putting him in the same unit as the others
        firstName: admin.firstName || "Raghav (Admin)",
        lastName: admin.lastName || "",
        email: admin.email,
        phone: admin.mobile || "0000000000",
        designation: "Administrator",
        department: "Management",
        status: "Working",
        userId: admin.id,
        empId: "EMP-ADMIN"
      }
    });
    console.log("Created staff record for admin:", staff);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
