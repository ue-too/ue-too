import { LaidOutEdge, LaidOutGraph } from './layout';

export type Flash = { edgeIndex: number; at: number } | null;

const FLASH_DURATION_MS = 800;

const COLORS = {
    nodeFill: '#f8fafc',
    nodeStroke: '#64748b',
    nodeText: '#0f172a',
    activeFill: '#dbeafe',
    activeStroke: '#2563eb',
    edge: '#94a3b8',
    edgeLabel: '#475569',
    flash: '#2563eb',
};

function edgePath(ctx: CanvasRenderingContext2D, edge: LaidOutEdge): void {
    const pts = edge.points;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    if (edge.selfLoop) {
        // single control point loop: start -> control -> end
        ctx.quadraticCurveTo(pts[1].x, pts[1].y, pts[2].x, pts[2].y);
        return;
    }
    // smooth polyline: quadratic curves through midpoints
    for (let i = 1; i < pts.length - 1; i++) {
        const midX = (pts[i].x + pts[i + 1].x) / 2;
        const midY = (pts[i].y + pts[i + 1].y) / 2;
        ctx.quadraticCurveTo(pts[i].x, pts[i].y, midX, midY);
    }
    const last = pts[pts.length - 1];
    ctx.lineTo(last.x, last.y);
}

function drawArrowhead(ctx: CanvasRenderingContext2D, edge: LaidOutEdge): void {
    const pts = edge.points;
    const tip = pts[pts.length - 1];
    const prev = edge.selfLoop ? pts[1] : pts[pts.length - 2];
    const angle = Math.atan2(tip.y - prev.y, tip.x - prev.x);
    const size = 8;
    ctx.beginPath();
    ctx.moveTo(tip.x, tip.y);
    ctx.lineTo(
        tip.x - size * Math.cos(angle - Math.PI / 6),
        tip.y - size * Math.sin(angle - Math.PI / 6)
    );
    ctx.lineTo(
        tip.x - size * Math.cos(angle + Math.PI / 6),
        tip.y - size * Math.sin(angle + Math.PI / 6)
    );
    ctx.closePath();
    ctx.fill();
}

export function drawGraph(
    ctx: CanvasRenderingContext2D,
    layout: LaidOutGraph,
    currentState: string | null,
    flash: Flash,
    now: number
): void {
    ctx.save();
    ctx.font = '13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    layout.edges.forEach((edge, i) => {
        const flashing =
            flash !== null &&
            flash.edgeIndex === i &&
            now - flash.at < FLASH_DURATION_MS;
        ctx.strokeStyle = COLORS.edge;
        ctx.fillStyle = COLORS.edge;
        ctx.lineWidth = 1.5;
        edgePath(ctx, edge);
        ctx.stroke();
        drawArrowhead(ctx, edge);
        if (flashing) {
            const t = (now - flash!.at) / FLASH_DURATION_MS;
            ctx.save();
            ctx.globalAlpha = 1 - t;
            ctx.strokeStyle = COLORS.flash;
            ctx.fillStyle = COLORS.flash;
            ctx.lineWidth = 3;
            edgePath(ctx, edge);
            ctx.stroke();
            drawArrowhead(ctx, edge);
            ctx.restore();
        }
        // label with a knockout halo so it stays readable over edges
        ctx.save();
        ctx.fillStyle = COLORS.edgeLabel;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 4;
        ctx.strokeText(edge.label, edge.labelX, edge.labelY);
        ctx.fillText(edge.label, edge.labelX, edge.labelY);
        ctx.restore();
    });

    for (const node of layout.nodes) {
        const active = node.id === currentState;
        const left = node.x - node.width / 2;
        const top = node.y - node.height / 2;
        ctx.fillStyle = active ? COLORS.activeFill : COLORS.nodeFill;
        ctx.strokeStyle = active ? COLORS.activeStroke : COLORS.nodeStroke;
        ctx.lineWidth = active ? 2.5 : 1.5;
        ctx.beginPath();
        ctx.roundRect(left, top, node.width, node.height, 10);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = COLORS.nodeText;
        ctx.fillText(node.id, node.x, node.y);
    }

    ctx.restore();
}
