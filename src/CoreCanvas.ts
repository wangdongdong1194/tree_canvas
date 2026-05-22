import { DrawShape } from "./DrawShape";
import { VisibleElement } from "./VisibleElement";
import { EventKey } from "./EventKey";
import type { EventBus } from "./EventBus";
import type { INodeData } from "tree_algorithm";
import type { IAddNodeCommand, IDeleteNodeCommand, IEditNodeCommand, NodeContent } from "./history/CanvasCommand";
import { CanvasHistoryManager } from "./history/CanvasHistoryManager";
import { RichTextCanvas } from "rich_text_canvas";
import type { ArrowKey, IVisibleNode } from "./type";


export class CoreCanvas extends DrawShape {
    private canvas: HTMLCanvasElement;
    private visibleElement: VisibleElement;
    private _TEMP_ID = 2;
    private drawRequestId: number | null = null;
    private pressedArrowKeys = new Set<ArrowKey>();
    private readonly SELECTED_GAP = 5; // 选中节点的边框与节点的间距
    private readonly HOVERED_GAP = 5; // hover节点的边框与节点的间距
    private readonly TEXT_PADDING = 10; // 文本与节点边界的最小距离
    private readonly TEXT_BASELINE_OFFSET = 20; // 文本基线相对节点顶部偏移
    private readonly LINE_HEIGHT_GAP = 3; // 多行文本行高与字体大小的额外间距
    private readonly MIN_NODE_WIDTH = 80; // 节点的最小宽度
    private readonly MIN_NODE_HEIGHT = 30; // 节点的最小高度
    private ignoreNextEnterKeyup = false;
    private richTextCanvas: RichTextCanvas;
    private _CURRENT_EDITOR_ID: string | null = null;
    private eventBus: EventBus;
    private rootId: string;
    private readonly HISTORY_LIMIT = 100;
    private historyManager: CanvasHistoryManager;

    constructor(root: HTMLElement, width: number, height: number, rootId: string, eventBus: EventBus) {
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
        this.eventBus = eventBus;
        this.rootId = rootId;
        this.visibleElement = new VisibleElement(this.rootId);
        const rootEle = this.visibleElement.getDataRef()[this.rootId];
        if (rootEle) {
            rootEle.x = width / 2 - this.MIN_NODE_HEIGHT / 2 - this.TEXT_PADDING;
            rootEle.y = height / 2 - this.MIN_NODE_HEIGHT / 2 - this.TEXT_PADDING;
        }
        this.visibleElement.setBoundary(0, 0, width, height);
        this.historyManager = new CanvasHistoryManager(this.visibleElement, () => this.draw(), this.HISTORY_LIMIT);
        this.canvas = canvas;
        this.richTextCanvas = new RichTextCanvas(root, {});
        this.initEvent();
        this.draw();
    }
    private initEvent() {
        this.canvas.addEventListener('contextmenu', (event) => {
            event.preventDefault();
            this.visibleElement.print();
        });
        this.canvas.addEventListener('mousedown', (event) => {
            let selectChanged = false;
            const preSelectIds = [...this.visibleElement.getSelectedNodeIds()];
            this.visibleElement.setSelectNodeByPos(event.offsetX, event.offsetY, event.shiftKey);
            const curSelectIds = [...this.visibleElement.getSelectedNodeIds()];
            // 比较pre和cur是否一致，如果不一致则调用draw
            if (preSelectIds.length !== curSelectIds.length || !preSelectIds.every(id => curSelectIds.includes(id))) {
                selectChanged = true;
            }
            if (selectChanged) {
                // 如果选中状态改变了，且之前有选中节点，则提交编辑内容
                const editorId = this.visibleElement.getEditorId();
                if (editorId && curSelectIds.length <= 1) {
                    this.commitTextareaContent(editorId);
                } else {
                    this.draw();
                }
            }
        });
        this.canvas.addEventListener('mousemove', (event) => {
            const preHoverIds = [...this.visibleElement.getHoveredNodeIds()];
            this.visibleElement.setHoverNodeByPos(event.offsetX, event.offsetY);
            const curHoverIds = [...this.visibleElement.getHoveredNodeIds()];
            if (preHoverIds.length !== curHoverIds.length || !preHoverIds.every(id => curHoverIds.includes(id))) {
                this.draw();
            }
        });
        this.canvas.addEventListener('dblclick', (event) => {
            const preEditorId = this.visibleElement.getEditorId();
            this.visibleElement.setEditorId(event.offsetX, event.offsetY);
            const curEditorId = this.visibleElement.getEditorId();
            if (preEditorId !== curEditorId) {
                this.draw();
                this.eventBus.publish({ eventType: 'dblclick' });
            }
        });
        this.canvas.addEventListener('wheel', (event) => {
            event.preventDefault();
            if (event.ctrlKey || event.metaKey) {
                const zoomFactor = event.deltaY > 0 ? 0.9 : 1.1;
                this.visibleElement.setZoom(
                    this.visibleElement.zoom * zoomFactor,
                    event.offsetX,
                    event.offsetY,
                );
            } else {
                this.visibleElement.offsetX -= event.deltaX;
                this.visibleElement.offsetY -= event.deltaY;
            }
            this.visibleElement.setHoverNodeByPos(event.offsetX, event.offsetY);
            this.draw();
        }, { passive: false });
        window.addEventListener('keydown', (event) => {
            if (this.visibleElement.getEditorId()) {
                return; // 编辑状态下不响应键盘事件
            }
            if (this.handleUndoRedoKeydown(event)) {
                return;
            }
            if (this.isArrowKey(event.key)) {
                event.preventDefault();
                if (event.shiftKey) { // 按住shift键新增节点
                    this.addNode(event.key as ArrowKey);
                } else {
                    // 若选中一个节点，则切换选中节点
                    const selectedNodeId = this.visibleElement.getSingleSelectedNodeId();
                    // 确定要选中的目标节点
                    const targetNodeId = selectedNodeId
                        ? this.visibleElement.getNeighborNodeId(selectedNodeId, event.key as ArrowKey)
                        : this.rootId;

                    // 存在目标节点则选中并滚动显示
                    if (targetNodeId) {
                        this.visibleElement.setSelectedNodeIds([targetNodeId]);
                        this.visibleElement.ensureNodeVisible(targetNodeId);
                        this.draw();
                    }
                }
            } else if (event.key === EventKey.Backspace) {
                this.deleteSelectedNode();
            }
        });
        window.addEventListener('keyup', (event) => {
            if (this.isArrowKey(event.key)) {
                this.pressedArrowKeys.delete(event.key as ArrowKey);
            } else if (event.key === EventKey.Escape) {
                if (this.visibleElement.getEditorId()) {
                    this.visibleElement.delEditorId();
                    this.draw();
                }
            } else if (event.key === EventKey.Enter) {

                console.log('enter keyup');
                if (this.ignoreNextEnterKeyup) {
                    this.ignoreNextEnterKeyup = false;
                    return;
                }
                const selectedNodeId = this.visibleElement.getSingleSelectedNodeId();
                if (!selectedNodeId || this.visibleElement.getEditorId() === selectedNodeId) {
                    return;
                }
                if (this.visibleElement.setEditorIdById(selectedNodeId)) {
                    this.draw();
                }
            }
        });
        window.addEventListener('blur', () => {
            this.pressedArrowKeys.clear();
        });
        this.richTextCanvas.addEventListener('stop', () => {
            this.ignoreNextEnterKeyup = true;
            const editorId = this.visibleElement.getEditorId();
            if (!editorId) {
                return;
            }
            const node = this.visibleElement.getDataRef()[editorId];
            if (!node) {
                return;
            }
            this.commitTextareaContent(editorId);
        });
        this.richTextCanvas.addEventListener('input', () => {
            console.log('rich text input', this.richTextCanvas.getToken(), this.richTextCanvas.getLines());
        });
    }
    private handleUndoRedoKeydown(event: KeyboardEvent) {
        const isModifierPressed = event.metaKey || event.ctrlKey;
        if (!isModifierPressed || event.altKey) {
            return false;
        }
        const key = event.key.toLowerCase();
        const isUndo = key === 'z' && !event.shiftKey;
        const isRedoByShiftZ = key === 'z' && event.shiftKey;
        const isRedoByY = key === 'y' && !event.shiftKey;

        if (!isUndo && !isRedoByShiftZ && !isRedoByY) {
            return false;
        }

        event.preventDefault();
        if (isUndo) {
            return this.historyManager.undo();
        }
        return this.historyManager.redo();
    }
    private cloneNodeData(node: IVisibleNode): IVisibleNode {
        return {
            ...node,
            children: [...node.children],
            contents: (node.contents || []).map((content) => ({ ...content })),
        };
    }
    private cloneNodeContents(contents: NodeContent[]): NodeContent[] {
        return contents.map((content) => ({ ...content }));
    }
    private deleteSelectedNode() {
        const selectedId = this.visibleElement.getSingleSelectedNodeId();
        if (!selectedId || selectedId === this.rootId) {
            return;
        }
        const dataRef = this.visibleElement.getDataRef();
        const node = dataRef[selectedId];
        if (!node || !node.parentId) {
            return;
        }
        const parentNode = dataRef[node.parentId];
        if (!parentNode) {
            return;
        }
        const parentChildrenBefore = [...parentNode.children];
        const idx = parentChildrenBefore.indexOf(selectedId);
        if (idx === -1) {
            return;
        }
        const promotedChildren = [...node.children];
        const parentChildrenAfter = [
            ...parentChildrenBefore.slice(0, idx),
            ...promotedChildren,
            ...parentChildrenBefore.slice(idx + 1),
        ];
        const selectedBefore = [...this.visibleElement.getSelectedNodeIds()];
        const selectedAfter = node.children.length > 0 && node.children[0] ? [node.children[0]] : [node.parentId];

        const command: IDeleteNodeCommand = {
            type: 'delete',
            deletedNode: this.cloneNodeData(node),
            parentId: node.parentId,
            parentChildrenBefore,
            parentChildrenAfter,
            promotedChildren,
            selectedBefore,
            selectedAfter,
        };

        this.historyManager.execute(command);
    }
    private resetHistory() {
        this.historyManager.reset();
    }
    // 根据方向键添加新节点
    private addNode(key: ArrowKey) {
        const selectedNodeId = this.visibleElement.getSingleSelectedNodeId();
        if (!selectedNodeId) {
            return;
        }
        const dataRef = this.visibleElement.getDataRef();
        const selectedNode = dataRef[selectedNodeId];
        if (!selectedNode) {
            return;
        }
        const parentNode = selectedNode.parentId ? dataRef[selectedNode.parentId] : undefined;
        const direction = key === 'ArrowUp' ? 'top' :
            key === 'ArrowDown' ? 'bottom' :
                key === 'ArrowLeft' ? 'left' : 'right';
        const paddings = + this.TEXT_PADDING * 2;
        const id = `${this._TEMP_ID}`;
        const command: IAddNodeCommand = {
            type: 'add',
            node: {
                id,
                w: this.MIN_NODE_WIDTH + paddings,
                h: this.MIN_NODE_HEIGHT + paddings,
                x: 0,
                y: 0,
                sh: 0,
                parentId: null,
                children: [],
                fontSize: 12,
                contents: [],
            },
            attachId: selectedNodeId,
            direction,
            attachChildrenBefore: [...selectedNode.children],
            parentIdBefore: selectedNode.parentId,
            parentChildrenBefore: parentNode
                ? [...parentNode.children]
                : [],
            selectedBefore: [...this.visibleElement.getSelectedNodeIds()],
            selectedAfter: [id],
        };
        if (this.historyManager.execute(command)) {
            this._TEMP_ID += 1;
        }
    }
    // 计算文本宽高度并更新节点数据，最后关闭编辑状态
    private commitTextareaContent(editorId: string) {
        const node = this.visibleElement.getDataRef()[editorId];
        if (!node) {
            return;
        }
        const lines = this.normalizeTextLines(this.richTextCanvas.getText());
        let maxTextWidth = 0;
        let currentOffsetY = 0;
        const nextContents = lines.map((line) => {
            const text = line || '';
            const metrics = this.measureText(text, node.fontSize || 12);
            const measuredWidth = Math.max(
                metrics.width,
                metrics.actualBoundingBoxLeft + metrics.actualBoundingBoxRight,
            );
            maxTextWidth = Math.max(maxTextWidth, measuredWidth);
            const content = {
                text,
                textOffsetX: 0,
                textOffsetY: currentOffsetY,
            };
            currentOffsetY += metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent + this.LINE_HEIGHT_GAP;
            return content;
        });
        if (lines.length > 0) {
            currentOffsetY -= this.LINE_HEIGHT_GAP;
        }
        const nextWidth = Math.max(Math.ceil(maxTextWidth), this.MIN_NODE_WIDTH) + this.TEXT_PADDING * 2;
        const nextHeight = Math.max(Math.ceil(currentOffsetY), this.MIN_NODE_HEIGHT) + this.TEXT_PADDING * 2;

        const currentContents = JSON.stringify(node.contents || []);
        const nextContentsJson = JSON.stringify(nextContents);
        const changed = node.w !== nextWidth || node.h !== nextHeight || currentContents !== nextContentsJson;
        if (!changed) {
            this.visibleElement.delEditorId();
            this.draw();
            return;
        }

        const selectedIds = [...this.visibleElement.getSelectedNodeIds()];
        const command: IEditNodeCommand = {
            type: 'edit',
            nodeId: editorId,
            before: {
                w: node.w,
                h: node.h,
                contents: this.cloneNodeContents(node.contents || []),
            },
            after: {
                w: nextWidth,
                h: nextHeight,
                contents: this.cloneNodeContents(nextContents),
            },
            selectedBefore: selectedIds,
            selectedAfter: selectedIds,
        };
        this.historyManager.execute(command);
    }
    private normalizeTextLines(text: string) {
        const lines = text.split('\n');
        if (lines.length > 1 && lines[lines.length - 1] === '') {
            return lines.slice(0, -1);
        }
        return lines;
    }
    // 同步textarea的位置和内容
    private syncTextareaByEditorId() {
        const editorId = this.visibleElement.getEditorId();
        if (!editorId) {
            this._CURRENT_EDITOR_ID = null;
            this.richTextCanvas.hide();
            return;
        }
        const node = this.visibleElement.getDataRef()[editorId];
        if (!node) {
            this._CURRENT_EDITOR_ID = null;
            this.richTextCanvas.hide();
            return;
        }
        const zoom = this.visibleElement.zoom;
        const x = node.x * zoom + this.visibleElement.offsetX;
        const y = node.y * zoom + this.visibleElement.offsetY;
        if (this._CURRENT_EDITOR_ID !== editorId) {
            this.richTextCanvas.setText(node.contents ? node.contents.map(content => content.text).join('\n') : '')
            this._CURRENT_EDITOR_ID = editorId;

            this.richTextCanvas.show(x, y);
        }
    }
    private isArrowKey(key: string) {
        const arrowKey = key as EventKey;
        return [EventKey.ArrowUp, EventKey.ArrowDown, EventKey.ArrowLeft, EventKey.ArrowRight].includes(arrowKey);
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
        this.visibleElement.calVisibleLines();
        // 同步编辑器位置和内容
        this.syncTextareaByEditorId();
        const data = this.visibleElement.getDataRef();
        const visibleNodeIds = this.visibleElement.getVisibleNodeIds();
        const visibleLines = this.visibleElement.getVisibleLines();
        const editorId = this.visibleElement.getEditorId();
        // 绘制可视节点
        for (const nodeId of visibleNodeIds) {
            if (nodeId === editorId) {
                continue; // 编辑状态由textarea渲染，这里不绘制
            }
            const node = data[nodeId];
            if (node) {
                const zoom = this.visibleElement.zoom;
                const nodeX = node.x * zoom + this.visibleElement.offsetX;
                const nodeY = node.y * zoom + this.visibleElement.offsetY;
                const nodeW = node.w * zoom;
                const nodeH = node.h * zoom;
                this.strokeRect(nodeX, nodeY, nodeW, nodeH, { radius: 4 * zoom });

                if (zoom > 0.4) { // 缩放过小则不绘制文本
                    if (node.contents) {
                        for (const content of node.contents) {
                            this.text(
                                content.text,
                                nodeX + (content.textOffsetX + this.TEXT_PADDING) * zoom,
                                nodeY + (content.textOffsetY + this.TEXT_BASELINE_OFFSET) * zoom,
                                (node.fontSize || 12) * zoom,
                            );
                        }
                    }
                }
            }
        }
        // 绘制连接线
        for (const visibleLine of visibleLines) {
            this.line([
                { x: visibleLine.startX, y: visibleLine.startY },
                { x: visibleLine.endX, y: visibleLine.endY },
            ], 2);
        }
        // hover事件
        for (const nodeId of this.visibleElement.getHoveredNodeIds()) {
            const node = data[nodeId];
            if (node) {
                const zoom = this.visibleElement.zoom;
                const nodeX = node.x * zoom + this.visibleElement.offsetX - this.HOVERED_GAP * zoom;
                const nodeY = node.y * zoom + this.visibleElement.offsetY - this.HOVERED_GAP * zoom;
                this.strokeRect(nodeX, nodeY, node.w * zoom + this.HOVERED_GAP * 2 * zoom, node.h * zoom + this.HOVERED_GAP * 2 * zoom, { radius: 4 * zoom, strokeStyle: '#EEEEEE' });
            }
        }
        // 绘制被选中节点
        for (const nodeId of this.visibleElement.getSelectedNodeIds()) {
            const node = data[nodeId];
            if (node) {
                const zoom = this.visibleElement.zoom;
                const nodeX = node.x * zoom + this.visibleElement.offsetX - this.SELECTED_GAP * zoom;
                const nodeY = node.y * zoom + this.visibleElement.offsetY - this.SELECTED_GAP * zoom;
                this.strokeRect(nodeX, nodeY, node.w * zoom + this.SELECTED_GAP * 2 * zoom, node.h * zoom + this.SELECTED_GAP * 2 * zoom, { radius: 4 * zoom, strokeStyle: '#13CCDA' });
            }
        }
    }
    /**
     * 调整画布大小
     * @param width 
     * @param height 
     */
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
    /**
     * 初始化数据，data的key为节点id，value为节点数据。rootId为根节点id，必须在data中存在
     * @param data 
     * @param rootId 
     */
    public initData(data: INodeData<IVisibleNode>, rootId: string = this.rootId) {
        if (!this.rootId || !data[rootId] || this.rootId !== rootId) {
            throw new Error(`initData failed: root node ${rootId} not found`);
        }

        const dataRef = this.visibleElement.getDataRef();
        for (const key in dataRef) {
            delete dataRef[key];
        }

        for (const key in data) {
            const node = data[key];
            if (!node?.id) {
                continue;
            }
            dataRef[key] = {
                id: node.id,
                w: node.w ?? this.MIN_NODE_WIDTH + this.TEXT_PADDING * 2,
                h: node.h ?? this.MIN_NODE_HEIGHT + this.TEXT_PADDING * 2,
                x: 0, // 先把所有节点放在(0, 0)，后续调用calculateNodePosition计算实际位置
                y: 0,
                sh: node.sh ?? 0,
                parentId: node.parentId ?? null,
                children: node.children ? [...node.children] : [],
                fontSize: node.fontSize ?? 12,
                contents: node.contents ? [...node.contents] : [],
            };
        }

        this.rootId = rootId;
        this.visibleElement.delEditorId();
        this.visibleElement.setSelectedNodeIds([rootId]);
        this.visibleElement.calculateNodePosition();
        this.visibleElement.ensureNodeVisible(rootId);

        const maxNumericId = Object.keys(dataRef).reduce((max, id) => {
            const num = Number(id);
            return Number.isInteger(num) ? Math.max(max, num) : max;
        }, 1);
        this._TEMP_ID = maxNumericId + 1;
        this.resetHistory();

        this.draw();
    }
    public getData() {
        return this.visibleElement.getData(true);
    }
}