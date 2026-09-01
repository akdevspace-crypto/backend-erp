import { prisma } from '../../app/prisma.js';

export class AllocationEngine {
    static async findBestStaff(entityId: string, module: string, options?: { serviceType?: string; latitude?: number; longitude?: number; tenantId?: string; unitId?: string }) {
        console.log(`🤝 Finding best staff for ${module}: ${entityId}`);

        try {
            const where: any = {
                isAvailable: true,
                isDeleted: false,
                status: 'Working'
            };
            if (options?.tenantId) where.tenantId = options.tenantId;
            if (options?.unitId) where.unitId = options.unitId;

            // Get staff with capacity
            const staffMembers = await (prisma as any).staff.findMany({
                where: {
                    ...where,
                    currentWorkload: { lt: (prisma as any).staff.fields.capacity }
                },
                orderBy: { performanceScore: 'desc' }
            });

            if (staffMembers.length === 0) {
                console.log('⚠️ No staff available for allocation');
                return null;
            }

            // Enhanced allocation logic: Weighting multi-factors
            const scoredStaff = staffMembers.map((staff: any) => {
                let score = staff.performanceScore || 50;

                // 1. Capacity weight (higher remaining capacity is better)
                const remainingCapacity = staff.capacity - staff.currentWorkload;
                score += (remainingCapacity / staff.capacity) * 20;

                // 2. Skill match
                if (options?.serviceType && staff.skills?.includes(options.serviceType)) {
                    score += 30;
                }

                // 3. Proximity check (if coordinates provided)
                if (options?.latitude && options?.longitude && staff.latitude && staff.longitude) {
                    const dist = Math.sqrt(
                        Math.pow(staff.latitude - options.latitude, 2) +
                        Math.pow(staff.longitude - options.longitude, 2)
                    );
                    // Add score inversely proportional to distance
                    score += Math.max(0, 20 - (dist * 100));
                }

                return { staff, score };
            });

            // Return staff with highest combined score
            const best = scoredStaff.sort((a: any, b: any) => b.score - a.score)[0];
            return best.staff;
        } catch (error) {
            console.error('❌ Allocation Engine Error:', error);
            throw error;
        }
    }

    static async allocate(entityId: string, module: string, staffId: string) {
        console.log(`🔗 Allocating ${module} ${entityId} to staff ${staffId}`);

        try {
            // Update staff workload
            await (prisma as any).staff.update({
                where: { id: staffId },
                data: { workload: { increment: 1 } }
            });

            // Create allocation record if needed, or update entity
            return { success: true, staffId };
        } catch (error) {
            console.error('❌ Allocation Error:', error);
            throw error;
        }
    }
}
