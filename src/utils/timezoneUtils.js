/**
 * Central utility for deriving local facility dates regardless of server timezone.
 */

/**
 * Derives the calendar date string ('YYYY-MM-DD') for a given tenant/unit timezone.
 *
 * @param {string} tenantTz - The tenant's timezone (e.g., 'Asia/Kolkata'). Falls back to 'UTC' if falsy.
 * @param {string|null} unitTz - The unit's optional timezone override.
 * @param {Date} [dateObj=new Date()] - The JS Date object to evaluate.
 * @returns {string} The localized date string in 'YYYY-MM-DD' format.
 */
export const getFacilityDateString = (tenantTz, unitTz, dateObj = new Date()) => {
    const tz = unitTz || tenantTz || 'UTC';

    // Format the date strictly in the requested timezone
    const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: tz,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });

    // en-CA format produces YYYY-MM-DD directly
    return formatter.format(dateObj);
};

/**
 * Returns a UTC Date object representing midnight of the facility's current calendar day.
 * 
 * @param {string} tenantTz - The tenant's timezone.
 * @param {string|null} unitTz - The unit's timezone.
 * @param {Date} [dateObj=new Date()] - The time to evaluate.
 * @returns {Date} A Date object normalized to 00:00:00.000 UTC of that calendar day.
 */
export const getFacilityMidnightUTC = (tenantTz, unitTz, dateObj = new Date()) => {
    const dateStr = getFacilityDateString(tenantTz, unitTz, dateObj);
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
};
