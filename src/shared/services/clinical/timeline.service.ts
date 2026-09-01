import { prisma } from '../../../app/prisma.js';

export interface TimelineEventPayload {
  patientId: string;
  category: 'NURSING' | 'PATIENT_CARE' | 'DOCTOR' | 'FAMILY' | 'INCIDENT';
  action: string;
  details?: any;
  performedBy?: string;
  tenantId: string;
  unitId?: string;
}

export class ResidentTimelineService {
  /**
   * Logs a new event into the shared Resident Timeline.
   */
  static async logEvent(payload: TimelineEventPayload) {
    try {
      const event = await prisma.residentTimeline.create({
        data: {
          patientId: payload.patientId,
          category: payload.category,
          action: payload.action,
          details: payload.details || {},
          performedBy: payload.performedBy,
          tenantId: payload.tenantId,
          unitId: payload.unitId
        }
      });
      return event;
    } catch (error) {
      console.error("[ResidentTimelineService] Failed to log event:", error);
      // Fail silently to prevent crashing the main transaction
      return null;
    }
  }

  /**
   * Fetches the chronological timeline for a resident across all departments.
   */
  static async getTimeline(patientId: string, tenantId: string, limit = 50) {
    return prisma.residentTimeline.findMany({
      where: {
        patientId,
        tenantId
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: limit
    });
  }
}
