import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  CreativeSceneCompositionProvider,
  createCreativeSceneFixture,
} from '../../../src/shared/ui/creative-scenes';
import { VIEWPORT_TIER_MAX_WIDTH } from '../../../src/shared/lib/viewportTokens';
import './styles.css';

declare global {
  interface Window {
    __creativeGateMetrics?: { longTasks: number; layoutShift: number };
  }
}

type ShellDraft = {
  name: string;
  profile: 'app' | 'site';
  scene: 'scene-ambient-particles' | 'scene-product-orbit';
};

function useMedia(query: string) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const media = window.matchMedia(query);
    const update = () => setMatches(media.matches);
    media.addEventListener('change', update);
    update();
    return () => media.removeEventListener('change', update);
  }, [query]);
  return matches;
}

function GateHarness() {
  const [draft, setDraft] = useState<ShellDraft | null>(null);
  const [name, setName] = useState('Deterministic creative shell');
  const [profile, setProfile] = useState<ShellDraft['profile']>('site');
  const [scene, setScene] = useState<ShellDraft['scene']>('scene-ambient-particles');
  const [previewing, setPreviewing] = useState(false);
  const [advancedEngines, setAdvancedEngines] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [status, setStatus] = useState('Ready to create.');
  const menuButton = useRef<HTMLButtonElement>(null);
  const reducedMotion = useMedia('(prefers-reduced-motion: reduce)');
  const forcedColors = useMedia('(forced-colors: active)');

  useEffect(() => {
    performance.mark('creative-shell-ready');
    document.documentElement.dataset.creativeGateReady = 'true';
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
        requestAnimationFrame(() => menuButton.current?.focus());
      }
    };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [menuOpen]);

  const save = () => {
    setDraft({ name, profile, scene });
    setStatus('Draft saved.');
  };

  const sceneFixture = createCreativeSceneFixture(scene, scene === 'scene-product-orbit' ? 'site' : profile);

  return (
    <>
      <a className="skip-link" href="#creative-main">Skip to creative shell content</a>
      <header className="app-header">
        <a className="brand" href="#creative-main" aria-label="Creative Shell Designer home">
          Creative Shell Designer
        </a>
        <nav aria-label="Primary">
          <a href="#workspace" aria-current="page">Workspace</a>
          <a href="#help">Help</a>
        </nav>
        <button
          ref={menuButton}
          type="button"
          aria-expanded={menuOpen}
          aria-controls="account-menu"
          onClick={() => setMenuOpen((open) => !open)}
        >
          Account menu
        </button>
        {menuOpen && (
          <div id="account-menu" className="menu" role="dialog" aria-label="Account menu">
            <button type="button" onClick={() => setMenuOpen(false)}>Close account menu</button>
          </div>
        )}
      </header>

      <main id="creative-main" tabIndex={-1}>
        <h1>Creative Shell browser gate</h1>
        {!draft ? (
          <section aria-labelledby="create-heading">
            <h2 id="create-heading">Create a deterministic shell</h2>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                save();
              }}
            >
              <label>
                Shell name
                <input
                  name="shell-name"
                  value={name}
                  onChange={(event) => setName(event.currentTarget.value)}
                  required
                />
              </label>
              <fieldset>
                <legend>Experience profile</legend>
                <label>
                  <input
                    type="radio"
                    name="profile"
                    value="site"
                    checked={profile === 'site'}
                    onChange={() => setProfile('site')}
                  />
                  Site
                </label>
                <label>
                  <input
                    type="radio"
                    name="profile"
                    value="app"
                    checked={profile === 'app'}
                    onChange={() => setProfile('app')}
                  />
                  App
                </label>
              </fieldset>
              <button type="submit">Create shell</button>
            </form>
          </section>
        ) : (
          <section id="workspace" aria-labelledby="editor-heading">
            <div className="editor-header">
              <div>
                <p className="eyebrow">Editing {draft.profile} profile</p>
                <h2 id="editor-heading">{draft.name}</h2>
              </div>
              <div className="actions">
                <button type="button" onClick={save}>Save draft</button>
                <button type="button" onClick={() => setPreviewing((value) => !value)}>
                  {previewing ? 'Return to editor' : 'Open preview'}
                </button>
              </div>
            </div>

            {!previewing && (
              <div className="editor-grid">
                <aside aria-label="Creative shell options">
                  <h3>Scene options</h3>
                  <label>
                    Display name
                    <input value={name} onChange={(event) => setName(event.currentTarget.value)} />
                  </label>
                  <label>
                    Creative scene
                    <select
                      value={scene}
                      onChange={(event) => setScene(event.currentTarget.value as ShellDraft['scene'])}
                    >
                      <option value="scene-ambient-particles">Ambient particles</option>
                      {profile === 'site' && (
                        <option value="scene-product-orbit">Product orbit</option>
                      )}
                    </select>
                  </label>
                  <button
                    type="button"
                    aria-pressed={!advancedEngines}
                    onClick={() => setAdvancedEngines((enabled) => !enabled)}
                  >
                    {advancedEngines ? 'Use deterministic fallback' : 'Enable advanced engine'}
                  </button>
                </aside>
                <Preview
                  fixture={sceneFixture}
                  advancedEngines={advancedEngines}
                  reducedMotion={reducedMotion}
                  forcedColors={forcedColors}
                />
              </div>
            )}

            {previewing && (
              <Preview
                fixture={sceneFixture}
                advancedEngines={advancedEngines}
                reducedMotion={reducedMotion}
                forcedColors={forcedColors}
                full
              />
            )}
          </section>
        )}
        <p role="status" aria-live="polite">{status}</p>
      </main>
    </>
  );
}

function Preview({
  fixture,
  advancedEngines,
  reducedMotion,
  forcedColors,
  full = false,
}: {
  fixture: ReturnType<typeof createCreativeSceneFixture>;
  advancedEngines: boolean;
  reducedMotion: boolean;
  forcedColors: boolean;
  full?: boolean;
}) {
  return (
    <section className={full ? 'preview preview-full' : 'preview'} aria-labelledby="preview-heading">
      <h3 id="preview-heading">Runtime-parity preview</h3>
      <CreativeSceneCompositionProvider
        config={fixture}
        capabilities={{
          advancedEngines,
          reducedMotion,
          forcedColors,
          visible: true,
          budgetEligible: true,
          viewport: window.innerWidth <= VIEWPORT_TIER_MAX_WIDTH.phone ? 'phone' : 'desktop',
        }}
      />
    </section>
  );
}

createRoot(document.getElementById('root')!).render(<GateHarness />);
