import fs from 'fs';
import path from 'path';
import { cmsPackageSeedAssetsDir } from './cmsPackageSeedPaths';

type FallbackSpec = {
  fileName: string;
  from: string;
  to: string;
  accent: string;
  label: string;
};

/** Placeholders used only when a live annotated screenshot is missing. */
export const APPENDO_GUIDE_ASSET_FALLBACKS: FallbackSpec[] = [
  { fileName: 'shot-login.jpg', from: '#0f172a', to: '#1d4ed8', accent: '#2f6bff', label: 'Sign in' },
  { fileName: 'shot-dashboard.jpg', from: '#0f172a', to: '#1e293b', accent: '#2f6bff', label: 'Dashboard' },
  { fileName: 'shot-data-studio.jpg', from: '#0f172a', to: '#0e7490', accent: '#0ea5e9', label: 'Data Studio' },
  { fileName: 'shot-server-functions.jpg', from: '#064e3b', to: '#0f172a', accent: '#10b981', label: 'Server Functions' },
  { fileName: 'shot-dev-reference.jpg', from: '#14532d', to: '#0f172a', accent: '#34d399', label: 'Developer Reference' },
  { fileName: 'shot-client-components.jpg', from: '#1e1b4b', to: '#0f172a', accent: '#818cf8', label: 'Client Components' },
  { fileName: 'shot-base-components.jpg', from: '#4c1d95', to: '#0f172a', accent: '#a78bfa', label: 'Base Components' },
  { fileName: 'shot-portals.jpg', from: '#1e3a8a', to: '#0f172a', accent: '#60a5fa', label: 'Portals' },
  { fileName: 'shot-packages.jpg', from: '#581c87', to: '#0f172a', accent: '#c084fc', label: 'Packages' },
  { fileName: 'shot-workflows.jpg', from: '#064e3b', to: '#0f172a', accent: '#34d399', label: 'Workflows' },
  { fileName: 'shot-file-manager.jpg', from: '#0c4a6e', to: '#0f172a', accent: '#38bdf8', label: 'File Manager' },
  { fileName: 'shot-ssh.jpg', from: '#14532d', to: '#0f172a', accent: '#4ade80', label: 'SSH Hub' },
  { fileName: 'shot-scheduled-tasks.jpg', from: '#155e75', to: '#0f172a', accent: '#22d3ee', label: 'Scheduled Tasks' },
  { fileName: 'shot-jobs.jpg', from: '#312e81', to: '#0f172a', accent: '#818cf8', label: 'Jobs' },
  { fileName: 'shot-cache.jpg', from: '#78350f', to: '#0f172a', accent: '#fbbf24', label: 'Cache' },
  { fileName: 'shot-data-sources.jpg', from: '#1e3a8a', to: '#0f172a', accent: '#60a5fa', label: 'Data Sources' },
  { fileName: 'shot-git.jpg', from: '#164e63', to: '#0f172a', accent: '#22d3ee', label: 'Git' },
  { fileName: 'shot-theme.jpg', from: '#5b21b6', to: '#0f172a', accent: '#c4b5fd', label: 'Theme Designer' },
  { fileName: 'shot-settings.jpg', from: '#334155', to: '#0f172a', accent: '#94a3b8', label: 'Settings' },
  { fileName: 'shot-platform-transfer.jpg', from: '#0e7490', to: '#0f172a', accent: '#22d3ee', label: 'Platform Transfer' },
  { fileName: 'shot-users.jpg', from: '#312e81', to: '#0f172a', accent: '#818cf8', label: 'Users' },
  { fileName: 'shot-roles.jpg', from: '#4c1d95', to: '#0f172a', accent: '#c084fc', label: 'Roles' },
  { fileName: 'shot-base-info.jpg', from: '#155e75', to: '#0f172a', accent: '#22d3ee', label: 'Base Info' },
  { fileName: 'shot-org-chart.jpg', from: '#075985', to: '#0f172a', accent: '#38bdf8', label: 'Organization' },
  { fileName: 'shot-geo.jpg', from: '#065f46', to: '#0f172a', accent: '#34d399', label: 'Geography' },
  { fileName: 'shot-chat-history.jpg', from: '#5b21b6', to: '#0f172a', accent: '#c4b5fd', label: 'Chat History' },
  { fileName: 'shot-logs.jpg', from: '#9f1239', to: '#0f172a', accent: '#fb7185', label: 'Logs' },
  { fileName: 'shot-cms-contents.jpg', from: '#0c4a6e', to: '#0f172a', accent: '#38bdf8', label: 'CMS Contents' },
  { fileName: 'shot-public-home.jpg', from: '#0f172a', to: '#1d4ed8', accent: '#ff3d7a', label: 'Public site' },
  { fileName: 'shot-about-page.jpg', from: '#0f172a', to: '#334155', accent: '#2f6bff', label: 'About' },
  { fileName: 'shot-guide-studio-map.jpg', from: '#0f172a', to: '#1e293b', accent: '#2f6bff', label: 'Studio map' },
];

const svgFor = (spec: FallbackSpec): string => `
<svg xmlns="http://www.w3.org/2000/svg" width="1440" height="900" viewBox="0 0 1440 900">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${spec.from}"/>
      <stop offset="1" stop-color="${spec.to}"/>
    </linearGradient>
  </defs>
  <rect width="1440" height="900" fill="url(#g)"/>
  <rect x="48" y="48" width="228" height="804" fill="#0f172a" opacity="0.55" rx="12"/>
  <rect x="48" y="48" width="228" height="804" fill="none" stroke="${spec.accent}" stroke-width="3" rx="12"/>
  <rect x="300" y="48" width="1092" height="72" fill="#0f172a" opacity="0.45" rx="12"/>
  <rect x="300" y="48" width="1092" height="72" fill="none" stroke="${spec.accent}" stroke-width="3" rx="12"/>
  <rect x="300" y="144" width="1092" height="708" fill="#0f172a" opacity="0.28" rx="12"/>
  <circle cx="78" cy="90" r="16" fill="${spec.accent}"/>
  <text x="78" y="95" text-anchor="middle" fill="#ffffff" font-size="15" font-family="Segoe UI, sans-serif" font-weight="700">1</text>
  <text x="72" y="860" fill="#f8fafc" font-size="36" font-family="Segoe UI, sans-serif" font-weight="650">${spec.label}</text>
  <text x="72" y="824" fill="${spec.accent}" font-size="14" font-family="Segoe UI, sans-serif">AppEndO · live screenshot pending</text>
</svg>
`.trim();

export const ensureAppEndoGuideAssets = async (): Promise<number> => {
  const assetsDir = cmsPackageSeedAssetsDir();
  fs.mkdirSync(assetsDir, { recursive: true });
  let written = 0;
  const sharp = (await import('sharp')).default;
  for (const spec of APPENDO_GUIDE_ASSET_FALLBACKS) {
    const target = path.join(assetsDir, spec.fileName);
    if (fs.existsSync(target) && fs.statSync(target).size > 8_000) {
      continue;
    }
    await sharp(Buffer.from(svgFor(spec)))
      .jpeg({ quality: 78, mozjpeg: true })
      .toFile(target);
    written += 1;
  }
  return written;
};
