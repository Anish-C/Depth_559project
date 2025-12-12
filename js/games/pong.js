// Pong Game
const pongGame = {
    title: 'Pong',
    controls: 'Use Arrow Up/Down keys to move the paddle. Keep the ball in play!',
    canvas: null,
    ctx: null,
    paddle: {},
    ball: {},
    score: 0,
    gameLoop: null,
    
    init(canvas, ctx) {
        this.canvas = canvas;
        this.ctx = ctx;
        this.canvas.width = 600;
        this.canvas.height = 400;
        
        // Initialize paddle
        this.paddle = {
            x: 20,
            y: this.canvas.height / 2 - 50,
            width: 10,
            height: 100,
            speed: 8,
            dy: 0
        };
        
        // Initialize ball
        this.resetBall();
        
        this.score = 0;
        this.setupControls();
        gamePlatform.updateScore(this.score);
    },
    
    resetBall() {
        this.ball = {
            x: this.canvas.width / 2,
            y: this.canvas.height / 2,
            radius: 8,
            speed: 4,
            dx: 4,
            dy: 3
        };
    },
    
    setupControls() {
        if (this.keyHandler) {
            document.removeEventListener('keydown', this.keyHandler);
            document.removeEventListener('keyup', this.keyUpHandler);
        }
        
        this.keyHandler = (e) => {
            if (e.key === 'ArrowUp') {
                this.paddle.dy = -this.paddle.speed;
                e.preventDefault();
            } else if (e.key === 'ArrowDown') {
                this.paddle.dy = this.paddle.speed;
                e.preventDefault();
            }
        };
        
        this.keyUpHandler = (e) => {
            if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                this.paddle.dy = 0;
                e.preventDefault();
            }
        };
        
        document.addEventListener('keydown', this.keyHandler);
        document.addEventListener('keyup', this.keyUpHandler);
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
            this.keyHandler = null;
            this.keyUpHandler = null;
        }
    },
    
    update() {
        // Move paddle
        this.paddle.y += this.paddle.dy;
        
        // Paddle boundaries
        if (this.paddle.y < 0) {
            this.paddle.y = 0;
        }
        if (this.paddle.y + this.paddle.height > this.canvas.height) {
            this.paddle.y = this.canvas.height - this.paddle.height;
        }
        
        // Move ball
        this.ball.x += this.ball.dx;
        this.ball.y += this.ball.dy;
        
        // Ball collision with top/bottom walls
        if (this.ball.y - this.ball.radius < 0 || 
            this.ball.y + this.ball.radius > this.canvas.height) {
            this.ball.dy *= -1;
        }
        
        // Ball collision with paddle
        if (this.ball.x - this.ball.radius < this.paddle.x + this.paddle.width &&
            this.ball.x + this.ball.radius > this.paddle.x &&
            this.ball.y > this.paddle.y &&
            this.ball.y < this.paddle.y + this.paddle.height) {
            
            // Calculate hit position on paddle (-1 to 1)
            const hitPos = (this.ball.y - (this.paddle.y + this.paddle.height / 2)) / (this.paddle.height / 2);
            this.ball.dy = hitPos * 5;
            this.ball.dx = Math.abs(this.ball.dx);
            
            this.score += 10;
            gamePlatform.updateScore(this.score);
            
            // Increase speed slightly
            if (this.score % 100 === 0) {
                this.ball.dx *= 1.1;
                this.ball.speed *= 1.1;
            }
        }
        
        // Ball collision with right wall (bounce back)
        if (this.ball.x + this.ball.radius > this.canvas.width) {
            this.ball.dx *= -1;
        }
        
        // Ball out of bounds (left side)
        if (this.ball.x - this.ball.radius < 0) {
            this.stop();
            gamePlatform.gameOver(this.score);
        }
    },
    
    draw() {
        // Clear canvas
        this.ctx.fillStyle = '#000';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw center line
        this.ctx.strokeStyle = '#fff';
        this.ctx.setLineDash([5, 5]);
        this.ctx.beginPath();
        this.ctx.moveTo(this.canvas.width / 2, 0);
        this.ctx.lineTo(this.canvas.width / 2, this.canvas.height);
        this.ctx.stroke();
        this.ctx.setLineDash([]);
        
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
gamePlatform.registerGame('pong', pongGame);
