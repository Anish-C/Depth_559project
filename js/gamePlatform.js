// Game Platform Core
const gamePlatform = {
    canvas: null,
    ctx: null,
    currentGame: null,
    games: {},
    
    init() {
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');
    },
    
    registerGame(name, gameObject) {
        this.games[name] = gameObject;
    },
    
    startGame(gameName) {
        const game = this.games[gameName];
        if (!game) {
            console.error('Game not found:', gameName);
            return;
        }
        
        // Hide menu, show game container
        document.getElementById('menu').style.display = 'none';
        document.getElementById('game-container').style.display = 'block';
        document.getElementById('game-over').style.display = 'none';
        
        // Set game title and controls
        document.getElementById('game-title').textContent = game.title;
        document.getElementById('controls-text').textContent = game.controls;
        
        // Initialize and start the game
        this.currentGame = game;
        game.init(this.canvas, this.ctx);
        game.start();
    },
    
    restartGame() {
        if (this.currentGame) {
            document.getElementById('game-over').style.display = 'none';
            this.currentGame.init(this.canvas, this.ctx);
            this.currentGame.start();
        }
    },
    
    returnToMenu() {
        if (this.currentGame) {
            this.currentGame.stop();
            this.currentGame = null;
        }
        
        document.getElementById('menu').style.display = 'block';
        document.getElementById('game-container').style.display = 'none';
        document.getElementById('game-over').style.display = 'none';
    },
    
    updateScore(score) {
        document.getElementById('score-value').textContent = score;
    },
    
    gameOver(score) {
        if (this.currentGame) {
            this.currentGame.stop();
        }
        document.getElementById('final-score').textContent = score;
        document.getElementById('game-over').style.display = 'block';
    }
};
