import { EventBus } from './EventBus';
import { CoreCanvas } from './CoreCanvas';

(function main() {
    const canvasRoot = document.querySelector<HTMLDivElement>('#canvas-root');
    if (!canvasRoot) {
        throw new Error('Canvas root not found');
    }
    const eventBus = new EventBus();

    const coreCanvas = new CoreCanvas(canvasRoot, window.innerWidth, window.innerHeight, eventBus);
    window.addEventListener('resize', (event) => {
        coreCanvas.resize(window.innerWidth, window.innerHeight);
    });
    eventBus.subscribe('dblclick', () => {
        console.log('dblclick');
    });
})();