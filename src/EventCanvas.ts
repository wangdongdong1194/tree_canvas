import type { AttachDirection } from "ld_algorithm";
import { DrawShape } from "./DrawShape";
import { VisibleElement } from "./VisibleElement";

export type ArrowKey = 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight';

export class EventCanvas extends DrawShape {
    private canvas: HTMLCanvasElement;
    private visibleElement = new VisibleElement();
    private _TEMP_ID = 2;
    private drawRequestId: number | null = null;
    private pressedArrowKeys = new Set<ArrowKey>();

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
            super(ctx);
            this.scale(devicePixelRatio, devicePixelRatio);
        } else {
            throw new Error('Failed to get canvas context');
        }
        this.visibleElement.setBoundary(0, 0, width, height);
        this.canvas = canvas;
        this.initEvent();
        this.initDemo();
        this.draw();
    }
    private initDemo() {
        const firstNodeId = `${this._TEMP_ID++}`;
        this.visibleElement.addRight({
            id: firstNodeId,
            w: Math.floor(Math.random() * 100) + 50,
            h: Math.floor(Math.random() * 50) + 25,
        }, '1', 'right');
        const nonRootNodeIds = [firstNodeId];
        const directions: AttachDirection[] = ['right', 'left', 'top', 'bottom'];
        for (let i = 0; i < 200000; i++) {
            const attachId = nonRootNodeIds[Math.floor(Math.random() * nonRootNodeIds.length)];
            if (!attachId) {
                continue;
            }
            const direction = directions[i % directions.length] ?? 'right';
            const newNodeId = `${this._TEMP_ID++}`;
            this.visibleElement.addRight({
                id: newNodeId,
                w: Math.floor(Math.random() * 100) + 50,
                h: Math.floor(Math.random() * 50) + 25,
            }, attachId, direction);
            nonRootNodeIds.push(newNodeId);
        }
        const root = this.visibleElement.getDataRef()['1'];
        if (root) {
            root.x = 50;
            root.y = 50;
        }
        this.visibleElement.calculateNodePosition();
        this.visibleElement.rebuildSpatialIndex();
        this.draw();
    }
    private initEvent() {
        this.canvas.addEventListener('contextmenu', (event) => {
            event.preventDefault();
        });
        this.canvas.addEventListener('mousedown', (event) => {
            const nodeId = this.visibleElement.point(event.offsetX, event.offsetY);
            if (nodeId) {
                console.log('Right-clicked node:', nodeId);
            }
        });
        this.canvas.addEventListener('mousemove', (event) => {

        });
        this.canvas.addEventListener('mouseup', (event) => {

        });
        this.canvas.addEventListener('mouseleave', (event) => {

        });
        this.canvas.addEventListener('wheel', (event) => {
            event.preventDefault();
            this.visibleElement.offsetX -= event.deltaX;
            this.visibleElement.offsetY -= event.deltaY;
            this.draw();
        }, { passive: false });
        window.addEventListener('keydown', (event) => {
            if (this.isArrowKey(event.key)) {
                event.preventDefault();
                this.pressedArrowKeys.add(event.key as ArrowKey);
                this.draw();
            }
        });
        window.addEventListener('keyup', (event) => {
            if (this.isArrowKey(event.key)) {
                this.pressedArrowKeys.delete(event.key as ArrowKey);
            }
        });
        window.addEventListener('blur', () => {
            this.pressedArrowKeys.clear();
        });
    }
    private isArrowKey(key: string) {
        return ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key);
    }
    private draw() {
        if (this.drawRequestId !== null) {
            return;
        }
        this.drawRequestId = window.requestAnimationFrame(() => {
            this.drawRequestId = null;
            this.applyKeyboardPan();
            this.render();
            if (this.pressedArrowKeys.size > 0) {
                this.draw();
            }
        });
    }
    private applyKeyboardPan() {
        const step = 5;
        if (this.pressedArrowKeys.has('ArrowUp')) {
            this.visibleElement.offsetY -= step;
        }
        if (this.pressedArrowKeys.has('ArrowDown')) {
            this.visibleElement.offsetY += step;
        }
        if (this.pressedArrowKeys.has('ArrowLeft')) {
            this.visibleElement.offsetX -= step;
        }
        if (this.pressedArrowKeys.has('ArrowRight')) {
            this.visibleElement.offsetX += step;
        }
    }
    private render() {
        this.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.visibleElement.calVisibleNodes();
        const data = this.visibleElement.getDataRef();
        const lineDis = 16;
        const visibleNodeIds = this.visibleElement.getVisibleNodeIds();
        // this.visibleElement.print();
        for (const nodeId of visibleNodeIds) {
            const node = data[nodeId];
            if (node) {
                const nodeX = node.x + this.visibleElement.offsetX;
                const nodeY = node.y + this.visibleElement.offsetY;
                this.strokeRect(nodeX, nodeY, node.w, node.h, 4);
                this.text(node.id, nodeX + 10, nodeY + 20);
                if (node.parentId) {
                    const parentNode = data[node.parentId];
                    if (parentNode) {
                        this.line([
                            { x: parentNode.x + parentNode.w + this.visibleElement.offsetX, y: parentNode.y + lineDis + this.visibleElement.offsetY },
                            { x: node.x + this.visibleElement.offsetX, y: node.y + lineDis + this.visibleElement.offsetY },
                        ], 2);
                    }
                }
            }
        }
    }
    public resize(width: number, height: number) {
        const devicePixelRatio = window.devicePixelRatio || 1;
        this.canvas.width = width * devicePixelRatio;
        this.canvas.height = height * devicePixelRatio;
        this.canvas.style.width = `${width}px`;
        this.canvas.style.height = `${height}px`;
        this.scale(devicePixelRatio, devicePixelRatio);
        this.visibleElement.setBoundary(0, 0, width, height);
        this.draw();
    }
}