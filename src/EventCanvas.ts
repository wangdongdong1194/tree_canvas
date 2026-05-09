import { DrawShape } from "./DrawShape";

export class EventCanvas extends DrawShape {
    private canvas: HTMLCanvasElement;

    constructor(root: HTMLElement, width: number, height: number) {
        const devicePixelRatio = window.devicePixelRatio || 1;
        const canvas = document.createElement('canvas');
        canvas.width = width * devicePixelRatio;
        canvas.height = height * devicePixelRatio;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
        root.appendChild(canvas);
        const ctx: CanvasRenderingContext2D | null = canvas.getContext('2d');
        if (ctx) {
            ctx.scale(devicePixelRatio, devicePixelRatio);
        } else {
            throw new Error('Failed to get canvas context');
        }
        super(ctx);
        this.canvas = canvas;

        this.initEvent();
    }
    private initEvent() {
        this.canvas.addEventListener('mousedown', (event) => { });
        this.canvas.addEventListener('mousemove', (event) => { });
        this.canvas.addEventListener('mouseup', (event) => { });
        this.canvas.addEventListener('mouseleave', (event) => { });
        window.addEventListener('resize', (event) => { });
        window.addEventListener('scroll', (event) => { });
        window.addEventListener('keydown', (event) => { });
        window.addEventListener('keyup', (event) => { });
    }
}