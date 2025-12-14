import * as THREE from 'https://unpkg.com/three@0.152.2/build/three.module.js';

/**
 * Underwater Flashlight Component
 * Lights are added to scene and updated each frame to follow camera
 */
export class Flashlight {
    constructor(camera, scene) {
        this.camera = camera;
        this.scene = scene;
        this.isOn = true;
        
        // Direction vector for calculations
        this.direction = new THREE.Vector3();
        
        // Main spotlight - added to SCENE, not camera
        // Use physically correct lighting so intensity is meaningful
        this.spotlight = new THREE.SpotLight(0xffffff, 1500);
        this.spotlight.angle = Math.PI / 5;      // ~36° cone
        this.spotlight.penumbra = 0.4;           // Soft edges
        this.spotlight.decay = 2;                // Physically correct falloff
        this.spotlight.distance = 0;             // Infinite; rely on decay
        this.spotlight.castShadow = true;
        this.spotlight.shadow.mapSize.width = 1024;
        this.spotlight.shadow.mapSize.height = 1024;
        this.spotlight.shadow.bias = -0.0005;
        this.scene.add(this.spotlight);
        
        // Target for spotlight - also in scene
        this.target = new THREE.Object3D();
        this.scene.add(this.target);
        this.spotlight.target = this.target;
        
        // Point light for ambient glow - added to SCENE
        this.ambientGlow = new THREE.PointLight(0xffffff, 300);
        this.ambientGlow.decay = 2;
        this.ambientGlow.distance = 0;
        this.scene.add(this.ambientGlow);
        
        // Volumetric cone mesh - attached to camera for visual effect
        this.createLightCone();
        
        // Initial position update
        this.update();
        
        console.log('Flashlight created and added to scene');
    }
    
    /**
     * Create a visible light cone mesh for volumetric effect
     */
    createLightCone() {
        const coneLength = 40;
        const coneRadius = Math.tan(this.spotlight.angle) * coneLength;
        
        const geometry = new THREE.ConeGeometry(coneRadius, coneLength, 32, 1, true);
        
        const material = new THREE.ShaderMaterial({
            vertexShader: `
                varying vec3 vPosition;
                varying float vDepth;
                
                void main() {
                    vPosition = position;
                    vDepth = position.y;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform float intensity;
                uniform vec3 color;
                
                varying vec3 vPosition;
                varying float vDepth;
                
                void main() {
                    float coneLength = 40.0;
                    float fadeAlongCone = 1.0 - (vDepth + coneLength * 0.5) / coneLength;
                    fadeAlongCone = clamp(fadeAlongCone, 0.0, 1.0);
                    
                    float dist = length(vPosition.xz);
                    float maxRadius = 12.0;
                    float radialFade = 1.0 - clamp(dist / maxRadius, 0.0, 1.0);
                    
                    float alpha = fadeAlongCone * radialFade * intensity * 0.2;
                    gl_FragColor = vec4(color, alpha);
                }
            `,
            uniforms: {
                intensity: { value: 1.0 },
                color: { value: new THREE.Color(0xccddff) }
            },
            transparent: true,
            side: THREE.DoubleSide,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        });
        
        this.coneMesh = new THREE.Mesh(geometry, material);
        this.coneMesh.rotation.x = Math.PI / 2;
        this.coneMesh.position.z = -coneLength / 2;
        this.camera.add(this.coneMesh);
    }
    
    /**
     * Update light positions to follow camera - CALL THIS EVERY FRAME
     */
    update() {
        if (!this.isOn) return;
        
        // Get camera world position
        const camPos = this.camera.position.clone();
        
        // Get camera forward direction
        this.camera.getWorldDirection(this.direction);
        
        // Position spotlight at camera
        this.spotlight.position.copy(camPos);
        
        // Position target in front of camera
        this.target.position.copy(camPos).add(this.direction.clone().multiplyScalar(50));
        
        // Position ambient glow at camera
        this.ambientGlow.position.copy(camPos);
    }
    
    /**
     * Toggle flashlight on/off
     */
    toggle() {
        this.isOn = !this.isOn;
        this.spotlight.visible = this.isOn;
        this.ambientGlow.visible = this.isOn;
        this.coneMesh.visible = this.isOn;
        
        console.log('Flashlight:', this.isOn ? 'ON' : 'OFF');
        return this.isOn;
    }
    
    /**
     * Set flashlight intensity (0-1)
     */
    setIntensity(value) {
        const intensity = Math.max(0, Math.min(1, value));
        this.spotlight.intensity = 1500 * intensity;
        this.ambientGlow.intensity = 300 * intensity;
        if (this.coneMesh.material.uniforms) {
            this.coneMesh.material.uniforms.intensity.value = intensity;
        }
    }
    
    /**
     * Update based on depth
     */
    updateForDepth(depth, maxDepth) {
        if (!this.isOn) return;
        
        const depthRatio = Math.min(depth / maxDepth, 1);
        const depthFactor = 1.0 - depthRatio * 0.3;
        
        this.spotlight.intensity = 1500 * depthFactor;
        this.ambientGlow.intensity = 300 * depthFactor;
    }
    
    /**
     * Clean up
     */
    dispose() {
        this.scene.remove(this.spotlight);
        this.scene.remove(this.target);
        this.scene.remove(this.ambientGlow);
        this.camera.remove(this.coneMesh);
        this.coneMesh.geometry.dispose();
        this.coneMesh.material.dispose();
    }
}
