import { mountLoadingEcgCanvas } from '../shared/lib/loadingEcgCanvasMount';

const canvas = document.querySelector<HTMLCanvasElement>('#app-boot-splash .app-loading-ecg-live');
if (canvas) {
  mountLoadingEcgCanvas(canvas);
}
