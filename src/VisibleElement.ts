import { BaseData, type IBaseData, type INodeData } from "ld_algorithm";

export interface IVisibleNode extends IBaseData {
    fontSize: number;
    contents: {
        text: string;
        textOffsetX: number;
        textOffsetY: number;
    }[];

}

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
    private editorId: string = ''; // 编辑器ID
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
        console.log('Visible lines:', this.getVisibleLines());
        console.log('Selected nodes:', this.getSelectedNodeIds());
        console.log('Hovered nodes:', this.getHoveredNodeIds());
        console.log('Editor ID:', this.getEditorId());
    }
    setBoundary(top: number, left: number, right: number, bottom: number) {
        this.top = top;
        this.left = left;
        this.right = right;
        this.bottom = bottom;
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
    getSingleSelectedNodeId() {
        if (this.selectedNodeIdSet.size !== 1) {
            return null;
        }
        return this.selectedNodeIdSet.values().next().value ?? null;
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
    setEditorId(x: number, y: number) {
        for (const nodeId of this.getSelectedNodeIds()) {
            if (this.isPointInnerNode(x, y, nodeId)) {
                this.editorId = nodeId;
                return;
            }
        }
        this.editorId = '';
    }
    setEditorIdById(editorId: string) {
        if (this.selectedNodeIdSet.size !== 1 || !this.selectedNodeIdSet.has(editorId)) {
            return false;
        }
        this.editorId = editorId;
        return true;
    }
    getEditorId() {
        return this.editorId;
    }
    delEditorId() {
        this.editorId = '';
    }
    /**
     * 设置选中节点id集合
     */
    setSelectedNodeIds(ids: string[]) {
        this.selectedNodeIdSet.clear();
        for (const id of ids) {
            if (this.data[id]) {
                this.selectedNodeIdSet.add(id);
            }
        }
    }
    /**
     * 获取指定节点在指定方向上的相邻节点id（上下左右）
     * @param nodeId 当前节点id
     * @param direction 方向 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight'
     */
    getNeighborNodeId(nodeId: string, direction: 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight'): string | null {
        const node = this.data[nodeId];
        if (!node) {
            return null;
        }

        // 左：父节点
        if (direction === 'ArrowLeft') {
            if (node.parentId && this.data[node.parentId]) {
                return node.parentId;
            }
            return null;
        }

        // 右：第一个有效子节点（按 children 数组顺序）
        if (direction === 'ArrowRight') {
            for (const childId of node.children) {
                if (this.data[childId]) {
                    return childId;
                }
            }
            return null;
        }

        // 上下：父节点 children 数组中的相邻兄弟
        if (!node.parentId) {
            return null;
        }
        const parentNode = this.data[node.parentId];
        if (!parentNode) {
            return null;
        }

        const siblings = parentNode.children.filter((id) => this.data[id]);
        const idx = siblings.indexOf(nodeId);
        if (idx === -1) {
            return null;
        }

        if (direction === 'ArrowUp' && idx > 0) {
            return siblings[idx - 1] ?? null;
        }
        if (direction === 'ArrowDown' && idx < siblings.length - 1) {
            return siblings[idx + 1] ?? null;
        }

        return null;
    }
}