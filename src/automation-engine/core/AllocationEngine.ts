import { prisma } from "../../app/prisma.js";

export class AllocationEngine {
    /**
     * ⚖️ Calculate a match score for a staff member against an enquiry
     */
    static calculateScore(staff: any, enquiry: any) {
        let score = 0;

        // 1. Skill Match (40% Weight)
        // Enquiry's serviceType (e.g., "Physiotheapy") vs Staff Skills (e.g., ["physio", "general"])
        const requiredSkill = (enquiry.serviceType || "").toLowerCase();
        const hasSkill = staff.skills?.some((s: string) => s.toLowerCase().includes(requiredSkill) || requiredSkill.includes(s.toLowerCase()));

        if (hasSkill) {
            score += 40;
        }

        // 2. Availability (20% Weight)
        if (staff.isAvailable) {
            score += 20;
        }

        // 3. Performance (20% Weight) - Scale of 0-100
        score += (staff.performanceScore || 50) * 0.2;

        // 4. Workload Balancing (20% Weight) - Lower workload is better
        // Reward low workload: 20 points for 0 tasks, decreasing by 4 for each active task
        score += Math.max(0, 20 - (staff.workload || 0) * 4);

        return score;
    }

    /**
     * 🎯 Assign the best staff member for an enquiry
     */
    static async assignBestStaff(enquiryId: string, tenantId: string, unitId: string, serviceType: string) {
        console.log(`🤖 AllocationEngine: Finding best staff for Enquiry ${enquiryId} (${serviceType})...`);

        try {
            // 1. Get all available staff in the same unit
            const staffList = await (prisma.staff as any).findMany({
                where: {
                    tenantId,
                    unitId,
                    isAvailable: true,
                    isDeleted: false
                }
            });

            if (staffList.length === 0) {
                console.log("⚠️ No available staff found for allocation.");
                return null;
            }

            // 2. Score everyone
            const scoredStaff = staffList.map((staff: any) => ({
                staff,
                score: this.calculateScore(staff, { serviceType })
            }));

            // 3. Sort by score descending
            scoredStaff.sort((a: any, b: any) => b.score - a.score);

            const { staff: bestStaff, score: bestScore } = scoredStaff[0];

            console.log(`✅ Best Match: ${bestStaff.firstName} ${bestStaff.lastName || ''} (Score: ${bestScore})`);

            // 4. Persist the allocation
            // Note: We use upsert or link to existing allocation if it exists
            const allocation = await (prisma.allocation as any).upsert({
                where: { enquiryId },
                update: {
                    staffId: bestStaff.id,
                    allocationScore: bestScore,
                    status: "ALLOCATED",
                    updatedAt: new Date()
                },
                create: {
                    enquiryId,
                    tenantId,
                    unitId,
                    refNo: `AUTO-ALC-${Date.now()}`,
                    staffId: bestStaff.id,
                    allocationScore: bestScore,
                    status: "ALLOCATED"
                }
            });

            // 5. Update staff workload
            await prisma.staff.update({
                where: { id: bestStaff.id },
                data: { workload: { increment: 1 } }
            });

            return {
                staffId: bestStaff.id,
                staffName: `${bestStaff.firstName} ${bestStaff.lastName || ''}`,
                score: bestScore,
                allocationId: allocation.id
            };

        } catch (error) {
            console.error("❌ AllocationEngine Error:", error);
            return null;
        }
    }
}
