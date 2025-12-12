/**
 * Utility Functions
 * 
 * Helper functions for common game development tasks.
 * Add your custom utility functions here as you develop your game.
 */

const Utils = {
    /**
     * Generate a random integer between min and max (inclusive)
     * @param {number} min - Minimum value
     * @param {number} max - Maximum value
     * @returns {number} Random integer
     */
    randomInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    },
    
    /**
     * Generate a random float between min and max
     * @param {number} min - Minimum value
     * @param {number} max - Maximum value
     * @returns {number} Random float
     */
    randomFloat(min, max) {
        return Math.random() * (max - min) + min;
    },
    
    /**
     * Clamp a value between min and max
     * @param {number} value - Value to clamp
     * @param {number} min - Minimum value
     * @param {number} max - Maximum value
     * @returns {number} Clamped value
     */
    clamp(value, min, max) {
        return Math.min(Math.max(value, min), max);
    },
    
    /**
     * Linear interpolation between two values
     * @param {number} start - Start value
     * @param {number} end - End value
     * @param {number} t - Interpolation factor (0-1)
     * @returns {number} Interpolated value
     */
    lerp(start, end, t) {
        return start + (end - start) * t;
    },
    
    /**
     * Calculate distance between two points
     * @param {number} x1 - First point X coordinate
     * @param {number} y1 - First point Y coordinate
     * @param {number} x2 - Second point X coordinate
     * @param {number} y2 - Second point Y coordinate
     * @returns {number} Distance between points
     */
    distance(x1, y1, x2, y2) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        return Math.sqrt(dx * dx + dy * dy);
    },
    
    /**
     * Check if two rectangles are colliding (AABB collision detection)
     * @param {object} rect1 - First rectangle {x, y, width, height}
     * @param {object} rect2 - Second rectangle {x, y, width, height}
     * @returns {boolean} True if rectangles are colliding
     */
    rectCollision(rect1, rect2) {
        return rect1.x < rect2.x + rect2.width &&
               rect1.x + rect1.width > rect2.x &&
               rect1.y < rect2.y + rect2.height &&
               rect1.y + rect1.height > rect2.y;
    },
    
    /**
     * Check if two circles are colliding
     * @param {object} circle1 - First circle {x, y, radius}
     * @param {object} circle2 - Second circle {x, y, radius}
     * @returns {boolean} True if circles are colliding
     */
    circleCollision(circle1, circle2) {
        const dist = this.distance(circle1.x, circle1.y, circle2.x, circle2.y);
        return dist < circle1.radius + circle2.radius;
    },
    
    /**
     * Convert degrees to radians
     * @param {number} degrees - Angle in degrees
     * @returns {number} Angle in radians
     */
    toRadians(degrees) {
        return degrees * (Math.PI / 180);
    },
    
    /**
     * Convert radians to degrees
     * @param {number} radians - Angle in radians
     * @returns {number} Angle in degrees
     */
    toDegrees(radians) {
        return radians * (180 / Math.PI);
    },
    
    /**
     * Normalize an angle to be between 0 and 2π
     * @param {number} angle - Angle in radians
     * @returns {number} Normalized angle
     */
    normalizeAngle(angle) {
        while (angle < 0) angle += Math.PI * 2;
        while (angle >= Math.PI * 2) angle -= Math.PI * 2;
        return angle;
    },
    
    /**
     * Choose a random element from an array
     * @param {Array} array - Array to choose from
     * @returns {*} Random element from array
     */
    randomChoice(array) {
        return array[Math.floor(Math.random() * array.length)];
    },
    
    /**
     * Shuffle an array (Fisher-Yates algorithm)
     * @param {Array} array - Array to shuffle
     * @returns {Array} Shuffled array
     */
    shuffle(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    },
    
    /**
     * Format a number with leading zeros
     * @param {number} num - Number to format
     * @param {number} length - Desired string length
     * @returns {string} Formatted number string
     */
    padNumber(num, length) {
        return num.toString().padStart(length, '0');
    },
    
    /**
     * Simple 2D Vector class for game physics
     */
    Vector2: class {
        constructor(x = 0, y = 0) {
            this.x = x;
            this.y = y;
        }
        
        add(v) {
            return new Utils.Vector2(this.x + v.x, this.y + v.y);
        }
        
        subtract(v) {
            return new Utils.Vector2(this.x - v.x, this.y - v.y);
        }
        
        multiply(scalar) {
            return new Utils.Vector2(this.x * scalar, this.y * scalar);
        }
        
        divide(scalar) {
            return new Utils.Vector2(this.x / scalar, this.y / scalar);
        }
        
        magnitude() {
            return Math.sqrt(this.x * this.x + this.y * this.y);
        }
        
        normalize() {
            const mag = this.magnitude();
            return mag > 0 ? this.divide(mag) : new Utils.Vector2(0, 0);
        }
        
        dot(v) {
            return this.x * v.x + this.y * v.y;
        }
        
        distance(v) {
            const dx = this.x - v.x;
            const dy = this.y - v.y;
            return Math.sqrt(dx * dx + dy * dy);
        }
    }
};

// Make Utils available globally
window.Utils = Utils;
