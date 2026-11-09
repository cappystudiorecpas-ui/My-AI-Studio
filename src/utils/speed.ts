export interface SpeakingSpeedOption {
  id: string; // e.g. '0.75x', '1.00x', '1.25x', '1.50x', '1.75x', '2.00x', '2.25x', '2.50x', '3.00x'
  speed: number;
  label: string;
  burmeseName: string;
  englishName: string;
  badge?: string;
  description: string;
}

export const SPEAKING_SPEED_OPTIONS: SpeakingSpeedOption[] = [
  {
    id: '0.75x',
    speed: 0.75,
    label: '0.75x – အလွန်နှေး (Very Slow)',
    burmeseName: 'အလွန်နှေး',
    englishName: 'Very Slow',
    badge: '0.75x',
    description: 'အေးဆေးငြိမ်သက်စွာ ရှင်းပြလိုသော ဇာတ်ကားများအတွက်',
  },
  {
    id: '1.00x',
    speed: 1.0,
    label: '1.00x – ပုံမှန် (Normal)',
    burmeseName: 'ပုံမှန်',
    englishName: 'Normal',
    badge: 'Default',
    description: 'သဘာဝကျပြီး နားထောင်ရအဆင်ပြေဆုံး ပုံမှန်အမြန်နှုန်း',
  },
  {
    id: '1.25x',
    speed: 1.25,
    label: '1.25x – အမြန် (Fast)',
    burmeseName: 'မြန်',
    englishName: 'Fast',
    badge: '1.25x',
    description: 'ခပ်သွက်သွက် စကားပြောနှုန်း၊ အချိန်တိုအတွင်း ဇာတ်လမ်းနားလည်နိုင်သည်',
  },
  {
    id: '1.50x',
    speed: 1.5,
    label: '1.50x – အလွန်မြန် (Very Fast)',
    burmeseName: 'အလွန်မြန်',
    englishName: 'Very Fast',
    badge: '1.50x',
    description: 'တိုက်ခိုက်ခန်းနှင့် သည်းထိတ်ရင်ဖို ရုပ်ရှင်များအတွက် လိုက်ဖက်သည်',
  },
  {
    id: '1.75x',
    speed: 1.75,
    label: '1.75x – အထူးမြန် (Ultra Fast)',
    burmeseName: 'အထူးမြန်',
    englishName: 'Ultra Fast',
    badge: '1.75x',
    description: 'မြန်ဆန်သော အကူးအပြောင်းနှင့် တက်ကြွသော ဇာတ်ကြောင်းပြော',
  },
  {
    id: '2.00x',
    speed: 2.0,
    label: '2.00x – အမြင့်ဆုံးမြန်နှုန်း (Maximum Speed)',
    burmeseName: 'အမြင့်ဆုံးမြန်နှုန်း',
    englishName: 'Maximum Speed',
    badge: '2.00x Max',
    description: 'အမြန်နှုန်းနှစ်ဆ၊ အချိန်အလွန်တိုတောင်းသော Recap အတွက်',
  },
  {
    id: '2.25x',
    speed: 2.25,
    label: '2.25x – လွန်ကဲမြန်နှုန်း (Extreme Speed)',
    burmeseName: 'လွန်ကဲမြန်နှုန်း',
    englishName: 'Extreme Speed',
    badge: '2.25x',
    description: 'အလွန်မြန်ဆန်ပြီး သွက်လက်သော စကားပြောနှုန်း',
  },
  {
    id: '2.50x',
    speed: 2.5,
    label: '2.50x – စူပါလွန်ကဲမြန်နှုန်း (Super Extreme Speed)',
    burmeseName: 'စူပါလွန်ကဲမြန်နှုန်း',
    englishName: 'Super Extreme Speed',
    badge: '2.50x Super',
    description: 'TikTok / Reels ဇာတ်လမ်းအကျဉ်းများအတွက် အထူးသင့်လျော်သည်',
  },
  {
    id: '3.00x',
    speed: 3.0,
    label: '3.00x – တာဘို အမြန်ဆုံး (Turbo Speed)',
    burmeseName: 'တာဘို အမြန်ဆုံး',
    englishName: 'Turbo Speed',
    badge: '3.00x Turbo',
    description: 'အမြင့်ဆုံး တာဘိုအမြန်နှုန်း၊ Pitch ထိန်းညှိထားသဖြင့် အသံကြည်လင်ပြတ်သားသည်',
  },
];

export const DEFAULT_SPEED_ID = '1.00x';

/**
 * Parse speed rate string into a numeric multiplier.
 * Supports:
 * - '0.75x', '1.00x', '1.25x', '1.50x', '1.75x', '2.00x', '2.25x', '2.50x', '3.00x'
 * - '+0%', '+10%', '-10%' (legacy)
 * - Raw numbers: 1.0, 2.0, etc.
 */
export function parseSpeedMultiplier(rate: string | number | undefined | null): number {
  if (rate === undefined || rate === null || rate === '') {
    return 1.0;
  }
  if (typeof rate === 'number') {
    if (isNaN(rate) || rate <= 0) return 1.0;
    return Math.max(0.5, Math.min(4.0, Math.round(rate * 100) / 100));
  }

  const str = String(rate).trim().toLowerCase();

  // Legacy percentage support
  if (str === '+0%' || str === '0%' || str === '+0') return 1.0;
  if (str === '+10%') return 1.1;
  if (str === '-10%') return 0.9;
  if (str === '+20%') return 1.2;
  if (str === '+50%') return 1.5;
  if (str === '+100%') return 2.0;

  // Standard multiplier matching e.g. "2.00x", "1.5x", "3x"
  const cleanNum = parseFloat(str.replace(/[^0-9.]/g, ''));
  if (!isNaN(cleanNum) && cleanNum > 0) {
    return Math.max(0.5, Math.min(4.0, Math.round(cleanNum * 100) / 100));
  }

  return 1.0;
}

/**
 * Format a multiplier number to standard ID string, e.g. 2 -> "2.00x"
 */
export function formatSpeedId(speed: number): string {
  const rounded = Math.round(speed * 100) / 100;
  return `${rounded.toFixed(2)}x`;
}

/**
 * Find the closest SpeakingSpeedOption for a given rate string or multiplier
 */
export function getSpeedOption(rate: string | number | undefined | null): SpeakingSpeedOption {
  const mult = parseSpeedMultiplier(rate);
  const exact = SPEAKING_SPEED_OPTIONS.find((opt) => Math.abs(opt.speed - mult) < 0.01);
  if (exact) return exact;

  // Closest match
  let closest = SPEAKING_SPEED_OPTIONS[1]; // default 1.00x
  let minDiff = 999;
  for (const opt of SPEAKING_SPEED_OPTIONS) {
    const diff = Math.abs(opt.speed - mult);
    if (diff < minDiff) {
      minDiff = diff;
      closest = opt;
    }
  }
  return closest;
}

/**
 * Build FFmpeg audio filter string using chained atempo filters.
 * FFmpeg's atempo filter is strictly bounded between 0.5 and 2.0.
 * For speeds above 2.0 (e.g. 2.25x, 2.50x, 3.00x), multiple atempo filters
 * must be chained (e.g. atempo=2.0,atempo=1.5 for 3.0x).
 */
export function buildAtempoFilter(speed: number): string {
  if (speed <= 0.01) return 'atempo=1.0';
  if (Math.abs(speed - 1.0) < 0.01) return '';

  const filters: string[] = [];
  let remaining = speed;

  // Chain atempo=2.0 while remaining > 2.0
  while (remaining > 2.0) {
    filters.push('atempo=2.0');
    remaining /= 2.0;
  }

  // Chain atempo=0.5 while remaining < 0.5
  while (remaining < 0.5) {
    filters.push('atempo=0.5');
    remaining /= 0.5;
  }

  // Append remaining factor if not 1.0
  if (Math.abs(remaining - 1.0) > 0.001) {
    // Format to 4 decimals and trim trailing zeros
    const valStr = remaining.toFixed(4).replace(/\.?0+$/, '');
    filters.push(`atempo=${valStr}`);
  }

  return filters.join(',');
}
