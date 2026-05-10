import type { AttachDirection } from "ld_algorithm";
import { DrawShape } from "./DrawShape";
import { VisibleElement } from "./VisibleElement";
import { EventKey } from "./EventKey";

export type ArrowKey = 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight';

export class EventCanvas extends DrawShape {
    private canvas: HTMLCanvasElement;
    private root: HTMLElement;
    private visibleElement = new VisibleElement();
    private _TEMP_ID = 2;
    private drawRequestId: number | null = null;
    private pressedArrowKeys = new Set<ArrowKey>();
    private readonly SELECTED_GAP = 5; // 选中节点的边框与节点的间距
    private readonly HOVERED_GAP = 5; // hover节点的边框与节点的间距
    private readonly TEXT_PADDING = 10; // 文本与节点边界的最小距离
    private readonly TEXT_BASELINE_OFFSET = 20; // 文本基线相对节点顶部偏移
    private readonly LINE_HEIGHT_GAP = 3; // 多行文本行高与字体大小的额外间距
    private readonly TEXT_WIDTH_SAFE_GAP = 2; // 文本宽度安全余量，避免临界换行
    private ignoreNextEnterKeyup = false;
    private textarea: HTMLTextAreaElement;

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
        this.root = root;
        this.canvas = canvas;
        this.textarea = this.initTextarea();
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
        for (let i = 0; i < 20; i++) {
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
            this.visibleElement.print();
        });
        this.canvas.addEventListener('mousedown', (event) => {
            const preSelectIds = [...this.visibleElement.getSelectedNodeIds()];
            this.visibleElement.setSelectNodeByPos(event.offsetX, event.offsetY, event.shiftKey);
            const curSelectIds = [...this.visibleElement.getSelectedNodeIds()];
            // 比较pre和cur是否一致，如果不一致则调用draw
            if (preSelectIds.length !== curSelectIds.length || !preSelectIds.every(id => curSelectIds.includes(id))) {
                this.draw();
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
            }
        });
        this.canvas.addEventListener('wheel', (event) => {
            event.preventDefault();
            this.visibleElement.offsetX -= event.deltaX;
            this.visibleElement.offsetY -= event.deltaY;
            this.draw();
        }, { passive: false });
        window.addEventListener('keydown', (event) => {
            if (this.visibleElement.getEditorId()) {
                return; // 编辑状态下不响应键盘事件
            }
            if (this.isArrowKey(event.key)) {
                event.preventDefault();
                this.pressedArrowKeys.add(event.key as ArrowKey);
                this.draw();
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
    }
    private initTextarea() {
        const rootStyle = window.getComputedStyle(this.root);
        if (rootStyle.position === 'static') {
            this.root.style.position = 'relative';
        }
        const textarea = document.createElement('textarea');
        textarea.style.position = 'absolute';
        textarea.style.display = 'none';
        textarea.style.zIndex = '10';
        textarea.style.resize = 'none';
        textarea.style.boxSizing = 'border-box';
        textarea.style.overflowY = 'hidden';
        textarea.style.outline = 'none';
        textarea.style.border = '1px solid #00CDCD';
        textarea.style.borderRadius = '4px';
        textarea.style.padding = `${this.TEXT_PADDING}px`;
        textarea.style.background = 'green';
        textarea.style.fontSize = '14px';
        textarea.addEventListener('input', () => {
            const editorId = this.visibleElement.getEditorId();
            if (!editorId) {
                return;
            }
            const node = this.visibleElement.getDataRef()[editorId];
            if (!node) {
                return;
            }
            this.resizeTextareaByContent(node.w, node.h, node.fontSize || 12);
        });
        textarea.addEventListener('keydown', (event) => {
            if (event.key !== EventKey.Enter || event.shiftKey) {
                return;
            }
            event.preventDefault();
            this.ignoreNextEnterKeyup = true;
            const editorId = this.visibleElement.getEditorId();
            if (!editorId) {
                return;
            }
            const node = this.visibleElement.getDataRef()[editorId];
            if (!node) {
                return;
            }
            this.commitTextareaContent(editorId, node.fontSize || 12);
        });
        textarea.addEventListener('compositionend', () => {
            const editorId = this.visibleElement.getEditorId();
            if (!editorId) {
                return;
            }
            const node = this.visibleElement.getDataRef()[editorId];
            if (!node) {
                return;
            }
            this.resizeTextareaByContent(node.w, node.h, node.fontSize || 12);
        });
        textarea.addEventListener('keyup', (event) => {
            if (event.key !== EventKey.Enter || event.shiftKey) {
                return;
            }
        });
        this.root.appendChild(textarea);
        return textarea;
    }
    private commitTextareaContent(editorId: string, fontSize: number, rawText?: string) {
        const node = this.visibleElement.getDataRef()[editorId];
        if (!node) {
            return;
        }
        const lines = this.normalizeTextLines(rawText ?? this.textarea.value);
        let maxTextWidth = 0;
        let currentOffsetY = 0;
        const nextContents = lines.map((line) => {
            const text = line || '';
            const metrics = this.measureText(text, fontSize);
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
        const nextWidth = Math.ceil(maxTextWidth) + this.TEXT_PADDING * 2 + this.TEXT_WIDTH_SAFE_GAP;
        const nextHeight = currentOffsetY + this.TEXT_PADDING * 2;
        node.w = nextWidth;
        node.h = nextHeight;
        node.contents = nextContents;
        this.visibleElement.delEditorId();
        this.visibleElement.calculateNodePosition();
        this.draw();
    }
    private normalizeTextLines(text: string) {
        const lines = text.split('\n');
        if (lines.length > 1 && lines[lines.length - 1] === '') {
            return lines.slice(0, -1);
        }
        return lines;
    }
    private resizeTextareaByContent(minWidth: number, minHeight: number, fontSize: number) {
        const lines = this.textarea.value.split('\n');
        let maxTextWidth = 0;
        for (let i = 0; i < lines.length; i++) {
            const text = lines[i] || '';
            const metrics = this.measureText(text, fontSize);
            const measuredWidth = Math.max(
                metrics.width,
                metrics.actualBoundingBoxLeft + metrics.actualBoundingBoxRight,
            );
            maxTextWidth = Math.max(maxTextWidth, measuredWidth);
        }
        const style = window.getComputedStyle(this.textarea);
        const borderLeft = parseFloat(style.borderLeftWidth || '0') || 0;
        const borderRight = parseFloat(style.borderRightWidth || '0') || 0;
        const borderTop = parseFloat(style.borderTopWidth || '0') || 0;
        const borderBottom = parseFloat(style.borderBottomWidth || '0') || 0;

        const measuredWidth = Math.ceil(maxTextWidth) + this.TEXT_PADDING * 2 + borderLeft + borderRight + this.TEXT_WIDTH_SAFE_GAP;
        const nextWidth = Math.max(minWidth, measuredWidth);
        this.textarea.style.width = `${nextWidth}px`;

        // Use the DOM layout result to avoid clipping descenders at the bottom.
        this.textarea.style.height = 'auto';
        const nextHeight = Math.max(minHeight, this.textarea.scrollHeight + borderTop + borderBottom);
        this.textarea.style.height = `${nextHeight}px`;
    }
    private syncTextareaByEditorId() {
        const editorId = this.visibleElement.getEditorId();
        if (!editorId) {
            this.textarea.style.display = 'none';
            this.textarea.value = '';
            delete this.textarea.dataset.editorId;
            return;
        }
        const node = this.visibleElement.getDataRef()[editorId];
        if (!node) {
            this.textarea.style.display = 'none';
            this.textarea.value = '';
            delete this.textarea.dataset.editorId;
            return;
        }
        const x = node.x + this.visibleElement.offsetX;
        const y = node.y + this.visibleElement.offsetY;
        this.textarea.style.left = `${x}px`;
        this.textarea.style.top = `${y}px`;
        this.textarea.style.display = 'block';
        this.textarea.style.fontSize = `${node.fontSize || 12}px`;
        this.textarea.style.lineHeight = `${(node.fontSize || 12) + this.LINE_HEIGHT_GAP}px`;
        if (this.textarea.dataset.editorId !== editorId) {
            this.textarea.value = node.contents ? node.contents.map(content => content.text).join('\n') : '';
            this.textarea.dataset.editorId = editorId;
            this.resizeTextareaByContent(node.w, node.h, node.fontSize || 12);
            this.textarea.select();
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
        this.syncTextareaByEditorId();
        const data = this.visibleElement.getDataRef();
        const visibleNodeIds = this.visibleElement.getVisibleNodeIds();
        const visibleLines = this.visibleElement.getVisibleLines();
        // 绘制可视节点
        for (const nodeId of visibleNodeIds) {
            const node = data[nodeId];
            if (node) {
                const nodeX = node.x + this.visibleElement.offsetX;
                const nodeY = node.y + this.visibleElement.offsetY;
                this.strokeRect(nodeX, nodeY, node.w, node.h, { radius: 4 });

                if (node.contents) {
                    for (const content of node.contents) {
                        this.text(content.text, nodeX + content.textOffsetX + this.TEXT_PADDING, nodeY + content.textOffsetY + this.TEXT_BASELINE_OFFSET, node.fontSize);
                    }
                } else {
                    this.text(node.id, nodeX + this.TEXT_PADDING, nodeY + this.TEXT_BASELINE_OFFSET);
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
                const nodeX = node.x + this.visibleElement.offsetX - this.HOVERED_GAP;
                const nodeY = node.y + this.visibleElement.offsetY - this.HOVERED_GAP;
                this.strokeRect(nodeX, nodeY, node.w + this.HOVERED_GAP * 2, node.h + this.HOVERED_GAP * 2, { radius: 4, strokeStyle: '#00EEEE' });
            }
        }
        // 绘制被选中节点
        for (const nodeId of this.visibleElement.getSelectedNodeIds()) {
            const node = data[nodeId];
            if (node) {
                const nodeX = node.x + this.visibleElement.offsetX - this.SELECTED_GAP;
                const nodeY = node.y + this.visibleElement.offsetY - this.SELECTED_GAP;
                this.strokeRect(nodeX, nodeY, node.w + this.SELECTED_GAP * 2, node.h + this.SELECTED_GAP * 2, { radius: 4, strokeStyle: '#00CDCD' });
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