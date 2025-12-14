import * as THREE from 'https://unpkg.com/three@0.152.2/build/three.module.js';

/**
 * Sprint Component - Handles player sprint speed boost
 */
export class Sprint {
    constructor(options = {}) {
        // Sprint settings
        this.baseSpeed = options.baseSpeed || 0.4;
        this.sprintMultiplier = options.sprintMultiplier || 2.5;
        this.maxStamina = options.maxStamina || 100;
        this.staminaDrainRate = options.staminaDrainRate || 15;  // Per second
        this.staminaRegenRate = options.staminaRegenRate || 10;  // Per second
        this.staminaRegenDelay = options.staminaRegenDelay || 1.0;  // Seconds before regen starts
        
        // State
        this.isSprinting = false;
        this.stamina = this.maxStamina;
        this.timeSinceLastSprint = 0;
        this.isExhausted = false;  // True when stamina hits 0, prevents sprinting until partial recovery
        this.exhaustionRecoveryThreshold = 20;  // Must recover this much stamina before sprinting again
        
        // UI element reference (optional)
        this.staminaBar = null;
        this.createStaminaUI();
    }
    
    /**
     * Create stamina bar UI element
     */
    createStaminaUI() {
        // Check if stamina bar already exists
        if (document.getElementById('staminaContainer')) {
            this.staminaBar = document.getElementById('staminaBar');
            return;
        }
        
        const container = document.createElement('div');
        container.id = 'staminaContainer';
        container.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            width: 200px;
            height: 8px;
            background: rgba(0, 0, 0, 0.5);
            border: 1px solid rgba(0, 255, 255, 0.3);
            border-radius: 4px;
            overflow: hidden;
            opacity: 0;
            transition: opacity 0.3s;
        `;
        
        const bar = document.createElement('div');
        bar.id = 'staminaBar';
        bar.style.cssText = `
            width: 100%;
            height: 100%;
            background: linear-gradient(90deg, #00aaff, #00ffff);
            transition: width 0.1s;
        `;
        
        container.appendChild(bar);
        document.body.appendChild(container);
        
        this.staminaBar = bar;
        this.staminaContainer = container;
    }
    
    /**
     * Start sprinting (called when shift is pressed)
     */
    startSprint() {
        if (!this.isExhausted && this.stamina > 0) {
            this.isSprinting = true;
            this.showStaminaBar();
        }
    }
    
    /**
     * Stop sprinting (called when shift is released)
     */
    stopSprint() {
        this.isSprinting = false;
        this.timeSinceLastSprint = 0;
    }
    
    /**
     * Update sprint state and stamina
     * @param {number} deltaTime - Time since last frame in seconds
     * @returns {number} - Current movement speed
     */
    update(deltaTime) {
        if (this.isSprinting && this.stamina > 0 && !this.isExhausted) {
            // Drain stamina while sprinting
            this.stamina -= this.staminaDrainRate * deltaTime;
            this.timeSinceLastSprint = 0;
            
            if (this.stamina <= 0) {
                this.stamina = 0;
                this.isSprinting = false;
                this.isExhausted = true;
            }
        } else {
            // Regenerate stamina when not sprinting
            this.timeSinceLastSprint += deltaTime;
            
            if (this.timeSinceLastSprint >= this.staminaRegenDelay) {
                this.stamina += this.staminaRegenRate * deltaTime;
                this.stamina = Math.min(this.stamina, this.maxStamina);
                
                // Recover from exhaustion when threshold is met
                if (this.isExhausted && this.stamina >= this.exhaustionRecoveryThreshold) {
                    this.isExhausted = false;
                }
            }
        }
        
        // Update UI
        this.updateStaminaUI();
        
        // Return current speed
        return this.getCurrentSpeed();
    }
    
    /**
     * Get current movement speed based on sprint state
     */
    getCurrentSpeed() {
        if (this.isSprinting && !this.isExhausted && this.stamina > 0) {
            return this.baseSpeed * this.sprintMultiplier;
        }
        return this.baseSpeed;
    }
    
    /**
     * Update stamina bar UI
     */
    updateStaminaUI() {
        if (this.staminaBar) {
            const percent = (this.stamina / this.maxStamina) * 100;
            this.staminaBar.style.width = `${percent}%`;
            
            // Change color when low
            if (this.isExhausted) {
                this.staminaBar.style.background = 'linear-gradient(90deg, #ff4444, #ff6666)';
            } else if (percent < 30) {
                this.staminaBar.style.background = 'linear-gradient(90deg, #ffaa00, #ffcc00)';
            } else {
                this.staminaBar.style.background = 'linear-gradient(90deg, #00aaff, #00ffff)';
            }
            
            // Hide bar when full and not recently used
            if (this.stamina >= this.maxStamina && this.timeSinceLastSprint > 2) {
                this.hideStaminaBar();
            }
        }
    }
    
    /**
     * Show stamina bar
     */
    showStaminaBar() {
        if (this.staminaContainer) {
            this.staminaContainer.style.opacity = '1';
        }
    }
    
    /**
     * Hide stamina bar
     */
    hideStaminaBar() {
        if (this.staminaContainer) {
            this.staminaContainer.style.opacity = '0';
        }
    }
    
    /**
     * Check if currently sprinting
     */
    isCurrentlySprinting() {
        return this.isSprinting && !this.isExhausted && this.stamina > 0;
    }
    
    /**
     * Get stamina percentage
     */
    getStaminaPercent() {
        return (this.stamina / this.maxStamina) * 100;
    }
    
    /**
     * Set base speed (for external configuration)
     */
    setBaseSpeed(speed) {
        this.baseSpeed = speed;
    }
    
    /**
     * Dispose and clean up
     */
    dispose() {
        if (this.staminaContainer) {
            this.staminaContainer.remove();
        }
    }
}
