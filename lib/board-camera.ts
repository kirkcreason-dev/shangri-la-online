export type Point = { x: number; y: number };
export type Camera = Point & { zoom: number; rotation: number };
export const OVERVIEW: Camera = { x: 400, y: 400, zoom: 0.94, rotation: 0 };
export function rotatePoint(p: Point, degrees: number): Point {
  const a = degrees * Math.PI / 180;
  return { x: p.x * Math.cos(a) - p.y * Math.sin(a), y: p.x * Math.sin(a) + p.y * Math.cos(a) };
}
export function nearestAngle(angle: number, previous: number) {
  return previous + ((angle - previous + 540) % 360 + 360) % 360 - 180;
}
export function facingRotation(p: Point, previous: number) {
  const dx = p.x - 400, dy = p.y - 400;
  if (Math.hypot(dx, dy) < 70) return nearestAngle(0, previous);
  const edge = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 90 : -90) : (dy > 0 ? 0 : 180);
  return nearestAngle(edge, previous);
}
export function fitCamera(points: Point[], rotation: number): Camera {
  if (!points.length) return OVERVIEW;
  const rotated = points.map(p => rotatePoint(p, rotation));
  const xs = rotated.map(p => p.x), ys = rotated.map(p => p.y);
  const left = Math.min(...xs), right = Math.max(...xs), top = Math.min(...ys), bottom = Math.max(...ys);
  const center = rotatePoint({ x: (left + right) / 2, y: (top + bottom) / 2 }, -rotation);
  const zoom = Math.min(1.85, 640 / Math.max(right - left + 140, bottom - top + 140));
  // Keep the board filling the frame while following pieces at its outer edge.
  const angle = rotation * Math.PI / 180;
  const inset = Math.min(400, (Math.abs(Math.cos(angle)) + Math.abs(Math.sin(angle))) * 400 / zoom);
  return { x: Math.max(inset, Math.min(800 - inset, center.x)), y: Math.max(inset, Math.min(800 - inset, center.y)), rotation, zoom };
}
export function panCamera(camera: Camera, dx: number, dy: number): Camera {
  const delta = rotatePoint({ x: dx / camera.zoom, y: dy / camera.zoom }, -camera.rotation);
  return { ...camera, x: Math.max(-100, Math.min(900, camera.x - delta.x)), y: Math.max(-100, Math.min(900, camera.y - delta.y)) };
}
export function zoomCamera(camera: Camera, factor: number): Camera {
  return { ...camera, zoom: Math.max(0.65, Math.min(3, camera.zoom * factor)) };
}
export function cameraCorners(camera: Camera): Point[] {
  return [[0, 0], [800, 0], [800, 800], [0, 800]].map(([x, y]) => {
    const offset = rotatePoint({ x: (x - 400) / camera.zoom, y: (y - 400) / camera.zoom }, -camera.rotation);
    return { x: camera.x + offset.x, y: camera.y + offset.y };
  });
}
