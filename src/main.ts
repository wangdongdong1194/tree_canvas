import { EventCanvas } from './EventCanvas';

(function main() {
    const canvasRoot = document.querySelector<HTMLDivElement>('#canvas-root');
    if (!canvasRoot) {
        throw new Error('Canvas root not found');
    }

    new EventCanvas(canvasRoot, window.innerWidth, window.innerHeight);
})();