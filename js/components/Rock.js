import * as THREE from 'https://unpkg.com/three@0.152.2/build/three.module.js';

/**
 * Rock component - creates rocks and formations with collision
 */
export class Rock {
    constructor(scene, x, y, z, options = {}) {
        this.scene = scene;
        this.colliders = [];
        
        const type = options.type || 'small';  // 'small', 'boulder', 'spire'
        const scale = options.scale || 1;
        
        this.mesh = null;
        this.group = null;
        
        switch (type) {
            case 'boulder':
                this.createBoulderFormation(x, y, z, scale);
                break;
            case 'spire':
                this.createSpire(x, y, z, scale);
                break;
            default:
                this.createSmallRock(x, y, z, scale);
        }
    }
    
    createSmallRock(x, y, z, scale) {
        const rockMat = new THREE.MeshStandardMaterial({
            color: 0x6E767F,
            roughness: 0.95,
            metalness: 0.0,
            fog: true
        });
        
        const radius = (3 + Math.random() * 8) * scale;
        const geo = new THREE.IcosahedronGeometry(radius, 1);
        
        // Deform for natural look
        const positions = geo.attributes.position;
        for (let j = 0; j < positions.count; j++) {
            const v = new THREE.Vector3(
                positions.getX(j),
                positions.getY(j),
                positions.getZ(j)
            );
            v.multiplyScalar(0.8 + Math.random() * 0.4);
            positions.setXYZ(j, v.x, v.y, v.z);
        }
        geo.computeVertexNormals();
        
        this.mesh = new THREE.Mesh(geo, rockMat);
        this.mesh.position.set(x, y, z);
        this.mesh.rotation.set(
            Math.random() * Math.PI,
            Math.random() * Math.PI,
            Math.random() * Math.PI
        );
        this.mesh.castShadow = true;
        this.mesh.receiveShadow = true;
        this.scene.add(this.mesh);
        
        // Sphere collider for rock
        this.colliders.push({
            type: 'sphere',
            center: new THREE.Vector3(x, y, z),
            radius: radius * 0.9
        });
    }
    
    createBoulderFormation(x, y, z, scale) {
        this.group = new THREE.Group();
        
        const darkRockMat = new THREE.MeshStandardMaterial({
            color: 0x4B525A,
            roughness: 0.96,
            metalness: 0.0,
            fog: true
        });
        
        const rockMat = new THREE.MeshLambertMaterial({
            color: 0x3a4048,
            fog: true
        });
        
        // Main large boulder
        const mainRadius = (15 + Math.random() * 20) * scale;
        const mainGeo = new THREE.IcosahedronGeometry(mainRadius, 2);
        const positions = mainGeo.attributes.position;
        for (let j = 0; j < positions.count; j++) {
            const v = new THREE.Vector3(
                positions.getX(j),
                positions.getY(j),
                positions.getZ(j)
            );
            v.multiplyScalar(0.7 + Math.random() * 0.5);
            positions.setXYZ(j, v.x, v.y, v.z);
        }
        mainGeo.computeVertexNormals();
        
        const mainBoulder = new THREE.Mesh(mainGeo, darkRockMat);
        mainBoulder.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
        mainBoulder.castShadow = true;
        mainBoulder.receiveShadow = true;
        this.group.add(mainBoulder);
        
        // Main boulder collider
        this.colliders.push({
            type: 'sphere',
            center: new THREE.Vector3(x, y, z),
            radius: mainRadius * 0.85
        });
        
        // Smaller rocks around
        const numSmall = 3 + Math.floor(Math.random() * 4);
        for (let k = 0; k < numSmall; k++) {
            const smallRadius = (4 + Math.random() * 8) * scale;
            const smallGeo = new THREE.IcosahedronGeometry(smallRadius, 1);
            const sPositions = smallGeo.attributes.position;
            for (let j = 0; j < sPositions.count; j++) {
                const v = new THREE.Vector3(
                    sPositions.getX(j),
                    sPositions.getY(j),
                    sPositions.getZ(j)
                );
                v.multiplyScalar(0.7 + Math.random() * 0.5);
                sPositions.setXYZ(j, v.x, v.y, v.z);
            }
            smallGeo.computeVertexNormals();
            
            const smallRock = new THREE.Mesh(smallGeo, rockMat);
            const angle = (k / numSmall) * Math.PI * 2 + Math.random() * 0.5;
            const dist = (12 + Math.random() * 15) * scale;
            const offsetX = Math.cos(angle) * dist;
            const offsetZ = Math.sin(angle) * dist;
            const offsetY = -5 + Math.random() * 3;
            
            smallRock.position.set(offsetX, offsetY, offsetZ);
            smallRock.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
            smallRock.castShadow = true;
            smallRock.receiveShadow = true;
            this.group.add(smallRock);
            
            // Small rock collider
            this.colliders.push({
                type: 'sphere',
                center: new THREE.Vector3(x + offsetX, y + offsetY, z + offsetZ),
                radius: smallRadius * 0.8
            });
        }
        
        this.group.position.set(x, y, z);
        this.scene.add(this.group);
    }
    
    createSpire(x, y, z, scale) {
        const darkRockMat = new THREE.MeshLambertMaterial({
            color: 0x2a3038,
            fog: true
        });
        
        const height = (30 + Math.random() * 50) * scale;
        const radius = (5 + Math.random() * 8) * scale;
        const spireGeo = new THREE.CylinderGeometry(radius * 0.3, radius, height, 8, 4);
        
        const positions = spireGeo.attributes.position;
        for (let j = 0; j < positions.count; j++) {
            const v = new THREE.Vector3(
                positions.getX(j),
                positions.getY(j),
                positions.getZ(j)
            );
            v.x *= 0.8 + Math.random() * 0.4;
            v.z *= 0.8 + Math.random() * 0.4;
            positions.setXYZ(j, v.x, v.y, v.z);
        }
        spireGeo.computeVertexNormals();
        
        this.mesh = new THREE.Mesh(spireGeo, darkRockMat);
        this.mesh.position.set(x, y, z);
        this.mesh.rotation.set(
            (Math.random() - 0.5) * 0.3,
            Math.random() * Math.PI,
            (Math.random() - 0.5) * 0.3
        );
        this.mesh.castShadow = true;
        this.mesh.receiveShadow = true;
        this.scene.add(this.mesh);
        
        // Cylinder collider approximated as box
        this.colliders.push({
            type: 'cylinder',
            center: new THREE.Vector3(x, y, z),
            radius: radius * 0.7,
            height: height
        });
    }
    
    getColliders() {
        return this.colliders;
    }
    
    dispose() {
        if (this.mesh) {
            this.mesh.geometry.dispose();
            this.mesh.material.dispose();
            this.scene.remove(this.mesh);
        }
        if (this.group) {
            this.group.traverse(child => {
                if (child.isMesh) {
                    child.geometry.dispose();
                    child.material.dispose();
                }
            });
            this.scene.remove(this.group);
        }
    }
}
