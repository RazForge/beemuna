import {
  type EthiopianDate,
  ethiopianToJdn,
  jdnToGregorian,
  toEthiopian,
} from "./ethiopian";
import { islamicHolidaysForDate } from "./hijri";

export interface Holiday {
  nameEn: string;
  nameAm: string;
}

export type Religion = "muslim" | "christian" | "non-religious" | "unspecified";

const NATIONAL_HOLIDAYS: Record<string, Holiday> = {
  "1-1": { nameEn: "Enkutatash (Ethiopian New Year)", nameAm: "እንቁጣጣሽ" },
  "6-2": { nameEn: "Victory of Adwa", nameAm: "የዓድዋ ድል" },
  "8-5": { nameEn: "Ethiopian Patriots' Victory Day", nameAm: "የአርበኞች ድል ቀን" },
  "9-21": { nameEn: "National Day (Martyrs' Day)", nameAm: "ቀዳሚት አብዮት" },
};

const CHRISTIAN_HOLIDAYS: Record<string, Holiday> = {
  "1-17": { nameEn: "Meskel (Finding of the True Cross)", nameAm: "መስቀል" },
  "4-29": { nameEn: "Genna (Ethiopian Christmas)", nameAm: "ገና" },
  "5-11": { nameEn: "Timkat (Ethiopian Epiphany)", nameAm: "ጥምቀት" },
  "3-12": { nameEn: "Kiddus Mikael (St. Michael)", nameAm: "ቅዱስ ሚካኤል" },
  "4-26": { nameEn: "Kiddus Gebriel (St. Gabriel)", nameAm: "ቅዱስ ገብርኤል" },
  "10-19": { nameEn: "Kiddus Gebriel (St. Gabriel)", nameAm: "ቅዱስ ገብርኤል" },
  "11-12": { nameEn: "Kiddus Mikael (St. Michael)", nameAm: "ቅዱስ ሚካኤል" },
  "12-13": { nameEn: "Debre Tabor (Transfiguration)", nameAm: "ደብረ ታቦር" },
};

const MOVABLE_HOLIDAYS = {
  fasika: { nameEn: "Fasika (Ethiopian Easter)", nameAm: "ፋሲካ" },
  siklet: { nameEn: "Good Friday (Siklet)", nameAm: "ስቅለት" },
  hosanna: { nameEn: "Hosanna (Palm Sunday)", nameAm: "ሆሣዕና" },
  ascension: { nameEn: "Ascension (Emarah)", nameAm: "ዕርገት" },
  pentecost: { nameEn: "Pentecost (Derqe)", nameAm: "በዓል ሃምሳ (ደርቀ)" },
} as const;

function julianToJdn(year: number, month: number, day: number): number {
  const a = Math.floor((14 - month) / 12);
  const y = year + 4800 - a;
  const m = month + 12 * a - 3;
  return day + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - 32083;
}

/**
 * Orthodox (Julian-calendar) Easter for a Gregorian year.
 * The Ethiopian Orthodox Church celebrates Easter on the same date.
 */
export function orthodoxEasterGregorian(gregorianYear: number): Date {
  const a = gregorianYear % 4;
  const b = gregorianYear % 7;
  const c = gregorianYear % 19;
  const d = (19 * c + 15) % 30;
  const e = (2 * a + 4 * b - d + 34) % 7;
  const month = Math.floor((d + e + 114) / 31);
  const day = ((d + e + 114) % 31) + 1;
  const g = jdnToGregorian(julianToJdn(gregorianYear, month, day));
  return new Date(g.year, g.month - 1, g.day);
}

function sameDay(a: EthiopianDate, b: EthiopianDate): boolean {
  return a.year === b.year && a.month === b.month && a.day === b.day;
}

function christianMovableFor(eth: EthiopianDate): Holiday[] {
  const out: Holiday[] = [];
  const easter = orthodoxEasterGregorian(eth.year + 8);
  const easterEth = toEthiopian(easter);
  if (sameDay(eth, easterEth)) out.push(MOVABLE_HOLIDAYS.fasika);

  const goodFriday = toEthiopian(new Date(easter.getTime() - 2 * 86400000));
  if (sameDay(eth, goodFriday)) out.push(MOVABLE_HOLIDAYS.siklet);

  const hosanna = toEthiopian(new Date(easter.getTime() - 7 * 86400000));
  if (sameDay(eth, hosanna)) out.push(MOVABLE_HOLIDAYS.hosanna);

  const ascension = toEthiopian(new Date(easter.getTime() + 39 * 86400000));
  if (sameDay(eth, ascension)) out.push(MOVABLE_HOLIDAYS.ascension);

  const pentecost = toEthiopian(new Date(easter.getTime() + 49 * 86400000));
  if (sameDay(eth, pentecost)) out.push(MOVABLE_HOLIDAYS.pentecost);

  return out;
}

/** Holidays falling on a given Ethiopian calendar date, filtered by the user's religion. */
export function ethiopianHolidaysForDate(eth: EthiopianDate, religion: Religion = "unspecified"): Holiday[] {
  const out: Holiday[] = [];
  const national = NATIONAL_HOLIDAYS[`${eth.month}-${eth.day}`];
  if (national) out.push(national);

  if (religion === "christian") {
    const fixed = CHRISTIAN_HOLIDAYS[`${eth.month}-${eth.day}`];
    if (fixed) out.push(fixed);
    out.push(...christianMovableFor(eth));
  } else if (religion === "muslim") {
    const date = toGregorianOf(eth);
    if (date) {
      const seen = new Set<string>();
      for (const h of islamicHolidaysForDate(date)) {
        const k = `${h.nameAm}-${h.nameEn}`;
        if (!seen.has(k)) {
          seen.add(k);
          out.push({ nameEn: h.nameEn, nameAm: h.nameAm });
        }
      }
    }
  }
  return out;
}

function toGregorianOf(eth: EthiopianDate): Date | null {
  try {
    const g = jdnToGregorian(ethiopianToJdn(eth));
    return new Date(g.year, g.month - 1, g.day);
  } catch {
    return null;
  }
}

/** Holidays falling on a Gregorian date, filtered by religion. */
export function gregorianHolidaysForDate(date: Date, religion: Religion = "unspecified"): Holiday[] {
  return ethiopianHolidaysForDate(toEthiopian(date), religion);
}