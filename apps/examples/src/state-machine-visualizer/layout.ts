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

type Point = { x: number; y: number };

// Two points closer than this on an axis are treated as aligned.
const AXIS_EPSILON = 0.5;

/**
 * Converts dagre's freeform waypoint polyline into an axis-aligned path.
 * Each hop between waypoints becomes one or two orthogonal segments —
 * horizontal-then-vertical, except the final hop which is
 * vertical-then-horizontal so edges always enter their target node
 * horizontally. Collinear points are collapsed afterwards, so a typical
 * three-waypoint dagre edge reduces to a clean Z-shaped elbow.
 */
function orthogonalize(points: Point[]): Point[] {
    const path: Point[] = [points[0]];
    for (let i = 1; i < points.length; i++) {
        const prev = path[path.length - 1];
        const next = points[i];
        const dx = Math.abs(next.x - prev.x);
        const dy = Math.abs(next.y - prev.y);
        if (dx < AXIS_EPSILON && dy < AXIS_EPSILON) {
            continue;
        }
        if (dx >= AXIS_EPSILON && dy >= AXIS_EPSILON) {
            const lastHop = i === points.length - 1;
            path.push(
                lastHop ? { x: prev.x, y: next.y } : { x: next.x, y: prev.y }
            );
        }
        path.push(next);
    }
    // collapse runs of collinear points
    const collapsed: Point[] = [path[0]];
    for (let i = 1; i < path.length - 1; i++) {
        const a = collapsed[collapsed.length - 1];
        const b = path[i];
        const c = path[i + 1];
        const collinear =
            (Math.abs(a.x - b.x) < AXIS_EPSILON &&
                Math.abs(b.x - c.x) < AXIS_EPSILON) ||
            (Math.abs(a.y - b.y) < AXIS_EPSILON &&
                Math.abs(b.y - c.y) < AXIS_EPSILON);
        if (!collinear) {
            collapsed.push(b);
        }
    }
    collapsed.push(path[path.length - 1]);
    return collapsed;
}

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

    // successive self-loops on the same node stack outward so their
    // rectangles and labels don't overlap
    const selfLoopIndexByNode = new Map<string, number>();

    const edges: LaidOutEdge[] = graph.edges.map((edge, i) => {
        const label = edge.guard ? `${edge.event} [${edge.guard}]` : edge.event;
        if (edge.from === edge.to) {
            const n = nodeById.get(edge.from)!;
            const cornerX = n.x + n.width / 2;
            const cornerY = n.y - n.height / 2;
            const loopIndex = selfLoopIndexByNode.get(edge.from) ?? 0;
            selfLoopIndexByNode.set(edge.from, loopIndex + 1);
            const exitX = cornerX - 16 - loopIndex * 10;
            const topY = cornerY - 24 - loopIndex * 20;
            const rightX = cornerX + 24 + loopIndex * 20;
            const entryY = cornerY + 12 + loopIndex * 10;
            // rectangular loop around the node's top-right corner:
            // out of the top edge, over the corner, back into the right edge
            return {
                ...edge,
                label,
                selfLoop: true,
                points: [
                    { x: exitX, y: cornerY },
                    { x: exitX, y: topY },
                    { x: rightX, y: topY },
                    { x: rightX, y: entryY },
                    { x: cornerX, y: entryY },
                ],
                labelX: (exitX + rightX) / 2,
                labelY: topY - 10,
            };
        }
        const laidOut = g.edge(edge.from, edge.to, `e${i}`);
        const mid = laidOut.points[Math.floor(laidOut.points.length / 2)];
        return {
            ...edge,
            label,
            selfLoop: false,
            points: orthogonalize(laidOut.points),
            labelX: laidOut.x ?? mid.x,
            labelY: laidOut.y ?? mid.y,
        };
    });

    return { nodes, edges };
}
