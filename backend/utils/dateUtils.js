/**
 * Converts a month value (numeric string, month name, or abbreviation) to a number (1-12).
 * @param {string|number} monthValue - The month value to convert.
 * @returns {number|null} - Numeric month (1-12) or null if invalid.
 */
export const monthToNumber = (monthValue) => {
    if (monthValue === null || monthValue === undefined) return null;
    const raw = String(monthValue).trim();
    if (!raw) return null;

    const numeric = Number(raw);
    if (Number.isFinite(numeric) && numeric >= 1 && numeric <= 12) return numeric;

    const months = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
    const lower = raw.toLowerCase();

    const fullIndex = months.indexOf(lower);
    if (fullIndex >= 0) return fullIndex + 1;

    const shortIndex = months.findIndex(m => m.slice(0, 3) === lower.slice(0, 3));
    return shortIndex >= 0 ? shortIndex + 1 : null;
};
