import { Component, computed, inject, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GameStateService } from '../services/game-state.service';
import { RpgGameService } from '../../services/rpg-game.service';

@Component({
  selector: 'app-hud',
  standalone: true,
  imports: [CommonModule],
  template: `
    <!-- BOSS BAR -->
    @if (activeBoss()) {
    <div class="absolute top-4 left-1/2 -translate-x-1/2 w-[600px] z-20 flex flex-col items-center animate-slide-down">
       <h2 class="text-2xl font-bold text-purple-400 mb-1 text-outline tracking-widest uppercase">{{ activeBoss()!.name }}</h2>
       <div class="w-full h-8 bg-gray-900 rounded border-2 border-purple-600 overflow-hidden relative shadow-2xl">
          <div class="h-full bg-gradient-to-r from-purple-700 to-purple-500 transition-all duration-200"
               [style.width.%]="bossHpPercent()"></div>
          <span class="absolute inset-0 flex items-center justify-center font-bold text-white text-sm text-outline">
            {{ activeBoss()!.hp | number:'1.0-0' }} / {{ activeBoss()!.maxHp | number:'1.0-0' }}
          </span>
       </div>
    </div>
    }

    <!-- PLAYER STATS -->
    <div class="absolute top-4 left-4 w-64 pointer-events-none select-none z-10">
      <div class="flex items-center mb-2">
        <div class="w-10 h-10 rounded-full bg-yellow-600 flex items-center justify-center text-white font-bold border-2 border-yellow-400 shadow-lg text-lg">
          {{ playerStats().level }}
        </div>
        <div class="ml-3 flex flex-col">
          <span class="text-yellow-400 font-bold tracking-wider text-sm">HERO</span>
          <span class="text-xs text-gray-300">Stage {{ gameState().currentLevel }}</span>
        </div>
      </div>

      <div class="relative w-full h-5 bg-gray-900 rounded-full mb-1 border border-gray-700 overflow-hidden">
        <div class="h-full bg-red-600 transition-all duration-300" [style.width.%]="hpPercent()"></div>
        <span class="absolute inset-0 flex items-center justify-center text-xs font-bold text-white shadow-black text-outline">
          {{ playerStats().hp | number:'1.0-0' }} / {{ playerStats().maxHp }}
        </span>
      </div>

      <div class="relative w-full h-4 bg-gray-900 rounded-full mb-1 border border-gray-700 overflow-hidden">
        <div class="h-full bg-blue-600 transition-all duration-300" [style.width.%]="manaPercent()"></div>
      </div>

      <div class="relative w-full h-2 bg-gray-900 rounded-full border border-gray-700 overflow-hidden mt-1">
        <div class="h-full bg-yellow-500 transition-all duration-300" [style.width.%]="xpPercent()"></div>
      </div>
      
      <div class="mt-2 text-yellow-400 text-sm font-mono flex items-center gap-1">
        <span class="text-lg">🪙</span> {{ playerStats().gold }}
        @if (playerStats().statPoints > 0) {
          <span class="ml-2 px-2 py-0.5 bg-red-600 text-white rounded text-xs animate-pulse font-bold">Points! (Press I)</span>
        }
      </div>
    </div>

    <!-- SKILLS -->
    <div class="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-3 pointer-events-auto z-10">
      <div class="flex flex-col items-center">
        <button (click)="usePotion('health')" class="w-12 h-12 bg-gray-800 border-2 border-red-500 rounded flex items-center justify-center hover:bg-red-900/50 transition relative group">
          <div class="w-6 h-6 bg-red-500 rounded-full blur-[2px]"></div>
          <span class="absolute top-0 right-1 text-xs font-bold text-white">1</span>
        </button>
        <span class="text-[10px] text-gray-400 mt-1">HP</span>
      </div>
      
      <div class="flex flex-col items-center">
        <button class="w-14 h-14 bg-gray-800 border-2 border-white rounded flex items-center justify-center relative hover:bg-gray-700 overflow-hidden">
          @if (isAttackOnCooldown()) {
            <div class="absolute inset-0 bg-black/60 animate-cooldown-wipe origin-bottom z-10"></div>
          }
          <span class="text-2xl">⚔️</span>
          <span class="absolute bottom-1 right-1 text-[10px] font-bold">LMB</span>
        </button>
        <span class="text-[10px] text-gray-400 mt-1">Attack</span>
      </div>
    </div>

    <!-- LOG & NOTIFICATIONS -->
    <div class="absolute bottom-4 right-4 w-64 h-48 overflow-hidden flex flex-col justify-end pointer-events-none z-10">
      @for (log of combatLog(); track log.id) {
        <div class="text-xs mb-1 text-shadow-sm font-mono animate-fade-in" 
            [class.text-red-400]="log.type === 'damage'"
            [class.text-green-400]="log.type === 'heal'"
            [class.text-yellow-400]="log.type === 'loot' || log.type === 'gold'"
            [class.text-blue-300]="log.type === 'info'">
          {{ log.message }}
        </div>
      }
    </div>

    <div class="absolute top-1/4 left-1/2 -translate-x-1/2 flex flex-col gap-2 items-center pointer-events-none z-20">
      @for (notif of notifications(); track notif.id) {
        <div class="px-6 py-2 rounded-lg bg-black/60 text-white font-bold text-xl backdrop-blur-sm border border-white/20 animate-slide-up shadow-xl"
             [class.text-yellow-400]="notif.type === 'levelup'"
             [class.text-purple-400]="notif.type === 'boss'">
          {{ notif.message }}
        </div>
      }
    </div>
  `
})
export class HudComponent {
  private state = inject(GameStateService);
  private game = inject(RpgGameService);

  playerStats = this.state.playerStats;
  gameState = this.state.gameState;
  activeBoss = this.state.activeBoss;
  combatLog = this.state.combatLog;
  notifications = this.state.notifications;

  isAttackOnCooldown = signal(false);

  hpPercent = computed(() => (this.playerStats().hp / this.playerStats().maxHp) * 100);
  manaPercent = computed(() => (this.playerStats().mana / this.playerStats().maxMana) * 100);
  xpPercent = computed(() => (this.playerStats().xp / this.playerStats().xpToNextLevel) * 100);
  bossHpPercent = computed(() => this.activeBoss() ? (this.activeBoss()!.hp / this.activeBoss()!.maxHp) * 100 : 0);

  constructor() {
      effect(() => {
        if (this.game.lastAttackTimestamp() > 0) {
            this.isAttackOnCooldown.set(true);
            setTimeout(() => this.isAttackOnCooldown.set(false), this.game.ATTACK_COOLDOWN);
        }
    });
  }

  usePotion(type: 'health' | 'mana' | 'speed') {
      this.state.usePotion(type);
  }
}