import { prisma } from './src/app/prisma.js';

async function main() {
    const assignment = await prisma.medicalAssignment.findFirst({
        where: { id: 'b221ca33-4a2d-4a53-8e11-b16928adfe0a' }
    });
    console.log('Assignment:', assignment);

    let department = 'Patient Care';
    if (assignment.role && assignment.role.toLowerCase().includes('nurs')) {
        department = 'Nursing';
    }
    console.log('Department:', department);

    let templates = [];
    if (assignment.patientId) {
        console.log('Has patientId');
        templates = []; // mocking defaultTasks
    } else if (assignment.allocationId || assignment.dutyType === 'VISIT') {
        console.log('Has allocationId or dutyType VISIT');
        templates = [{ title: 'Service Visit Execution', phase: 'MORNING_OPERATIONS' }];
        department = 'Field Service';
    } else {
        console.log('No condition met');
    }

    console.log('Templates:', templates);

    if (templates.length === 0) {
        console.log('Returning early');
        return;
    }

    const existingTasks = await prisma.dailyOperationTask.findMany({
        where: {
            assignmentId: assignment.id,
            tenantId: assignment.tenantId,
            unitId: assignment.unitId,
            isDeleted: false
        },
        select: { title: true }
    });

    console.log('Existing tasks:', existingTasks);

    const existingTitles = new Set(existingTasks.map(t => t.title));
    const tasksToCreate = templates.filter(t => !existingTitles.has(t.title));

    console.log('Tasks to create:', tasksToCreate);
}

main().catch(console.error).finally(() => {
    console.log('Test finished.');
    process.exit(0);
});
