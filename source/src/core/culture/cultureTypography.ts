import type { CultureTypography } from '../../shared/api/contracts/systemExtensions/types';

export const US_CULTURE_TYPOGRAPHY: CultureTypography = {
  defaultFontId: 'inter',
  fonts: [
    { id: 'inter', label: 'Inter', family: 'Inter' },
    { id: 'source-sans-3', label: 'Source Sans 3', family: 'Source Sans 3' },
    { id: 'ibm-plex-sans', label: 'IBM Plex Sans', family: 'IBM Plex Sans' },
  ],
};

export const IR_CULTURE_TYPOGRAPHY: CultureTypography = {
  defaultFontId: 'vazirmatn',
  fonts: [
    { id: 'vazirmatn', label: 'Vazirmatn', family: 'Vazirmatn' },
    { id: 'parastoo', label: 'Parastoo', family: 'Parastoo' },
  ],
};

export const IQ_CULTURE_TYPOGRAPHY: CultureTypography = {
  defaultFontId: 'noto-sans-arabic',
  fonts: [
    { id: 'noto-sans-arabic', label: 'Noto Sans Arabic', family: 'Noto Sans Arabic' },
    { id: 'ibm-plex-sans-arabic', label: 'IBM Plex Sans Arabic', family: 'IBM Plex Sans Arabic' },
    { id: 'rubik', label: 'Rubik', family: 'Rubik' },
  ],
};
