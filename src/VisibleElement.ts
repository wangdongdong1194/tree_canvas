import { BaseData, type IBaseData, type INodeData } from "ld_algorithm";

export interface IVisibleNode extends IBaseData { }

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
    point(x: number, y: number) {
        for (const nodeId in this.data) {
            const node = this.data[nodeId];
            if (node) {
                if (x >= node.x + this.offsetX && x <= node.x + node.w + this.offsetX && y >= node.y + this.offsetY && y <= node.y + node.h + this.offsetY) {
                    return nodeId;
                }
            }
        }
        return null;
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
    getVisibleNodeIds() {
        return this.visibleNodeIdSet.values();
    }
}