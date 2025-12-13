# Game Platform Starter Template

A minimal, extensible browser-based game platform starter template built with vanilla JavaScript. This template provides a clean foundation for building 2D games without any pre-built game logic, allowing you to start developing immediately.

## 🌊 NEW: 3D Underwater Environment

An immersive 3D underwater scene built with Three.js featuring:
- **Rocky ocean floor terrain** with procedural generation
- **First-person POV controls** (WASD/Arrow keys + mouse look)
- **Underwater atmosphere** with fog, lighting, and floating particles
- **Fully customizable** - regenerate terrain, toggle effects, adjust parameters

## 🎮 Features

**2D Game Framework:**
- **Clean HTML5 Structure**: Semantic markup with canvas element and UI controls
- **Responsive Design**: Mobile-friendly layout that works on all screen sizes
- **Game Loop Framework**: Built-in `requestAnimationFrame` game loop with delta time
- **Input Handling**: Pre-configured keyboard, mouse, and touch event listeners
- **Score Management**: Score tracking with localStorage persistence for high scores
- **Utility Functions**: Helpful math and collision detection utilities
- **CSS Variables**: Easy theming with CSS custom properties
- **Well-Commented**: Clear documentation explaining where to add your game logic

**3D Underwater World:**
- Procedural rocky terrain generation
- First-person exploration with mouse look controls
- Underwater lighting and atmospheric effects
- Interactive customization controls
- Built with Three.js

## 🚀 Quick Start

### Running the Platform

1. Clone this repository:
   ```bash
   git clone <repository-url>
   cd Depth_559project
   ```

2. Open `index.html` in your web browser:
   - **Option 1**: Double-click `index.html` to see the main hub page
   - **Option 2**: Use a local server (recommended):
     ```bash
     # Using Python 3
     python -m http.server 8000
     
     # Using Python 2
     python -m SimpleHTTPServer 8000
     
     # Using Node.js (if you have http-server installed)
     npx http-server
     ```
   - **Option 3**: Use VS Code's Live Server extension

3. From the hub page, choose:
   - **2D Game Framework** - Build canvas-based 2D games
   - **3D Underwater World** - Explore the immersive underwater environment

### No Build Step Required!

This template uses vanilla JavaScript and requires no build tools, bundlers, or package managers. Just open the HTML file and start coding!

## 📁 Project Structure

```
Depth_559project/
├── index.html              # Main hub/landing page (NEW!)
├── game-platform.html      # 2D game framework with canvas
├── underwater.html         # 3D underwater environment
├── css/
│   ├── style.css           # Styling for 2D game platform
│   └── underwater-style.css # Styling for 3D underwater scene
├── js/
│   ├── game.js         # Main 2D game framework and loop
│   ├── utils.js        # Utility functions and helpers
│   └── underwater.js   # 3D underwater scene with Three.js
└── README.md           # This file
```

## 🎯 How to Build Your Game

### 1. Game Initialization

Add your game setup logic in the `Game.init()` method or after it:

```javascript
// In js/game.js - after line 62 (in init method)
// Example: Initialize your game objects
this.player = {
    x: this.canvas.width / 2,
    y: this.canvas.height / 2,
    width: 50,
    height: 50,
    speed: 200
};
```

### 2. Game Logic (Update)

Add your game logic in the `Game.update(deltaTime)` method:

```javascript
// In js/game.js - in the update method (around line 254)
// Example: Move player based on input
if (this.keys['arrowleft'] || this.keys['a']) {
    this.player.x -= this.player.speed * deltaTime;
}
if (this.keys['arrowright'] || this.keys['d']) {
    this.player.x += this.player.speed * deltaTime;
}
```

### 3. Rendering (Draw)

Add your drawing logic in the `Game.render()` method:

```javascript
// In js/game.js - in the render method (around line 280)
// Example: Draw the player
this.ctx.fillStyle = '#4a90e2';
this.ctx.fillRect(this.player.x, this.player.y, this.player.width, this.player.height);
```

### 4. Event Handling

Customize input handling in the event listeners:

```javascript
// In js/game.js - in setupEventListeners method (around line 75)
// Add custom keyboard handling
if (e.key === ' ') {
    // Jump or shoot logic
}
```

## 🛠️ Available Utilities

The `js/utils.js` file includes helpful functions:

- **Random Numbers**: `Utils.randomInt()`, `Utils.randomFloat()`
- **Math Helpers**: `Utils.clamp()`, `Utils.lerp()`, `Utils.distance()`
- **Collision Detection**: `Utils.rectCollision()`, `Utils.circleCollision()`
- **Angle Conversion**: `Utils.toRadians()`, `Utils.toDegrees()`
- **Array Helpers**: `Utils.randomChoice()`, `Utils.shuffle()`
- **Vector2 Class**: For 2D physics and movement

### Example Usage:

```javascript
// Generate random position
const x = Utils.randomInt(0, this.canvas.width);
const y = Utils.randomInt(0, this.canvas.height);

// Check collision between two rectangles
if (Utils.rectCollision(player, enemy)) {
    // Handle collision
}

// Use vectors for movement
const velocity = new Utils.Vector2(5, 0);
const position = new Utils.Vector2(100, 100);
const newPosition = position.add(velocity);
```

## 🎨 Customizing the Appearance

### CSS Variables

Edit the CSS variables in `css/style.css` to change the theme:

```css
:root {
    --primary-color: #4a90e2;      /* Main accent color */
    --secondary-color: #50c878;    /* Secondary accent */
    --background-color: #f5f5f5;   /* Page background */
    --canvas-border: #333;         /* Canvas border color */
}
```

### Canvas Size

Adjust the canvas dimensions in `index.html`:

```html
<canvas id="gameCanvas" width="800" height="600"></canvas>
```

## 🎮 Game Loop Architecture

The template uses a standard game loop pattern:

```
┌─────────────────────────────────────┐
│  requestAnimationFrame Loop         │
├─────────────────────────────────────┤
│  1. Calculate deltaTime             │
│  2. Update game logic (update())    │
│  3. Render everything (render())    │
│  4. Request next frame              │
└─────────────────────────────────────┘
```

**Delta Time**: The time difference between frames is passed to `update()`, allowing for frame-rate independent movement.

## 📱 Mobile Support

The template includes touch event handling for mobile devices. Touch events are mapped to mouse events, so your mouse-based interactions will work on mobile too.

## 💾 Score Persistence

High scores are automatically saved to `localStorage` and persist between sessions. The score management is handled by:

- `Game.addScore(points)` - Add points and update display
- `Game.loadHighScore()` - Load saved high score
- `Game.saveHighScore()` - Save current high score

## 🔧 Development Tips

1. **Use Console Logging**: The template includes helpful console messages. Open browser DevTools to see them.

2. **Start Simple**: Begin with basic shapes and movement before adding complex features.

3. **Test Frequently**: Refresh your browser often to test changes.

4. **Use Browser DevTools**: 
   - Console for debugging
   - Network tab to verify file loading
   - Performance tab to optimize your game loop

5. **Comment Your Code**: Follow the commenting style in the template.

## 📚 Next Steps

Here are some ideas for what to build:

- **Platformer**: Add gravity, jumping, and platforms
- **Shooter**: Add projectiles and enemies
- **Puzzle Game**: Implement grid-based logic
- **Arcade Game**: Create classic arcade-style gameplay
- **Physics Simulation**: Use the Vector2 class for realistic movement

## 🤝 Contributing

Feel free to fork this template and customize it for your needs. If you build something cool, share it!

## 📄 License

This is a starter template - use it however you like! No attribution required.

---

## 🌊 3D Underwater Environment Guide

### Overview

The underwater environment (`underwater.html`) is a fully immersive 3D scene built with Three.js that showcases:
- Procedurally generated rocky ocean floor terrain
- First-person camera controls for exploring the underwater world
- Realistic underwater effects (fog, lighting, particles)
- Interactive UI for customization

### Getting Started

1. Open `underwater.html` in a web browser (local server recommended)
2. Click anywhere on the screen to enable mouse controls
3. Use WASD or Arrow keys to move around
4. Move your mouse to look around (first-person POV)
5. Use Space to swim up, Shift to swim down

### Customization

The underwater environment is highly customizable through the `CONFIG` object in `js/underwater.js`:

```javascript
const CONFIG = {
    terrain: {
        width: 200,          // Terrain width
        depth: 200,          // Terrain depth
        segments: 100,       // Mesh detail (higher = smoother)
        heightScale: 15,     // Terrain height variation
        rockiness: 0.8,      // 0-1, controls how rocky the terrain is
    },
    fog: {
        enabled: true,
        color: 0x001a33,     // Underwater blue color
        near: 10,
        far: 150,
    },
    lighting: {
        ambientIntensity: 0.4,
        directionalIntensity: 0.8,
        directionalColor: 0x4dd0e1,  // Cyan underwater light
    },
};
```

### Interactive Controls

The UI provides buttons to customize the scene in real-time:
- **Toggle Fog**: Enable/disable underwater fog effect
- **Toggle Lighting**: Turn lights on/off to see the effect
- **Regenerate Terrain**: Create a new random rocky ocean floor

### Advanced Customization

To further customize the underwater scene:

1. **Terrain Shape**: Modify the `noise()` function in `js/underwater.js` to change terrain generation
2. **Add Objects**: Use `addRocks()` as a template to add new underwater objects (coral, shipwrecks, etc.)
3. **Colors**: Adjust material colors in `createTerrain()` and lighting colors in `setupLighting()`
4. **Particles**: Modify `addParticles()` to change the underwater debris/plankton effect
5. **Water Effect**: Adjust fog density and color for different water clarity

### Technical Details

- **Three.js Version**: r128 (loaded from CDN)
- **Terrain Generation**: Multi-octave noise for natural-looking rocky formations
- **Camera System**: First-person with Euler angle rotation for POV control
- **Performance**: ~1000 particles, 30 rocks, 100x100 terrain segments
- **Browser Support**: Modern browsers with WebGL support

### Code Structure

The `underwater.js` file is organized into clear sections:
- Configuration object for easy parameter adjustment
- Initialization (`init()`) sets up scene, camera, renderer
- Terrain generation (`createTerrain()`) with procedural noise
- Lighting setup (`setupLighting()`) for underwater atmosphere
- Control handlers (`setupControls()`) for movement and POV
- Animation loop (`animate()`) for rendering and updates

### Tips for Development

1. **Adjust Terrain**: Change `CONFIG.terrain.rockiness` for different ocean floor types
2. **Performance**: Reduce `segments` if the scene runs slowly
3. **Visibility**: Adjust fog `near` and `far` values for water clarity
4. **Movement Speed**: Modify `CONFIG.movement.speed` and `lookSpeed` for different feel
5. **Add Features**: Use the existing code as a foundation to add submarines, fish, etc.

---

## 🐛 Troubleshooting

**Canvas not showing?**
- Check browser console for errors
- Verify all file paths are correct
- Make sure JavaScript files are loading

**Input not working?**
- Click on the canvas to focus it
- Check browser console for event listener errors

**Game running too fast/slow?**
- The delta time system should handle this, but you can adjust speed values

**Styling issues?**
- Check that `css/style.css` is properly linked
- Use browser DevTools to inspect elements

## 📞 Support

If you encounter issues:
1. Check the browser console for errors
2. Verify all files are in the correct locations
3. Make sure you're using a modern browser (Chrome, Firefox, Safari, Edge)

---

**Happy Game Development! 🎮**

Start by modifying the `update()` and `render()` methods in `js/game.js` to bring your game idea to life!