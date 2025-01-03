import { StateMachine } from "./interfaces";

export function placeholder(){};

export function parseStateMachine<EventPayloadMapping, Context, States extends string>(stateMachine: StateMachine<EventPayloadMapping, Context, States>){
    const states = stateMachine.states;
    const possibleStates = stateMachine.possibleStates;
    possibleStates.forEach(state => {
        const stateObject = states[state];
        console.log("--------------------------------");
        console.log("state: ", state);
        console.log("can handle:");
        for (const event in stateObject.eventReactions){
            if(stateObject.eventReactions[event] === undefined){
                continue;
            }
            console.log("event: ", event);
            console.log("default target state: ", stateObject.eventReactions[event].defaultTargetState);
            const eventGuards = stateObject.eventGuards[event];
            if(eventGuards === undefined){
                continue;
            }
            console.log("event guards: ", eventGuards);
            for (const guard in eventGuards){
                console.log("guard: ", guard);
                console.log("guard condition: ", eventGuards[guard]);
            }
        }
    });
}

export function parseEventsOfAState<EventPayloadMapping, Context, States extends string>(stateMachine: StateMachine<EventPayloadMapping, Context, States>, state: States){
    const stateObject = stateMachine.states[state];
    console.log("state: ", state);
    console.log("events: ", stateObject.eventReactions);
    const eventsMap: {
        event: string;
        defaultTargetState: States;
    }[] = [];
    for(const event in stateObject.eventReactions){
        if(stateObject.eventReactions[event] === undefined){
            continue;
        }
        const eventObject = stateObject.eventReactions[event];
        eventsMap.push({
            event: event,
            defaultTargetState: eventObject.defaultTargetState
        });
    }
    return eventsMap;
}

interface Node {
    id: number;
    x: number;
    y: number;
    targetX: number | null;
    targetY: number | null;
}

interface Edge {
    source: number;
    target: number;
}

interface GraphOptions {
    nodeSize?: number;
    gridSize?: number;
    nodeColor?: string;
    edgeColor?: string;
    snapToGrid?: boolean;
    verticalSpacing?: number;
    horizontalSpacing?: number;
    flexibility?: number;        // 0-1: How much nodes can deviate from preferred positions
    gridSnapStrength?: number;   // 0-1: How strongly nodes snap to grid
    layerDeviation?: number;     // How much nodes can deviate from their layer
    edgeLength?: number;         // Preferred edge length
    repulsionStrength?: number;  // Strength of node repulsion
}

class FlowchartGraph {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private options: Required<GraphOptions>;
    private nodes: Node[];
    private edges: Edge[];
    private isDragging: boolean;
    private draggedNode: number | null;

    constructor(canvasId: string, options: GraphOptions = {}) {
        const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
        if (!canvas) {
            throw new Error(`Canvas with id ${canvasId} not found`);
        }
        this.canvas = canvas;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            throw new Error('Could not get 2D context from canvas');
        }
        this.ctx = ctx;
        
        // Default options with required type safety
        this.options = {
            nodeSize: options.nodeSize ?? 60,
            gridSize: options.gridSize ?? 20,
            nodeColor: options.nodeColor ?? '#1a73e8',
            edgeColor: options.edgeColor ?? '#666',
            snapToGrid: options.snapToGrid ?? false,
            verticalSpacing: options.verticalSpacing ?? 100,
            horizontalSpacing: options.horizontalSpacing ?? 200,
            flexibility: options.flexibility ?? 0.3,        // 30% flexibility by default
            gridSnapStrength: options.gridSnapStrength ?? 0.5,
            layerDeviation: options.layerDeviation ?? 50,
            edgeLength: options.edgeLength ?? 150,
            repulsionStrength: options.repulsionStrength ?? 1000
        };

        this.nodes = [];
        this.edges = [];
        this.isDragging = false;
        this.draggedNode = null;

        // Bind event handlers with proper types
        this.canvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
        this.canvas.addEventListener('mousemove', this.handleMouseMove.bind(this));
        this.canvas.addEventListener('mouseup', this.handleMouseUp.bind(this));
    }

    addNode(id: number, x?: number, y?: number): void {
        const nodeSize = this.options.nodeSize;
        this.nodes.push({
            id,
            x: x ?? Math.random() * (this.canvas.width - nodeSize * 2) + nodeSize,
            y: y ?? Math.random() * (this.canvas.height - nodeSize * 2) + nodeSize,
            targetX: null,
            targetY: null
        });
    }

    addEdge(sourceId: number, targetId: number): void {
        const sourceIndex = this.nodes.findIndex(node => node.id === sourceId);
        const targetIndex = this.nodes.findIndex(node => node.id === targetId);
 
        if (sourceIndex !== -1 && targetIndex !== -1) {
            this.edges.push({ source: sourceIndex, target: targetIndex });
        }
    }

    private snapToGrid(value: number): number {
        const gridSize = this.options.gridSize;
        return Math.round(value / gridSize) * gridSize;
    }

    private drawArrow(fromX: number, fromY: number, toX: number, toY: number): void {
        const headLength = 10;
        const headAngle = Math.PI / 6;

        // Calculate the angle of the line
        const angle = Math.atan2(toY - fromY, toX - fromX);

        // Draw the line
        this.ctx.beginPath();
        this.ctx.moveTo(fromX, fromY);

        // Calculate midpoints for orthogonal lines
        const midX = (fromX + toX) / 2;
        const midY = (fromY + toY) / 2;

        // Draw path with right angles
        this.ctx.lineTo(midX, fromY); // Horizontal line
        this.ctx.lineTo(midX, toY);   // Vertical line
        this.ctx.lineTo(toX, toY);    // Horizontal line to end

        // Draw the arrowhead
        this.ctx.moveTo(toX, toY);
        this.ctx.lineTo(
            toX - headLength * Math.cos(angle - headAngle),
            toY - headLength * Math.sin(angle - headAngle)
        );
        this.ctx.moveTo(toX, toY);
        this.ctx.lineTo(
            toX - headLength * Math.cos(angle + headAngle),
            toY - headLength * Math.sin(angle + headAngle)
        );

        this.ctx.stroke();
    }

    private updatePositions(): void {
        const { nodeSize, verticalSpacing, horizontalSpacing } = this.options;

        // Simple layered layout
        const layers: Record<number, number> = {};
        let maxLayer = 0;

        // Assign initial layers based on incoming edges
        this.nodes.forEach((_, index) => {
            const incomingEdges = this.edges.filter(e => e.target === index);
            const layer = incomingEdges.length === 0 ? 0 : 
                Math.max(...incomingEdges.map(e => (layers[e.source] || 0))) + 1;
            layers[index] = layer;
            maxLayer = Math.max(maxLayer, layer);
        });

        // Position nodes based on layers
        const nodesInLayer = new Array(maxLayer + 1).fill(0);
        this.nodes.forEach((node, index) => {
            const layer = layers[index];
            const nodesInThisLayer = this.nodes.filter((_, i) => layers[i] === layer).length;
            const position = nodesInLayer[layer]++;
            
            // Calculate target position
            const targetX = (layer * horizontalSpacing) + nodeSize;
            const targetY = (position * verticalSpacing) + nodeSize;
            
            // Smooth movement
            node.x += (targetX - node.x) * 0.1;
            node.y += (targetY - node.y) * 0.1;
            
            // Snap to grid if enabled
            if (this.options.snapToGrid) {
                node.x = this.snapToGrid(node.x);
                node.y = this.snapToGrid(node.y);
            }
        });
    }

    private draw(): void {
        const { nodeSize, nodeColor, edgeColor } = this.options;
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw grid
        this.ctx.strokeStyle = '#eee';
        this.ctx.lineWidth = 1;
        for (let x = 0; x < this.canvas.width; x += this.options.gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, this.canvas.height);
            this.ctx.stroke();
        }
        for (let y = 0; y < this.canvas.height; y += this.options.gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(this.canvas.width, y);
            this.ctx.stroke();
        }

        // Draw edges with arrows
        this.ctx.strokeStyle = edgeColor;
        this.ctx.lineWidth = 2;
        this.edges.forEach(edge => {
            const source = this.nodes[edge.source];
            const target = this.nodes[edge.target];
            this.drawArrow(source.x, source.y, target.x, target.y);
        });

        // Draw nodes (squares)
        this.nodes.forEach(node => {
            // Draw square node
            this.ctx.fillStyle = nodeColor;
            this.ctx.strokeStyle = '#000';
            this.ctx.lineWidth = 2;
            const halfSize = nodeSize / 2;
            this.ctx.beginPath();
            this.ctx.rect(node.x - halfSize, node.y - halfSize, nodeSize, nodeSize);
            this.ctx.fill();
            this.ctx.stroke();

            // Draw label
            this.ctx.fillStyle = '#fff';
            this.ctx.font = '16px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(node.id.toString(), node.x, node.y);
        });
    }

    private handleMouseDown(event: MouseEvent): void {
        const rect = this.canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        const halfSize = this.options.nodeSize / 2;

        this.nodes.forEach((node, index) => {
            if (x >= node.x - halfSize && x <= node.x + halfSize &&
                y >= node.y - halfSize && y <= node.y + halfSize) {
                this.isDragging = true;
                this.draggedNode = index;
            }
        });
    }

    private handleMouseMove(event: MouseEvent): void {
        if (!this.isDragging || this.draggedNode === null) return;

        const rect = this.canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        this.nodes[this.draggedNode].x = this.options.snapToGrid ? this.snapToGrid(x) : x;
        this.nodes[this.draggedNode].y = this.options.snapToGrid ? this.snapToGrid(y) : y;
    }

    private handleMouseUp(): void {
        this.isDragging = false;
        this.draggedNode = null;
    }

    start(): void {
        const animate = () => {
            this.updatePositions();
            this.draw();
            requestAnimationFrame(animate);
        };
        animate();
    }

    clear(): void {
        this.nodes = [];
        this.edges = [];
    }


    // Method to adjust flexibility dynamically
    setFlexibility(value: number): void {
        this.options.flexibility = Math.max(0, Math.min(1, value));
    }

    // Method to adjust grid snap strength
    setGridSnapStrength(value: number): void {
        this.options.gridSnapStrength = Math.max(0, Math.min(1, value));
    }
}

// Example usage:
/*
const graph = new FlowchartGraph('graphCanvas', {
    nodeSize: 60,
    gridSize: 20,
    snapToGrid: true,
    verticalSpacing: 100,
    horizontalSpacing: 200
});

function setupInitialGraph(): void {
    graph.addNode(1, 100, 100);
    graph.addNode(2, 300, 100);
    graph.addNode(3, 500, 200);
    graph.addNode(4, 300, 300);

    graph.addEdge(1, 2);
    graph.addEdge(2, 3);
    graph.addEdge(3, 4);
    graph.addEdge(1, 4);
}

setupInitialGraph();
graph.start();
*/

export { FlowchartGraph, type Node, type Edge, type GraphOptions };
