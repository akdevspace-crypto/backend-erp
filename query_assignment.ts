import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
    const staff = await prisma.staff.findFirst({ where: { user: { name: { contains: 'Raphael' } } } });
    if (!staff) {
        console.log('Staff Raphael not found');
        return;
    }
    const assignment = await prisma.medicalAssignment.findFirst({
        where: { staffId: staff.id },
        orderBy: { createdAt: 'desc' }
    });
    console.log('Medical Assignment:', assignment);
    if (assignment) {
        const tasks = await prisma.dailyOperationTask.findMany({
            where: { assignmentId: assignment.id }
        });
        console.log('Tasks Count:', tasks.length);
        console.log('Tasks:', tasks);
    }
}
main().catch(console.error).finally(() => prisma.$disconnect());
