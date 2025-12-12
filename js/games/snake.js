// Snake Game
const snakeGame = {
    title: 'Snake',
    controls: 'Use Arrow Keys to move the snake. Eat the red food to grow!',
    canvas: null,
    ctx: null,
    gridSize: 20,
    tileCount: 20,
    snake: [],
    food: {},
    direction: { x: 1, y: 0 },
    nextDirection: { x: 1, y: 0 },
    score: 0,
    gameLoop: null,
    speed: 100,
    
    init(canvas, ctx) {
        this.canvas = canvas;
        this.ctx = ctx;
        this.canvas.width = 400;
        this.canvas.height = 400;
        this.gridSize = this.canvas.width / this.tileCount;
        
        // Initialize snake in the middle
        this.snake = [
            { x: 10, y: 10 },
            { x: 9, y: 10 },
            { x: 8, y: 10 }
        ];
        
        this.direction = { x: 1, y: 0 };
        this.nextDirection = { x: 1, y: 0 };
        this.score = 0;
        this.speed = 100;
        
        this.spawnFood();
        this.setupControls();
        gamePlatform.updateScore(this.score);
        this.draw(); // Initial draw
    },
    
    setupControls() {
        // Remove old listener if exists
        if (this.keyHandler) {
            document.removeEventListener('keydown', this.keyHandler);
        }
        
        this.keyHandler = (e) => {
            switch(e.key) {
                case 'ArrowUp':
                    if (this.direction.y === 0) {
                        this.nextDirection = { x: 0, y: -1 };
                    }
                    e.preventDefault();
                    break;
                case 'ArrowDown':
                    if (this.direction.y === 0) {
                        this.nextDirection = { x: 0, y: 1 };
                    }
                    e.preventDefault();
                    break;
                case 'ArrowLeft':
                    if (this.direction.x === 0) {
                        this.nextDirection = { x: -1, y: 0 };
                    }
                    e.preventDefault();
                    break;
                case 'ArrowRight':
                    if (this.direction.x === 0) {
                        this.nextDirection = { x: 1, y: 0 };
                    }
                    e.preventDefault();
                    break;
            }
        };
        
        document.addEventListener('keydown', this.keyHandler);
    },
    
    spawnFood() {
        let validPosition = false;
        while (!validPosition) {
            this.food = {
                x: Math.floor(Math.random() * this.tileCount),
                y: Math.floor(Math.random() * this.tileCount)
            };
            
            // Check if food spawns on snake
            validPosition = !this.snake.some(segment => 
                segment.x === this.food.x && segment.y === this.food.y
            );
        }
    },
    
    start() {
        this.gameLoop = setInterval(() => this.update(), this.speed);
    },
    
    stop() {
        if (this.gameLoop) {
            clearInterval(this.gameLoop);
            this.gameLoop = null;
        }
        if (this.keyHandler) {
            document.removeEventListener('keydown', this.keyHandler);
            this.keyHandler = null;
        }
    },
    
    update() {
        this.direction = this.nextDirection;
        
        // Move snake
        const head = {
            x: this.snake[0].x + this.direction.x,
            y: this.snake[0].y + this.direction.y
        };
        
        // Check wall collision
        if (head.x < 0 || head.x >= this.tileCount || 
            head.y < 0 || head.y >= this.tileCount) {
            this.stop();
            gamePlatform.gameOver(this.score);
            return;
        }
        
        // Check self collision
        if (this.snake.some(segment => segment.x === head.x && segment.y === head.y)) {
            this.stop();
            gamePlatform.gameOver(this.score);
            return;
        }
        
        this.snake.unshift(head);
        
        // Check food collision
        if (head.x === this.food.x && head.y === this.food.y) {
            this.score += 10;
            gamePlatform.updateScore(this.score);
            this.spawnFood();
            
            // Increase speed slightly
            if (this.score % 50 === 0 && this.speed > 50) {
                this.speed -= 5;
                this.stop();
                this.start();
            }
        } else {
            this.snake.pop();
        }
        
        this.draw();
    },
    
    draw() {
        // Clear canvas
        this.ctx.fillStyle = '#000';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw grid
        this.ctx.strokeStyle = '#1a1a1a';
        this.ctx.lineWidth = 1;
        for (let i = 0; i <= this.tileCount; i++) {
            this.ctx.beginPath();
            this.ctx.moveTo(i * this.gridSize, 0);
            this.ctx.lineTo(i * this.gridSize, this.canvas.height);
            this.ctx.stroke();
            
            this.ctx.beginPath();
            this.ctx.moveTo(0, i * this.gridSize);
            this.ctx.lineTo(this.canvas.width, i * this.gridSize);
            this.ctx.stroke();
        }
        
        // Draw snake
        this.snake.forEach((segment, index) => {
            if (index === 0) {
                // Head
                this.ctx.fillStyle = '#00ff00';
            } else {
                // Body
                this.ctx.fillStyle = '#00cc00';
            }
            this.ctx.fillRect(
                segment.x * this.gridSize + 1,
                segment.y * this.gridSize + 1,
                this.gridSize - 2,
                this.gridSize - 2
            );
        });
        
        // Draw food
        this.ctx.fillStyle = '#ff0000';
        this.ctx.beginPath();
        this.ctx.arc(
            this.food.x * this.gridSize + this.gridSize / 2,
            this.food.y * this.gridSize + this.gridSize / 2,
            this.gridSize / 2 - 2,
            0,
            Math.PI * 2
        );
        this.ctx.fill();
    }
};

// Register the game
gamePlatform.registerGame('snake', snakeGame);
