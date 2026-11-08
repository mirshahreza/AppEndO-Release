export type GradientPresetCategoryId =
  | 'sunset'
  | 'ocean'
  | 'aurora'
  | 'forest'
  | 'pastel'
  | 'dark'
  | 'brand'
  | 'conic'
  | 'radial'
  | 'repeating';

export type GradientPreset = {
  id: string;
  name: string;
  category: GradientPresetCategoryId;
  css: string;
};

export const GRADIENT_PRESET_CATEGORIES: Array<{ id: GradientPresetCategoryId | 'all'; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'sunset', label: 'Sunset' },
  { id: 'ocean', label: 'Ocean' },
  { id: 'aurora', label: 'Aurora' },
  { id: 'forest', label: 'Forest' },
  { id: 'pastel', label: 'Pastel' },
  { id: 'dark', label: 'Dark' },
  { id: 'brand', label: 'Brand' },
  { id: 'radial', label: 'Radial' },
  { id: 'conic', label: 'Conic' },
  { id: 'repeating', label: 'Repeating' },
];

export const GRADIENT_PRESETS: GradientPreset[] = [
  // Sunset
  { id: 'sunset-blaze', name: 'Sunset Blaze', category: 'sunset', css: 'linear-gradient(135deg, #FF6E7F 0%, #FF9966 45%, #FFCB47 100%)' },
  { id: 'golden-hour', name: 'Golden Hour', category: 'sunset', css: 'linear-gradient(120deg, #F7971E 0%, #FFD200 100%)' },
  { id: 'peach-dream', name: 'Peach Dream', category: 'sunset', css: 'linear-gradient(160deg, #FFECD2 0%, #FCB69F 100%)' },
  { id: 'coral-dusk', name: 'Coral Dusk', category: 'sunset', css: 'linear-gradient(135deg, #FF758C 0%, #FF7EB3 100%)' },
  { id: 'mango-sorbet', name: 'Mango Sorbet', category: 'sunset', css: 'linear-gradient(145deg, #F953C6 0%, #FFB88C 100%)' },
  { id: 'warm-ember', name: 'Warm Ember', category: 'sunset', css: 'linear-gradient(135deg, #FF512F 0%, #F09819 100%)' },

  // Ocean
  { id: 'deep-ocean', name: 'Deep Ocean', category: 'ocean', css: 'linear-gradient(135deg, #1E3C72 0%, #2A5298 100%)' },
  { id: 'aqua-splash', name: 'Aqua Splash', category: 'ocean', css: 'linear-gradient(120deg, #00C6FF 0%, #0072FF 100%)' },
  { id: 'lagoon', name: 'Lagoon', category: 'ocean', css: 'linear-gradient(135deg, #43E97B 0%, #38F9D7 100%)' },
  { id: 'arctic-breeze', name: 'Arctic Breeze', category: 'ocean', css: 'linear-gradient(135deg, #E0F7FA 0%, #80DEEA 50%, #0288D1 100%)' },
  { id: 'tidal-wave', name: 'Tidal Wave', category: 'ocean', css: 'linear-gradient(160deg, #2193B0 0%, #6DD5ED 100%)' },
  { id: 'reef-glow', name: 'Reef Glow', category: 'ocean', css: 'linear-gradient(135deg, #11998E 0%, #38EF7D 100%)' },

  // Aurora
  { id: 'northern-lights', name: 'Northern Lights', category: 'aurora', css: 'linear-gradient(135deg, #00F5A0 0%, #00D9F5 50%, #7B2FF7 100%)' },
  { id: 'neon-pulse', name: 'Neon Pulse', category: 'aurora', css: 'linear-gradient(120deg, #FF2D8A 0%, #8B5CF6 50%, #00E5FF 100%)' },
  { id: 'electric-sky', name: 'Electric Sky', category: 'aurora', css: 'linear-gradient(135deg, #4776E6 0%, #8E54E9 100%)' },
  { id: 'cyber-dawn', name: 'Cyber Dawn', category: 'aurora', css: 'linear-gradient(145deg, #F857A6 0%, #FF5858 100%)' },
  { id: 'plasma-flow', name: 'Plasma Flow', category: 'aurora', css: 'linear-gradient(135deg, #7F00FF 0%, #E100FF 100%)' },
  { id: 'violet-flare', name: 'Violet Flare', category: 'aurora', css: 'linear-gradient(120deg, #654EA3 0%, #EAAFC8 100%)' },

  // Forest
  { id: 'emerald-canopy', name: 'Emerald Canopy', category: 'forest', css: 'linear-gradient(135deg, #134E5E 0%, #71B280 100%)' },
  { id: 'moss-garden', name: 'Moss Garden', category: 'forest', css: 'linear-gradient(135deg, #56AB2F 0%, #A8E063 100%)' },
  { id: 'pine-mist', name: 'Pine Mist', category: 'forest', css: 'linear-gradient(160deg, #0F2027 0%, #203A43 50%, #2C5364 100%)' },
  { id: 'spring-leaf', name: 'Spring Leaf', category: 'forest', css: 'linear-gradient(135deg, #A8FF78 0%, #78FFD6 100%)' },
  { id: 'olive-grove', name: 'Olive Grove', category: 'forest', css: 'linear-gradient(135deg, #C9D6FF 0%, #E2E2E2 100%)' },

  // Pastel
  { id: 'cotton-candy', name: 'Cotton Candy', category: 'pastel', css: 'linear-gradient(135deg, #FDF2F8 0%, #E0E7FF 100%)' },
  { id: 'blush-lilac', name: 'Blush Lilac', category: 'pastel', css: 'linear-gradient(135deg, #FBC2EB 0%, #A6C1EE 100%)' },
  { id: 'soft-sky', name: 'Soft Sky', category: 'pastel', css: 'linear-gradient(135deg, #A1C4FD 0%, #C2E9FB 100%)' },
  { id: 'mint-cream', name: 'Mint Cream', category: 'pastel', css: 'linear-gradient(135deg, #D4FC79 0%, #96E6A1 100%)' },
  { id: 'rose-quartz', name: 'Rose Quartz', category: 'pastel', css: 'linear-gradient(135deg, #FFE0F0 0%, #FFF1EB 100%)' },
  { id: 'lavender-haze', name: 'Lavender Haze', category: 'pastel', css: 'linear-gradient(135deg, #E0C3FC 0%, #8EC5FC 100%)' },

  // Dark
  { id: 'midnight', name: 'Midnight', category: 'dark', css: 'linear-gradient(135deg, #0F0C29 0%, #302B63 50%, #24243E 100%)' },
  { id: 'carbon-night', name: 'Carbon Night', category: 'dark', css: 'linear-gradient(135deg, #232526 0%, #414345 100%)' },
  { id: 'obsidian', name: 'Obsidian', category: 'dark', css: 'linear-gradient(160deg, #000000 0%, #434343 100%)' },
  { id: 'deep-space', name: 'Deep Space', category: 'dark', css: 'linear-gradient(135deg, #141E30 0%, #243B55 100%)' },
  { id: 'noir-violet', name: 'Noir Violet', category: 'dark', css: 'linear-gradient(135deg, #200122 0%, #6F0000 100%)' },
  { id: 'slate-storm', name: 'Slate Storm', category: 'dark', css: 'linear-gradient(135deg, #1F2937 0%, #111827 100%)' },

  // Brand / UI
  { id: 'indigo-bloom', name: 'Indigo Bloom', category: 'brand', css: 'linear-gradient(135deg, #667EEA 0%, #764BA2 100%)' },
  { id: 'studio-accent', name: 'Studio Accent', category: 'brand', css: 'linear-gradient(135deg, #00A28A 0%, #14B8A6 100%)' },
  { id: 'royal-blue', name: 'Royal Blue', category: 'brand', css: 'linear-gradient(135deg, #396afc 0%, #2948ff 100%)' },
  { id: 'fuchsia-pop', name: 'Fuchsia Pop', category: 'brand', css: 'linear-gradient(135deg, #DA22FF 0%, #9733EE 100%)' },
  { id: 'sunrise-ui', name: 'Sunrise UI', category: 'brand', css: 'linear-gradient(135deg, #FF9A9E 0%, #FAD0C4 100%)' },
  { id: 'cool-steel', name: 'Cool Steel', category: 'brand', css: 'linear-gradient(135deg, #ECE9E6 0%, #FFFFFF 100%)' },

  // Radial
  { id: 'spotlight-gold', name: 'Spotlight Gold', category: 'radial', css: 'radial-gradient(circle at 50% 50%, #FDE68A 0%, #F97316 100%)' },
  { id: 'moon-glow', name: 'Moon Glow', category: 'radial', css: 'radial-gradient(ellipse at 30% 20%, #E0E7FF 0%, #6366F1 70%)' },
  { id: 'sunburst', name: 'Sunburst', category: 'radial', css: 'radial-gradient(circle farthest-corner at 50% 50%, #FFF7AE 0%, #FFA63D 55%, #FF3D77 100%)' },
  { id: 'orbital-teal', name: 'Orbital Teal', category: 'radial', css: 'radial-gradient(circle at 70% 30%, #5EEAD4 0%, #0F766E 75%)' },
  { id: 'rose-lantern', name: 'Rose Lantern', category: 'radial', css: 'radial-gradient(ellipse at 50% 0%, #FDA4AF 0%, #881337 80%)' },
  { id: 'cosmic-burst', name: 'Cosmic Burst', category: 'radial', css: 'radial-gradient(circle at 50% 50%, #C084FC 0%, #312E81 100%)' },

  // Conic
  { id: 'color-wheel', name: 'Color Wheel', category: 'conic', css: 'conic-gradient(from 0deg at 50% 50%, #FF2D8A, #8B5CF6, #00E5FF, #B8FF00, #FF2D8A)' },
  { id: 'pie-spectrum', name: 'Pie Spectrum', category: 'conic', css: 'conic-gradient(from 90deg at 50% 50%, #F43F5E, #FB923C, #FACC15, #4ADE80, #38BDF8, #A78BFA, #F43F5E)' },
  { id: 'dial-chrome', name: 'Dial Chrome', category: 'conic', css: 'conic-gradient(from 180deg at 50% 50%, #E2E8F0 0deg, #94A3B8 120deg, #334155 240deg, #E2E8F0 360deg)' },
  { id: 'neon-ring', name: 'Neon Ring', category: 'conic', css: 'conic-gradient(from 45deg at 50% 50%, #22D3EE, #A855F7, #F472B6, #22D3EE)' },
  { id: 'prism-spin', name: 'Prism Spin', category: 'conic', css: 'conic-gradient(from 0deg at 50% 50%, #FF0000, #FFFF00, #00FF00, #00FFFF, #0000FF, #FF00FF, #FF0000)' },

  // Repeating
  { id: 'candy-stripe', name: 'Candy Stripe', category: 'repeating', css: 'repeating-linear-gradient(45deg, #FF8A00 0px, #FF8A00 10px, #E52E71 10px, #E52E71 20px)' },
  { id: 'ocean-ripples', name: 'Ocean Ripples', category: 'repeating', css: 'repeating-radial-gradient(circle, #667EEA 0 8%, #764BA2 8% 16%)' },
  { id: 'sunburst-tiles', name: 'Sunburst Tiles', category: 'repeating', css: 'repeating-conic-gradient(from 0deg, #FDE68A 0deg 30deg, #F97316 30deg 60deg)' },
  { id: 'mint-zigzag', name: 'Mint Zigzag', category: 'repeating', css: 'repeating-linear-gradient(135deg, #A7F3D0 0px, #A7F3D0 12px, #6EE7B7 12px, #6EE7B7 24px)' },
  { id: 'violet-pulse', name: 'Violet Pulse', category: 'repeating', css: 'repeating-linear-gradient(90deg, #C4B5FD 0px, #C4B5FD 16px, #8B5CF6 16px, #8B5CF6 32px)' },
  { id: 'retro-rings', name: 'Retro Rings', category: 'repeating', css: 'repeating-radial-gradient(circle at 50% 50%, #F472B6 0 6%, #DB2777 6% 12%)' },

  // Extra modern picks
  { id: 'instagram-pop', name: 'Instagram Pop', category: 'brand', css: 'linear-gradient(45deg, #F58529 0%, #DD2A7B 50%, #8134AF 100%)' },
  { id: 'spotify-green', name: 'Spotify Green', category: 'brand', css: 'linear-gradient(135deg, #1DB954 0%, #191414 100%)' },
  { id: 'discord-blurple', name: 'Discord Blurple', category: 'brand', css: 'linear-gradient(135deg, #5865F2 0%, #7289DA 100%)' },
  { id: 'twilight-haze', name: 'Twilight Haze', category: 'aurora', css: 'linear-gradient(135deg, #2E3192 0%, #1BFFFF 100%)' },
  { id: 'fire-ice', name: 'Fire & Ice', category: 'aurora', css: 'linear-gradient(90deg, #FF416C 0%, #FF4B2B 50%, #00C9FF 100%)' },
  { id: 'berry-smoothie', name: 'Berry Smoothie', category: 'pastel', css: 'linear-gradient(135deg, #C471F5 0%, #FA71CD 100%)' },
  { id: 'honey-dew', name: 'Honey Dew', category: 'pastel', css: 'linear-gradient(135deg, #FFF1BA 0%, #B2FEFA 100%)' },
  { id: 'desert-rose', name: 'Desert Rose', category: 'sunset', css: 'linear-gradient(135deg, #ED4264 0%, #FFEDBC 100%)' },
  { id: 'polar-night', name: 'Polar Night', category: 'dark', css: 'linear-gradient(135deg, #0B486B 0%, #F56217 100%)' },
  { id: 'jade-lake', name: 'Jade Lake', category: 'ocean', css: 'linear-gradient(135deg, #004E92 0%, #000428 100%)' },
  { id: 'sakura-bloom', name: 'Sakura Bloom', category: 'pastel', css: 'linear-gradient(135deg, #FBD3E9 0%, #BB377D 100%)' },
  { id: 'lime-surge', name: 'Lime Surge', category: 'forest', css: 'linear-gradient(135deg, #A8E063 0%, #56AB2F 100%)' },
  { id: 'holographic', name: 'Holographic', category: 'conic', css: 'conic-gradient(from 180deg at 50% 50%, #FF6FD8, #3813C2, #00F5D4, #FF6FD8)' },
  { id: 'spotlight-silk', name: 'Spotlight Silk', category: 'radial', css: 'radial-gradient(circle at 20% 20%, #FFFFFF 0%, #C7D2FE 45%, #6366F1 100%)' },
  { id: 'neon-lanes', name: 'Neon Lanes', category: 'repeating', css: 'repeating-linear-gradient(90deg, #0F172A 0px, #0F172A 20px, #22D3EE 20px, #22D3EE 22px)' },
];

export const getGradientPresetsByCategory = (
  category: GradientPresetCategoryId | 'all',
): GradientPreset[] => (
  category === 'all'
    ? GRADIENT_PRESETS
    : GRADIENT_PRESETS.filter((preset) => preset.category === category)
);

export const findGradientPreset = (id: string): GradientPreset | undefined => (
  GRADIENT_PRESETS.find((preset) => preset.id === id)
);
