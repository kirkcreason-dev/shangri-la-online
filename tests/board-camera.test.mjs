import test from 'node:test';
import assert from 'node:assert/strict';
import { OVERVIEW, facingRotation, fitCamera, nearestAngle, panCamera, zoomCamera, cameraCorners, rotatePoint } from '../lib/board-camera.ts';
const close = (a,b) => assert.ok(Math.abs(a-b)<.0001,`${a} ≈ ${b}`);
test('following all board edges turns the piece toward the viewer without extra spins',()=>{
 for(const point of [{x:400,y:50},{x:750,y:400},{x:400,y:750},{x:50,y:400}]){
  const rotation=facingRotation(point,450);
  const facing=rotatePoint({x:point.x-400,y:point.y-400},rotation);
  close(facing.x,0);assert.ok(facing.y>0);assert.ok(Math.abs(rotation-450)<=180);
 }
 close(nearestAngle(0,359),360);close(nearestAngle(270,0),-90);
});
test('camera framing keeps opposite-edge destinations and tile margins visible when rotated',()=>{
 const points=[{x:50,y:50},{x:750,y:50},{x:50,y:750},{x:750,y:750}];
 for(const rotation of [0,90,-90,135,270,540]){
  const camera=fitCamera(points,rotation);
  for(const point of points){
   const relative=rotatePoint({x:point.x-camera.x,y:point.y-camera.y},rotation);
   assert.ok(Math.abs(relative.x*camera.zoom)<320);assert.ok(Math.abs(relative.y*camera.zoom)<320);
  }
 }
});
test('dragging remains screen-relative after rotation and zoom',()=>{
 const initial={x:400,y:400,zoom:2,rotation:90};
 const moved=panCamera(initial,120,0);
 close(moved.x,400);close(moved.y,460);
 const screen=rotatePoint({x:400-moved.x,y:400-moved.y},moved.rotation);
 close(screen.x*moved.zoom,120);close(screen.y,0);
});
test('zoom and pan have safe limits and minimap corners match the visible area',()=>{
 assert.equal(zoomCamera(OVERVIEW,100).zoom,3);assert.equal(zoomCamera(OVERVIEW,.001).zoom,.65);
 const p=panCamera(OVERVIEW,100000,-100000);assert.equal(p.x,-100);assert.equal(p.y,900);
 const camera={x:200,y:300,zoom:2,rotation:90};
 for(const corner of cameraCorners(camera)){
  const v=rotatePoint({x:corner.x-camera.x,y:corner.y-camera.y},camera.rotation);
  close(Math.abs(v.x*camera.zoom),400);close(Math.abs(v.y*camera.zoom),400);
 }
});
