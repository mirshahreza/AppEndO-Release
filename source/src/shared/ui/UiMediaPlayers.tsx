import * as React from 'react';
import { UiSelect } from './HeroFieldControls';

/**
 * HTML5 media players for Component Designer (Phase 53).
 * Native controls cover play/pause/seek/volume; captions via optional VTT track.
 */

export type UiVideoPlayerProps = {
  src?: string;
  poster?: string;
  autoplay?: boolean;
  loop?: boolean;
  muted?: boolean;
  controls?: boolean;
  showCaptions?: boolean;
  captionsSrc?: string;
  aspectRatio?: string;
  className?: string;
  style?: React.CSSProperties;
  'data-designer-component'?: string;
};

export type UiAudioPlayerProps = {
  src?: string;
  autoplay?: boolean;
  loop?: boolean;
  showWaveform?: boolean;
  playbackSpeedControl?: boolean;
  className?: string;
  style?: React.CSSProperties;
  'data-designer-component'?: string;
};

export type UiLottiePlaceholderProps = {
  src?: string;
  className?: string;
  style?: React.CSSProperties;
  'data-designer-component'?: string;
};

const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;

export const UiVideoPlayer: React.FC<UiVideoPlayerProps> = ({
  src,
  poster,
  autoplay = false,
  loop = false,
  muted = false,
  controls = true,
  showCaptions = false,
  captionsSrc,
  aspectRatio = '16 / 9',
  className,
  style,
  'data-designer-component': dataDesignerComponent = 'content.video-player',
}) => {
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const [playing, setPlaying] = React.useState(false);
  const resolvedSrc = typeof src === 'string' ? src.trim() : '';

  const handlePlay = React.useCallback(() => {
    const el = videoRef.current;
    if (!el) return;
    void el.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
  }, []);

  const handlePause = React.useCallback(() => {
    const el = videoRef.current;
    if (!el) return;
    el.pause();
    setPlaying(false);
  }, []);

  return (
    <div
      className={className}
      style={style}
      data-designer-component={dataDesignerComponent}
      data-media-kind="video"
    >
      <div className="relative w-full overflow-hidden rounded-lg bg-slate-900" style={{ aspectRatio }}>
        {resolvedSrc ? (
          <video
            ref={videoRef}
            src={resolvedSrc}
            poster={poster?.trim() || undefined}
            autoPlay={autoplay}
            loop={loop}
            muted={muted || autoplay}
            controls={controls}
            playsInline
            className="h-full w-full object-contain"
            data-testid="ui-video-element"
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
          >
            {showCaptions && captionsSrc?.trim() ? (
              <track kind="captions" src={captionsSrc.trim()} srcLang="en" label="Captions" default />
            ) : null}
          </video>
        ) : (
          <div className="flex h-full min-h-[120px] items-center justify-center text-sm text-slate-300">
            Set a video source URL
          </div>
        )}
      </div>
      {!controls && resolvedSrc ? (
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            data-testid="ui-video-play"
            className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800"
            onClick={handlePlay}
            disabled={playing}
          >
            Play
          </button>
          <button
            type="button"
            data-testid="ui-video-pause"
            className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800"
            onClick={handlePause}
            disabled={!playing}
          >
            Pause
          </button>
        </div>
      ) : null}
    </div>
  );
};

export const UiAudioPlayer: React.FC<UiAudioPlayerProps> = ({
  src,
  autoplay = false,
  loop = false,
  showWaveform = false,
  playbackSpeedControl = true,
  className,
  style,
  'data-designer-component': dataDesignerComponent = 'content.audio-player',
}) => {
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const [speed, setSpeed] = React.useState(1);
  const resolvedSrc = typeof src === 'string' ? src.trim() : '';

  React.useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = speed;
    }
  }, [speed]);

  return (
    <div
      className={`rounded-lg border border-slate-200 bg-slate-50 p-3 ${className ?? ''}`}
      style={style}
      data-designer-component={dataDesignerComponent}
      data-media-kind="audio"
    >
      {showWaveform ? (
        <div
          className="mb-2 flex h-10 items-end gap-0.5 rounded bg-slate-200/80 px-2 py-1"
          data-testid="ui-audio-waveform"
          aria-hidden
        >
          {Array.from({ length: 32 }, (_, index) => (
            <span
              key={index}
              className="w-1 flex-1 rounded-sm bg-slate-500/70"
              style={{ height: `${20 + ((index * 17) % 60)}%` }}
            />
          ))}
        </div>
      ) : null}
      {resolvedSrc ? (
        <audio
          ref={audioRef}
          src={resolvedSrc}
          controls
          autoPlay={autoplay}
          loop={loop}
          className="w-full"
          data-testid="ui-audio-element"
        />
      ) : (
        <p className="text-sm text-slate-500">Set an audio source URL</p>
      )}
      {playbackSpeedControl && resolvedSrc ? (
        <label className="mt-2 flex items-center gap-2 text-xs text-slate-600" data-testid="ui-audio-speed">
          <span>Speed</span>
          <UiSelect
            size="sm"
            ariaLabel="Playback speed"
            value={String(speed)}
            onChange={(event) => setSpeed(Number(event.target.value) || 1)}
          >
            {SPEED_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}x
              </option>
            ))}
          </UiSelect>
        </label>
      ) : null}
    </div>
  );
};

/** Lightweight Lottie placeholder — full lottie-react runtime is optional; shows source until Phase enrichment. */
export const UiLottiePlaceholder: React.FC<UiLottiePlaceholderProps> = ({
  src,
  className,
  style,
  'data-designer-component': dataDesignerComponent = 'content.lottie',
}) => (
  <div
    className={`flex min-h-[120px] flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-violet-300 bg-violet-50 p-4 text-center ${className ?? ''}`}
    style={style}
    data-designer-component={dataDesignerComponent}
    data-media-kind="lottie"
  >
    <p className="text-sm font-medium text-violet-900">Lottie animation</p>
    <p className="max-w-full truncate text-xs text-violet-700">{src?.trim() || 'Set a .json animation URL'}</p>
  </div>
);
