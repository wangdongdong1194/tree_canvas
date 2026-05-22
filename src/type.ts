import { BaseData, type IBaseData, type INodeData } from "tree_algorithm";

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

export interface IStrokeRectOptions {
    radius?: number;
    strokeStyle?: string;
}

export type ArrowKey = 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight';


export interface ICanvasEvent {
    eventType: string;
}
export type EventListener = (event: ICanvasEvent) => void;