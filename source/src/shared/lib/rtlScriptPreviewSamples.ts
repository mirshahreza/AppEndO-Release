/**
 * RTL script sample strings for font previews and Base Components autoDir demos.
 * Exempt from `hygiene:english-copy` — not application UI copy; exercises bidi detection only.
 */
export const RTL_SCRIPT_PREVIEW_FA =
  'بنی آدم اعضای یک پیکرند که در آفرینش ز یک گوهرند.';

export const RTL_SCRIPT_PREVIEW_AR =
  'بَنِي آدَمَ أَعْضَاءُ بَدَنٍ وَاحِدٍ، وَخُلِقُوا مِنْ طِينَةٍ وَاحِدَةٍ، فَإِذَا أَصَابَ أَحَدُكُمْ أَحَدًا أَلَمَّ بِهِ الْوَجَعُ.';

export const RTL_TEXT_DIRECTION_SAMPLES = [
  { id: 'en', label: 'English', value: 'The export button does not respond on mobile.' },
  { id: 'fa', label: 'Persian', value: 'دکمه خروجی در موبایل کار نمی‌کند.' },
  { id: 'ar', label: 'Arabic', value: 'زر الحفظ لا يعمل في الصفحة الرئيسية.' },
  { id: 'mixed', label: 'Mixed', value: 'Bug report: صفحه تنظیمات باز نمی‌شود' },
] as const;
