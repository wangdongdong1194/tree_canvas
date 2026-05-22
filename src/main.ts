import { EventBus } from './EventBus';
import { CoreCanvas } from './CoreCanvas';
import type { INodeData } from 'tree_algorithm';
import type { IVisibleNode } from './type';

(function main() {
    const canvasRoot = document.querySelector<HTMLDivElement>('#canvas-root');
    if (!canvasRoot) {
        throw new Error('Canvas root not found');
    }
    const eventBus = new EventBus();

    const coreCanvas = new CoreCanvas(canvasRoot, window.innerWidth, window.innerHeight, '1', eventBus);
    const data: INodeData<IVisibleNode> = {
        "1": {
            "id": "1",
            "w": 100,
            "h": 50,
            "children": [
                "2",
                "5",
                "4"
            ],
            "parentId": null,
            "sh": 250,
            "x": 230,
            "y": 334,
            fontSize: 12,
            contents: [{
                text: '双击打开',
                textOffsetX: 0,
                textOffsetY: 0
            }]
        },
        "2": {
            "id": "2",
            "w": 100,
            "h": 50,
            "x": 380,
            "y": 334,
            "children": [],
            "parentId": "1",
            "sh": 50,
            fontSize: 12,
            contents: []
        },
        "3": {
            "id": "3",
            "w": 100,
            "h": 50,
            "x": 562,
            "y": 434,
            "children": [],
            "parentId": "5",
            "sh": 50,
            fontSize: 12,
            contents: []
        },
        "4": {
            "id": "4",
            "w": 100,
            "h": 50,
            "x": 380,
            "y": 534,
            "children": [],
            "parentId": "1",
            "sh": 50,
            fontSize: 12,
            contents: []
        },
        "5": {
            "id": "5",
            "w": 132,
            "h": 50,
            "x": 380,
            "y": 434,
            "children": [
                "3"
            ],
            "parentId": "1",
            "sh": 50,
            "fontSize": 12,
            "contents": [
                {
                    "text": "jajsdfsdfj啊双击打开",
                    "textOffsetX": 0,
                    "textOffsetY": 0
                },
                {
                    "text": "上的就看法",
                    "textOffsetX": 0,
                    "textOffsetY": 15.144000053405762
                }
            ]
        }
    };
    coreCanvas.initData(data, '1');
    window.addEventListener('resize', (event) => {
        coreCanvas.resize(window.innerWidth, window.innerHeight);
    });
    eventBus.subscribe('dblclick', () => {
        console.log('dblclick');
    });
})();