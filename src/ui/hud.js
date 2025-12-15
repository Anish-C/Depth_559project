export class HUD {
    constructor() {
      this.toolEl = document.getElementById("hudTool");
      this.statusEl = document.getElementById("hudStatus");
  
      this.steveBar = document.getElementById("steveBar");
      this.steveText = document.getElementById("steveText");
    }
  
    setTool(name) {
      this.toolEl.textContent = name;
    }
  
    setStatus(text) {
      this.statusEl.textContent = text || "";
    }
  
    setSteveHP(hp, maxHP) {
      const p = Math.max(0, Math.min(1, hp / maxHP));
      this.steveBar.style.width = `${(p * 100).toFixed(1)}%`;
      this.steveText.textContent = `${Math.round(hp)} / ${Math.round(maxHP)}`;
    }

  }
  