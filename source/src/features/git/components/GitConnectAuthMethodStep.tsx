import React from 'react';
import { Github, KeyRound, Terminal } from 'lucide-react';
import { UiOptionCardGroup } from '../../../shared/ui';
import { GitConnectLocalOnlyButton } from './GitConnectLocalOnlyButton';
import type { GitConnectAuthMethod } from '../gitConnectWizard';

type GitConnectAuthMethodStepProps = {
  value: GitConnectAuthMethod;
  githubOAuthAvailable: boolean;
  onChange: (method: GitConnectAuthMethod) => void;
  onLocalOnly?: () => void;
};

export const GitConnectAuthMethodStep: React.FC<GitConnectAuthMethodStepProps> = ({
  value,
  githubOAuthAvailable,
  onChange,
  onLocalOnly,
}) => (
  <>
    <UiOptionCardGroup
      value={value}
      onChange={(next) => onChange(next as GitConnectAuthMethod)}
      ariaLabel="Git sign-in method"
      columns={1}
      options={[
        {
          value: 'github_oauth',
          title: 'Sign in with GitHub',
          description: githubOAuthAvailable
            ? 'Open GitHub in your browser and authorize AppEndO — like VS Code.'
            : 'Recommended when server OAuth is configured. Step 2 will show setup instructions if OAuth is not ready yet.',
          icon: Github,
        },
        {
          value: 'https_pat',
          title: 'HTTPS · Personal access token',
          description: 'Paste a GitHub/GitLab token or reference a token environment variable on the server.',
          icon: KeyRound,
        },
        {
          value: 'ssh_key_path',
          title: 'SSH · Key path on server',
          description: 'Use an SSH private key file already present on the AppEndO server.',
          icon: Terminal,
        },
      ]}
    />

    {onLocalOnly ? <GitConnectLocalOnlyButton onClick={onLocalOnly} /> : null}
  </>
);
