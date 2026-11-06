export function getDistanceInFeet(lat1, lon1, lat2, lon2) {
    const R = 3958.8;
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return (R * c) * 5280;
}

// Returns a Date object anchored to Black Hills local time (America/Denver)
export function getBlackHillsDate(dateInput = new Date()) {
    const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
    if (isNaN(d.getTime())) return new Date();
    return new Date(d.toLocaleString('en-US', { timeZone: 'America/Denver' }));
}

// Safely parses an event_date string into a Black Hills Date object
export function parseEventBlackHillsDate(eventDateStr) {
    if (!eventDateStr) return getBlackHillsDate();
    if (eventDateStr instanceof Date) return getBlackHillsDate(eventDateStr);
    const str = String(eventDateStr);
    const safeStr = str.includes('Z') || str.includes('+') || (str.includes('-') && str.lastIndexOf('-') > 10)
        ? str
        : `${str}Z`;
    return getBlackHillsDate(safeStr);
}

// Returns the normalized recurring pattern: 'weekly' | 'biweekly' | 'monthly' | 'none'
export function getRecurringPattern(event) {
    if (!event) return 'none';
    const raw = (event.recurring_pattern || '').toLowerCase();
    if (raw === 'weekly' || raw === 'biweekly' || raw === 'monthly') return raw;
    if (event.recurring_weekly) return 'weekly';
    return 'none';
}

export function isRecurringEvent(event) {
    return getRecurringPattern(event) !== 'none';
}

export function isSpecialEvent(event) {
    if (!event) return false;
    const rawPattern = (event.recurring_pattern || '').toLowerCase();
    if (rawPattern === 'special') return true;
    return ['Specials', 'Special', 'Featured', 'Ticketed'].includes(event.event_type);
}

// Returns 'Recurring' | 'Special' | 'Non-Recurring'
export function getEventCategory(event) {
    if (isRecurringEvent(event)) return 'Recurring';
    if (isSpecialEvent(event)) return 'Special';
    return 'Non-Recurring';
}

// Checks whether an event takes place on targetDateObj (anchored to Black Hills Time)
export function doesEventOccurOnDate(event, targetDateObj, options = {}) {
    if (!event || !event.event_date) return false;
    const { ignoreStartDateForRecurring = false } = options;

    const eDate = parseEventBlackHillsDate(event.event_date);
    const tDate = targetDateObj instanceof Date ? targetDateObj : getBlackHillsDate(targetDateObj);

    const pattern = getRecurringPattern(event);
    if (pattern === 'none') {
        return (
            eDate.getFullYear() === tDate.getFullYear() &&
            eDate.getMonth() === tDate.getMonth() &&
            eDate.getDate() === tDate.getDate()
        );
    }

    // Recurring event must match day of the week
    if (eDate.getDay() !== tDate.getDay()) return false;

    const startDay = new Date(eDate.getFullYear(), eDate.getMonth(), eDate.getDate());
    const currentDay = new Date(tDate.getFullYear(), tDate.getMonth(), tDate.getDate());

    if (!ignoreStartDateForRecurring && currentDay < startDay) {
        return false;
    }

    if (pattern === 'weekly') return true;
    if (pattern === 'biweekly') {
        const diffWeeks = Math.round(Math.abs(currentDay - startDay) / (1000 * 60 * 60 * 24 * 7));
        return diffWeeks % 2 === 0;
    }
    if (pattern === 'monthly') {
        return Math.ceil(startDay.getDate() / 7) === Math.ceil(currentDay.getDate() / 7);
    }
    return false;
}

// Builds the 7-day Recurring Events schedule for a specific venue
export function buildVenueRecurringSchedule(venue, eventsData = [], baseDate = getBlackHillsDate()) {
    const schedule = [];
    const legacySchedule = venue?.details?.schedule || [];
    const venueNameClean = (venue?.name || '').trim().toLowerCase();

    const venueRecurringEvents = (eventsData || []).filter(e => {
        if (!e || (e.venue || '').trim().toLowerCase() !== venueNameClean) return false;
        return isRecurringEvent(e);
    });

    for (let i = 0; i < 7; i++) {
        const slotDate = new Date(baseDate);
        slotDate.setDate(baseDate.getDate() + i);
        const dayName = slotDate.toLocaleDateString('en-US', { weekday: 'short' });
        const longDayName = slotDate.toLocaleDateString('en-US', { weekday: 'long' });

        let matchedEvent = venueRecurringEvents.find(e =>
            doesEventOccurOnDate(e, slotDate, { ignoreStartDateForRecurring: true })
        );

        if (!matchedEvent) {
            const ls = legacySchedule.find(s => s.day === dayName || s.day === longDayName);
            if (ls?.event) {
                matchedEvent = {
                    ...ls.event,
                    venue: venue.name,
                    recurring_pattern: ls.event.recurring_pattern || 'weekly',
                    recurring_weekly: true
                };
            }
        }

        schedule.push({
            day: dayName,
            longDay: longDayName,
            date: slotDate,
            event: matchedEvent || null
        });
    }

    return schedule;
}

// Client-side image validator and WebP resizer/compressor for fast mobile uploads
export async function compressImageToWebP(file, maxDimension = 1200, quality = 0.82) {
    if (!file || !file.type.startsWith('image/')) {
        throw new Error('Please select a valid image file.');
    }
    // Skip compression for animated GIFs or SVGs, or tiny files (< 120KB)
    if (file.type === 'image/gif' || file.type === 'image/svg+xml' || file.size < 120 * 1024) {
        return file;
    }

    return new Promise((resolve) => {
        const img = new Image();
        const objectUrl = URL.createObjectURL(file);

        img.onload = () => {
            URL.revokeObjectURL(objectUrl);
            let { width, height } = img;

            if (width > maxDimension || height > maxDimension) {
                if (width > height) {
                    height = Math.round((height * maxDimension) / width);
                    width = maxDimension;
                } else {
                    width = Math.round((width * maxDimension) / height);
                    height = maxDimension;
                }
            }

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (!ctx) return resolve(file);

            ctx.drawImage(img, 0, 0, width, height);
            canvas.toBlob(
                (blob) => {
                    if (!blob || blob.size >= file.size) return resolve(file);
                    const baseName = file.name.replace(/\.[^/.]+$/, '');
                    resolve(new File([blob], `${baseName}.webp`, { type: 'image/webp' }));
                },
                'image/webp',
                quality
            );
        };

        img.onerror = () => {
            URL.revokeObjectURL(objectUrl);
            resolve(file);
        };

        img.src = objectUrl;
    });
}
