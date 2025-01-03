type NodeType = 'rectangular' | 'pill';

interface Node {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
    label: string;
    type: NodeType;
    vx: number;  // velocity x
    vy: number;  // velocity y
    fx: number | null;  // fixed x position (null if not fixed)
    fy: number | null;  // fixed y position (null if not fixed)
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

class ForceGraph {
    private nodes: Map<string, Node> = new Map();
    private edges: Edge[] = [];
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private readonly NODE_WIDTH = 150;
    private readonly NODE_HEIGHT = 60;
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

    // Force simulation parameters
    private readonly REPULSION = 1000;  // Node repulsion force
    private readonly SPRING_LENGTH = 200;  // Desired edge length
    private readonly SPRING_STRENGTH = 0.1;  // Edge spring force
    private readonly DAMPING = 0.8;  // Velocity damping
    private readonly CENTER_GRAVITY = 0.03;  // Force pulling nodes to center
    private isSimulating: boolean = false;

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
            ? Math.max(textMetrics.width * 2, this.NODE_WIDTH * 0.3)
            : Math.max(textMetrics.width, this.NODE_WIDTH);

        this.nodes.set(id, {
            id,
            x: Math.random() * this.canvas.width,
            y: Math.random() * this.canvas.height,
            width: nodeWidth,
            height: type === 'pill' ? this.NODE_HEIGHT * 0.5 : this.NODE_HEIGHT,
            label,
            type,
            vx: 0,
            vy: 0,
            fx: null,
            fy: null
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

    private applyForces(): void {
        const nodes = Array.from(this.nodes.values());
        
        // Reset forces
        nodes.forEach(node => {
            node.vx = node.vx * this.DAMPING;
            node.vy = node.vy * this.DAMPING;
        });

        // Apply repulsion between nodes
        for (let i = 0; i < nodes.length; i++) {
            for (let j = i + 1; j < nodes.length; j++) {
                const nodeA = nodes[i];
                const nodeB = nodes[j];
                const dx = nodeB.x - nodeA.x;
                const dy = nodeB.y - nodeA.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                if (distance === 0) continue;

                const force = this.REPULSION / (distance * distance);
                const forceX = (dx / distance) * force;
                const forceY = (dy / distance) * force;

                if (!nodeA.fx) nodeA.vx -= forceX;
                if (!nodeA.fy) nodeA.vy -= forceY;
                if (!nodeB.fx) nodeB.vx += forceX;
                if (!nodeB.fy) nodeB.vy += forceY;
            }
        }

        // Apply spring forces for edges
        this.edges.forEach(edge => {
            const source = this.nodes.get(edge.from)!;
            const target = this.nodes.get(edge.to)!;
            const dx = target.x - source.x;
            const dy = target.y - source.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance === 0) return;

            const force = (distance - this.SPRING_LENGTH) * this.SPRING_STRENGTH;
            const forceX = (dx / distance) * force;
            const forceY = (dy / distance) * force;

            if (!source.fx) {
                source.vx += forceX;
                source.vy += forceY;
            }
            if (!target.fx) {
                target.vx -= forceX;
                target.vy -= forceY;
            }
        });

        // Apply center gravity
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
        nodes.forEach(node => {
            if (!node.fx) {
                node.vx += (centerX - node.x) * this.CENTER_GRAVITY;
                node.vy += (centerY - node.y) * this.CENTER_GRAVITY;
            }
        });

        // Update positions
        nodes.forEach(node => {
            if (!node.fx) node.x += node.vx;
            if (!node.fy) node.y += node.vy;
        });
    }

    private calculateEdgePoints(): void {
        this.edges.forEach(edge => {
            const source = this.nodes.get(edge.from)!;
            const target = this.nodes.get(edge.to)!;
            
            // Simple straight line with arrow
            edge.points = [
                { x: source.x, y: source.y },
                { x: target.x, y: target.y }
            ];
        });
    }

    layout(): void {
        if (!this.isSimulating) {
            this.isSimulating = true;
            const simulate = () => {
                this.applyForces();
                this.calculateEdgePoints();
                if (this.isSimulating) {
                    requestAnimationFrame(simulate);
                }
            };
            simulate();
        }
    }

    stopLayout(): void {
        this.isSimulating = false;
    }

    render(): void {
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw edges
        this.edges.forEach(edge => {
            const source = this.nodes.get(edge.from)!;
            const target = this.nodes.get(edge.to)!;

            // Draw edge line
            this.ctx.beginPath();
            this.ctx.moveTo(source.x, source.y);
            this.ctx.lineTo(target.x, target.y);
            this.ctx.strokeStyle = edge.color || '#666';
            this.ctx.stroke();

            // Draw arrow
            const angle = Math.atan2(target.y - source.y, target.x - source.x);
            const arrowSize = 8;
            this.ctx.beginPath();
            this.ctx.moveTo(target.x, target.y);
            this.ctx.lineTo(
                target.x - arrowSize * Math.cos(angle - Math.PI / 6),
                target.y - arrowSize * Math.sin(angle - Math.PI / 6)
            );
            this.ctx.lineTo(
                target.x - arrowSize * Math.cos(angle + Math.PI / 6),
                target.y - arrowSize * Math.sin(angle + Math.PI / 6)
            );
            this.ctx.closePath();
            this.ctx.fillStyle = edge.color || '#666';
            this.ctx.fill();

            // Draw edge label if it exists
            if (edge.label) {
                const midX = (source.x + target.x) / 2;
                const midY = (source.y + target.y) / 2;
                
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
                
                this.ctx.fillStyle = '#333';
                this.ctx.textAlign = 'center';
                this.ctx.textBaseline = 'middle';
                this.ctx.fillText(edge.label, midX, midY);
            }
        });

        // Draw nodes
        this.nodes.forEach(node => {
            this.ctx.fillStyle = '#fff';
            this.ctx.strokeStyle = '#333';
            this.ctx.lineWidth = 2;
            
            const halfWidth = node.width / 2;
            const halfHeight = node.height / 2;

            if (node.type === 'pill') {
                const radius = node.height / 2;
                this.ctx.beginPath();
                this.ctx.arc(
                    node.x - halfWidth + radius,
                    node.y,
                    radius,
                    Math.PI / 2,
                    Math.PI * 1.5
                );
                this.ctx.lineTo(node.x + halfWidth - radius, node.y - radius);
                this.ctx.arc(
                    node.x + halfWidth - radius,
                    node.y,
                    radius,
                    Math.PI * 1.5,
                    Math.PI / 2
                );
                this.ctx.closePath();
            } else {
                this.ctx.beginPath();
                this.ctx.roundRect(
                    node.x - halfWidth,
                    node.y - halfHeight,
                    node.width,
                    node.height,
                    8
                );
            }
            
            this.ctx.fill();
            this.ctx.stroke();

            // Draw node label
            this.ctx.fillStyle = '#333';
            this.ctx.font = node.type === 'pill' ? '12px Arial' : '14px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(node.label, node.x, node.y);
        });
    }
}

export default ForceGraph; 