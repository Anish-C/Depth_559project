import * as THREE from "three";

// STEVE swims at a fixed depth above the seafloor
const D = -4.8;

export function makeWaypoints() {
  return [
    new THREE.Vector3(0,   D,   0),     // W0 start
    new THREE.Vector3(18,  D,  -45),    // W1
    new THREE.Vector3(-12, D,  -95),    // W2 (STOP)
    new THREE.Vector3(26,  D, -135),    // W3
    new THREE.Vector3(-22, D, -175),    // W4 (STOP)
    new THREE.Vector3(0,   D, -230),    // W5 extraction
  ];
}
