/**
 * Ethiopian calendar utilities — TypeScript port of the verified
 * backend CalendarService (apps/api/app/services/calendar_service.py).
 * Anchors: 1 Meskerem 1893 == 11 Sep 1900; 1 Meskerem 2000 == 12 Sep 2007
 * (1999 was leap); Nehase 4 2018 == 10 Aug 2026.
 */

export interface EthiopianDate {
  year: number;
  month: number; // 1..13 (13 = Pagumen)
  day: number;
}

export const ETHIOPIAN_MONTHS_EN = [
  "Meskerem",
  "Tikimt",
  "Hidar",
  "Tahsas",
  "Tir",
  "Yekatit",
  "Megabit",
  "Miyazya",
  "Ginbot",
  "Sene",
  "Hamle",
  "Nehase",
  "Pagumen",
] as const;

export const ETHIOPIAN_MONTHS_AM = [
  "መስከረም",
  "ጥቅምት",
  "ኅዳር",
  "ታኅሣሥ",
  "ጥር",
  "የካቲት",
  "መጋቢት",
  "ሚያዝያ",
  "ግንቦት",
  "ሰኔ",
  "ሐምሌ",
  "ነሐሴ",
  "ጳጉሜን",
] as const;

export const GREGORIAN_MONTHS_EN = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

const GEEZ_ONES = ["", "፩", "፪", "፫", "፬", "፭", "፮", "፯", "፰", "፱"];
const GEEZ_TENS = ["", "፲", "፳", "፴", "፵", "፶", "፷", "፸", "፹", "፺"];
const GEEZ_HUNDRED = "፻";
const GEEZ_TEN_THOUSAND = "፼";
const EPOCH_JDN = 1724221;
const DAYS_PER_YEAR = 365;
const MONTHS_REGULAR = 12;
const DAYS_PER_MONTH = 30;
const PAGUMEN_BASE = 5;

export function toGeez(num: number): string {
  if (num < 0) throw new Error("Ge'ez numerals only support non-negative integers");
  if (num === 0) return "";
  if (num < 10) return GEEZ_ONES[num];
  if (num < 100) return GEEZ_TENS[Math.floor(num / 10)] + GEEZ_ONES[num % 10];
  if (num < 10000) {
    const hundreds = Math.floor(num / 100);
    const remainder = num % 100;
    const out = hundreds === 1 ? GEEZ_HUNDRED : toGeez(hundreds) + GEEZ_HUNDRED;
    return out + toGeez(remainder);
  }
  const tenThousands = Math.floor(num / 10000);
  const remainder = num % 10000;
  const out =
    tenThousands === 1 ? GEEZ_TEN_THOUSAND : toGeez(tenThousands) + GEEZ_TEN_THOUSAND;
  return out + toGeez(remainder);
}

export function isEthiopianLeap(year: number): boolean {
  return (year + 1) % 4 === 0;
}

function gregorianToJdn(year: number, month: number, day: number): number {
  const a = Math.floor((14 - month) / 12);
  const y = year + 4800 - a;
  const m = month + 12 * a - 3;
  return (
    day +
    Math.floor((153 * m + 2) / 5) +
    365 * y +
    Math.floor(y / 4) -
    Math.floor(y / 100) +
    Math.floor(y / 400) -
    32045
  );
}

export function jdnToGregorian(jdn: number): { year: number; month: number; day: number } {
  const a = jdn + 32044;
  const b = Math.floor((4 * a + 3) / 146097);
  const c = a - Math.floor((146097 * b) / 4);
  const d = Math.floor((4 * c + 3) / 1461);
  const e = c - Math.floor((1461 * d) / 4);
  const m = Math.floor((5 * e + 2) / 153);
  const day = e - Math.floor((153 * m + 2) / 5) + 1;
  const month = m + 3 - 12 * Math.floor(m / 10);
  const year = 100 * b + d - 4800 + Math.floor(m / 10);
  return { year, month, day };
}

function startOfYearJdn(year: number): number {
  return EPOCH_JDN + DAYS_PER_YEAR * (year - 1) + Math.floor(year / 4);
}

export function ethiopianToJdn(eth: EthiopianDate): number {
  if (eth.month < 1 || eth.month > 13) throw new Error("month out of range");
  const maxDay =
    eth.month <= 12
      ? DAYS_PER_MONTH
      : PAGUMEN_BASE + (isEthiopianLeap(eth.year) ? 1 : 0);
  if (eth.day < 1 || eth.day > maxDay)
    throw new Error(`day out of range for year ${eth.year} month ${eth.month}`);
  return (
    EPOCH_JDN +
    DAYS_PER_YEAR * (eth.year - 1) +
    Math.floor(eth.year / 4) +
    DAYS_PER_MONTH * (eth.month - 1) +
    (eth.day - 1)
  );
}

export function jdnToEthiopian(jdn: number): EthiopianDate {
  const r = jdn - EPOCH_JDN;
  if (r < 0) throw new Error("date precedes Ethiopian epoch");
  let lo = 1;
  let hi = Math.max(2, Math.floor(r / 364) + 2);
  while (lo < hi) {
    const mid = Math.floor((lo + hi + 1) / 2);
    if (startOfYearJdn(mid) <= jdn) lo = mid;
    else hi = mid - 1;
  }
  const year = lo;
  const dayOfYear = jdn - startOfYearJdn(year);
  if (dayOfYear >= MONTHS_REGULAR * DAYS_PER_MONTH) {
    return {
      year,
      month: 13,
      day: dayOfYear - MONTHS_REGULAR * DAYS_PER_MONTH + 1,
    };
  }
  return {
    year,
    month: Math.floor(dayOfYear / DAYS_PER_MONTH) + 1,
    day: (dayOfYear % DAYS_PER_MONTH) + 1,
  };
}

export function toEthiopian(date: Date): EthiopianDate {
  return jdnToEthiopian(
    gregorianToJdn(date.getFullYear(), date.getMonth() + 1, date.getDate()),
  );
}

export function toGregorian(eth: EthiopianDate): Date {
  const { year, month, day } = jdnToGregorian(ethiopianToJdn(eth));
  return new Date(year, month - 1, day);
}

export type NumeralMode = "western" | "geez" | "both";

export function formatEthiopian(
  eth: EthiopianDate,
  language: "en" | "am" | "both" = "en",
  numeralMode: NumeralMode = "western",
): string {
  const monthEn = ETHIOPIAN_MONTHS_EN[eth.month - 1];
  const monthAm = ETHIOPIAN_MONTHS_AM[eth.month - 1];
  const useGeez = numeralMode === "geez" || numeralMode === "both";
  const year = useGeez ? toGeez(eth.year) : String(eth.year);
  const day = useGeez ? toGeez(eth.day) : String(eth.day);
  if (language === "am") return `${monthAm} ${day}፣ ${year}`;
  if (language === "both")
    return `${monthEn} ${eth.day}, ${eth.year}\n${monthAm} ${toGeez(eth.day)}፣ ${toGeez(eth.year)}`;
  return `${monthEn} ${day}, ${year}`;
}

export function formatGregorian(date: Date, numeralMode: NumeralMode = "western"): string {
  const useGeez = numeralMode === "geez";
  const day = useGeez ? toGeez(date.getDate()) : String(date.getDate());
  const year = useGeez ? toGeez(date.getFullYear()) : String(date.getFullYear());
  return `${GREGORIAN_MONTHS_EN[date.getMonth()]} ${day}, ${year}`;
}

export function formatDual(date: Date, numeralMode: NumeralMode = "western"): string {
  return `${formatGregorian(date, numeralMode)}\n${formatEthiopian(
    toEthiopian(date),
    "am",
    "both",
  )}`;
}
