import dagre from '@dagrejs/dagre';
import { MachineGraph } from '@ue-too/being';

export type LaidOutNode = {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
};

export type LaidOutEdge = {
    from: string;
    to: string;
    event: string;
    guard?: string;
    points: { x: number; y: number }[];
    selfLoop: boolean;
    labelX: number;
    labelY: number;
    label: string;
};

export type LaidOutGraph = {
    nodes: LaidOutNode[];
    edges: LaidOutEdge[];
};

const NODE_PADDING_X = 24;
const NODE_HEIGHT = 44;

export function layoutGraph(
    graph: MachineGraph,
    measureText: (text: string) => number
): LaidOutGraph {
    const g = new dagre.graphlib.Graph({ multigraph: true });
    g.setGraph({ rankdir: 'LR', nodesep: 40, ranksep: 90, edgesep: 20 });
    g.setDefaultEdgeLabel(() => ({}));

    for (const node of graph.nodes) {
        g.setNode(node.id, {
            width: measureText(node.id) + NODE_PADDING_X * 2,
            height: NODE_HEIGHT,
        });
    }
    graph.edges.forEach((edge, i) => {
        if (edge.from === edge.to) {
            return; // self-loops are drawn manually, not laid out by dagre
        }
        const label = edge.guard ? `${edge.event} [${edge.guard}]` : edge.event;
        g.setEdge(
            edge.from,
            edge.to,
            { width: measureText(label), height: 16, labelpos: 'c' },
            `e${i}`
        );
    });

    dagre.layout(g);

    const nodes: LaidOutNode[] = graph.nodes.map(n => {
        const { x, y, width, height } = g.node(n.id);
        return { id: n.id, x, y, width, height };
    });
    const nodeById = new Map(nodes.map(n => [n.id, n]));

    const edges: LaidOutEdge[] = graph.edges.map((edge, i) => {
        const label = edge.guard ? `${edge.event} [${edge.guard}]` : edge.event;
        if (edge.from === edge.to) {
            const n = nodeById.get(edge.from)!;
            const cornerX = n.x + n.width / 2;
            const cornerY = n.y - n.height / 2;
            return {
                ...edge,
                label,
                selfLoop: true,
                points: [
                    { x: cornerX - 12, y: cornerY },
                    { x: cornerX + 28, y: cornerY - 32 },
                    { x: cornerX, y: cornerY + 12 },
                ],
                labelX: cornerX + 34,
                labelY: cornerY - 36,
            };
        }
        const laidOut = g.edge(edge.from, edge.to, `e${i}`);
        const mid = laidOut.points[Math.floor(laidOut.points.length / 2)];
        return {
            ...edge,
            label,
            selfLoop: false,
            points: laidOut.points,
            labelX: laidOut.x ?? mid.x,
            labelY: laidOut.y ?? mid.y,
        };
    });

    return { nodes, edges };
}
