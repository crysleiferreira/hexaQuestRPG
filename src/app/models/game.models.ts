export type Rarity = 'Common' | 'Uncommon' | 'Rare' | 'Epic' | 'Legendary';
export type ItemType = 'Weapon' | 'Armor' | 'Consumable';
export type EquipmentSlot = 'MainHand' | 'OffHand' | 'Armor';
export type NotificationType = 'levelup' | 'boss' | 'loot' | 'info';

export interface ItemStats {
  damage?: number;
  defense?: number;
  strength?: number;
  intelligence?: number;
  agility?: number;
  vitality?: number;
  dexterity?: number;
  critChance?: number;
}

export interface Item {
  id: string;
  name: string;
  type: ItemType;
  subType?: string;
  slot?: EquipmentSlot;
  rarity: Rarity;
  minLevel: number;
  stats: ItemStats;
  icon: string;
  description?: string;
}

export interface GameStats {
  hp: number;
  maxHp: number;
  mana: number;
  maxMana: number;
  xp: number;
  xpToNextLevel: number;
  level: number;
  gold: number;
  statPoints: number;
  skillPoints: number;
  strength: number;
  intelligence: number;
  agility: number;
  vitality: number;
  dexterity: number;
}

export interface EnemyAbility {
    name: string;
    type: 'melee' | 'ranged' | 'aoe' | 'buff';
    damageMult: number;
    cooldown: number;
    lastUsed: number;
    range: number;
    castTime?: number;
    radius?: number;
    projectileColor?: number;
}

export interface CombatLogEntry {
  id: number;
  message: string;
  type: 'damage' | 'heal' | 'info' | 'loot' | 'gold';
  timestamp: number;
}

export interface GameState {
    currentLevel: number;
    isPaused: boolean;
    isBossLevel: boolean;
    isMainMenu: boolean;
}