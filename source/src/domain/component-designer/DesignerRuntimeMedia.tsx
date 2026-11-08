import * as React from 'react';
import { UiVideoPlayer, UiAudioPlayer, UiLottiePlaceholder } from '../../shared/ui/UiMediaPlayers';
import { UiQrCode } from '../../shared/ui/UiQrCode';
import { UiBarcode } from '../../shared/ui/UiBarcode';
import { readBoolean, readNumber, readString } from './runtimeShared';
import type { DesignerNode } from './types';

export type DesignerMediaStyleProps = {
  className?: string;
  style?: React.CSSProperties;
};

export const DesignerVideoPlayer: React.FC<{
  src?: string;
  poster?: string;
  autoplay?: boolean;
  loop?: boolean;
  muted?: boolean;
  controls?: boolean;
  showCaptions?: boolean;
  captionsSrc?: string;
  aspectRatio?: string;
} & DesignerMediaStyleProps> = ({
  src,
  poster,
  autoplay,
  loop,
  muted,
  controls = true,
  showCaptions,
  captionsSrc,
  aspectRatio,
  className,
  style,
}) => (
  <UiVideoPlayer
    src={src}
    poster={poster}
    autoplay={autoplay}
    loop={loop}
    muted={muted}
    controls={controls !== false}
    showCaptions={showCaptions}
    captionsSrc={captionsSrc}
    aspectRatio={aspectRatio || '16 / 9'}
    className={className}
    style={style}
    data-designer-component="content.video-player"
  />
);

export const DesignerAudioPlayer: React.FC<{
  src?: string;
  autoplay?: boolean;
  loop?: boolean;
  showWaveform?: boolean;
  playbackSpeedControl?: boolean;
} & DesignerMediaStyleProps> = ({
  src,
  autoplay,
  loop,
  showWaveform,
  playbackSpeedControl = true,
  className,
  style,
}) => (
  <UiAudioPlayer
    src={src}
    autoplay={autoplay}
    loop={loop}
    showWaveform={showWaveform}
    playbackSpeedControl={playbackSpeedControl !== false}
    className={className}
    style={style}
    data-designer-component="content.audio-player"
  />
);

export const DesignerQrCode: React.FC<{
  value?: string;
  size?: number;
  errorCorrectionLevel?: string;
  logoOverlay?: string;
  downloadable?: boolean;
} & DesignerMediaStyleProps> = ({
  value,
  size = 160,
  errorCorrectionLevel = 'M',
  logoOverlay,
  downloadable,
  className,
  style,
}) => (
  <UiQrCode
    value={value}
    size={size}
    errorCorrectionLevel={errorCorrectionLevel}
    logoOverlay={logoOverlay}
    downloadable={downloadable}
    className={className}
    style={style}
    data-designer-component="content.qr-code"
  />
);

export const DesignerBarcode: React.FC<{
  value?: string;
  format?: string;
  showValue?: boolean;
  size?: number;
} & DesignerMediaStyleProps> = ({
  value,
  format = 'CODE128',
  showValue = true,
  size = 2,
  className,
  style,
}) => (
  <UiBarcode
    value={value}
    format={format}
    showValue={showValue !== false}
    size={size}
    className={className}
    style={style}
    data-designer-component="content.barcode"
  />
);

export const resolveVideoPlayerPropsFromNode = (node: DesignerNode) => ({
  src: readString(node.props.src),
  poster: readString(node.props.poster),
  autoplay: readBoolean(node.props.autoplay),
  loop: readBoolean(node.props.loop),
  muted: readBoolean(node.props.muted),
  controls: node.props.controls === false ? false : true,
  showCaptions: readBoolean(node.props.showCaptions),
  captionsSrc: readString(node.props.captionsSrc),
  aspectRatio: readString(node.props.aspectRatio, '16 / 9'),
  className: readString(node.props.className),
});

export const resolveAudioPlayerPropsFromNode = (node: DesignerNode) => ({
  src: readString(node.props.src),
  autoplay: readBoolean(node.props.autoplay),
  loop: readBoolean(node.props.loop),
  showWaveform: readBoolean(node.props.showWaveform),
  playbackSpeedControl: node.props.playbackSpeedControl === false ? false : true,
  className: readString(node.props.className),
});

export const resolveQrCodePropsFromNode = (node: DesignerNode) => ({
  value: readString(node.props.value, 'https://example.com'),
  size: readNumber(node.props.size, 160),
  errorCorrectionLevel: readString(node.props.errorCorrectionLevel, 'M'),
  logoOverlay: readString(node.props.logoOverlay),
  downloadable: readBoolean(node.props.downloadable),
  className: readString(node.props.className),
});

export const resolveBarcodePropsFromNode = (node: DesignerNode) => ({
  value: readString(node.props.value, '123456789012'),
  format: readString(node.props.format, 'CODE128'),
  showValue: node.props.showValue === false ? false : true,
  size: readNumber(node.props.size, 2),
  className: readString(node.props.className),
});

export { UiLottiePlaceholder };
