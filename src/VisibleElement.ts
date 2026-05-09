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
    constructor() {
        super('1');
        this.data = this.getData(false);
    }
    print() {
        console.log('');
        console.log('Current VisibleElement State:');
        console.log('Boundary set to:', { top: this.top, left: this.left, bottom: this.bottom, right: this.right });
        console.log(this.data);
        console.log(this.offsetX, this.offsetY);
        console.log('Visible nodes:', this.getVisibleNodes());
    }
    setBoundary(top: number, left: number, right: number, bottom: number) {
        this.top = top;
        this.left = left;
        this.right = right;
        this.bottom = bottom;
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
        for (const nodeId in this.data) {
            const node = this.data[nodeId];
            if (node) {
                if (node.x + node.w + this.offsetX >= this.left && node.x + this.offsetX <= this.right && node.y + node.h + this.offsetY >= this.top && node.y + this.offsetY <= this.bottom) {
                    this.visibleNodeIdSet.add(nodeId);
                }
            }
        }
    }
    getVisibleNodes() {
        return [...this.visibleNodeIdSet];
    }
}