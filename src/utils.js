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

// ============================================================================
// CONSUMABLE ITEMS, POINT SYSTEM & DUAL SETLIST HELPERS
// ============================================================================

export const CONSUMABLE_CATALOG = {
    // Instant Single-Use L$ Items (NOT multiplied by active multipliers)
    Quartz: {
        kind: 'instant_lp',
        bonusLp: 80,
        color: '#f9a8d4',
        glow: 'rgba(249,168,212,0.28)',
        icon: '💎',
        label: '+80 L$ (Single Use)',
        description: 'Instantly grants +80 L$ upon consumption.'
    },
    Agate: {
        kind: 'instant_lp',
        bonusLp: 50,
        color: '#fb923c',
        glow: 'rgba(251,146,60,0.28)',
        icon: '🪨',
        label: '+50 L$ (Single Use)',
        description: 'Instantly grants +50 L$ upon consumption.'
    },
    Opal: {
        kind: 'instant_lp',
        bonusLp: 100,
        color: '#a5b4fc',
        glow: 'rgba(165,180,252,0.28)',
        icon: '🔮',
        label: '+100 L$ (Single Use)',
        description: 'Instantly grants +100 L$ upon consumption.'
    },
    Onyx: {
        kind: 'instant_lp',
        bonusLp: 150,
        color: '#94a3b8',
        glow: 'rgba(148,163,184,0.28)',
        icon: '🖤',
        label: '+150 L$ (Single Use)',
        description: 'Instantly grants +150 L$ upon consumption.'
    },
    Jade: {
        kind: 'instant_lp',
        bonusLp: 300,
        color: '#34d399',
        glow: 'rgba(52,211,153,0.28)',
        icon: '🟢',
        label: '+300 L$ (Single Use)',
        description: 'Instantly grants +300 L$ upon consumption.'
    },

    // Action/Event Multiplier Gems (Applies ONLY to Action/Event L$ rewards)
    Ruby: {
        kind: 'multiplier',
        mult: 2,
        uses: 5,
        color: '#f87171',
        glow: 'rgba(248,113,113,0.28)',
        icon: '♦️',
        label: 'x2 L$ (Next 5 Rewards)',
        description: 'Doubles L$ earned from the next 5 action/event rewards.'
    },
    Emerald: {
        kind: 'multiplier',
        mult: 3,
        uses: 3,
        color: '#10b981',
        glow: 'rgba(16,185,129,0.28)',
        icon: '💚',
        label: 'x3 L$ (Next 3 Rewards)',
        description: 'Triples L$ earned from the next 3 action/event rewards.'
    },
    Diamond: {
        kind: 'multiplier',
        mult: 4,
        uses: 1,
        color: '#67e8f9',
        glow: 'rgba(103,232,249,0.28)',
        icon: '💠',
        label: 'x4 L$ (Next 1 Reward)',
        description: 'Quadruples L$ earned from the next action/event reward.'
    },

    // KSocial Single-Song Vote Buff Items
    Microphone: {
        kind: 'ksocial_buff',
        buffKey: 'microphone',
        mult: 2,
        uses: 1,
        color: '#c084fc',
        glow: 'rgba(192,132,252,0.28)',
        icon: '🎤',
        label: 'x2 Incoming Votes (1 Song)',
        description: 'Doubles all Vote Points you receive for your next single song sung.'
    },
    Megaphone: {
        kind: 'ksocial_buff',
        buffKey: 'megaphone',
        mult: 2,
        uses: 1,
        color: '#facc15',
        glow: 'rgba(250,204,21,0.28)',
        icon: '📢',
        label: 'x2 Outgoing Votes (1 Song)',
        description: 'Doubles the Vote Points you send to a singer for 1 song.'
    }
};

export function getTodayBlackHillsKey() {
    const bh = getBlackHillsDate();
    const y = bh.getFullYear();
    const m = String(bh.getMonth() + 1).padStart(2, '0');
    const d = String(bh.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

/**
 * Awards Action/Event-based Lifestyle Points (L$) to a user.
 * Automatically applies & decrements active gem multipliers (Ruby/Emerald/Diamond).
 * Multiplier bonuses NEVER apply to consumed items (those use consumeInventoryAsset).
 */
export async function awardLifestylePoints(supabase, userId, baseAmount, options = {}) {
    if (!supabase || !userId || !baseAmount || baseAmount <= 0) {
        return { awarded: 0, skipped: true };
    }
    const {
        title = 'Reward Earned!',
        guardKey = null,
        applyMultiplier = true,
        emitToast = true
    } = options;

    const { data: profile, error: fetchErr } = await supabase
        .from('profiles')
        .select('id, lifestyle_points, active_multiplier, multiplier_uses_left, details')
        .eq('id', userId)
        .maybeSingle();

    if (fetchErr || !profile) {
        return { awarded: 0, error: fetchErr };
    }

    const details = { ...(profile.details || {}) };
    const rewardGuards = { ...(details.reward_guards || {}) };

    if (guardKey && rewardGuards[guardKey]) {
        return { awarded: 0, skipped: true };
    }

    let multUses = Number(profile.multiplier_uses_left || 0);
    let activeMult = Number(profile.active_multiplier || 1);
    let appliedMult = 1;

    if (applyMultiplier && multUses > 0 && activeMult > 1) {
        appliedMult = activeMult;
        multUses -= 1;
        if (multUses <= 0) {
            multUses = 0;
            activeMult = 1;
        }
    }

    const finalAward = Math.round(baseAmount * appliedMult);
    const newLp = Number(profile.lifestyle_points || 0) + finalAward;

    if (guardKey) {
        rewardGuards[guardKey] = new Date().toISOString();
        details.reward_guards = rewardGuards;
    }

    const { error: updateErr } = await supabase
        .from('profiles')
        .update({
            lifestyle_points: newLp,
            active_multiplier: activeMult,
            multiplier_uses_left: multUses,
            details
        })
        .eq('id', userId);

    if (updateErr) {
        return { awarded: 0, error: updateErr };
    }

    const displayTitle = appliedMult > 1 ? `${title} (${appliedMult}x Boost!)` : title;

    // Insert a persistent notification for every L$ reward earned
    await supabase
        .from('notifications')
        .insert([
            {
                user_id: userId,
                title: `💰 +${finalAward} L$ Earned!`,
                content: `${displayTitle} — +${finalAward} L$ added to your balance.`
            }
        ])
        .then(() => {})
        .catch(() => {});

    if (emitToast && typeof window !== 'undefined') {
        window.dispatchEvent(
            new CustomEvent('bhnl-reward-earned', {
                detail: { title: displayTitle, points: `${finalAward} L$` }
            })
        );
    }

    return {
        awarded: finalAward,
        appliedMultiplier: appliedMult,
        remainingUses: multUses,
        newTotal: newLp
    };
}

/**
 * Awards KSocial Points (league_monthly & league_all_time) to a user.
 */
export async function awardKSocialPoints(supabase, userId, pointsToAdd, options = {}) {
    if (!supabase || !userId || !pointsToAdd || pointsToAdd <= 0) {
        return { awarded: 0, skipped: true };
    }
    const {
        title = 'KSocial Points!',
        guardKey = null,
        clearMicrophoneBuff = false,
        emitToast = false
    } = options;

    const { data: profile, error: fetchErr } = await supabase
        .from('profiles')
        .select('id, league_monthly, league_all_time, details')
        .eq('id', userId)
        .maybeSingle();

    if (fetchErr || !profile) {
        return { awarded: 0, error: fetchErr };
    }

    const details = { ...(profile.details || {}) };
    const rewardGuards = { ...(details.reward_guards || {}) };

    if (guardKey && rewardGuards[guardKey]) {
        return { awarded: 0, skipped: true };
    }

    if (guardKey) {
        rewardGuards[guardKey] = new Date().toISOString();
        details.reward_guards = rewardGuards;
    }

    if (clearMicrophoneBuff && details.active_buffs?.microphone) {
        details.active_buffs = {
            ...details.active_buffs,
            microphone: false
        };
    }

    const newMonthly = Number(profile.league_monthly || 0) + pointsToAdd;
    const newAllTime = Number(profile.league_all_time || 0) + pointsToAdd;

    const { error: updateErr } = await supabase
        .from('profiles')
        .update({
            league_monthly: newMonthly,
            league_all_time: newAllTime,
            details
        })
        .eq('id', userId);

    if (updateErr) {
        return { awarded: 0, error: updateErr };
    }

    if (emitToast && typeof window !== 'undefined') {
        window.dispatchEvent(
            new CustomEvent('bhnl-reward-earned', {
                detail: { title, points: `${pointsToAdd} KSocial PTS` }
            })
        );
    }

    return { awarded: pointsToAdd, newMonthly, newAllTime };
}

/**
 * Consumes a gem or item from the user's inventory (inv_gems or inv_items),
 * removes it when quantity hits 0, and applies its exact single-use or instance effect.
 * Multiplier bonuses DO NOT apply to consumed items.
 */
export async function consumeInventoryAsset(supabase, userId, rawItemName) {
    if (!supabase || !userId || !rawItemName) {
        return { ok: false, message: 'Invalid item.' };
    }

    const canonicalName = Object.keys(CONSUMABLE_CATALOG).find(
        k => k.toLowerCase() === String(rawItemName).trim().toLowerCase()
    ) || rawItemName;

    const spec = CONSUMABLE_CATALOG[canonicalName];
    if (!spec) {
        return { ok: false, message: `${rawItemName} cannot be consumed directly.` };
    }

    const { data: profile, error: fetchErr } = await supabase
        .from('profiles')
        .select('id, lifestyle_points, active_multiplier, multiplier_uses_left, inv_gems, inv_items, details')
        .eq('id', userId)
        .maybeSingle();

    if (fetchErr || !profile) {
        return { ok: false, message: 'Could not load profile inventory.' };
    }

    const invGems = { ...(profile.inv_gems || {}) };
    const invItems = { ...(profile.inv_items || {}) };

    // Locate item in inv_gems or inv_items
    const gemKey = Object.keys(invGems).find(k => k.toLowerCase() === canonicalName.toLowerCase());
    const itemKey = Object.keys(invItems).find(k => k.toLowerCase() === canonicalName.toLowerCase());

    let sourceBucket = null;
    let sourceKey = null;
    if (gemKey && Number(invGems[gemKey]) > 0) {
        sourceBucket = 'gems';
        sourceKey = gemKey;
    } else if (itemKey && Number(invItems[itemKey]) > 0) {
        sourceBucket = 'items';
        sourceKey = itemKey;
    } else {
        return { ok: false, message: `You do not have any ${canonicalName} in your inventory.` };
    }

    const details = { ...(profile.details || {}) };
    const updates = {};

    if (spec.kind === 'instant_lp') {
        // Flat L$ grant — NEVER multiplied by active_multiplier
        updates.lifestyle_points = Number(profile.lifestyle_points || 0) + spec.bonusLp;
    } else if (spec.kind === 'multiplier') {
        if (Number(profile.multiplier_uses_left || 0) > 0 && Number(profile.active_multiplier || 1) > 1) {
            return {
                ok: false,
                message: `You already have an active ${profile.active_multiplier}x multiplier (${profile.multiplier_uses_left} uses left). Use it up before activating ${canonicalName}!`
            };
        }
        updates.active_multiplier = spec.mult;
        updates.multiplier_uses_left = spec.uses;
    } else if (spec.kind === 'ksocial_buff') {
        const activeBuffs = { ...(details.active_buffs || {}) };
        if (activeBuffs[spec.buffKey]) {
            return {
                ok: false,
                message: `${canonicalName} is already active for your next song!`
            };
        }
        activeBuffs[spec.buffKey] = true;
        details.active_buffs = activeBuffs;
        updates.details = details;
    }

    // Decrement and remove key if 0
    if (sourceBucket === 'gems') {
        const nextQty = Number(invGems[sourceKey]) - 1;
        if (nextQty <= 0) delete invGems[sourceKey];
        else invGems[sourceKey] = nextQty;
        updates.inv_gems = invGems;
    } else {
        const nextQty = Number(invItems[sourceKey]) - 1;
        if (nextQty <= 0) delete invItems[sourceKey];
        else invItems[sourceKey] = nextQty;
        updates.inv_items = invItems;
    }

    const { data: updatedProfile, error: updateErr } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', userId)
        .select('*')
        .maybeSingle();

    if (updateErr) {
        return { ok: false, message: 'Network error: ' + updateErr.message };
    }

    let message = `${canonicalName} consumed!`;
    if (spec.kind === 'instant_lp') {
        message = `${spec.icon} ${canonicalName} consumed! +${spec.bonusLp} L$ added to your wallet.`;
        await supabase
            .from('notifications')
            .insert([
                {
                    user_id: userId,
                    title: `💎 +${spec.bonusLp} L$ Received!`,
                    content: `Consumed ${canonicalName} and received +${spec.bonusLp} L$!`
                }
            ])
            .then(() => {})
            .catch(() => {});

        if (typeof window !== 'undefined') {
            window.dispatchEvent(
                new CustomEvent('bhnl-reward-earned', {
                    detail: { title: `${canonicalName} Consumed!`, points: `${spec.bonusLp} L$` }
                })
            );
        }
    } else if (spec.kind === 'multiplier') {
        message = `${spec.icon} ${canonicalName} activated! x${spec.mult} L$ applied to your next ${spec.uses} reward${spec.uses > 1 ? 's' : ''}.`;
    } else if (spec.kind === 'ksocial_buff') {
        message =
            spec.buffKey === 'microphone'
                ? '🎤 Microphone active! Incoming Vote Points on your next song sung will be doubled (x2).'
                : '📢 Megaphone active! Your next outgoing KSocial song vote will be doubled (x2).';
    }

    return { ok: true, message, spec, updatedProfile };
}

/**
 * Extracts Side A and Side B setlists from a profile row.
 */
export function extractSetlistsFromProfile(profile) {
    const rawSetlists = profile?.details?.setlists;
    const legacyActive = Array.isArray(profile?.active_setlist) ? profile.active_setlist : [];
    const sideA = Array.isArray(rawSetlists?.sideA) ? rawSetlists.sideA : legacyActive;
    const sideB = Array.isArray(rawSetlists?.sideB) ? rawSetlists.sideB : [];
    const activeSide = rawSetlists?.activeSide === 'B' ? 'B' : 'A';
    return {
        sideA,
        sideB,
        activeSide,
        currentIds: activeSide === 'B' ? sideB : sideA
    };
}

/**
 * Saves Side A / Side B setlists to profiles.details.setlists and syncs profiles.active_setlist.
 * Also awards +40 L$ the very first time a user fills a setlist to 7/7 songs!
 */
export async function updateDualSetlistOnProfile(supabase, userId, { sideA, sideB, activeSide }) {
    const { data: profile, error: fetchErr } = await supabase
        .from('profiles')
        .select('active_setlist, details')
        .eq('id', userId)
        .maybeSingle();

    if (fetchErr) return { error: fetchErr };

    const existing = extractSetlistsFromProfile(profile);
    const nextSideA = Array.isArray(sideA) ? sideA : existing.sideA;
    const nextSideB = Array.isArray(sideB) ? sideB : existing.sideB;
    const nextActiveSide = activeSide === 'B' ? 'B' : activeSide === 'A' ? 'A' : existing.activeSide;
    const nextActiveList = nextActiveSide === 'B' ? nextSideB : nextSideA;

    const nextDetails = {
        ...(profile?.details || {}),
        setlists: {
            sideA: nextSideA,
            sideB: nextSideB,
            activeSide: nextActiveSide
        }
    };

    const { error } = await supabase
        .from('profiles')
        .update({
            active_setlist: nextActiveList,
            details: nextDetails
        })
        .eq('id', userId);

    if (!error && (nextSideA.length >= 7 || nextSideB.length >= 7)) {
        await awardLifestylePoints(supabase, userId, 40, {
            title: 'First Full Setlist!',
            guardKey: 'first_full_setlist'
        });
    }

    return {
        error,
        sideA: nextSideA,
        sideB: nextSideB,
        activeSide: nextActiveSide,
        currentIds: nextActiveList
    };
}

/**
 * Extracts a numeric rotation timestamp/order for a session_singers row.
 * Uses setlist[0]._rotOrder when present, falling back to created_at or id.
 */
export function getSingerRotationOrder(singer, fallbackIdx = 0) {
    const fromSetlist = Number(singer?.setlist?.[0]?._rotOrder);
    if (Number.isFinite(fromSetlist) && fromSetlist > 0) return fromSetlist;
    if (singer?.created_at) {
        const ts = new Date(singer.created_at).getTime();
        if (Number.isFinite(ts) && ts > 0) return ts;
    }
    return 1000000 + fallbackIdx * 1000;
}

/**
 * Attaches _rotOrder onto the first item of a singer's setlist array so queue order
 * persists in Supabase without requiring extra schema columns.
 */
export function withSingerRotationOrder(setlist, rotOrder = Date.now()) {
    const list = Array.isArray(setlist) && setlist.length > 0
        ? setlist.map(item => ({ ...item }))
        : [{ id: 'manual-entry', title: 'TBD', artist: 'TBD' }];
    list[0] = { ...list[0], _rotOrder: rotOrder };
    return list;
}

/**
 * Sorts active (non-pending) contenders in true karaoke rotation order:
 * 1. Currently on stage (singing / voting / results)
 * 2. On deck (standby)
 * 3. Queued contenders ordered by their rotation timestamp (_rotOrder / created_at)
 */
export function sortSingersForRotation(singers = []) {
    const statusPriority = (status) => {
        if (status === 'singing' || status === 'voting' || status === 'results') return 0;
        if (status === 'standby') return 1;
        return 2;
    };

    return singers
        .filter(s => s.status !== 'pending')
        .map((s, idx) => ({ s, idx }))
        .sort((a, b) => {
            const pa = statusPriority(a.s.status);
            const pb = statusPriority(b.s.status);
            if (pa !== pb) return pa - pb;
            const oa = getSingerRotationOrder(a.s, a.idx);
            const ob = getSingerRotationOrder(b.s, b.idx);
            if (oa !== ob) return oa - ob;
            return String(a.s.id).localeCompare(String(b.s.id));
        })
        .map(item => item.s);
}


