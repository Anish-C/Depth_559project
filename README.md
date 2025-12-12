# 🎮 JavaScript Game Platform

A modern, responsive web-based game platform featuring classic arcade games built with vanilla JavaScript, HTML5 Canvas, and CSS3.

## 🌟 Features

- **Three Classic Games:**
  - 🐍 **Snake** - Classic snake game where you eat food and grow longer
  - 🏓 **Pong** - Retro arcade game with paddle and ball mechanics
  - 🧱 **Breakout** - Brick-breaking game with colorful bricks

- **Modern Design:**
  - Beautiful gradient UI with smooth animations
  - Fully responsive layout for desktop and mobile
  - Clean, intuitive game selection menu
  - Real-time score tracking

- **Game Features:**
  - Smooth gameplay with proper collision detection
  - Keyboard and mouse controls
  - Progressive difficulty (speed increases in Snake and Pong)
  - Game over screen with restart option
  - Easy navigation between games

## 🚀 Getting Started

### Prerequisites
- A modern web browser (Chrome, Firefox, Safari, or Edge)
- No installation or build process required!

### How to Play

1. **Open the game platform:**
   - Simply open `index.html` in your web browser
   - Or use a local server: `python -m http.server 8000` or `npx serve`

2. **Select a game:**
   - Click on any game card to start playing

3. **Game Controls:**

   **Snake:**
   - Arrow keys to move (Up, Down, Left, Right)
   - Eat red food to grow and score points
   - Avoid hitting walls or yourself

   **Pong:**
   - Arrow Up/Down to move the paddle
   - Keep the ball in play by bouncing it with your paddle
   - Ball speeds up as your score increases

   **Breakout:**
   - Arrow Left/Right or Mouse to move the paddle
   - Break all bricks to win
   - Don't let the ball fall off the bottom

4. **Navigation:**
   - Click "Back to Menu" to return to game selection
   - Click "Play Again" after game over to restart
   - Score is displayed at the top of the screen

## 📁 Project Structure

```
Depth_559project/
├── index.html              # Main HTML file
├── styles.css              # Global styles and UI design
├── js/
│   ├── gamePlatform.js    # Core game platform engine
│   └── games/
│       ├── snake.js       # Snake game implementation
│       ├── pong.js        # Pong game implementation
│       └── breakout.js    # Breakout game implementation
└── README.md              # This file
```

## 🎨 Customization

### Adding New Games

To add a new game to the platform:

1. Create a new game file in `js/games/` (e.g., `mygame.js`)

2. Define your game object with required methods:
```javascript
const myGame = {
    title: 'My Game',
    controls: 'Game controls description',
    canvas: null,
    ctx: null,
    score: 0,
    gameLoop: null,
    
    init(canvas, ctx) {
        // Initialize game state
    },
    
    start() {
        // Start the game loop
    },
    
    stop() {
        // Clean up and stop the game
    },
    
    update() {
        // Update game logic
    },
    
    draw() {
        // Draw game graphics
    }
};

// Register the game
gamePlatform.registerGame('mygame', myGame);
```

3. Add the game to `index.html`:
```html
<!-- In the menu section -->
<div class="game-card" data-game="mygame">
    <div class="game-icon">🎲</div>
    <h3>My Game</h3>
    <p>Description of your game</p>
    <button onclick="gamePlatform.startGame('mygame')">Play</button>
</div>

<!-- Before closing body tag -->
<script src="js/games/mygame.js"></script>
```

### Styling

Modify `styles.css` to customize:
- Color schemes (gradients, backgrounds)
- Button styles
- Card layouts
- Responsive breakpoints

## 🛠️ Technologies Used

- **HTML5 Canvas** - For game rendering
- **Vanilla JavaScript** - Game logic and platform core
- **CSS3** - Modern UI with gradients and animations
- **No frameworks or libraries** - Pure, lightweight implementation

## 🎯 Game Mechanics

### Snake
- Grid-based movement system
- Collision detection for walls and self
- Random food spawning
- Score increases by 10 per food item
- Speed increases every 50 points

### Pong
- Physics-based ball movement
- Paddle collision with angle variation
- Wall bouncing
- Score increases by 10 per paddle hit
- Ball speed increases every 100 points

### Breakout
- Multi-row brick layout with colors
- Paddle and ball physics
- Mouse and keyboard controls
- Score increases by 10 per brick
- Win condition when all bricks destroyed

## 🌐 Browser Compatibility

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## 📝 License

This project is open source and available for educational purposes.

## 🤝 Contributing

Feel free to fork this project and add your own games or improvements!

## 🎮 Have Fun!

Enjoy playing these classic games and feel free to extend the platform with your own creations!