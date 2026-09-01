const { prisma } = require('../../app/prisma');

const listAutomationTasks = async (req, res) => {
    try {
        const { tenantId, id: userId } = req.user;
        const { unitId } = req.query;

        if (!unitId) {
            return res.status(400).json({ message: "unitId is required" });
        }

        const tasks = await prisma.automationTask.findMany({
            where: {
                tenantId,
                unitId,
                assignedTo: userId,
                status: "PENDING"
            },
            orderBy: { createdAt: 'desc' }
        });

        res.json(tasks);
    } catch (error) {
        console.error("Error listing automation tasks:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

const updateAutomationTaskStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        const { tenantId } = req.user;

        const existing = await prisma.automationTask.findFirst({
            where: { id, tenantId },
            select: { id: true }
        });

        if (!existing) {
            return res.status(404).json({ message: "Automation task not found" });
        }

        const task = await prisma.automationTask.update({
            where: { id },
            data: {
                status,
                completedAt: status === 'COMPLETED' ? new Date() : undefined
            }
        });

        res.json(task);
    } catch (error) {
        console.error("Error updating automation task:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

const getAutomationStats = async (req, res) => {
    try {
        const { tenantId } = req.user;
        const { unitId } = req.query;

        if (!unitId) {
            return res.status(400).json({ message: "unitId is required" });
        }

        // 1. Distribution by Label
        const logs = await prisma.automationLog.findMany({
            where: { tenantId, unitId },
            select: { label: true }
        });

        const distribution = {
            hot: logs.filter(l => l.label === 'HOT').length,
            warm: logs.filter(l => l.label === 'WARM').length,
            cold: logs.filter(l => l.label === 'COLD').length
        };

        const total = logs.length || 1;
        const distributionPercent = {
            hot: Math.round((distribution.hot / total) * 100),
            warm: Math.round((distribution.warm / total) * 100),
            cold: Math.round((distribution.cold / total) * 100)
        };

        // 2. Rule Performance
        const topRules = await prisma.automationRule.findMany({
            where: { tenantId, unitId, status: true },
            orderBy: { triggerCount: 'desc' },
            take: 5
        });

        const formattedRules = topRules.map(r => ({
            name: r.name,
            triggers: r.triggerCount || 0,
            conversion: `${Math.round((r.conversionRate || 0) * 100)}%`
        }));

        // 3. Conversion Stats (Overall)
        const totalEnquiries = await prisma.enquiry.count({ where: { tenantId, unitId } });
        const convertedEnquiries = await prisma.enquiry.count({
            where: { tenantId, unitId, status: { in: ['Converted', 'CONVERTED', 'Approved'] } }
        });

        const overallConversionRate = totalEnquiries ? Math.round((convertedEnquiries / totalEnquiries) * 100) : 0;

        res.json({
            distribution: distributionPercent,
            topRules: formattedRules,
            overallConversionRate,
            totalTriggers: logs.length
        });
    } catch (error) {
        console.error("Error fetching automation stats:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

module.exports = {
    listAutomationTasks,
    updateAutomationTaskStatus,
    getAutomationStats
};
