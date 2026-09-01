import { PrismaClient } from './src/generated/prisma/index.js';
const prisma = new PrismaClient();

async function run() {
    try {
        const staff = await prisma.staff.findMany({ where: { firstName: { contains: 'Raphael', mode: 'insensitive' } }, include: { user: true } });
        console.log('--- RAPHAEL STAFF RECORDS ---');
        console.log(JSON.stringify(staff, null, 2));

        if (staff.length > 0) {
            const staffId = staff[0].id;
            const assignments = await prisma.medicalAssignment.findMany({ where: { staffId } });
            console.log('\n--- RAPHAEL ASSIGNMENTS ---');
            console.log(JSON.stringify(assignments, null, 2));
            
            const assignmentIds = assignments.map(a => a.id);
            const tasks = await prisma.dailyOperationTask.findMany({ where: { assignmentId: { in: assignmentIds } } });
            console.log('\n--- RAPHAEL TASKS ---');
            console.log(JSON.stringify(tasks, null, 2));
            
            if (staff[0].userId) {
                const user = await prisma.user.findUnique({ where: { id: staff[0].userId } });
                console.log('\n--- RAPHAEL USER ---');
                console.log(JSON.stringify(user, null, 2));
            } else {
                console.log('\n--- RAPHAEL USER ---');
                console.log('No userId linked to staff record.');
            }
        }
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}
run();
