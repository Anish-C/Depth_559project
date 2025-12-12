/**
 * Game Platform - Main Game Module
 * 
 * A minimal, extensible game framework for building browser-based games.
 * Uses the object pattern for simple state management and game loop control.
 * 
 * Architecture:
 * - init(): Set up canvas, context, and event listeners
 * - update(): Handle game logic and state updates
 * - render(): Draw everything on canvas
 * - loop(): Main game loop using requestAnimationFrame
 * - start(): Initialize and begin the game loop
 */

const Game = {
    // Canvas and rendering context
    canvas: null,
    ctx: null,
    
    // Game state
    isRunning: false,
    isPaused: false,
    lastTime: 0,
    
    // Score management
    score: 0,
    highScore: 0,
    
    // Input tracking
    keys: {},
    mouse: {
        x: 0,
        y: 0,
        isDown: false
    },
    
    /**
     * Initialize the game
     * Sets up canvas, context, event listeners, and UI bindings
     */
    init() {
        console.log('Initializing game...');
        
        // Get canvas and context
        this.canvas = document.getElementById('gameCanvas');
        if (!this.canvas) {
            console.error('Canvas element not found!');
            return;
        }
        
        this.ctx = this.canvas.getContext('2d');
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Bind UI controls
        this.setupUIControls();
        
        // Load high score from localStorage
        this.loadHighScore();
        
        // Draw initial state
        this.render();
        
        console.log('Game initialized successfully!');
    },
    
    /**
     * Set up keyboard and mouse event listeners
     */
    setupEventListeners() {
        // Keyboard events
        window.addEventListener('keydown', (e) => {
            this.keys[e.key.toLowerCase()] = true;
            
            // Prevent default behavior for arrow keys and space
            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
                e.preventDefault();
            }
            
            // TODO: Add your keyboard input handling here
            // Example: if (e.key === ' ') { /* Jump logic */ }
        });
        
        window.addEventListener('keyup', (e) => {
            this.keys[e.key.toLowerCase()] = false;
        });
        
        // Mouse events
        this.canvas.addEventListener('mousemove', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            this.mouse.x = e.clientX - rect.left;
            this.mouse.y = e.clientY - rect.top;
            
            // TODO: Add your mouse move handling here
        });
        
        this.canvas.addEventListener('mousedown', (e) => {
            this.mouse.isDown = true;
            
            // TODO: Add your mouse click handling here
        });
        
        this.canvas.addEventListener('mouseup', (e) => {
            this.mouse.isDown = false;
        });
        
        // Touch events for mobile support
        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const rect = this.canvas.getBoundingClientRect();
            const touch = e.touches[0];
            this.mouse.x = touch.clientX - rect.left;
            this.mouse.y = touch.clientY - rect.top;
            this.mouse.isDown = true;
        });
        
        this.canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            const rect = this.canvas.getBoundingClientRect();
            const touch = e.touches[0];
            this.mouse.x = touch.clientX - rect.left;
            this.mouse.y = touch.clientY - rect.top;
        });
        
        this.canvas.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.mouse.isDown = false;
        });
    },
    
    /**
     * Set up UI control button handlers
     */
    setupUIControls() {
        const startBtn = document.getElementById('startBtn');
        const pauseBtn = document.getElementById('pauseBtn');
        const resetBtn = document.getElementById('resetBtn');
        
        if (startBtn) {
            startBtn.addEventListener('click', () => {
                if (!this.isRunning) {
                    this.start();
                }
            });
        }
        
        if (pauseBtn) {
            pauseBtn.addEventListener('click', () => {
                this.togglePause();
            });
        }
        
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                this.reset();
            });
        }
    },
    
    /**
     * Start the game
     * Begins the game loop
     */
    start() {
        if (this.isRunning) return;
        
        console.log('Starting game...');
        this.isRunning = true;
        this.isPaused = false;
        this.lastTime = performance.now();
        
        // Update UI
        this.updateUIButtons();
        
        // TODO: Add your game initialization logic here
        // Example: reset player position, spawn enemies, etc.
        
        // Start the game loop
        this.loop();
    },
    
    /**
     * Pause/unpause the game
     */
    togglePause() {
        if (!this.isRunning) return;
        
        this.isPaused = !this.isPaused;
        console.log(this.isPaused ? 'Game paused' : 'Game resumed');
        
        this.updateUIButtons();
        
        if (!this.isPaused) {
            this.lastTime = performance.now();
            this.loop();
        }
    },
    
    /**
     * Reset the game to initial state
     */
    reset() {
        console.log('Resetting game...');
        
        this.isRunning = false;
        this.isPaused = false;
        this.score = 0;
        this.keys = {};
        
        // TODO: Add your game reset logic here
        // Example: reset player position, clear enemies, etc.
        
        this.updateScore();
        this.updateUIButtons();
        this.render();
    },
    
    /**
     * Main game loop
     * Handles update and render cycles using requestAnimationFrame
     */
    loop() {
        if (!this.isRunning || this.isPaused) return;
        
        const currentTime = performance.now();
        const deltaTime = (currentTime - this.lastTime) / 1000; // Convert to seconds
        this.lastTime = currentTime;
        
        // Update game state
        this.update(deltaTime);
        
        // Render everything
        this.render();
        
        // Continue the loop
        requestAnimationFrame(() => this.loop());
    },
    
    /**
     * Update game logic
     * @param {number} deltaTime - Time elapsed since last frame (in seconds)
     */
    update(deltaTime) {
        // TODO: Add your game update logic here
        // This is where you handle:
        // - Player movement
        // - Enemy behavior
        // - Collision detection
        // - Game rules and win/lose conditions
        // - Physics updates
        
        // Example: Check keyboard input
        if (this.keys['arrowleft'] || this.keys['a']) {
            // Move left
        }
        if (this.keys['arrowright'] || this.keys['d']) {
            // Move right
        }
        if (this.keys['arrowup'] || this.keys['w']) {
            // Move up
        }
        if (this.keys['arrowdown'] || this.keys['s']) {
            // Move down
        }
        
        // Example: Update score
        // this.addScore(points);
    },
    
    /**
     * Render everything on the canvas
     */
    render() {
        // Clear the canvas
        this.ctx.fillStyle = '#f0f0f0';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // TODO: Add your drawing logic here
        // This is where you draw:
        // - Background elements
        // - Player
        // - Enemies
        // - Particles/effects
        // - UI elements on canvas (if any)
        
        // Example: Draw a placeholder message
        if (!this.isRunning) {
            this.ctx.fillStyle = '#333';
            this.ctx.font = '24px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText('Click "Start Game" to begin!', this.canvas.width / 2, this.canvas.height / 2);
        } else {
            // Draw game objects here when running
            this.ctx.fillStyle = '#4a90e2';
            this.ctx.font = '20px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText('Game is running! Add your game logic.', this.canvas.width / 2, this.canvas.height / 2);
        }
    },
    
    /**
     * Add points to the score
     * @param {number} points - Points to add
     */
    addScore(points) {
        this.score += points;
        this.updateScore();
        
        // Update high score if necessary
        if (this.score > this.highScore) {
            this.highScore = this.score;
            this.saveHighScore();
        }
    },
    
    /**
     * Update score display in UI
     */
    updateScore() {
        const scoreElement = document.getElementById('score');
        const highScoreElement = document.getElementById('highScore');
        
        if (scoreElement) {
            scoreElement.textContent = this.score;
        }
        
        if (highScoreElement) {
            highScoreElement.textContent = this.highScore;
        }
    },
    
    /**
     * Load high score from localStorage
     */
    loadHighScore() {
        const saved = localStorage.getItem('gameHighScore');
        if (saved) {
            this.highScore = parseInt(saved, 10);
            this.updateScore();
        }
    },
    
    /**
     * Save high score to localStorage
     */
    saveHighScore() {
        localStorage.setItem('gameHighScore', this.highScore.toString());
        this.updateScore();
    },
    
    /**
     * Update UI button states
     */
    updateUIButtons() {
        const startBtn = document.getElementById('startBtn');
        const pauseBtn = document.getElementById('pauseBtn');
        
        if (startBtn) {
            startBtn.disabled = this.isRunning;
            startBtn.textContent = this.isRunning ? 'Running...' : 'Start Game';
        }
        
        if (pauseBtn) {
            pauseBtn.disabled = !this.isRunning;
            pauseBtn.textContent = this.isPaused ? 'Resume' : 'Pause';
        }
    }
};

// Initialize the game when the page loads
window.addEventListener('DOMContentLoaded', () => {
    Game.init();
});
