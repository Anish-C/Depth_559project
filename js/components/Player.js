import * as THREE from 'https://unpkg.com/three@0.152.2/build/three.module.js';

/**
 * Player component - handles player collision box and physics
 * The player is a rectangular volume (y=2, x=1, z=1) with the top-middle at camera POV
 */
export class Player {
    constructor(camera) {
        this.camera = camera;
        
        // Player dimensions
        this.width = 1;   // x
        this.height = 2;  // y
        this.depth = 1;   // z
        
        // The camera represents the top-middle of the player
        // So the player box extends from camera.y - height to camera.y
        // and from camera.x - width/2 to camera.x + width/2
        // and from camera.z - depth/2 to camera.z + depth/2
        
        this.velocity = new THREE.Vector3();
        this.moveSpeed = 2;
        
        // Collision response
        this.pushbackStrength = 1.0;
    }
    
    /**
     * Get the player's bounding box in world space
     */
    getBoundingBox() {
        const pos = this.camera.position;
        
        return {
            min: new THREE.Vector3(
                pos.x - this.width / 2,
                pos.y - this.height,
                pos.z - this.depth / 2
            ),
            max: new THREE.Vector3(
                pos.x + this.width / 2,
                pos.y,
                pos.z + this.depth / 2
            )
        };
    }
    
    /**
     * Get the player's center position (not camera position)
     */
    getCenter() {
        const pos = this.camera.position;
        return new THREE.Vector3(
            pos.x,
            pos.y - this.height / 2,
            pos.z
        );
    }
    
    /**
     * Check collision with a sphere collider
     */
    checkSphereCollision(sphere) {
        const playerBox = this.getBoundingBox();
        const sphereCenter = sphere.center;
        const sphereRadius = sphere.radius;
        
        // Find closest point on box to sphere center
        const closest = new THREE.Vector3(
            Math.max(playerBox.min.x, Math.min(sphereCenter.x, playerBox.max.x)),
            Math.max(playerBox.min.y, Math.min(sphereCenter.y, playerBox.max.y)),
            Math.max(playerBox.min.z, Math.min(sphereCenter.z, playerBox.max.z))
        );
        
        const distance = closest.distanceTo(sphereCenter);
        
        if (distance < sphereRadius) {
            // Calculate push direction (away from sphere center)
            const pushDir = new THREE.Vector3().subVectors(this.camera.position, sphereCenter);
            pushDir.y *= 0.5;  // Less vertical push
            pushDir.normalize();
            
            const penetration = sphereRadius - distance;
            return {
                colliding: true,
                pushback: pushDir.multiplyScalar(penetration + 0.5)
            };
        }
        
        return { colliding: false };
    }
    
    /**
     * Check collision with a box collider
     */
    checkBoxCollision(box) {
        const playerBox = this.getBoundingBox();
        const boxCenter = box.center;
        const boxHalf = box.halfExtents;
        
        // For now, ignore rotation and use AABB
        const boxMin = new THREE.Vector3(
            boxCenter.x - boxHalf.x,
            boxCenter.y - boxHalf.y,
            boxCenter.z - boxHalf.z
        );
        const boxMax = new THREE.Vector3(
            boxCenter.x + boxHalf.x,
            boxCenter.y + boxHalf.y,
            boxCenter.z + boxHalf.z
        );
        
        // AABB vs AABB collision
        const colliding = (
            playerBox.min.x <= boxMax.x && playerBox.max.x >= boxMin.x &&
            playerBox.min.y <= boxMax.y && playerBox.max.y >= boxMin.y &&
            playerBox.min.z <= boxMax.z && playerBox.max.z >= boxMin.z
        );
        
        if (colliding) {
            // Calculate penetration and push direction
            const playerCenter = this.getCenter();
            
            // Find overlap on each axis
            const overlapX = Math.min(playerBox.max.x - boxMin.x, boxMax.x - playerBox.min.x);
            const overlapY = Math.min(playerBox.max.y - boxMin.y, boxMax.y - playerBox.min.y);
            const overlapZ = Math.min(playerBox.max.z - boxMin.z, boxMax.z - playerBox.min.z);
            
            // Push along axis with smallest overlap
            const pushback = new THREE.Vector3();
            
            if (overlapX <= overlapY && overlapX <= overlapZ) {
                pushback.x = (playerCenter.x < boxCenter.x) ? -overlapX : overlapX;
            } else if (overlapY <= overlapX && overlapY <= overlapZ) {
                pushback.y = (playerCenter.y < boxCenter.y) ? -overlapY : overlapY;
            } else {
                pushback.z = (playerCenter.z < boxCenter.z) ? -overlapZ : overlapZ;
            }
            
            return {
                colliding: true,
                pushback: pushback.multiplyScalar(1.1)  // Slight extra push
            };
        }
        
        return { colliding: false };
    }
    
    /**
     * Check collision with a cylinder collider
     */
    checkCylinderCollision(cylinder) {
        const playerBox = this.getBoundingBox();
        const cylCenter = cylinder.center;
        const cylRadius = cylinder.radius;
        const cylHalfHeight = cylinder.height / 2;
        
        // Check Y overlap first
        const cylMinY = cylCenter.y - cylHalfHeight;
        const cylMaxY = cylCenter.y + cylHalfHeight;
        
        if (playerBox.max.y < cylMinY || playerBox.min.y > cylMaxY) {
            return { colliding: false };
        }
        
        // Check XZ distance (2D circle check)
        const playerCenterXZ = new THREE.Vector2(this.camera.position.x, this.camera.position.z);
        const cylCenterXZ = new THREE.Vector2(cylCenter.x, cylCenter.z);
        
        const distance = playerCenterXZ.distanceTo(cylCenterXZ);
        const playerRadius = Math.max(this.width, this.depth) / 2;
        
        if (distance < cylRadius + playerRadius) {
            // Calculate push direction (away from cylinder center in XZ)
            const pushDir = new THREE.Vector3(
                this.camera.position.x - cylCenter.x,
                0,
                this.camera.position.z - cylCenter.z
            ).normalize();
            
            const penetration = (cylRadius + playerRadius) - distance;
            
            return {
                colliding: true,
                pushback: pushDir.multiplyScalar(penetration + 0.5)
            };
        }
        
        return { colliding: false };
    }
    
    /**
     * Check collision with any collider type
     */
    checkCollision(collider) {
        switch (collider.type) {
            case 'sphere':
                return this.checkSphereCollision(collider);
            case 'box':
                return this.checkBoxCollision(collider);
            case 'cylinder':
                return this.checkCylinderCollision(collider);
            default:
                return { colliding: false };
        }
    }
    
    /**
     * Check collisions with all obstacles and resolve
     */
    resolveCollisions(obstacles) {
        const totalPushback = new THREE.Vector3();
        let collisionCount = 0;
        
        for (const obstacle of obstacles) {
            const colliders = obstacle.getColliders();
            for (const collider of colliders) {
                const result = this.checkCollision(collider);
                if (result.colliding) {
                    totalPushback.add(result.pushback);
                    collisionCount++;
                }
            }
        }
        
        if (collisionCount > 0) {
            // Apply averaged pushback
            totalPushback.divideScalar(collisionCount);
            this.camera.position.add(totalPushback);
            return true;
        }
        
        return false;
    }
    
    /**
     * Try to move and check for collisions
     * Returns the valid position after collision resolution
     */
    tryMove(movement, obstacles) {
        // Store original position
        const originalPos = this.camera.position.clone();
        
        // Apply movement
        this.camera.position.add(movement);
        
        // Check and resolve collisions
        let iterations = 0;
        const maxIterations = 5;
        
        while (this.resolveCollisions(obstacles) && iterations < maxIterations) {
            iterations++;
        }
        
        // If still colliding after max iterations, revert to original
        if (iterations >= maxIterations) {
            // Do a final collision check
            for (const obstacle of obstacles) {
                const colliders = obstacle.getColliders();
                for (const collider of colliders) {
                    if (this.checkCollision(collider).colliding) {
                        this.camera.position.copy(originalPos);
                        return false;
                    }
                }
            }
        }
        
        return true;
    }
}
