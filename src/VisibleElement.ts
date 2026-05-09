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
    point(x: number, y: number) {
        for (const nodeId in this.data) {
            const node = this.data[nodeId];
            if (node) {
                if (x >= node.x && x <= node.x + node.w && y >= node.y && y <= node.y + node.h) {
                    return nodeId;
                }
            }
        }
        return null;
    }
}