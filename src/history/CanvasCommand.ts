import type { IVisibleNode } from "../VisibleElement";

export type AddDirection = "top" | "bottom" | "left" | "right";
export type NodeContent = IVisibleNode["contents"][number];

export interface IAddNodeCommand {
    type: "add";
    node: IVisibleNode;
    attachId: string;
    direction: AddDirection;
    attachChildrenBefore: string[];
    parentIdBefore: string | null;
    parentChildrenBefore: string[];
    selectedBefore: string[];
    selectedAfter: string[];
}

export interface IDeleteNodeCommand {
    type: "delete";
    deletedNode: IVisibleNode;
    parentId: string;
    parentChildrenBefore: string[];
    parentChildrenAfter: string[];
    promotedChildren: string[];
    selectedBefore: string[];
    selectedAfter: string[];
}

export interface IEditNodeCommand {
    type: "edit";
    nodeId: string;
    before: {
        w: number;
        h: number;
        contents: NodeContent[];
    };
    after: {
        w: number;
        h: number;
        contents: NodeContent[];
    };
    selectedBefore: string[];
    selectedAfter: string[];
}

export type ICanvasCommand = IAddNodeCommand | IDeleteNodeCommand | IEditNodeCommand;
