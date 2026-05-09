export abstract class DrawShape {
    private _ctx: CanvasRenderingContext2D;
    constructor(ctx: CanvasRenderingContext2D) {
        this._ctx = ctx;
    }
    strokeRect(x: number, y: number, width: number, height: number, radius: number = 0) {
        this._ctx.beginPath();
        this._ctx.save();
        this._ctx.lineWidth = 1;
        this._ctx.roundRect(x, y, width, height, radius);
        this._ctx.restore();
        this._ctx.stroke();
    }
    fillRect(x: number, y: number, width: number, height: number, radius: number = 0) {
        this._ctx.beginPath();
        this._ctx.save();
        this._ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        this._ctx.roundRect(x, y, width, height, radius);
        this._ctx.restore();
        this._ctx.fill();
    }
    line(pos: { x: number, y: number }[], width: number = 1) {
        if (pos.length > 1) {
            this._ctx.beginPath();
            this._ctx.save();
            this._ctx.lineWidth = width;
            if (pos[0]) {
                this._ctx.moveTo(pos[0].x, pos[0].y);
            }
            for (let i = 1; i < pos.length; i++) {
                const point = pos[i];
                if (point) {
                    this._ctx.lineTo(point.x, point.y);
                }
            }
            this._ctx.restore();
            this._ctx.stroke();
        }
    }
    text(text: string, x: number, y: number, fontSize: number = 12, color: string = 'black') {
        this._ctx.beginPath();
        this._ctx.save();
        this._ctx.font = `${fontSize}px sans-serif`;
        this._ctx.fillStyle = color;
        this._ctx.fillText(text, x, y);
        this._ctx.restore();
    }
}