import { BaseData, type IBaseData, type INodeData } from "ld_algorithm";

export interface IVisibleNode extends IBaseData { }

export interface IVisibleLine {
    parentId: string;
    childId: string;
    startX: number;
    startY: number;
    endX: number;
    endY: number;
}

export class VisibleElement extends BaseData<IVisibleNode> {
    private data: INodeData<IVisibleNode>;
    public offsetX = 0; // 偏移
    public offsetY = 0;
    private top = 0; // 边界
    private left = 0;
    private bottom = 0;
    private right = 0;
    private selectedNodeIdSet = new Set<string>();
    private hoveredNodeIdSet = new Set<string>();
    private visibleNodeIdSet = new Set<string>();
    private visibleLines: IVisibleLine[] = [];
    private spatialIndex = new Map<string, Set<string>>();
    private spatialCellSize = 320;
    constructor() {
        super('1');
        this.data = this.getData(false);
    }
    getDataRef() {
        return this.data;
    }
    print() {
        console.log('');
        console.log('Current VisibleElement State:');
        console.log('Boundary set to:', { top: this.top, left: this.left, bottom: this.bottom, right: this.right });
        console.log(this.data);
        console.log(this.offsetX, this.offsetY);
        console.log('Visible nodes:', this.getVisibleNodeIds());
    }
    setBoundary(top: number, left: number, right: number, bottom: number) {
        this.top = top;
        this.left = left;
        this.right = right;
        this.bottom = bottom;
    }
    rebuildSpatialIndex(cellSize: number = 320) {
        this.spatialCellSize = Math.max(1, Math.floor(cellSize));
        this.spatialIndex.clear();
        for (const nodeId in this.data) {
            const node = this.data[nodeId];
            if (!node) {
                continue;
            }
            const minCellX = Math.floor(node.x / this.spatialCellSize);
            const maxCellX = Math.floor((node.x + node.w) / this.spatialCellSize);
            const minCellY = Math.floor(node.y / this.spatialCellSize);
            const maxCellY = Math.floor((node.y + node.h) / this.spatialCellSize);
            for (let cx = minCellX; cx <= maxCellX; cx++) {
                for (let cy = minCellY; cy <= maxCellY; cy++) {
                    const key = `${cx},${cy}`;
                    let bucket = this.spatialIndex.get(key);
                    if (!bucket) {
                        bucket = new Set<string>();
                        this.spatialIndex.set(key, bucket);
                    }
                    bucket.add(nodeId);
                }
            }
        }
    }
    calVisibleNodes() {
        this.visibleNodeIdSet.clear();
        const viewLeft = this.left - this.offsetX;
        const viewRight = this.right - this.offsetX;
        const viewTop = this.top - this.offsetY;
        const viewBottom = this.bottom - this.offsetY;

        if (this.spatialIndex.size === 0) {
            for (const nodeId in this.data) {
                const node = this.data[nodeId];
                if (!node) {
                    continue;
                }
                if (node.x + node.w >= viewLeft && node.x <= viewRight && node.y + node.h >= viewTop && node.y <= viewBottom) {
                    this.visibleNodeIdSet.add(nodeId);
                }
            }
            return;
        }

        const minCellX = Math.floor(viewLeft / this.spatialCellSize);
        const maxCellX = Math.floor(viewRight / this.spatialCellSize);
        const minCellY = Math.floor(viewTop / this.spatialCellSize);
        const maxCellY = Math.floor(viewBottom / this.spatialCellSize);
        const candidates = new Set<string>();
        for (let cx = minCellX; cx <= maxCellX; cx++) {
            for (let cy = minCellY; cy <= maxCellY; cy++) {
                const bucket = this.spatialIndex.get(`${cx},${cy}`);
                if (!bucket) {
                    continue;
                }
                for (const nodeId of bucket) {
                    candidates.add(nodeId);
                }
            }
        }

        for (const nodeId of candidates) {
            const node = this.data[nodeId];
            if (!node) {
                continue;
            }
            if (node.x + node.w >= viewLeft && node.x <= viewRight && node.y + node.h >= viewTop && node.y <= viewBottom) {
                this.visibleNodeIdSet.add(nodeId);
            }
        }
    }
    calVisibleLines() {
        this.visibleLines = [];
        const lineDis = 16;
        const minVisibleLineLength = 8;

        const clipLineToViewport = (x1: number, y1: number, x2: number, y2: number) => {
            let t0 = 0;
            let t1 = 1;
            const dx = x2 - x1;
            const dy = y2 - y1;

            const clip = (p: number, q: number) => {
                if (p === 0) {
                    return q >= 0;
                }
                const r = q / p;
                if (p < 0) {
                    if (r > t1) {
                        return false;
                    }
                    if (r > t0) {
                        t0 = r;
                    }
                } else {
                    if (r < t0) {
                        return false;
                    }
                    if (r < t1) {
                        t1 = r;
                    }
                }
                return true;
            };

            if (!clip(-dx, x1 - this.left)) {
                return null;
            }
            if (!clip(dx, this.right - x1)) {
                return null;
            }
            if (!clip(-dy, y1 - this.top)) {
                return null;
            }
            if (!clip(dy, this.bottom - y1)) {
                return null;
            }

            return {
                startX: x1 + t0 * dx,
                startY: y1 + t0 * dy,
                endX: x1 + t1 * dx,
                endY: y1 + t1 * dy,
            };
        };

        for (const childId in this.data) {
            const childNode = this.data[childId];
            if (!childNode?.parentId) {
                continue;
            }
            const parentNode = this.data[childNode.parentId];
            if (!parentNode) {
                continue;
            }

            const x1 = parentNode.x + parentNode.w + this.offsetX;
            const y1 = parentNode.y + lineDis + this.offsetY;
            const x2 = childNode.x + this.offsetX;
            const y2 = childNode.y + lineDis + this.offsetY;
            const clippedLine = clipLineToViewport(x1, y1, x2, y2);
            if (!clippedLine) {
                continue;
            }
            const visibleLength = Math.hypot(
                clippedLine.endX - clippedLine.startX,
                clippedLine.endY - clippedLine.startY,
            );
            if (visibleLength < minVisibleLineLength) {
                continue;
            }
            this.visibleLines.push({
                parentId: childNode.parentId,
                childId,
                startX: clippedLine.startX,
                startY: clippedLine.startY,
                endX: clippedLine.endX,
                endY: clippedLine.endY,
            });
        }
    }
    getVisibleNodeIds() {
        return this.visibleNodeIdSet.values();
    }
    getVisibleLines() {
        return this.visibleLines;
    }
    setSelectNodeByPos(x: number, y: number, multi: boolean) {
        const visibleNodeIds = this.getVisibleNodeIds();
        for (const nodeId of visibleNodeIds) {
            if (this.isPointInnerNode(x, y, nodeId)) {
                if (multi) {
                    if (this.selectedNodeIdSet.has(nodeId)) {
                        this.selectedNodeIdSet.delete(nodeId);
                    } else {
                        this.selectedNodeIdSet.add(nodeId);
                    }
                } else {
                    this.selectedNodeIdSet.clear();
                    this.selectedNodeIdSet.add(nodeId);
                }
                return;
            }
        }
        this.selectedNodeIdSet.clear();
    }
    getSelectedNodeIds() {
        return this.selectedNodeIdSet.values();
    }
    setHoverNodeByPos(x: number, y: number) {
        const visibleNodeIds = this.getVisibleNodeIds();
        for (const nodeId of visibleNodeIds) {
            if (this.isPointInnerNode(x, y, nodeId)) {
                this.hoveredNodeIdSet.add(nodeId);
            } else {
                this.hoveredNodeIdSet.delete(nodeId);
            }
        }
    }
    getHoveredNodeIds() {
        return this.hoveredNodeIdSet.values();
    }
    private isPointInnerNode(x: number, y: number, nodeId: string) {
        const node = this.data[nodeId];
        if (!node) {
            return false;
        }
        return x >= node.x + this.offsetX && x <= node.x + this.offsetX + node.w && y >= node.y + this.offsetY && y <= node.y + this.offsetY + node.h;
    }
}