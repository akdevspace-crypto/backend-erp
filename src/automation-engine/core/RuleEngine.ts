export class RuleEngine {
    static evaluate(ruleConditions: any, context: any): boolean {
        if (!ruleConditions || !ruleConditions.conditions || !Array.isArray(ruleConditions.conditions)) {
            return false;
        }

        const logic = (ruleConditions.logic || 'AND').toUpperCase();

        const results = ruleConditions.conditions.map((cond: any) => {
            const fieldValue = this.getNestedValue(context, cond.field);
            if (fieldValue === undefined || fieldValue === null) return false;

            const ruleValue = cond.value;

            switch (cond.operator) {
                case '=':
                case '===':
                case '==':
                    return String(fieldValue).toLowerCase() === String(ruleValue).toLowerCase();
                case '!=':
                    return String(fieldValue).toLowerCase() !== String(ruleValue).toLowerCase();
                case '>':
                    return Number(fieldValue) > Number(ruleValue);
                case '<':
                    return Number(fieldValue) < Number(ruleValue);
                case '>=':
                    return Number(fieldValue) >= Number(ruleValue);
                case '<=':
                    return Number(fieldValue) <= Number(ruleValue);
                case 'contains':
                    return String(fieldValue).toLowerCase().includes(String(ruleValue).toLowerCase());
                default:
                    return false;
            }
        });

        if (logic === 'OR') {
            return results.some((res: boolean) => res);
        }

        // Default AND
        return results.every((res: boolean) => res);
    }

    private static getNestedValue(obj: any, path: string): any {
        return path?.split('.').reduce((acc: any, part: string) => (acc ? acc[part] : undefined), obj);
    }
}
