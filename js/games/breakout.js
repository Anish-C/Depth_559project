// Breakout Game
const breakoutGame = {
    title: 'Breakout',
    controls: 'Use Arrow Left/Right keys or Mouse to move the paddle. Break all bricks!',
    canvas: null,
    ctx: null,
    paddle: {},
    ball: {},
    bricks: [],
    score: 0,
    gameLoop: null,
    brickRowCount: 5,
    brickColumnCount: 9,
    brickWidth: 60,
    brickHeight: 20,
    brickPadding: 5,
    brickOffsetTop: 30,
    brickOffsetLeft: 20,
    
    init(canvas, ctx) {
        this.canvas = canvas;
        this.ctx = ctx;
        this.canvas.width = 600;
        this.canvas.height = 400;
        
        // Initialize paddle
        this.paddle = {
            width: 80,
            height: 10,
            x: (this.canvas.width - 80) / 2,
            speed: 7,
            dx: 0
        };
        this.paddle.y = this.canvas.height - this.paddle.height - 10;
        
        // Initialize ball
        this.resetBall();
        
        // Initialize bricks
        this.initBricks();
        
        this.score = 0;
        this.setupControls();
        gamePlatform.updateScore(this.score);
    },
    
    initBricks() {
        this.bricks = [];
        const colors = ['#FF0000', '#FF7F00', '#FFFF00', '#00FF00', '#0000FF'];
        for (let row = 0; row < this.brickRowCount; row++) {
            this.bricks[row] = [];
            for (let col = 0; col < this.brickColumnCount; col++) {
                this.bricks[row][col] = {
                    x: col * (this.brickWidth + this.brickPadding) + this.brickOffsetLeft,
                    y: row * (this.brickHeight + this.brickPadding) + this.brickOffsetTop,
                    status: 1,
                    color: colors[row]
                };
            }
        }
    },
    
    resetBall() {
        this.ball = {
            x: this.canvas.width / 2,
            y: this.canvas.height - 40,
            radius: 7,
            speed: 4,
            dx: 3,
            dy: -4
        };
    },
    
    setupControls() {
        if (this.keyHandler) {
            document.removeEventListener('keydown', this.keyHandler);
            document.removeEventListener('keyup', this.keyUpHandler);
            document.removeEventListener('mousemove', this.mouseHandler);
        }
        
        this.keyHandler = (e) => {
            if (e.key === 'ArrowLeft') {
                this.paddle.dx = -this.paddle.speed;
                e.preventDefault();
            } else if (e.key === 'ArrowRight') {
                this.paddle.dx = this.paddle.speed;
                e.preventDefault();
            }
        };
        
        this.keyUpHandler = (e) => {
            if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                this.paddle.dx = 0;
                e.preventDefault();
            }
        };
        
        this.mouseHandler = (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            if (mouseX > 0 && mouseX < this.canvas.width) {
                this.paddle.x = mouseX - this.paddle.width / 2;
            }
        };
        
        document.addEventListener('keydown', this.keyHandler);
        document.addEventListener('keyup', this.keyUpHandler);
        this.canvas.addEventListener('mousemove', this.mouseHandler);
    },
    
    start() {
        this.gameLoop = requestAnimationFrame(() => this.gameLoopFunc());
    },
    
    gameLoopFunc() {
        this.update();
        this.draw();
        this.gameLoop = requestAnimationFrame(() => this.gameLoopFunc());
    },
    
    stop() {
        if (this.gameLoop) {
            cancelAnimationFrame(this.gameLoop);
            this.gameLoop = null;
        }
        if (this.keyHandler) {
            document.removeEventListener('keydown', this.keyHandler);
            document.removeEventListener('keyup', this.keyUpHandler);
            this.canvas.removeEventListener('mousemove', this.mouseHandler);
            this.keyHandler = null;
            this.keyUpHandler = null;
            this.mouseHandler = null;
        }
    },
    
    update() {
        // Move paddle
        this.paddle.x += this.paddle.dx;
        
        // Paddle boundaries
        if (this.paddle.x < 0) {
            this.paddle.x = 0;
        }
        if (this.paddle.x + this.paddle.width > this.canvas.width) {
            this.paddle.x = this.canvas.width - this.paddle.width;
        }
        
        // Move ball
        this.ball.x += this.ball.dx;
        this.ball.y += this.ball.dy;
        
        // Ball collision with walls
        if (this.ball.x + this.ball.radius > this.canvas.width || 
            this.ball.x - this.ball.radius < 0) {
            this.ball.dx *= -1;
        }
        
        if (this.ball.y - this.ball.radius < 0) {
            this.ball.dy *= -1;
        }
        
        // Ball collision with paddle
        if (this.ball.y + this.ball.radius > this.paddle.y &&
            this.ball.x > this.paddle.x &&
            this.ball.x < this.paddle.x + this.paddle.width) {
            
            // Calculate hit position on paddle (-1 to 1)
            const hitPos = (this.ball.x - (this.paddle.x + this.paddle.width / 2)) / (this.paddle.width / 2);
            this.ball.dx = hitPos * 5;
            this.ball.dy = -Math.abs(this.ball.dy);
        }
        
        // Ball out of bounds (bottom)
        if (this.ball.y + this.ball.radius > this.canvas.height) {
            this.stop();
            gamePlatform.gameOver(this.score);
            return;
        }
        
        // Ball collision with bricks
        for (let row = 0; row < this.brickRowCount; row++) {
            for (let col = 0; col < this.brickColumnCount; col++) {
                const brick = this.bricks[row][col];
                if (brick.status === 1) {
                    if (this.ball.x > brick.x &&
                        this.ball.x < brick.x + this.brickWidth &&
                        this.ball.y > brick.y &&
                        this.ball.y < brick.y + this.brickHeight) {
                        
                        this.ball.dy *= -1;
                        brick.status = 0;
                        this.score += 10;
                        gamePlatform.updateScore(this.score);
                        
                        // Check if all bricks are destroyed
                        if (this.score === this.brickRowCount * this.brickColumnCount * 10) {
                            this.stop();
                            gamePlatform.gameOver(this.score);
                            return;
                        }
                    }
                }
            }
        }
    },
    
    draw() {
        // Clear canvas
        this.ctx.fillStyle = '#000';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw bricks
        for (let row = 0; row < this.brickRowCount; row++) {
            for (let col = 0; col < this.brickColumnCount; col++) {
                const brick = this.bricks[row][col];
                if (brick.status === 1) {
                    this.ctx.fillStyle = brick.color;
                    this.ctx.fillRect(brick.x, brick.y, this.brickWidth, this.brickHeight);
                    this.ctx.strokeStyle = '#000';
                    this.ctx.strokeRect(brick.x, brick.y, this.brickWidth, this.brickHeight);
                }
            }
        }
        
        // Draw paddle
        this.ctx.fillStyle = '#00ff00';
        this.ctx.fillRect(this.paddle.x, this.paddle.y, this.paddle.width, this.paddle.height);
        
        // Draw ball
        this.ctx.fillStyle = '#fff';
        this.ctx.beginPath();
        this.ctx.arc(this.ball.x, this.ball.y, this.ball.radius, 0, Math.PI * 2);
        this.ctx.fill();
    }
};

// Register the game
gamePlatform.registerGame('breakout', breakoutGame);
