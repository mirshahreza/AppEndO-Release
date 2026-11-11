/** Forced hover paint for living catalogs — mirrors `HWY_MEMBER_FACE_SUBTLE_HOVER_CLASS` hover pseudo. */
export const HWY_MEMBER_FACE_SUBTLE_HOVER_APPLIED_CLASS =
  '!border-slate-200/90 bg-white shadow-[0_2px_8px_rgba(15,23,42,0.08)]';

/** Forced active/pressed paint for living catalogs. */
export const HWY_MEMBER_FACE_SUBTLE_ACTIVE_APPLIED_CLASS =
  '!border-slate-300/95 bg-white shadow-[0_1px_4px_rgba(15,23,42,0.14)]';

/** Subtle button-like hover for clickable member face rows — white lift, no scale (avoids grid jitter). */
export const HWY_MEMBER_FACE_SUBTLE_HOVER_CLASS =
  'rounded-md border border-transparent px-1.5 py-1 transition-[background-color,box-shadow,border-color] duration-150 ease-out hover:border-slate-200/90 hover:bg-white hover:shadow-[0_2px_8px_rgba(15,23,42,0.08)] active:border-slate-300/95 active:bg-white active:shadow-[0_1px_4px_rgba(15,23,42,0.14)]';

/** Member-directory / designer grid list avatars — always circular (photo + gender placeholder). */
export const HWY_MEMBER_LIST_AVATAR_IMAGE_CLASS =
  'rounded-full border border-slate-200 object-cover';

export const HWY_MEMBER_LIST_AVATAR_PLACEHOLDER_CLASS =
  'inline-flex items-center justify-center rounded-full border';
