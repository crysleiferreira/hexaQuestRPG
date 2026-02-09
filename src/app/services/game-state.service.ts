import { Injectable, signal, computed, WritableSignal, effect } from '@angular/core';
import { GameStats, Item, GameState, CombatLogEntry, NotificationType } from '../models/game.models';

@Injectable({
  providedIn: 'root'
})
export class GameStateService {
  
  // --- Signals ---
  playerStats: WritableSignal<GameStats> = signal(this.getInitialStats());
  
  inventory = signal<Item[]>([]);
  
  equipment = signal<{[key: string]: Item | null}>({
    MainHand: null, OffHand: null, Armor: null
  });
  
  gameState = signal<GameState>({
    currentLevel: 1,
    isPaused: false,
    isBossLevel: false,
    isMainMenu: true
  });

  activeBoss = signal<{name: string, hp: number, maxHp: number} | null>(null);
  combatLog = signal<CombatLogEntry[]>([]);
  notifications = signal<{id: number, message: string, type: NotificationType}[]>([]);

  constructor() {
    // Auto-save effect
    effect(() => {
        const state = {
          stats: this.playerStats(),
          inventory: this.inventory(),
          equipment: this.equipment(),
          level: this.gameState().currentLevel
        };
        if (!this.gameState().isMainMenu && this.playerStats().hp > 0) {
          localStorage.setItem('hexaquest_save', JSON.stringify(state));
        }
    });
  }

  // --- Core Data Logic ---

  getInitialStats(): GameStats {
      return {
        hp: 100, maxHp: 100, mana: 50, maxMana: 50,
        xp: 0, xpToNextLevel: 100, level: 1, gold: 0,
        statPoints: 0, skillPoints: 0,
        strength: 5, intelligence: 5, agility: 5, vitality: 5, dexterity: 5
      };
  }

  addLog(message: string, type: 'damage' | 'heal' | 'info' | 'loot' | 'gold') {
      const entry: CombatLogEntry = { id: Math.random(), message, type, timestamp: Date.now() };
      this.combatLog.update(logs => [...logs.slice(-5), entry]); 
  }

  addNotification(message: string, type: NotificationType) {
      const id = Math.random();
      this.notifications.update(n => [...n, { id, message, type }]);
      setTimeout(() => {
          this.notifications.update(n => n.filter(x => x.id !== id));
      }, 3000);
  }

  gainXp(amount: number) {
      this.playerStats.update(s => {
          let newXp = s.xp + amount;
          let newLevel = s.level;
          let newStatPoints = s.statPoints;
          let newNextXp = s.xpToNextLevel;
          let hp = s.hp;
          let maxHp = s.maxHp;

          if (newXp >= s.xpToNextLevel) { 
              newXp -= s.xpToNextLevel;
              newLevel++;
              newStatPoints += 1; 
              newNextXp = Math.floor(100 * Math.pow(newLevel, 1.2));
              maxHp += 15;
              hp = maxHp; 
              this.addNotification(`LEVEL UP! You reached Level ${newLevel}`, 'levelup');
          }
          return { ...s, xp: newXp, level: newLevel, statPoints: newStatPoints, xpToNextLevel: newNextXp, hp, maxHp };
      });
  }

  equipItem(item: Item) {
     if (item.minLevel > this.playerStats().level) {
         this.addLog(`Need Level ${item.minLevel} to equip!`, 'info');
         return;
     }
     
     if (!item.slot) return; 
     
     this.inventory.update(inv => inv.filter(i => i.id !== item.id));
     
     const currentEquip = this.equipment()[item.slot];
     if (currentEquip) {
         this.inventory.update(inv => [...inv, currentEquip]);
     }
     
     this.equipment.update(eq => ({ ...eq, [item.slot!]: item }));
     this.addLog(`Equipped ${item.name}`, 'info');
  }

  removeItem(item: Item) {
      this.inventory.update(inv => inv.filter(i => i !== item));
  }

  upgradeStat(stat: keyof GameStats) {
      this.playerStats.update(s => {
          if (s.statPoints > 0) {
             const newVal = (s[stat] as number) + 1;
             return { ...s, statPoints: s.statPoints - 1, [stat]: newVal };
          }
          return s;
      });
  }

  usePotion(type: 'health' | 'mana' | 'speed') {
      if (type === 'health') {
          this.playerStats.update(s => ({ ...s, hp: Math.min(s.maxHp, s.hp + s.maxHp * 0.3) }));
          this.addLog("Used Potion (30% HP)", 'heal');
      }
  }

  loadSave(saveData: any) {
      this.playerStats.set(saveData.stats);
      this.inventory.set(saveData.inventory);
      this.equipment.set(saveData.equipment);
      this.gameState.update(s => ({ ...s, currentLevel: saveData.level, isMainMenu: false })); 
  }

  reset() {
      this.playerStats.set(this.getInitialStats());
      this.inventory.set([]);
      this.equipment.set({ MainHand: null, OffHand: null, Armor: null });
      this.gameState.set({ currentLevel: 1, isPaused: false, isBossLevel: false, isMainMenu: false });
  }
}