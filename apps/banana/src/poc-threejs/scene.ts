/**
 * Three.js scene: top-down orthographic camera, ground plane, tracks and preview.
 * Self-contained; no banana imports.
 */

import * as THREE from 'three';
import type { Point, TrackSegment } from './types';
import type { TrackState } from './track-state';

const TRACK_WIDTH = 0.15;
const TRACK_COLOR = 0x333333;
const PREVIEW_COLOR = 0x666666;
const GRID_COLOR = 0xcccccc;

export function createScene(container: HTMLElement, trackState: TrackState) {
  const width = container.clientWidth;
  const height = container.clientHeight;
  const aspect = width / height;

  const camera = new THREE.OrthographicCamera(
    -50 * aspect,
    50 * aspect,
    50,
    -50,
    0.1,
    1000
  );
  camera.position.set(0, 100, 0);
  camera.lookAt(0, 0, 0);
  camera.up.set(0, 0, 1);
  camera.updateProjectionMatrix();

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf5f5f0);

  const grid = new THREE.GridHelper(200, 40, GRID_COLOR, GRID_COLOR);
  grid.rotation.x = Math.PI / 2;
  grid.position.set(0, 0, 0);
  scene.add(grid);

  const trackGroup = new THREE.Group();
  scene.add(trackGroup);

  const previewMesh = new THREE.Line(
    new THREE.BufferGeometry(),
    new THREE.LineBasicMaterial({ color: PREVIEW_COLOR, linewidth: 2 })
  );
  previewMesh.visible = false;
  scene.add(previewMesh);

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const intersect = new THREE.Vector3();

  function pointerToWorld(clientX: number, clientY: number): Point {
    pointer.x = (clientX / width) * 2 - 1;
    pointer.y = -(clientY / height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    raycaster.ray.intersectPlane(plane, intersect);
    return { x: intersect.x, y: intersect.z };
  }

  function addSegmentMesh(segment: TrackSegment) {
    const start = new THREE.Vector3(segment.start.x, 0.001, segment.start.y);
    const end = new THREE.Vector3(segment.end.x, 0.001, segment.end.y);
    const halfWidth = TRACK_WIDTH / 2;
    const dir = new THREE.Vector3().subVectors(end, start);
    const length = dir.length();
    if (length < 1e-6) return;
    dir.normalize();
    const perp = new THREE.Vector3(-dir.z, 0, dir.x).multiplyScalar(halfWidth);

    const shape = new THREE.Shape();
    shape.moveTo(start.x + perp.x, start.z + perp.z);
    shape.lineTo(end.x + perp.x, end.z + perp.z);
    shape.lineTo(end.x - perp.x, end.z - perp.z);
    shape.lineTo(start.x - perp.x, start.z - perp.z);
    shape.closePath();

    const geom = new THREE.ShapeGeometry(shape);
    const mat = new THREE.MeshBasicMaterial({
      color: TRACK_COLOR,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = 0.001;
    trackGroup.add(mesh);
  }

  function updatePreview(start: Point, end: Point) {
    const points = [
      new THREE.Vector3(start.x, 0.002, start.y),
      new THREE.Vector3(end.x, 0.002, end.y),
    ];
    previewMesh.geometry.dispose();
    previewMesh.geometry = new THREE.BufferGeometry().setFromPoints(points);
    previewMesh.visible = true;
  }

  function hidePreview() {
    previewMesh.visible = false;
  }

  function syncFromState() {
    const snap = trackState.getSnapshot();

    while (trackGroup.children.length > 0) {
      const child = trackGroup.children[0];
      trackGroup.remove(child);
      if (child instanceof THREE.Mesh && child.geometry) child.geometry.dispose();
      if (child instanceof THREE.Mesh && child.material) {
        const m = child.material as THREE.Material;
        m.dispose();
      }
    }

    snap.segments.forEach((seg) => addSegmentMesh(seg));

    if (snap.state === 'placing' && snap.startPoint && snap.cursorPoint) {
      updatePreview(snap.startPoint, snap.cursorPoint);
    } else {
      hidePreview();
    }
  }

  trackState.subscribe(() => syncFromState());
  syncFromState();

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(width, height);
  renderer.setPixelRatio(window.devicePixelRatio);
  container.appendChild(renderer.domElement);

  function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
  }
  animate();

  function onResize() {
    const w = container.clientWidth;
    const h = container.clientHeight;
    const a = w / h;
    camera.left = -50 * a;
    camera.right = 50 * a;
    camera.top = 50;
    camera.bottom = -50;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }

  window.addEventListener('resize', onResize);

  function onPointerMove(e: PointerEvent) {
    const world = pointerToWorld(e.clientX, e.clientY);
    trackState.setCursor(world);
  }

  function onPointerDown(e: PointerEvent) {
    if (e.button !== 0) return;
    const world = pointerToWorld(e.clientX, e.clientY);
    trackState.pointerDown(world);
  }

  renderer.domElement.addEventListener('pointermove', onPointerMove);
  renderer.domElement.addEventListener('pointerdown', onPointerDown);

  return {
    destroy() {
      window.removeEventListener('resize', onResize);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      trackGroup.clear();
      previewMesh.geometry.dispose();
      (previewMesh.material as THREE.Material).dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
    },
    pointerToWorld,
  };
}
