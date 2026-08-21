export interface HijriDate {
  year: number;
  month: number; // 1..12
  day: number;
}

export interface Holiday {
  nameEn: string;
  nameAm: string;
  nameAr: string;
}

export const HIJRI_MONTHS_EN = [
  "Muharram",
  "Safar",
  "Rabi' al-Awwal",
  "Rabi' ath-Thani",
  "Jumada al-Awwal",
  "Jumada ath-Thani",
  "Rajab",
  "Sha'ban",
  "Ramadan",
  "Shawwal",
  "Dhu al-Qa'dah",
  "Dhu al-Hijjah",
] as const;

export const HIJRI_MONTHS_AR = [
  "المحرّم",
  "صفر",
  "ربيع الأول",
  "ربيع الآخر",
  "جمادى الأولى",
  "جمادى الآخرة",
  "رجب",
  "شعبان",
  "رمضان",
  "شوّال",
  "ذو القعدة",
  "ذو الحجة",
] as const;

const ARABIC_DIGITS = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];

export function toArabicIndic(num: number): string {
  return String(num)
    .split("")
    .map((c) => (/\d/.test(c) ? ARABIC_DIGITS[Number(c)] : c))
    .join("");
}

const _fmt = new Intl.DateTimeFormat("en-US-u-ca-islamic-umalqura", {
  year: "numeric",
  month: "numeric",
  day: "numeric",
});

/** Convert a Gregorian date to the Umm al-Qura Hijri calendar (via Intl). */
export function toHijri(date: Date): HijriDate {
  const parts = _fmt.formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value;
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
  };
}

const ISLAMIC_HOLIDAYS: Record<string, Holiday> = {
  "1-1": { nameEn: "Islamic New Year", nameAm: "አዲስ ዓመት (ሂጅራ)", nameAr: "رأس السنة الهجرية" },
  "1-10": { nameEn: "Day of Ashura", nameAm: "ዓሹራ", nameAr: "عاشوراء" },
  "3-12": { nameEn: "Mawlid an-Nabi (Prophet's Birthday)", nameAm: "መውሊድ", nameAr: "المولد النبوي" },
  "7-27": { nameEn: "Isra & Mi'raj", nameAm: "እስራ ወምዕራጅ", nameAr: "الإسراء والمعراج" },
  "9-1": { nameEn: "Beginning of Ramadan", nameAm: "ረመዳን ጀመረ", nameAr: "بداية رمضان" },
  "9-27": { nameEn: "Laylat al-Qadr (Night of Power)", nameAm: "ሌይለቱል ቀድር", nameAr: "ليلة القدر" },
  "10-1": { nameEn: "Eid al-Fitr", nameAm: "ኢድ አልፈጥር", nameAr: "عيد الفطر" },
  "10-2": { nameEn: "Eid al-Fitr (2nd day)", nameAm: "ኢድ አልፈጥር (2ኛ ቀን)", nameAr: "عيد الفطر" },
  "12-9": { nameEn: "Day of Arafah", nameAm: "ቀን ዓረፋ", nameAr: "يوم عرفة" },
  "12-10": { nameEn: "Eid al-Adha", nameAm: "ኢድ አልአድሃ", nameAr: "عيد الأضحى" },
  "12-11": { nameEn: "Eid al-Adha (2nd day)", nameAm: "ኢድ አልአድሃ (2ኛ ቀን)", nameAr: "عيد الأضحى" },
};

export function hijriHolidaysForDate(h: HijriDate): Holiday[] {
  const hit = ISLAMIC_HOLIDAYS[`${h.month}-${h.day}`];
  return hit ? [hit] : [];
}

export function islamicHolidaysForDate(date: Date): Holiday[] {
  return hijriHolidaysForDate(toHijri(date));
}

/** Month length in days (Umm al-Qura via Intl): days until the next Hijri month. */
export function hijriMonthLength(year: number, month: number): number {
  const start = hijriToGregorian(year, month, 1);
  if (!start) return 30;
  for (let d = 28; d <= 31; d++) {
    const h = toHijri(new Date(start.getTime() + d * 86400000));
    if (h.year === year && h.month === month + 1 && h.day === 1) return d;
  }
  return 30;
}

/** Gregorian date of the 1st day of a Hijri month (scans ±3 days around the estimate). */
export function hijriToGregorian(year: number, month: number, day: number): Date | null {
  const today = new Date();
  const todayH = toHijri(today);
  const est = new Date(
    today.getTime() -
      (todayH.day - day) * 86400000 -
      (todayH.month - month) * 29.5 * 86400000 -
      (todayH.year - year) * 354.37 * 86400000,
  );
  for (let offset = -6; offset <= 6; offset++) {
    const cand = new Date(est.getTime() + offset * 86400000);
    const h = toHijri(cand);
    if (h.year === year && h.month === month && h.day === day) return cand;
  }
  return null;
}

export function hijriMonthLabel(year: number, month: number): string {
  return `${HIJRI_MONTHS_EN[month - 1]} ${toArabicIndic(year)}`;
}