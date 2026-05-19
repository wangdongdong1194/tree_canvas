import { VisibleElement, type IVisibleNode } from "../VisibleElement";
import type { IAddNodeCommand, ICanvasCommand, IDeleteNodeCommand, IEditNodeCommand, NodeContent } from "./CanvasCommand";

export class CanvasHistoryManager {
    private historyPast: ICanvasCommand[] = [];
    private historyFuture: ICanvasCommand[] = [];

    constructor(
        private readonly visibleElement: VisibleElement,
        private readonly onChanged: () => void,
        private readonly historyLimit: number,
    ) { }

    execute(command: ICanvasCommand) {
        const applied = this.applyCommand(command, "redo");
        if (!applied) {
            return false;
        }
        this.historyPast.push(command);
        if (this.historyPast.length > this.historyLimit) {
            this.historyPast.shift();
        }
        this.historyFuture = [];
        return true;
    }

    undo() {
        const command = this.historyPast.pop();
        if (!command) {
            return false;
        }
        const applied = this.applyCommand(command, "undo");
        if (!applied) {
            this.historyPast.push(command);
            return false;
        }
        this.historyFuture.push(command);
        return true;
    }

    redo() {
        const command = this.historyFuture.pop();
        if (!command) {
            return false;
        }
        const applied = this.applyCommand(command, "redo");
        if (!applied) {
            this.historyFuture.push(command);
            return false;
        }
        this.historyPast.push(command);
        return true;
    }

    reset() {
        this.historyPast = [];
        this.historyFuture = [];
    }

    private applyCommand(command: ICanvasCommand, mode: "undo" | "redo") {
        if (command.type === "add") {
            return mode === "redo" ? this.applyAddCommand(command) : this.revertAddCommand(command);
        }
        if (command.type === "delete") {
            return mode === "redo" ? this.applyDeleteCommand(command) : this.revertDeleteCommand(command);
        }
        return mode === "redo" ? this.applyEditCommand(command) : this.revertEditCommand(command);
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

    private setSelectedNodeIdsAndEnsureVisible(ids: string[]) {
        this.visibleElement.setSelectedNodeIds(ids);
        const selectedNodeId = this.visibleElement.getSingleSelectedNodeId();
        if (selectedNodeId) {
            this.visibleElement.ensureNodeVisible(selectedNodeId);
        }
    }

    private afterMutation(selectedIds: string[]) {
        this.visibleElement.calculateNodePosition();
        this.setSelectedNodeIdsAndEnsureVisible(selectedIds);
        this.visibleElement.delEditorId();
        this.onChanged();
    }

    private applyAddCommand(command: IAddNodeCommand) {
        const node = this.cloneNodeData(command.node);
        const added = this.visibleElement.addRight(
            {
                ...node,
                children: [],
                parentId: null,
                sh: 0,
                x: 0,
                y: 0,
            },
            command.attachId,
            command.direction,
        );
        if (!added) {
            return false;
        }
        this.afterMutation(command.selectedAfter);
        return true;
    }

    private revertAddCommand(command: IAddNodeCommand) {
        const dataRef = this.visibleElement.getDataRef();
        const attachNode = dataRef[command.attachId];
        if (!attachNode || !dataRef[command.node.id]) {
            return false;
        }

        if (command.direction === "right") {
            attachNode.children = [...command.attachChildrenBefore];
            for (const childId of attachNode.children) {
                const child = dataRef[childId];
                if (child) {
                    child.parentId = command.attachId;
                }
            }
        } else {
            const parentId = command.parentIdBefore;
            if (parentId) {
                const parentNode = dataRef[parentId];
                if (!parentNode) {
                    return false;
                }
                parentNode.children = [...command.parentChildrenBefore];
            }
            attachNode.parentId = command.parentIdBefore;
        }

        delete dataRef[command.node.id];
        this.afterMutation(command.selectedBefore);
        return true;
    }

    private applyDeleteCommand(command: IDeleteNodeCommand) {
        const dataRef = this.visibleElement.getDataRef();
        const node = dataRef[command.deletedNode.id];
        const parentNode = dataRef[command.parentId];
        if (!node || !parentNode) {
            return false;
        }

        parentNode.children = [...command.parentChildrenAfter];
        for (const childId of command.promotedChildren) {
            const child = dataRef[childId];
            if (child) {
                child.parentId = command.parentId;
            }
        }
        delete dataRef[command.deletedNode.id];
        this.afterMutation(command.selectedAfter);
        return true;
    }

    private revertDeleteCommand(command: IDeleteNodeCommand) {
        const dataRef = this.visibleElement.getDataRef();
        const parentNode = dataRef[command.parentId];
        if (!parentNode) {
            return false;
        }

        dataRef[command.deletedNode.id] = this.cloneNodeData(command.deletedNode);
        parentNode.children = [...command.parentChildrenBefore];
        for (const childId of command.promotedChildren) {
            const child = dataRef[childId];
            if (child) {
                child.parentId = command.deletedNode.id;
            }
        }
        this.afterMutation(command.selectedBefore);
        return true;
    }

    private applyEditCommand(command: IEditNodeCommand) {
        const node = this.visibleElement.getDataRef()[command.nodeId];
        if (!node) {
            return false;
        }
        node.w = command.after.w;
        node.h = command.after.h;
        node.contents = this.cloneNodeContents(command.after.contents);
        this.afterMutation(command.selectedAfter);
        return true;
    }

    private revertEditCommand(command: IEditNodeCommand) {
        const node = this.visibleElement.getDataRef()[command.nodeId];
        if (!node) {
            return false;
        }
        node.w = command.before.w;
        node.h = command.before.h;
        node.contents = this.cloneNodeContents(command.before.contents);
        this.afterMutation(command.selectedBefore);
        return true;
    }
}
