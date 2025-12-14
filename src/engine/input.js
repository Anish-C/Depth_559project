export class Input {
    constructor(domElement) {
      this.dom = domElement;
  
      this.keys = new Set();
  
      this.isPointerLocked = false;
      this.mouseDX = 0;
      this.mouseDY = 0;
  
      this.mouseLeftDown = false;
      this.mouseLeftPressedThisFrame = false;
  
      window.addEventListener("keydown", (e) => this.keys.add(e.code));
      window.addEventListener("keyup", (e) => this.keys.delete(e.code));
  
      window.addEventListener("mousemove", (e) => {
        if (!this.isPointerLocked) return;
        this.mouseDX += e.movementX;
        this.mouseDY += e.movementY;
      });
  
      window.addEventListener("mousedown", (e) => {
        if (e.button === 0) {
          this.mouseLeftDown = true;
          this.mouseLeftPressedThisFrame = true;
        }
      });
  
      window.addEventListener("mouseup", (e) => {
        if (e.button === 0) {
          this.mouseLeftDown = false;
        }
      });
  
      document.addEventListener("pointerlockchange", () => {
        this.isPointerLocked = (document.pointerLockElement === this.dom);
      });
    }
  
    requestPointerLock() {
      this.dom.requestPointerLock();
    }
  
    down(code) {
      return this.keys.has(code);
    }
  
    consumeMouseDelta() {
      const dx = this.mouseDX;
      const dy = this.mouseDY;
      this.mouseDX = 0;
      this.mouseDY = 0;
      return { dx, dy };
    }
  
    // Call once per frame
    consumeMouseButtons() {
      const leftPressed = this.mouseLeftPressedThisFrame;
      this.mouseLeftPressedThisFrame = false;
      return { leftPressed, leftDown: this.mouseLeftDown };
    }
  }  