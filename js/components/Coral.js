import * as THREE from 'https://unpkg.com/three@0.152.2/build/three.module.js';

/**
 * Coral obstacle - colorful coral clusters with simple colliders
 */
export class Coral {
    constructor(scene, x, y, z, options = {}) {
        this.scene = scene;
        this.group = new THREE.Group();
        this.colliders = [];
        const scale = options.scale || 1;
        const count = options.count || 6;

        const colors = [0xFF6FA0, 0xFFB347, 0x7CF7B7, 0x8AA9FF, 0xFFD166];

        for (let i = 0; i < count; i++) {
            const color = colors[i % colors.length];
            const mat = new THREE.MeshStandardMaterial({
                color,
                roughness: 0.85,
                metalness: 0.0,
                fog: true
            });
            const radiusTop = 0.6 * scale * (0.6 + Math.random() * 0.8);
            const radiusBot = 1.2 * scale * (0.6 + Math.random() * 0.8);
            const height = (3 + Math.random() * 6) * scale;
            const geo = new THREE.CylinderGeometry(radiusTop, radiusBot, height, 8, 1);
            const mesh = new THREE.Mesh(geo, mat);
            const angle = Math.random() * Math.PI * 2;
            const dist = (2 + Math.random() * 3) * scale;
            mesh.position.set(Math.cos(angle) * dist, height / 2, Math.sin(angle) * dist);
            mesh.rotation.y = Math.random() * Math.PI;
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            this.group.add(mesh);

            this.colliders.push({
                type: 'cylinder',
                center: new THREE.Vector3(x + mesh.position.x, y + mesh.position.y - height / 2, z + mesh.position.z),
                radius: Math.max(radiusTop, radiusBot) * 0.8,
                height
            });
        }

        this.group.position.set(x, y, z);
        this.scene.add(this.group);
    }

    getColliders() { return this.colliders; }

    dispose() {
        this.group.traverse((c) => {
            if (c.isMesh) { c.geometry.dispose(); c.material.dispose(); }
        });
        this.scene.remove(this.group);
    }
}