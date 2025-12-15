import * as THREE from "three";

export function makeWaypoints() {
  const wps = [
    new THREE.Vector3(83.34, 4.88, 257.29),
    new THREE.Vector3(-37.08, -6.21, 220.25),
    new THREE.Vector3(-57.63, -3.29, 212.41),
    new THREE.Vector3(-106.00, -2.23, 96.68),
    new THREE.Vector3(-22.04, -7.94, 12.75),
    new THREE.Vector3(190.32, -1.56, -77.06),
    new THREE.Vector3(40.98, -2.73, -131.78),
    new THREE.Vector3(-63.01, -5.68, -95.22),
    new THREE.Vector3(-178.45, -3.40, -85.11),
    new THREE.Vector3(-218.00, -1.38, -156.64),
    new THREE.Vector3(-249.57, -4.74, -268.14),
  ];

  // Optional: pick which indices stall for 15s (0-based waypoint index reached)
  // Example: stall after reaching waypoint 2 and 6
  // wps.stallIndices = [2, 6];

  return wps;
}