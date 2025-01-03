
import FlowGraph from '../src/being/flowgraph';
import { UserInputStateMachine } from 'src/input-state-machine';

// Create and initialize the graph
const graph = new FlowGraph('graphCanvas');

const canvas = document.getElementById('graphCanvas') as HTMLCanvasElement;

canvas.width = window.innerWidth * 0.8;
canvas.height = window.innerHeight * 0.8;

// Add some example nodes
graph.addNode('start', 'Start', 'pill');
graph.addNode('process1', 'Process 1', 'rectangular');
graph.addNode('decision', 'Decision', 'pill');
graph.addNode('process2A', 'Process 2A', 'rectangular');
graph.addNode('process2B', 'Process 2B', 'rectangular');
graph.addNode('end', 'End', 'pill');

// Add edges
graph.addEdge('start', 'process1', 'Initialize');
graph.addEdge('process1', 'decision', 'Check condition');
graph.addEdge('decision', 'process2A', 'Yes');
graph.addEdge('decision', 'process2B', 'No');
graph.addEdge('process2A', 'end', 'Complete A');
graph.addEdge('process2B', 'end', 'Complete B');

graph.addNode('idle', 'Idle', 'pill');

// Layout and render the graph
graph.layout();
graph.render();

// Handle window resize
window.addEventListener('resize', () => {
    graph.layout();
    graph.render();
});
