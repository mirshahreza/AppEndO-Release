import React from 'react';
import { AppSurfaceBox, FormSection } from '../../../shared/ui';
import { useCultureT } from '../../../core/culture/CultureContext';

type RdpHubGuacdSetupBannerProps = {
  host: string;
  port: number;
};

function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_match, key: string) => vars[key] ?? '');
}

const CommandBlock: React.FC<{ text: string }> = ({ text }) => (
  <pre className="overflow-x-auto rounded-md border border-slate-100 bg-slate-50/80 p-2 font-mono text-[11px] leading-relaxed text-slate-700 whitespace-pre-wrap">
    {text}
  </pre>
);

export const RdpHubGuacdSetupBanner: React.FC<RdpHubGuacdSetupBannerProps> = ({
  host,
  port,
}) => {
  const t = useCultureT();
  const endpoint = `${host}:${port}`;

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col p-4">
      <AppSurfaceBox
        tone="amber"
        fill
        title={t('rdpHub.guacdUnreachable')}
        headerExtra={(
          <span className="font-mono text-[11px] font-semibold text-amber-900">
            {endpoint}
          </span>
        )}
        bodyClassName="overflow-y-auto space-y-3"
      >
        <p className="text-xs font-medium leading-relaxed text-slate-600">
          {interpolate(t('rdpHub.guacdUnreachable.lead'), { endpoint })}
        </p>
        <p className="text-xs font-medium leading-relaxed text-slate-600">
          {t('rdpHub.guacdUnreachable.refresh')}
        </p>
        <div className="grid gap-4 lg:grid-cols-2">
          <FormSection
            title={t('rdpHub.guacdUnreachable.windows.title')}
            ink="accent"
            hint={t('rdpHub.guacdUnreachable.windows.intro')}
          >
            <p className="text-xs font-medium leading-relaxed text-slate-600">
              {t('rdpHub.guacdUnreachable.windows.step1')}
            </p>
            <p className="text-xs font-medium leading-relaxed text-slate-600">
              {t('rdpHub.guacdUnreachable.windows.step2')}
            </p>
            <CommandBlock text={t('rdpHub.guacdUnreachable.windows.commandRun')} />
            <p className="text-xs font-medium leading-relaxed text-slate-600">
              {t('rdpHub.guacdUnreachable.windows.step3')}
            </p>
            <CommandBlock text={t('rdpHub.guacdUnreachable.windows.commandStart')} />
            <p className="text-xs font-medium leading-relaxed text-slate-600">
              {t('rdpHub.guacdUnreachable.windows.step4')}
            </p>
            <CommandBlock text={t('rdpHub.guacdUnreachable.windows.commandVerify')} />
            <p className="text-xs font-medium leading-relaxed text-slate-600">
              {t('rdpHub.guacdUnreachable.windows.wsl')}
            </p>
            <CommandBlock text={t('rdpHub.guacdUnreachable.windows.commandWsl')} />
            <p className="text-xs font-medium leading-relaxed text-slate-600">
              {t('rdpHub.guacdUnreachable.windows.env')}
            </p>
          </FormSection>
          <FormSection
            title={t('rdpHub.guacdUnreachable.linux.title')}
            ink="contrast"
            hint={t('rdpHub.guacdUnreachable.linux.intro')}
          >
            <p className="text-xs font-medium leading-relaxed text-slate-600">
              {t('rdpHub.guacdUnreachable.linux.docker')}
            </p>
            <CommandBlock text={t('rdpHub.guacdUnreachable.linux.commandDocker')} />
            <p className="text-xs font-medium leading-relaxed text-slate-600">
              {t('rdpHub.guacdUnreachable.linux.dockerStart')}
            </p>
            <CommandBlock text={t('rdpHub.guacdUnreachable.linux.commandDockerStart')} />
            <p className="text-xs font-medium leading-relaxed text-slate-600">
              {t('rdpHub.guacdUnreachable.linux.debian')}
            </p>
            <CommandBlock text={t('rdpHub.guacdUnreachable.linux.commandDebian')} />
            <p className="text-xs font-medium leading-relaxed text-slate-600">
              {t('rdpHub.guacdUnreachable.linux.verify')}
            </p>
            <CommandBlock text={t('rdpHub.guacdUnreachable.linux.commandVerify')} />
            <p className="text-xs font-medium leading-relaxed text-slate-600">
              {t('rdpHub.guacdUnreachable.linux.other')}
            </p>
            <p className="text-xs font-medium leading-relaxed text-slate-600">
              {t('rdpHub.guacdUnreachable.linux.env')}
            </p>
          </FormSection>
        </div>
      </AppSurfaceBox>
    </div>
  );
};
