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
    public zoom = 1; // 缩放
    private top = 0; // 边界
    private left = 0;
    private bottom = 0;
    private right = 0;
    private selectedNodeIdSet = new Set<string>();
    private hoveredNodeIdSet = new Set<string>();
    private visibleNodeIdSet = new Set<string>();
    private visibleLines: IVisibleLine[] = [];
    private editorId: string = ''; // 编辑器ID
    constructor(rootId?: string) {
        super(rootId || '1');
        this.data = this.getData(false);
    }
    getDataRef() {
        return this.data;
    }
    private toScreenX(x: number) {
        return x * this.zoom + this.offsetX;
    }
    private toScreenY(y: number) {
        return y * this.zoom + this.offsetY;
    }
    private toWorldX(screenX: number) {
        return (screenX - this.offsetX) / this.zoom;
    }
    private toWorldY(screenY: number) {
        return (screenY - this.offsetY) / this.zoom;
    }
    setZoom(zoom: number, anchorX?: number, anchorY?: number) {
        const safeZoom = Math.max(0.1, zoom);
        if (safeZoom === this.zoom) {
            return false;
        }

        if (anchorX !== undefined && anchorY !== undefined) {
            const worldX = this.toWorldX(anchorX);
            const worldY = this.toWorldY(anchorY);
            this.zoom = safeZoom;
            this.offsetX = anchorX - worldX * this.zoom;
            this.offsetY = anchorY - worldY * this.zoom;
            return true;
        }

        this.zoom = safeZoom;
        return true;
    }
    print() {
        console.log('');
        console.log('Current VisibleElement State:');
        console.log('Boundary set to:', { top: this.top, left: this.left, bottom: this.bottom, right: this.right });
        console.log(this.data);
        console.log(this.offsetX, this.offsetY, this.zoom);
        console.log('Visible nodes:', this.getVisibleNodeIds());
        console.log('Visible lines:', this.getVisibleLines());
        console.log('Selected nodes:', this.getSelectedNodeIds());
        console.log('Hovered nodes:', this.getHoveredNodeIds());
        console.log('Editor ID:', this.getEditorId());
        console.log(JSON.stringify({ data: this.data }, null, 2));
    }
    setBoundary(top: number, left: number, right: number, bottom: number) {
        this.top = top;
        this.left = left;
        this.right = right;
        this.bottom = bottom;
    }
    calVisibleNodes() {
        this.visibleNodeIdSet.clear();
        const viewLeft = this.toWorldX(this.left);
        const viewRight = this.toWorldX(this.right);
        const viewTop = this.toWorldY(this.top);
        const viewBottom = this.toWorldY(this.bottom);

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

            const x1 = this.toScreenX(parentNode.x + parentNode.w);
            const y1 = this.toScreenY(parentNode.y + lineDis);
            const x2 = this.toScreenX(childNode.x);
            const y2 = this.toScreenY(childNode.y + lineDis);
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
        const screenX = this.toScreenX(node.x);
        const screenY = this.toScreenY(node.y);
        const screenW = node.w * this.zoom;
        const screenH = node.h * this.zoom;
        return x >= screenX && x <= screenX + screenW && y >= screenY && y <= screenY + screenH;
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
     * 调整偏移量，确保指定节点落在可视区域内
     */
    ensureNodeVisible(nodeId: string, padding: number = 50): boolean {
        const node = this.data[nodeId];
        if (!node) {
            return false;
        }

        const safePadding = Math.max(0, padding);
        const minVisibleX = this.left + safePadding;
        const maxVisibleX = this.right - safePadding;
        const minVisibleY = this.top + safePadding;
        const maxVisibleY = this.bottom - safePadding;

        const availableWidth = maxVisibleX - minVisibleX;
        const availableHeight = maxVisibleY - minVisibleY;
        if (availableWidth <= 0 || availableHeight <= 0) {
            return false;
        }

        const nodeScreenX = this.toScreenX(node.x);
        const nodeScreenY = this.toScreenY(node.y);
        const nodeScreenW = node.w * this.zoom;
        const nodeScreenH = node.h * this.zoom;
        const maxNodeX = maxVisibleX - nodeScreenW;
        const maxNodeY = maxVisibleY - nodeScreenH;

        const targetNodeX = maxNodeX >= minVisibleX
            ? Math.min(Math.max(nodeScreenX, minVisibleX), maxNodeX)
            : minVisibleX;
        const targetNodeY = maxNodeY >= minVisibleY
            ? Math.min(Math.max(nodeScreenY, minVisibleY), maxNodeY)
            : minVisibleY;

        const nextOffsetX = this.offsetX + (targetNodeX - nodeScreenX);
        const nextOffsetY = this.offsetY + (targetNodeY - nodeScreenY);
        if (nextOffsetX === this.offsetX && nextOffsetY === this.offsetY) {
            return false;
        }

        this.offsetX = nextOffsetX;
        this.offsetY = nextOffsetY;
        return true;
    }
    private getNodeDepth(nodeId: string): number {
        let depth = 0;
        let current = this.data[nodeId];
        const visited = new Set<string>();
        while (current?.parentId) {
            if (visited.has(current.id)) {
                break;
            }
            visited.add(current.id);
            const parent = this.data[current.parentId];
            if (!parent) {
                break;
            }
            depth += 1;
            current = parent;
        }
        return depth;
    }
    private isAncestorNode(ancestorId: string, nodeId: string): boolean {
        const visited = new Set<string>();
        let current = this.data[nodeId];
        while (current?.parentId) {
            if (visited.has(current.id)) {
                break;
            }
            visited.add(current.id);
            if (current.parentId === ancestorId) {
                return true;
            }
            current = this.data[current.parentId];
        }
        return false;
    }
    private getVerticalFallbackNodeId(nodeId: string, direction: 'ArrowUp' | 'ArrowDown'): string | null {
        const currentNode = this.data[nodeId];
        if (!currentNode) {
            return null;
        }

        const currentCenterX = currentNode.x + currentNode.w / 2;
        const currentCenterY = currentNode.y + currentNode.h / 2;
        const currentDepth = this.getNodeDepth(nodeId);

        let bestNodeId: string | null = null;
        let bestDepthPriority = Number.POSITIVE_INFINITY;
        let bestVerticalDistance = Number.POSITIVE_INFINITY;
        let bestHorizontalDistance = Number.POSITIVE_INFINITY;

        for (const candidateId in this.data) {
            if (candidateId === nodeId) {
                continue;
            }
            const candidate = this.data[candidateId];
            if (!candidate) {
                continue;
            }
            const candidateCenterY = candidate.y + candidate.h / 2;
            const isInDirection = direction === 'ArrowUp'
                ? candidateCenterY < currentCenterY
                : candidateCenterY > currentCenterY;
            if (!isInDirection) {
                continue;
            }
            // 避免上下键走到同一分支的祖先/子孙，造成行为近似左右键。
            if (direction === 'ArrowDown' && this.isAncestorNode(nodeId, candidateId)) {
                continue;
            }
            if (direction === 'ArrowUp' && this.isAncestorNode(candidateId, nodeId)) {
                continue;
            }

            const candidateDepth = this.getNodeDepth(candidateId);
            const depthGap = candidateDepth - currentDepth;
            let depthPriority = Number.POSITIVE_INFINITY;
            if (depthGap === 0) {
                depthPriority = 0;
            } else if (depthGap === 1) {
                depthPriority = 1;
            } else if (depthGap === 2) {
                depthPriority = 2;
            }
            if (!Number.isFinite(depthPriority)) {
                continue;
            }

            const verticalDistance = Math.abs(candidateCenterY - currentCenterY);
            const candidateCenterX = candidate.x + candidate.w / 2;
            const horizontalDistance = Math.abs(candidateCenterX - currentCenterX);
            const isBetter =
                depthPriority < bestDepthPriority ||
                (depthPriority === bestDepthPriority && verticalDistance < bestVerticalDistance) ||
                (depthPriority === bestDepthPriority && verticalDistance === bestVerticalDistance && horizontalDistance < bestHorizontalDistance);
            if (isBetter) {
                bestNodeId = candidateId;
                bestDepthPriority = depthPriority;
                bestVerticalDistance = verticalDistance;
                bestHorizontalDistance = horizontalDistance;
            }
        }

        return bestNodeId;
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

        return this.getVerticalFallbackNodeId(nodeId, direction);
    }
}