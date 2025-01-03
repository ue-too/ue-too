// Define basic interfaces for the graph components
interface Point {
    x: number;
    y: number;
}

interface GraphNode extends Point {
    id: number | string;
    label?: string;
    width?: number;
    height?: number;
    level?: number;  // Tree level for hierarchical layout
    parent?: string | number;  // Parent node in spanning tree
    children?: (string | number)[];  // Child nodes in spanning tree
}

interface Edge {
    source: number | string;
    target: number | string;
    color?: string;
    weight?: number;  // For MST calculation
}

interface RoutedEdge extends Edge {
    points: Point[];
    isTreeEdge?: boolean;  // Whether this edge is part of the spanning tree
}

interface Graph {
    nodes: GraphNode[];
    edges: Edge[];
}

interface LayoutResult {
    nodes: GraphNode[];
    edges: RoutedEdge[];
}

interface RenderOptions {
    nodeRadius: number;
    nodeColor: string;
    nodeBorderColor: string;
    edgeColor: string;
    treeEdgeColor: string;
    backgroundColor: string;
    fontSize: number;
    fontFamily: string;
    showGrid: boolean;
    gridColor: string;
}

class OrthogonalLayout {
    private readonly GRID_SIZE: number;
    private readonly PADDING: number;
    private readonly LEVEL_HEIGHT: number;
    private ctx: CanvasRenderingContext2D;
    private defaultRenderOptions: RenderOptions = {
        nodeRadius: 20,
        nodeColor: '#4299e1',
        nodeBorderColor: '#2b6cb0',
        edgeColor: '#666666',
        treeEdgeColor: '#2b6cb0',
        backgroundColor: '#ffffff',
        fontSize: 14,
        fontFamily: 'Arial',
        showGrid: true,
        gridColor: '#eeeeee'
    };

    constructor(ctx: CanvasRenderingContext2D) {
        this.ctx = ctx;
        this.GRID_SIZE = 50;
        this.PADDING = 20;
        this.LEVEL_HEIGHT = 100;
    }

    public layout(graph: Graph): LayoutResult {
        const nodes = [...graph.nodes];
        const edges = [...graph.edges];

        // Step 1: Create MST using Prim's algorithm
        const mst = this.createMinimumSpanningTree(nodes, edges);
        
        // Step 2: Assign levels and parent-child relationships
        this.assignHierarchicalLevels(nodes, mst);
        
        // Step 3: Position nodes based on tree structure
        this.positionNodesHierarchically(nodes);
        
        // Step 4: Route edges orthogonally
        const routedEdges = this.routeEdges(nodes, edges, mst);
        
        return { nodes, edges: routedEdges };
    }

    private createMinimumSpanningTree(nodes: GraphNode[], edges: Edge[]): Edge[] {
        if (nodes.length === 0) return [];
        
        const mst: Edge[] = [];
        const visited = new Set<string | number>();
        const edgeList = [...edges]; // Create a copy of edges to work with
        
        // Start with the first node
        visited.add(nodes[0].id);

        while (visited.size < nodes.length) {
            let minWeight = Infinity;
            let minEdgeIndex = -1;

            // Find the minimum weight edge that connects a visited node to an unvisited node
            for (let i = 0; i < edgeList.length; i++) {
                const edge = edgeList[i];
                const sourceVisited = visited.has(edge.source);
                const targetVisited = visited.has(edge.target);

                if (sourceVisited !== targetVisited) {
                    const weight = edge.weight || 1;
                    if (weight < minWeight) {
                        minWeight = weight;
                        minEdgeIndex = i;
                    }
                }
            }

            if (minEdgeIndex !== -1) {
                const minEdge = edgeList[minEdgeIndex];
                mst.push(minEdge);
                visited.add(visited.has(minEdge.source) ? minEdge.target : minEdge.source);
                edgeList.splice(minEdgeIndex, 1); // Remove used edge
            } else {
                // Graph might be disconnected, add remaining nodes
                const unvisitedNode = nodes.find(node => !visited.has(node.id));
                if (unvisitedNode) {
                    visited.add(unvisitedNode.id);
                } else {
                    break; // No more nodes to process
                }
            }
        }

        return mst;
    }

    private assignHierarchicalLevels(nodes: GraphNode[], mst: Edge[]): void {
        // Reset all nodes
        nodes.forEach(node => {
            node.level = undefined;
            node.parent = undefined;
            node.children = [];
        });

        // Start with the first node as root
        const root = nodes[0];
        root.level = 0;
        
        const assignLevel = (nodeId: string | number, level: number, parentId?: string | number) => {
            const node = nodes.find(n => n.id === nodeId);
            if (!node || node.level !== undefined) return;

            node.level = level;
            node.parent = parentId;

            // Find children in MST
            mst.forEach(edge => {
                if (edge.source === nodeId) {
                    node.children?.push(edge.target);
                    assignLevel(edge.target, level + 1, nodeId);
                } else if (edge.target === nodeId) {
                    node.children?.push(edge.source);
                    assignLevel(edge.source, level + 1, nodeId);
                }
            });
        };

        assignLevel(root.id, 0);
    }

    private positionNodesHierarchically(nodes: GraphNode[]): void {
        // Group nodes by level
        const levelGroups = new Map<number, GraphNode[]>();
        nodes.forEach(node => {
            const level = node.level ?? 0;
            if (!levelGroups.has(level)) {
                levelGroups.set(level, []);
            }
            levelGroups.get(level)?.push(node);
        });

        // Position nodes level by level
        levelGroups.forEach((levelNodes, level) => {
            const levelWidth = this.ctx.canvas.width - (2 * this.PADDING);
            const nodeSpacing = levelWidth / (levelNodes.length + 1);

            levelNodes.forEach((node, index) => {
                node.x = this.PADDING + ((index + 1) * nodeSpacing);
                node.y = this.PADDING + (level * this.LEVEL_HEIGHT);
            });
        });
    }

    private findOrthogonalRoute(source: GraphNode, target: GraphNode): Point[] {
        const points: Point[] = [];
        points.push({ x: source.x, y: source.y });

        // If nodes are on different levels, use three-segment path
        if (source.level !== target.level) {
            const midY = (source.y + target.y) / 2;
            points.push({ x: source.x, y: midY });
            points.push({ x: target.x, y: midY });
        } else {
            // For nodes on same level, use direct horizontal path
            points.push({ x: target.x, y: source.y });
        }

        points.push({ x: target.x, y: target.y });
        return this.optimizeRoute(points);
    }

    private optimizeRoute(points: Point[]): Point[] {
        for (let i = 1; i < points.length - 1; i++) {
            if (points[i-1].x === points[i].x && points[i].x === points[i+1].x ||
                points[i-1].y === points[i].y && points[i].y === points[i+1].y) {
                points.splice(i, 1);
                i--;
            }
        }
        return points;
    }

    private routeEdges(nodes: GraphNode[], edges: Edge[], mst: Edge[]): RoutedEdge[] {
        return edges.map(edge => {
            const source = nodes.find(n => n.id === edge.source);
            const target = nodes.find(n => n.id === edge.target);
            
            if (!source || !target) {
                throw new Error(`Unable to find nodes for edge ${edge.source} -> ${edge.target}`);
            }

            const isTreeEdge = mst.some(e => 
                (e.source === edge.source && e.target === edge.target) ||
                (e.source === edge.target && e.target === edge.source)
            );
            
            const points = this.findOrthogonalRoute(source, target);
            
            return {
                ...edge,
                points,
                isTreeEdge
            };
        });
    }

    public render(layoutResult: LayoutResult, options: Partial<RenderOptions> = {}): void {
        const renderOpts = { ...this.defaultRenderOptions, ...options };
        const { nodes, edges } = layoutResult;
        const { width, height } = this.ctx.canvas;

        // Clear canvas
        this.ctx.fillStyle = renderOpts.backgroundColor;
        this.ctx.fillRect(0, 0, width, height);

        // Draw grid if enabled
        if (renderOpts.showGrid) {
            this.drawGrid(width, height, renderOpts.gridColor);
        }

        // Draw edges
        edges.forEach(edge => {
            this.ctx.strokeStyle = edge.isTreeEdge ? 
                renderOpts.treeEdgeColor : 
                renderOpts.edgeColor;
            this.drawEdge(edge);
        });

        // Draw nodes
        nodes.forEach(node => {
            this.drawNode(node, renderOpts);
        });
    }

    private drawGrid(width: number, height: number, gridColor: string): void {
        this.ctx.strokeStyle = gridColor;
        this.ctx.lineWidth = 1;

        // Draw vertical grid lines
        for (let x = 0; x <= width; x += this.GRID_SIZE) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, height);
            this.ctx.stroke();
        }

        // Draw horizontal grid lines
        for (let y = 0; y <= height; y += this.GRID_SIZE) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(width, y);
            this.ctx.stroke();
        }
    }

    private drawEdge(edge: RoutedEdge): void {
        const { points } = edge;
        if (points.length < 2) return;

        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.moveTo(points[0].x, points[0].y);

        for (let i = 1; i < points.length; i++) {
            this.ctx.lineTo(points[i].x, points[i].y);
        }

        this.ctx.stroke();
    }

    private drawNode(node: GraphNode, options: typeof this.defaultRenderOptions): void {
        // Draw node circle
        this.ctx.beginPath();
        this.ctx.arc(node.x, node.y, options.nodeRadius, 0, Math.PI * 2);
        this.ctx.fillStyle = options.nodeColor;
        this.ctx.fill();
        this.ctx.strokeStyle = options.nodeBorderColor;
        this.ctx.lineWidth = 2;
        this.ctx.stroke();

        // Draw node label if it exists
        if (node.label) {
            this.ctx.fillStyle = '#ffffff';
            this.ctx.font = `${options.fontSize}px ${options.fontFamily}`;
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(node.label, node.x, node.y);
        }
    }
}


const exampleGraph: Graph = {
    nodes: [
        { id: 1, label: 'A', x: 0, y: 0 },
        { id: 2, label: 'B', x: 0, y: 0 },
        { id: 3, label: 'C', x: 0, y: 0 },
        { id: 4, label: 'D', x: 0, y: 0 },
        { id: 5, label: 'E', x: 0, y: 0 },
        { id: 6, label: 'F', x: 0, y: 0 },
        { id: 7, label: 'G', x: 0, y: 0 },
        { id: 8, label: 'H', x: 0, y: 0 },
        { id: 9, label: 'I', x: 0, y: 0 },
        { id: 10, label: 'J', x: 0, y: 0 },
        { id: 11, label: 'K', x: 0, y: 0 },
        { id: 12, label: 'L', x: 0, y: 0 },
        { id: 13, label: 'M', x: 0, y: 0 },
        { id: 14, label: 'N', x: 0, y: 0 },
        { id: 15, label: 'O', x: 0, y: 0 }
    ],
    edges: [
        // Main connection path
        { source: 1, target: 2 },
        { source: 2, target: 3 },
        { source: 3, target: 4 },
        { source: 4, target: 5 },
        
        // Cross connections
        { source: 1, target: 6 },
        { source: 2, target: 7 },
        { source: 3, target: 8 },
        { source: 4, target: 9 },
        { source: 5, target: 10 },
        
        // Secondary path
        { source: 6, target: 7 },
        { source: 7, target: 8 },
        { source: 8, target: 9 },
        { source: 9, target: 10 },
        
        // Connections to outer nodes
        { source: 11, target: 6 },
        { source: 11, target: 7 },
        { source: 12, target: 8 },
        { source: 12, target: 9 },
        { source: 13, target: 10 },
        
        // Complex cross-connections
        { source: 14, target: 11 },
        { source: 14, target: 12 },
        { source: 15, target: 13 },
        { source: 15, target: 14 }
        
    ]
};

export { OrthogonalLayout, exampleGraph };
