import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const files = [
  'src/features/jobs/hooks/useJobsPage.tsx',
  'src/features/libraries/hooks/useLibrariesPage.ts',
  'src/features/cache/hooks/useCachePage.tsx',
  'src/features/chat-history/hooks/useChatHistoryPage.tsx',
  'src/features/data-sources/hooks/useDataSourcesPage.tsx',
  'src/features/data-studio/hooks/useDataStudioPage.ts',
  'src/features/feedback/hooks/useMyFeedbackPage.ts',
  'src/features/git/hooks/useGitPage.tsx',
  'src/features/in-app-notifications/hooks/useInAppNotificationsAdminPage.tsx',
  'src/features/my-apis/hooks/useMyApisPage.ts',
  'src/features/platform-navigations/hooks/usePlatformNavigationsPage.tsx',
  'src/features/platform-portals/hooks/usePortalsPage.tsx',
  'src/features/scheduled-tasks/hooks/useScheduledTasksPage.tsx',
  'src/features/settings/components/settingsAttributes/useSettingsAttributesSection.tsx',
];

for (const rel of files) {
  const file = path.join(root, rel);
  let text = fs.readFileSync(file, 'utf8');
  text = text.replace(
    /import\s*\{[^}]*useListPageToolbarScroll[^}]*\}\s*from\s*['"][^'"]+['"];?\n/g,
    '',
  );
  if (!text.includes('useListPagePresentationScroll')) {
    text = text.replace(
      /(from '\.\.\/\.\.\/\.\.\/shared\/lib\/useGridListPresentation';)/,
      "$1\nimport { useListPagePresentationScroll } from '../../../shared/lib/useListPagePresentationScroll';",
    );
    text = text.replace(
      /(from '\.\.\/\.\.\/\.\.\/\.\.\/shared\/lib\/useGridListPresentation';)/,
      "$1\nimport { useListPagePresentationScroll } from '../../../../shared/lib/useListPagePresentationScroll';",
    );
  }
  if (!text.includes('const onGridScroll = useListPagePresentationScroll')) {
    text = text.replace(
      /(const presentation = useGridListPresentation\([\s\S]*?\);\n)/,
      '$1\n  const onGridScroll = useListPagePresentationScroll(presentation);\n',
    );
  }
  if (!text.includes('presentation = useGridListPresentation') && text.includes('onGridScroll,')) {
    text = text.replace(/\n\s*onGridScroll,\n/, '\n');
  }
  fs.writeFileSync(file, text);
  console.log('fixed', rel);
}
