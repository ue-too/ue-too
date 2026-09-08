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
    preconditions?: string[];
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

/**
 * Builds an edge's display label: the event name, its preconditions
 * (joined with ∧) when the source state declares any, and the routing
 * guard in brackets for eventGuards edges.
 * e.g. `withdraw if hasFunds [isOverdrawn]`
 */
function edgeLabel(edge: {
    event: string;
    guard?: string;
    preconditions?: string[];
}): string {
    let label = edge.event;
    if (edge.preconditions && edge.preconditions.length > 0) {
        label += ` if ${edge.preconditions.join(' ∧ ')}`;
    }
    if (edge.guard) {
        label += ` [${edge.guard}]`;
    }
    return label;
}

type Point = { x: number; y: number };
type Axis = 'horizontal' | 'vertical';

/**
 * The axis a segment must have to meet a node border perpendicularly, plus
 * the unit direction pointing away from the node at that border.
 */
type BorderContact = { axis: Axis; outwardX: number; outwardY: number };

// Two points closer than this on an axis are treated as aligned.
const AXIS_EPSILON = 0.5;

// How far a wrong-axis approach run is lifted off the border so it can
// come into the node perpendicularly.
const PERPENDICULAR_APPROACH = 14;

/**
 * Identifies which border of a node an (on-border) endpoint sits on.
 * Left/right borders demand a horizontal touching segment; top/bottom
 * borders demand a vertical one.
 */
function borderContact(point: Point, node: LaidOutNode): BorderContact {
    const contacts: (BorderContact & { distance: number })[] = [
        {
            distance: Math.abs(point.x - (node.x - node.width / 2)),
            axis: 'horizontal',
            outwardX: -1,
            outwardY: 0,
        },
        {
            distance: Math.abs(point.x - (node.x + node.width / 2)),
            axis: 'horizontal',
            outwardX: 1,
            outwardY: 0,
        },
        {
            distance: Math.abs(point.y - (node.y - node.height / 2)),
            axis: 'vertical',
            outwardX: 0,
            outwardY: -1,
        },
        {
            distance: Math.abs(point.y - (node.y + node.height / 2)),
            axis: 'vertical',
            outwardX: 0,
            outwardY: 1,
        },
    ];
    contacts.sort((a, b) => a.distance - b.distance);
    return contacts[0];
}

function segmentAxis(a: Point, b: Point): Axis {
    return Math.abs(b.y - a.y) < AXIS_EPSILON ? 'horizontal' : 'vertical';
}

/**
 * Converts dagre's freeform waypoint polyline into an axis-aligned path
 * whose first and last segments meet their node borders perpendicularly —
 * horizontal into left/right borders, vertical into top/bottom borders.
 * Collinear points are collapsed, so a typical three-waypoint dagre edge
 * reduces to a clean Z-shaped elbow.
 */
function orthogonalize(
    points: Point[],
    start: BorderContact,
    end: BorderContact
): Point[] {
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
            const firstHop = path.length === 1;
            const lastHop = i === points.length - 1;
            const horizontalFirst = { x: next.x, y: prev.y };
            const verticalFirst = { x: prev.x, y: next.y };
            if (firstHop && lastHop && start.axis === end.axis) {
                // single diagonal hop with matching border axes needs a
                // Z-shape: two elbows through the midpoint
                if (start.axis === 'horizontal') {
                    const midX = (prev.x + next.x) / 2;
                    path.push({ x: midX, y: prev.y }, { x: midX, y: next.y });
                } else {
                    const midY = (prev.y + next.y) / 2;
                    path.push({ x: prev.x, y: midY }, { x: next.x, y: midY });
                }
            } else if (firstHop) {
                path.push(
                    start.axis === 'horizontal'
                        ? horizontalFirst
                        : verticalFirst
                );
            } else if (lastHop) {
                // the elbow before the endpoint decides the final segment
                path.push(
                    end.axis === 'horizontal' ? verticalFirst : horizontalFirst
                );
            } else {
                path.push(horizontalFirst);
            }
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
    return enforcePerpendicularContact(collapsed, start, end);
}

/**
 * Fixes the degenerate case where an approach run lies flat along the
 * border it connects to (e.g. a dead-horizontal run into a top border):
 * the run is lifted outward by a small offset and dropped in
 * perpendicularly. Paths of two points (straight, axis-aligned edges)
 * are left alone.
 */
function enforcePerpendicularContact(
    path: Point[],
    start: BorderContact,
    end: BorderContact
): Point[] {
    if (path.length >= 3) {
        const endPoint = path[path.length - 1];
        const beforeEnd = path[path.length - 2];
        if (segmentAxis(beforeEnd, endPoint) !== end.axis) {
            const liftedX = beforeEnd.x + end.outwardX * PERPENDICULAR_APPROACH;
            const liftedY = beforeEnd.y + end.outwardY * PERPENDICULAR_APPROACH;
            path.splice(
                path.length - 2,
                1,
                { x: liftedX, y: liftedY },
                {
                    x: end.axis === 'vertical' ? endPoint.x : liftedX,
                    y: end.axis === 'vertical' ? liftedY : endPoint.y,
                }
            );
        }
    }
    if (path.length >= 3) {
        const startPoint = path[0];
        const afterStart = path[1];
        if (segmentAxis(startPoint, afterStart) !== start.axis) {
            const liftedX =
                afterStart.x + start.outwardX * PERPENDICULAR_APPROACH;
            const liftedY =
                afterStart.y + start.outwardY * PERPENDICULAR_APPROACH;
            path.splice(
                1,
                1,
                {
                    x: start.axis === 'vertical' ? startPoint.x : liftedX,
                    y: start.axis === 'vertical' ? liftedY : startPoint.y,
                },
                { x: liftedX, y: liftedY }
            );
        }
    }
    return path;
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
        const label = edgeLabel(edge);
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
        const label = edgeLabel(edge);
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
        const sourceContact = borderContact(
            laidOut.points[0],
            nodeById.get(edge.from)!
        );
        const targetContact = borderContact(
            laidOut.points[laidOut.points.length - 1],
            nodeById.get(edge.to)!
        );
        return {
            ...edge,
            label,
            selfLoop: false,
            points: orthogonalize(laidOut.points, sourceContact, targetContact),
            labelX: laidOut.x ?? mid.x,
            labelY: laidOut.y ?? mid.y,
        };
    });

    return { nodes, edges };
}
