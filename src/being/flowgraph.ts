// graph.ts
type NodeType = 'rectangular' | 'pill';

interface Node {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
    level?: number;
    label: string;
    type: NodeType;
}

interface Edge {
    from: string;
    to: string;
    points: Point[];
    label?: string;
    color?: string;
}

interface Point {
    x: number;
    y: number;
}

class FlowGraph {
    private nodes: Map<string, Node> = new Map();
    private edges: Edge[] = [];
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private readonly LEVEL_HEIGHT = 120;
    private readonly NODE_WIDTH = 150;
    private readonly NODE_HEIGHT = 60;
    private readonly NODE_SPACING = 50;
    private readonly COLORS = [
        '#4285f4', // Google Blue
        '#ea4335', // Google Red
        '#fbbc05', // Google Yellow
        '#34a853', // Google Green
        '#ff6d01', // Orange
        '#46bdc6', // Turquoise
        '#7b1fa2', // Purple
        '#c2185b', // Pink
    ];

    constructor(canvasId: string) {
        this.canvas = document.getElementById(canvasId) as HTMLCanvasElement;
        this.ctx = this.canvas.getContext('2d')!;
    }

    addNode(id: string, label: string, type: NodeType = 'rectangular'): void {
        const originalFontSize = this.ctx.font;
        this.ctx.font = type === 'pill' ? '12px Arial' : '14px Arial';
        const textMetrics = this.ctx.measureText(label);
        this.ctx.font = originalFontSize;
        const nodeWidth = type === 'pill' 
            ? (textMetrics.width * 2 < this.NODE_WIDTH * 0.3 ? this.NODE_WIDTH * 0.3 : textMetrics.width * 2) 
            : Math.max(textMetrics.width, this.NODE_WIDTH);
        this.nodes.set(id, {
            id,
            x: 0,
            y: 0,
            width: nodeWidth,
            height: type === 'pill' ? this.NODE_HEIGHT * 0.5 : this.NODE_HEIGHT,
            label,
            type
        });
    }

    addEdge(fromId: string, toId: string, label?: string): void {
        this.edges.push({
            from: fromId,
            to: toId,
            points: [],
            label,
            color: this.COLORS[this.edges.length % this.COLORS.length]
        });
    }

    private assignLevels(): void {
        // Find root nodes (nodes with no incoming edges)
        const incomingEdges = new Map<string, number>();
        this.edges.forEach(edge => {
            incomingEdges.set(edge.to, (incomingEdges.get(edge.to) || 0) + 1);
        });

        const roots = Array.from(this.nodes.keys())
            .filter(nodeId => !incomingEdges.has(nodeId));

        // Assign levels using BFS
        const queue: string[] = [...roots];
        const visited = new Set<string>();
        let currentLevel = 0;

        while (queue.length > 0) {
            const levelSize = queue.length;
            for (let i = 0; i < levelSize; i++) {
                const nodeId = queue.shift()!;
                if (visited.has(nodeId)) continue;

                const node = this.nodes.get(nodeId)!;
                node.level = currentLevel;
                visited.add(nodeId);

                // Add children to queue
                this.edges
                    .filter(edge => edge.from === nodeId)
                    .forEach(edge => queue.push(edge.to));
            }
            currentLevel++;
        }
    }

    private calculateBarycenter(nodeId: string, previousLevelNodes: Node[]): number {
        // Find all incoming edges to this node
        const incomingEdges = this.edges.filter(edge => edge.to === nodeId);
        
        if (incomingEdges.length === 0) {
            // If no incoming edges, use the middle position
            return previousLevelNodes.length / 2;
        }

        // Calculate average position of connected nodes
        const connectedPositions = incomingEdges.map(edge => {
            const sourceNode = this.nodes.get(edge.from)!;
            return previousLevelNodes.findIndex(node => node.id === sourceNode.id);
        });

        return connectedPositions.reduce((sum, pos) => sum + pos, 0) / connectedPositions.length;
    }

    private calculateNodePositions(): void {
        // Group nodes by level
        const levelGroups = new Map<number, Node[]>();
        this.nodes.forEach(node => {
            if (node.level === undefined) return;
            if (!levelGroups.has(node.level)) {
                levelGroups.set(node.level, []);
            }
            levelGroups.get(node.level)!.push(node);
        });

        // Process levels from top to bottom
        const levels = Array.from(levelGroups.keys()).sort((a, b) => a - b);
        
        // Initial positioning of first level
        const firstLevelNodes = levelGroups.get(levels[0])!;
        let totalWidth = firstLevelNodes.reduce((sum, node) => sum + node.width, 0) + 
                        (firstLevelNodes.length - 1) * this.NODE_SPACING;
        let startX = (this.canvas.width - totalWidth) / 2;
        firstLevelNodes.forEach(node => {
            node.x = startX;
            node.y = node.level! * this.LEVEL_HEIGHT + 50;
            startX += node.width + this.NODE_SPACING;
        });

        // Process subsequent levels to minimize crossings
        for (let i = 1; i < levels.length; i++) {
            const currentLevel = levels[i];
            const currentNodes = levelGroups.get(currentLevel)!;
            const prevLevelNodes = levelGroups.get(levels[i-1])!;
            
            // Calculate optimal positions based on connected nodes
            const nodePositions = new Map<string, number>();
            currentNodes.forEach(node => {
                const incomingEdges = this.edges.filter(edge => edge.to === node.id);
                if (incomingEdges.length > 0) {
                    // Calculate average x position of connected nodes from previous level
                    const avgX = incomingEdges.reduce((sum, edge) => {
                        const sourceNode = this.nodes.get(edge.from)!;
                        return sum + (sourceNode.x + sourceNode.width / 2);
                    }, 0) / incomingEdges.length;
                    nodePositions.set(node.id, avgX);
                }
            });

            // Sort nodes based on their optimal positions
            currentNodes.sort((a, b) => {
                const posA = nodePositions.get(a.id) ?? 0;
                const posB = nodePositions.get(b.id) ?? 0;
                return posA - posB;
            });

            // Position nodes with minimum spacing
            totalWidth = currentNodes.reduce((sum, node) => sum + node.width, 0) + 
                        (currentNodes.length - 1) * this.NODE_SPACING;
            startX = (this.canvas.width - totalWidth) / 2;
            currentNodes.forEach(node => {
                node.x = startX;
                node.y = currentLevel * this.LEVEL_HEIGHT + 50;
                startX += node.width + this.NODE_SPACING;
            });
        }
    }

    private isPointInsideNode(point: Point, node: Node, padding: number = 10): boolean {
        return point.x >= node.x - padding &&
               point.x <= node.x + node.width + padding &&
               point.y >= node.y - padding &&
               point.y <= node.y + node.height + padding;
    }

    private findPathAroundNode(edge: Edge, node: Node, point: Point, nextPoint: Point): Point[] {
        const padding = 20;
        const points: Point[] = [];
        
        // Determine if we should go left or right of the node
        const goLeft = point.x < node.x + node.width / 2;
        const xOffset = goLeft ? node.x - padding : node.x + node.width + padding;
        
        // Add points to route around the node
        points.push(
            { x: xOffset, y: point.y },
            { x: xOffset, y: nextPoint.y }
        );
        
        return points;
    }

    private calculateEdgePoints(): void {
        const edgeGroups = new Map<string, Edge[]>();
        
        this.edges.forEach(edge => {
            const fromNode = this.nodes.get(edge.from)!;
            const toNode = this.nodes.get(edge.to)!;
            const key = `${fromNode.level}-${toNode.level}`;
            if (!edgeGroups.has(key)) {
                edgeGroups.set(key, []);
            }
            edgeGroups.get(key)!.push(edge);
        });

        edgeGroups.forEach((edges, _) => {
            const totalEdges = edges.length;
            edges.forEach((edge, index) => {
                const fromNode = this.nodes.get(edge.from)!;
                const toNode = this.nodes.get(edge.to)!;
                const offset = totalEdges > 1 
                    ? (index - (totalEdges - 1) / 2) * 20
                    : 0;

                const points: Point[] = [];
                
                // Calculate start point along bottom of source node
                const startX = fromNode.x + (fromNode.width * (index + 1)) / (totalEdges + 1);
                points.push({
                    x: startX,
                    y: fromNode.y + fromNode.height
                });

                // Initial vertical segment
                points.push({
                    x: startX,
                    y: fromNode.y + fromNode.height + 20
                });

                // Calculate end point along top of target node
                const endX = toNode.x + (toNode.width * (index + 1)) / (totalEdges + 1);
                
                // Rest of the routing points
                points.push({
                    x: startX + offset,
                    y: fromNode.y + fromNode.height + 20
                });

                const verticalSegment = {
                    x: startX + offset,
                    y: toNode.y - 20
                };

                // Check for intersecting nodes
                const intersectingNodes = Array.from(this.nodes.values()).filter(node => {
                    if (node.id === edge.from || node.id === edge.to) return false;
                    
                    // Check if the vertical segment intersects with this node
                    return this.isPointInsideNode({ x: verticalSegment.x, y: (verticalSegment.y + toNode.y) / 2 }, node);
                });

                if (intersectingNodes.length > 0) {
                    // Sort nodes by vertical position
                    intersectingNodes.sort((a, b) => a.y - b.y);
                    
                    let currentY = verticalSegment.y;
                    intersectingNodes.forEach(node => {
                        // Add points to route around each intersecting node
                        const detourPoints = this.findPathAroundNode(
                            edge,
                            node,
                            { x: verticalSegment.x, y: currentY },
                            { x: verticalSegment.x, y: node.y + node.height + 20 }
                        );
                        points.push(...detourPoints);
                        currentY = node.y + node.height + 20;
                    });
                }

                points.push(verticalSegment);

                // Final horizontal segment to calculated end point
                points.push({
                    x: endX,
                    y: toNode.y - 20
                });

                // End point
                points.push({
                    x: endX,
                    y: toNode.y
                });

                edge.points = points;
            });
        });
    }

    layout(): void {
        this.assignLevels();
        this.calculateNodePositions();
        this.calculateEdgePoints();
    }

    render(): void {
        // Draw edges
        this.edges.forEach(edge => {
            // Draw edge segments
            this.ctx.beginPath();
            this.ctx.moveTo(edge.points[0].x, edge.points[0].y);
            for (let i = 1; i < edge.points.length; i++) {
                this.ctx.lineTo(edge.points[i].x, edge.points[i].y);
            }
            this.ctx.strokeStyle = edge.color || '#666';
            this.ctx.stroke();

            // Draw edge label if it exists
            if (edge.label) {
                // Find the middle segment of the edge
                const midIndex = Math.floor(edge.points.length / 2) - 1;
                const startPoint = edge.points[midIndex];
                const endPoint = edge.points[midIndex + 1];
                
                // Calculate the middle point of the segment
                const midX = (startPoint.x + endPoint.x) / 2;
                const midY = (startPoint.y + endPoint.y) / 2;

                // Draw label background
                this.ctx.font = '12px Arial';
                const textMetrics = this.ctx.measureText(edge.label);
                const padding = 4;
                this.ctx.fillStyle = 'white';
                this.ctx.fillRect(
                    midX - textMetrics.width / 2 - padding,
                    midY - 8 - padding,
                    textMetrics.width + padding * 2,
                    16 + padding * 2
                );

                // Draw label text
                this.ctx.fillStyle = '#333';
                this.ctx.textAlign = 'center';
                this.ctx.textBaseline = 'middle';
                this.ctx.fillText(edge.label, midX, midY);
            }

            // Draw arrow at the end
            const lastPoint = edge.points[edge.points.length - 1];
            const arrowSize = 8;
            this.ctx.beginPath();
            this.ctx.moveTo(lastPoint.x, lastPoint.y);
            this.ctx.lineTo(lastPoint.x - arrowSize, lastPoint.y - arrowSize);
            this.ctx.lineTo(lastPoint.x + arrowSize, lastPoint.y - arrowSize);
            this.ctx.closePath();
            this.ctx.fillStyle = edge.color || '#666';
            this.ctx.fill();

        });

        // Draw nodes
        this.nodes.forEach(node => {
            // Draw node shape
            this.ctx.fillStyle = '#fff';
            this.ctx.strokeStyle = '#333';
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            
            if (node.type === 'pill') {
                const radius = node.height / 2;
                this.ctx.arc(
                    node.x + radius, 
                    node.y + radius, 
                    radius, 
                    Math.PI / 2, 
                    Math.PI * 1.5
                );
                this.ctx.lineTo(node.x + node.width - radius, node.y);
                this.ctx.arc(
                    node.x + node.width - radius,
                    node.y + radius,
                    radius,
                    Math.PI * 1.5,
                    Math.PI / 2
                );
                this.ctx.lineTo(node.x + radius, node.y + node.height);
                this.ctx.closePath();
            } else {
                this.ctx.roundRect(node.x, node.y, node.width, node.height, 8);
            }
            
            this.ctx.fill();
            this.ctx.stroke();

            // Draw node label
            this.ctx.fillStyle = '#333';
            this.ctx.font = node.type === 'pill' ? '12px Arial' : '14px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(
                node.label,
                node.x + node.width / 2,
                node.y + node.height / 2
            );
        });
    }
}

export default FlowGraph;
