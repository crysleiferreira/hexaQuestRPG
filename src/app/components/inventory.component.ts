import { Component, output, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GameStateService } from '../services/game-state.service';
import { Item, Rarity, GameStats } from '../models/game.models';

@Component({
  selector: 'app-inventory',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="absolute inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center animate-fade-in">
      <div class="bg-gray-900 border border-gray-600 w-[900px] h-[650px] rounded-lg shadow-2xl flex flex-col relative" (click)="$event.stopPropagation()">
        
        <div class="flex justify-between items-center p-4 border-b border-gray-700 bg-gray-800 rounded-t-lg">
          <h2 class="text-xl font-bold text-yellow-500">Inventory & Stats</h2>
          <button (click)="close.emit()" class="text-gray-400 hover:text-white">✕ ESC</button>
        </div>

        <div class="flex flex-1 overflow-hidden">
          <!-- LEFT: EQUIPMENT & STATS -->
          <div class="w-1/3 p-4 border-r border-gray-700 bg-gray-800/50 overflow-y-auto">
            <div class="mb-6">
              <h3 class="text-sm font-bold text-gray-400 uppercase mb-2">Equipment</h3>
              <div class="space-y-2">
                @for (slot of ['MainHand', 'OffHand', 'Armor'] ; track slot) {
                  <div class="flex items-center justify-between p-2 bg-gray-900 rounded border border-gray-700 h-14 hover:border-gray-500 transition-colors"
                       (mouseenter)="onItemHover(equipment()[slot])" (mouseleave)="onItemHover(null)">
                    <span class="text-xs text-gray-500">{{ slot }}</span>
                    @if (equipment()[slot]) {
                      <div class="flex items-center gap-2 cursor-pointer">
                         <span class="text-xl">{{ equipment()[slot]!.icon }}</span>
                         <div class="flex flex-col items-end">
                            <span class="text-sm font-bold" [class]="getRarityColor(equipment()[slot]!.rarity)">{{ equipment()[slot]!.name }}</span>
                         </div>
                      </div>
                    } @else { <span class="text-xs text-gray-700 italic">Empty</span> }
                  </div>
                }
              </div>
            </div>

            <div class="mb-6">
              <div class="flex justify-between items-center mb-2">
                <h3 class="text-sm font-bold text-gray-400 uppercase">Attributes</h3>
                <span class="text-xs text-yellow-500 font-bold border border-yellow-600 px-2 rounded">Points: {{ playerStats().statPoints }}</span>
              </div>
              <div class="space-y-1 bg-black/20 p-2 rounded">
                @for (stat of statsList; track stat) {
                  <div class="flex items-center justify-between text-sm py-1 border-b border-gray-800 last:border-0">
                    <span class="capitalize text-gray-300">{{ stat }}</span>
                    <div class="flex items-center gap-2">
                      <span class="font-mono font-bold text-white">{{ playerStats()[stat] }}</span>
                      @if (playerStats().statPoints > 0) {
                        <button (click)="state.upgradeStat(stat)" class="w-5 h-5 bg-green-600 hover:bg-green-500 text-white rounded flex items-center justify-center text-xs shadow">+</button>
                      }
                    </div>
                  </div>
                }
              </div>
            </div>
            
             <div class="p-3 bg-black/40 rounded text-xs text-gray-400 space-y-1 font-mono">
               <div class="flex justify-between"><span>Dmg:</span> <span class="text-white">{{ playerStats().strength * 2 + (equipment()['MainHand']?.stats?.damage || 0) }}</span></div>
               <div class="flex justify-between"><span>Armor:</span> <span class="text-white">{{ equipment()['Armor']?.stats?.defense || 0 }}</span></div>
            </div>
          </div>

          <!-- RIGHT: INVENTORY GRID -->
          <div class="w-2/3 p-4 bg-gray-900 overflow-y-auto">
             <div class="flex justify-between mb-2">
               <h3 class="text-sm font-bold text-gray-400 uppercase">Bag ({{ inventory().length }}/20)</h3>
               <span class="text-xs text-gray-500">Click to Equip</span>
             </div>
             <div class="grid grid-cols-5 gap-3">
               @for (item of inventory(); track item.id) {
                 <div class="aspect-square bg-gray-800 border-2 rounded-lg cursor-pointer relative group hover:bg-gray-700 transition shadow-lg"
                      [class]="getRarityColor(item.rarity) + ' ' + (item === hoveredItem() ? 'bg-gray-700 scale-105' : '')"
                      (click)="state.equipItem(item)"
                      (mouseenter)="onItemHover(item)"
                      (mouseleave)="onItemHover(null)">
                    <div class="w-full h-full flex flex-col items-center justify-center p-1">
                       <span class="text-3xl filter drop-shadow-md">{{ item.icon }}</span>
                       <span class="text-[9px] text-center truncate w-full px-1 mt-1 font-bold text-gray-300">{{ item.name }}</span>
                    </div>
                    @if (item.minLevel > playerStats().level) {
                      <div class="absolute inset-0 bg-black/70 flex items-center justify-center rounded-lg backdrop-blur-[1px]">
                         <span class="text-red-500 font-bold text-xs border border-red-500 px-1 rounded bg-black/50">Lvl {{item.minLevel}}</span>
                      </div>
                    }
                 </div>
               }
             </div>
          </div>
        </div>

        <!-- TOOLTIP -->
        @if (hoveredItem()) {
           <div class="absolute bottom-4 left-1/3 w-72 bg-gray-900 border-2 p-4 rounded-lg z-50 pointer-events-none shadow-2xl"
                [class]="getRarityColor(hoveredItem()!.rarity)">
             <div class="flex justify-between items-start border-b border-gray-700 pb-2 mb-2">
               <div>
                  <h4 class="font-bold text-lg">{{ hoveredItem()!.name }}</h4>
                  <p class="text-xs text-gray-400">{{ hoveredItem()!.rarity }} {{ hoveredItem()!.type }}</p>
               </div>
               <span class="text-2xl">{{ hoveredItem()!.icon }}</span>
             </div>
             <div class="space-y-1 text-sm text-gray-200 mb-3">
                @if (hoveredItem()!.stats.damage) { <div class="flex justify-between"><span>Damage</span> <span class="font-bold text-white">{{ hoveredItem()!.stats.damage }}</span></div> }
                @if (hoveredItem()!.stats.defense) { <div class="flex justify-between"><span>Defense</span> <span class="font-bold text-white">{{ hoveredItem()!.stats.defense }}</span></div> }
                @if (hoveredItem()!.stats.strength) { <div class="flex justify-between text-red-300"><span>+ Strength</span> <span>{{ hoveredItem()!.stats.strength }}</span></div> }
             </div>
             <div class="mt-2 text-xs text-gray-500 border-t border-gray-700 pt-2 flex justify-between items-center">
                <span>Requires Level {{ hoveredItem()!.minLevel }}</span>
             </div>
           </div>
        }
      </div>
    </div>
  `
})
export class InventoryComponent {
  state = inject(GameStateService);
  close = output<void>();

  inventory = this.state.inventory;
  equipment = this.state.equipment;
  playerStats = this.state.playerStats;

  hoveredItem = signal<Item | null>(null);

  // Added typed list for strictly typed template iteration
  readonly statsList: (keyof GameStats)[] = ['strength', 'intelligence', 'agility', 'vitality', 'dexterity'];

  onItemHover(item: Item | null) {
    this.hoveredItem.set(item);
  }

  getRarityColor(rarity: Rarity): string {
    switch (rarity) {
      case 'Common': return 'text-gray-400 border-gray-400';
      case 'Uncommon': return 'text-green-400 border-green-400';
      case 'Rare': return 'text-blue-400 border-blue-400';
      case 'Epic': return 'text-purple-400 border-purple-400';
      case 'Legendary': return 'text-orange-400 border-orange-400';
      default: return 'text-white border-white';
    }
  }
}