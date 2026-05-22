import type { IStrokeRectOptions } from "./type";

export abstract class DrawShape {
    private _ctx: CanvasRenderingContext2D;
    constructor(ctx: CanvasRenderingContext2D) {
        this._ctx = ctx;
    }
    protected strokeRect(x: number, y: number, width: number, height: number, options?: IStrokeRectOptions) {
        this._ctx.beginPath();
        this._ctx.save();
        this._ctx.lineWidth = 2;
        if (options) {
            if (options.strokeStyle) {
                this._ctx.strokeStyle = options.strokeStyle;
            }
        }
        this._ctx.roundRect(x, y, width, height, options?.radius ?? 0);
        this._ctx.stroke();
        this._ctx.restore();
    }
    protected fillRect(x: number, y: number, width: number, height: number, radius: number = 0) {
        this._ctx.beginPath();
        this._ctx.save();
        this._ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        this._ctx.roundRect(x, y, width, height, radius);
        this._ctx.fill();
        this._ctx.restore();
    }
    protected line(pos: { x: number, y: number }[], width: number = 1) {
        if (pos.length > 1) {
            this._ctx.beginPath();
            this._ctx.save();
            this._ctx.lineWidth = width;
            if (pos[0]) {
                this._ctx.moveTo(pos[0].x, pos[0].y);
            }
            for (let i = 1; i < pos.length; i++) {
                const prev = pos[i - 1];
                const point = pos[i];
                if (prev && point) {
                    const cpOffsetX = (point.x - prev.x) / 2;
                    this._ctx.bezierCurveTo(
                        prev.x + cpOffsetX,
                        prev.y,
                        point.x - cpOffsetX,
                        point.y,
                        point.x,
                        point.y,
                    );
                }
            }
            this._ctx.stroke();
            this._ctx.restore();
        }
    }
    protected text(text: string, x: number, y: number, fontSize: number = 12, color: string = 'black') {
        this._ctx.beginPath();
        this._ctx.save();
        this._ctx.font = `${fontSize}px sans-serif`;
        this._ctx.fillStyle = color;
        this._ctx.fillText(text, x, y);
        this._ctx.restore();
    }
    protected measureText(text: string, fontSize: number = 12) {
        this._ctx.save();
        this._ctx.font = `${fontSize}px sans-serif`;
        const metrics = this._ctx.measureText(text);
        this._ctx.restore();
        return metrics;
    }
    protected clearRect(x: number, y: number, width: number, height: number) {
        this._ctx.clearRect(x, y, width, height);
    }
    scale(x: number, y: number) {
        this._ctx.scale(x, y);
    }
    protected get ctx() {
        return this._ctx;
    }
}