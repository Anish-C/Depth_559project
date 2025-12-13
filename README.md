# 3D Underwater Environment

An immersive 3D underwater scene built with Three.js featuring procedurally generated rocky ocean floor terrain, first-person exploration controls, and realistic underwater atmosphere.

## 🌊 Features

- **Procedural Rocky Terrain** - Multi-octave noise generation creates natural-looking ocean floor (200×200 units, 100×100 segments)
- **First-Person POV Controls** - Full WASD/Arrow key movement with mouse look (pointer lock API)
- **Underwater Atmosphere** - Distance-based fog, ambient/directional/point lighting with cyan underwater tones
- **Floating Particles** - 1000 animated particles simulating plankton and underwater debris
- **Rock Formations** - 30+ procedurally placed dodecahedron rocks with varied sizes and rotations
- **Interactive Customization** - Real-time controls to toggle fog, lighting, and regenerate terrain
- **Fully Customizable** - Exposed CONFIG object for terrain, fog, lighting, and movement parameters
- **Zero Dependencies** - Three.js loaded from CDN with SRI integrity check

## 🚀 Quick Start

### Running the Environment

1. Clone this repository:
   ```bash
   git clone <repository-url>
   cd Depth_559project
   ```

2. Open `index.html` in your web browser:
   - **Option 1**: Double-click `index.html`
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

3. Click anywhere on the screen to lock mouse controls, then explore:
   - **WASD** or **Arrow Keys** - Move forward/back/left/right
   - **Mouse** - Look around (360° first-person view)
   - **Space** - Swim up
   - **Shift** - Swim down

### No Build Step Required!

This project uses vanilla JavaScript with Three.js from CDN. No build tools, bundlers, or package managers needed. Just open the HTML file and start exploring!

## 📁 Project Structure

```
Depth_559project/
├── index.html              # Main underwater environment page
├── css/
│   └── underwater-style.css # UI styling for underwater scene
├── js/
│   └── underwater.js        # Three.js scene with terrain and controls
└── README.md                # This file
```

## 🎯 How to Customize

The underwater environment is highly customizable through the `CONFIG` object in `js/underwater.js`:

```javascript
const CONFIG = {
    terrain: {
        width: 200,          // Terrain width in units
        depth: 200,          // Terrain depth in units
        segments: 100,       // Mesh detail (higher = smoother)
        heightScale: 15,     // Terrain height variation
        rockiness: 0.8,      // 0-1, controls how rocky the terrain is
    },
    fog: {
        enabled: true,
        color: 0x001a33,     // Deep blue underwater color
        near: 10,            // Fog starts at this distance
        far: 150,            // Fog fully obscures at this distance
    },
    lighting: {
        ambientIntensity: 0.4,
        directionalIntensity: 0.8,
        directionalColor: 0x4dd0e1,  // Cyan underwater light
    },
    movement: {
        speed: 0.2,          // Movement speed
        lookSpeed: 0.002,    // Mouse sensitivity
    }
};
```

### Interactive Controls

The UI provides buttons to customize the scene in real-time:
- **Toggle Fog** - Enable/disable underwater fog effect
- **Toggle Lighting** - Turn lights on/off to see the effect
- **Regenerate Terrain** - Create a new random rocky ocean floor

### Advanced Customization

To further customize the underwater scene:

1. **Terrain Shape** - Modify the `noise()` function in `js/underwater.js` to change terrain generation algorithm
2. **Add Objects** - Use `addRocks()` as a template to add new underwater objects:
   - Coral reefs (ConeGeometry or custom shapes)
   - Shipwrecks (BoxGeometry + custom materials)
   - Underwater vegetation (PlaneGeometry with textures)
   - Animated fish (SphereGeometry + movement logic)
3. **Colors** - Adjust material colors in `createTerrain()` and lighting colors in `setupLighting()`
4. **Particles** - Modify `addParticles()` to change the underwater debris/plankton effect
5. **Water Effect** - Adjust fog density and color for different water clarity

## 🎮 Technical Architecture

The underwater environment uses a standard Three.js pattern:

```
┌─────────────────────────────────────┐
│  requestAnimationFrame Loop         │
├─────────────────────────────────────┤
│  1. Calculate deltaTime             │
│  2. Update movement & particles     │
│  3. Render scene with camera        │
│  4. Request next frame              │
└─────────────────────────────────────┘
```

**Key Components:**
- **Scene** - Three.js scene container
- **Camera** - PerspectiveCamera with Euler rotation for POV
- **Terrain** - PlaneGeometry with procedurally modified vertices
- **Lighting** - Ambient, directional, and point lights
- **Particles** - BufferGeometry with 1000 points
- **Controls** - Pointer lock API for mouse look, keyboard for movement

## 📱 Mobile Support

The environment includes touch event handling for mobile devices. Touch events are mapped to movement controls for mobile exploration.

## 🔧 Development Tips

1. **Use Console Logging** - The environment includes helpful console messages. Open browser DevTools to see them.

2. **Adjust Performance** - If the scene runs slowly:
   - Reduce `CONFIG.terrain.segments` (default: 100)
   - Reduce particle count in `addParticles()` (default: 1000)
   - Simplify rock count in `addRocks()` (default: 30)

3. **Test Movement** - Use browser DevTools to monitor frame rate and adjust `CONFIG.movement.speed`

4. **Use Browser DevTools**:
   - Console for debugging
   - Network tab to verify Three.js CDN loading
   - Performance tab to optimize render loop

5. **Comment Your Code** - Follow the commenting style in the underwater.js template

## 📚 Extension Ideas

Here are some ideas for extending the underwater environment:

- **Marine Life** - Add animated fish, jellyfish, or other sea creatures
- **Coral Reefs** - Create colorful coral formations using custom geometries
- **Shipwrecks** - Add sunken ships or ancient ruins to explore
- **Treasure Hunt** - Place collectible objects around the ocean floor
- **Different Biomes** - Create areas with sand, rocks, coral, or deep trenches
- **Caustics Effect** - Add animated light patterns on the ocean floor
- **Submarines** - Add a controllable submarine model
- **Underwater Caves** - Generate cave systems to explore

## 📄 License

This is a starter template - use it however you like! No attribution required.

## 🐛 Troubleshooting

**Scene not showing?**
- Check browser console for errors
- Verify Three.js CDN is loading (check Network tab)
- Make sure WebGL is supported by your browser

**Controls not working?**
- Click on the canvas to enable pointer lock
- Check browser console for event listener errors
- Try refreshing the page

**Performance issues?**
- Reduce `CONFIG.terrain.segments` value
- Decrease particle count in `addParticles()`
- Lower rock count in `addRocks()`
- Close other browser tabs to free up resources

**Mouse sensitivity too high/low?**
- Adjust `CONFIG.movement.lookSpeed` (default: 0.002)
- Higher values = more sensitive
- Lower values = less sensitive

---

**Enjoy exploring the underwater world! 🌊**

Start by modifying the `update()` and `render()` methods in `js/game.js` to bring your game idea to life!