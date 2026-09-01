import { prisma } from '../../app/prisma.js';

export class ScoringEngine {
    static async calculateScore(entityId: string, module: string, context?: { tenantId?: string; unitId?: string }) {
        console.log(`🧠 Calculating score for ${module} entity: ${entityId}`);

        let score = 50; // Base score
        let factors: any = { base: 50 };
        let resolvedTenantId = context?.tenantId || 'system';
        let resolvedUnitId = context?.unitId || 'system';

        try {
            if (module === 'enquiry') {
                const enquiry = await (prisma as any).enquiry.findUnique({
                    where: { id: entityId },
                    include: { client: true }
                });

                if (enquiry) {
                    resolvedTenantId = enquiry.tenantId;
                    resolvedUnitId = enquiry.unitId;

                    // 1. Channel/Mode Logic
                    if (enquiry.mode === 'WHATSAPP') {
                        score += 10;
                        factors.channel = 10;
                    } else if (enquiry.mode === 'WEBSITE') {
                        score += 15;
                        factors.channel = 15;
                    }

                    // 2. Source Logic
                    const source = String(enquiry.source || '').toUpperCase();
                    if (source === 'REFERRAL' || source === 'DOCTOR') {
                        score += 20;
                        factors.source = 20;
                    } else if (source === 'GOOGLE' || source === 'ADS') {
                        score += 10;
                        factors.source = 10;
                    }

                    // 3. Service Impact
                    if (enquiry.serviceId) {
                        score += 10;
                        factors.serviceMatch = 10;
                    }

                    // 4. Contact Data Quality
                    if (enquiry.client?.mobile && enquiry.client?.email) {
                        score += 5;
                        factors.dataQuality = 5;
                    }

                    // 5. Intent/Urgency from metadata (parsed from rawMessage)
                    try {
                        const meta = JSON.parse(enquiry.rawMessage || '{}');
                        if (meta.clientLocation) {
                            score += 5;
                            factors.locationProvided = 5;
                        }
                        if (meta.patientHealthCondition && meta.patientHealthCondition.length > 20) {
                            score += 10;
                            factors.detailedIntent = 10;
                        }
                    } catch (e) {
                        // Ignore parse errors for scoring
                    }
                }
            }

            // Cap score at 100 and floor at 0
            score = Math.min(100, Math.max(0, score));

            const label = score > 80 ? 'HOT' : score > 40 ? 'WARM' : 'COLD';
            const probability = score / 100;

            await (prisma as any).automationScore.upsert({
                where: { entityId_module: { entityId, module } },
                update: {
                    score,
                    label,
                    probability,
                    confidence: 0.85, // Static confidence for demo
                    factors
                },
                create: {
                    entityId,
                    module,
                    score,
                    label,
                    probability,
                    confidence: 0.85,
                    factors,
                    tenantId: resolvedTenantId,
                    unitId: resolvedUnitId,
                    ...(module === 'complaint' ? { complaintId: entityId } : {})
                }
            });

            return { score, label, probability, confidence: 0.85, factors };
        } catch (error) {
            console.error('❌ Scoring Engine Error:', error);
            throw error;
        }
    }
}
