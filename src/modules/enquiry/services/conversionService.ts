import { prisma } from "../../../app/prisma.js";

export class ConversionService {
    /**
     * 🔹 Mark an enquiry as converted
     */
    static async convertEnquiry(enquiryId: string) {
        console.log(`🎯 Converting enquiry: ${enquiryId}`);

        try {
            const updated = await prisma.enquiry.update({
                where: { id: enquiryId },
                data: {
                    isConverted: true,
                    convertedAt: new Date(),
                    status: 'CLOSED'
                }
            });

            console.log(`✅ Enquiry ${enquiryId} marked as converted.`);

            // In a real AI system, we would trigger an Analytics recalculation here
            // await AnalyticsEngine.updateStats(); 

            return updated;
        } catch (error) {
            console.error("❌ Conversion Failed:", error);
            throw error;
        }
    }
}
