import { Component, ElementRef, ViewChild, AfterViewInit, OnDestroy, signal, HostListener, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RpgGameService } from './services/rpg-game.service';
import { GameStateService } from './app/services/game-state.service';
import { StartScreenComponent } from './app/components/start-screen.component';
import { HudComponent } from './app/components/hud.component';
import { InventoryComponent } from './app/components/inventory.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, StartScreenComponent, HudComponent, InventoryComponent],
  templateUrl: './app.component.html',
})
export class AppComponent implements AfterViewInit, OnDestroy {
  @ViewChild('gameCanvas') canvasRef!: ElementRef<HTMLCanvasElement>;

  private gameService = inject(RpgGameService);
  private gameStateService = inject(GameStateService);

  gameState = this.gameStateService.gameState;
  playerStats = this.gameStateService.playerStats;
  
  showInventory = signal(false);

  ngAfterViewInit() {
    this.gameService.initialize(this.canvasRef.nativeElement);
    const save = localStorage.getItem('hexaquest_save');
    if (save) {
      try {
        this.gameStateService.loadSave(JSON.parse(save));
        this.gameStateService.addLog("Game Loaded.", 'info');
      } catch (e) { console.error("Save load failed", e); }
    }
  }

  ngOnDestroy() {
    this.gameService.dispose();
  }

  @HostListener('window:keydown', ['$event'])
  handleKeyDown(event: KeyboardEvent) {
    if (this.gameState().isMainMenu) return;

    if (event.key === 'Escape' || event.key.toLowerCase() === 'i') {
      this.toggleInventory();
    }
    if (event.key === '1') this.gameStateService.usePotion('health');
  }

  onStartGame() {
    this.gameService.startGame();
  }

  toggleInventory() {
    this.showInventory.update(v => !v);
    this.gameService.setPaused(this.showInventory());
  }

  restartGame() {
    this.gameStateService.reset();
    this.showInventory.set(false);
  }
}