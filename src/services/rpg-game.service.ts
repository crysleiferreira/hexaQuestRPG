import { Injectable, signal, inject } from '@angular/core';
import * as THREE from 'three';
import { GameStateService } from '../app/services/game-state.service';
import { AssetService } from '../app/services/asset.service';
import { Item, EnemyAbility, ItemStats, Rarity } from '../app/models/game.models';

interface ActiveProjectile {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  damage: number;
  ownerId: number;
  lifeTime: number;
}

interface ActiveAoE {
  mesh: THREE.Mesh;
  damage: number;
  detonationTime: number;
  radius: number;
  ownerId: number;
}

const ITEM_DATABASE = {
  Weapons: [
    { name: "Longsword", type: 'Sword', dmgMult: 1.0, icon: "⚔️" },
    { name: "Dagger", type: 'Dagger', dmgMult: 0.7, icon: "🗡️" },
    { name: "Warhammer", type: 'Mace', dmgMult: 1.4, icon: "🔨" },
    { name: "Battleaxe", type: 'Axe', dmgMult: 1.2, icon: "🪓" }
  ],
  Armors: [
    { name: "Plate Chest", type: 'Plate', defMult: 1.0, icon: "🛡️" },
    { name: "Leather Tunic", type: 'Leather', defMult: 0.6, icon: "🧥" },
    { name: "Silk Robe", type: 'Cloth', defMult: 0.3, icon: "👘" }
  ]
};

@Injectable({
  providedIn: 'root'
})
export class RpgGameService {
  
  private state = inject(GameStateService);
  private assets = inject(AssetService);

  // Expose signals for Components
  gameState = this.state.gameState;
  playerStats = this.state.playerStats;
  inventory = this.state.inventory;
  equipment = this.state.equipment;
  notifications = this.state.notifications;
  combatLog = this.state.combatLog;
  activeBoss = this.state.activeBoss;

  // --- Three.js Internals ---
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private clock = new THREE.Clock();
  private animationFrameId: number | null = null;
  
  // Raycasting
  private raycaster = new THREE.Raycaster();
  private mouse = new THREE.Vector2();
  private floorPlane!: THREE.Mesh; 
  
  // Entities
  private playerGroup!: THREE.Group; 
  private playerMesh!: THREE.Mesh;  

  private enemies: { 
    mesh: THREE.Mesh, 
    healthBar: THREE.Group, 
    hp: number, 
    maxHp: number, 
    stats: any, 
    id: number, 
    isBoss: boolean,
    abilities: EnemyAbility[]
  }[] = [];

  private projectiles: ActiveProjectile[] = [];
  private aoeZones: ActiveAoE[] = [];
  private lootDrops: { mesh: THREE.Mesh, item: Item, floatOffset: number, beam?: THREE.Mesh }[] = [];
  private portal!: THREE.Mesh;
  
  // Input
  private keysPressed: {[key: string]: boolean} = {};
  
  // Logic Constants
  private readonly MOVEMENT_SPEED = 0.15;
  public readonly ATTACK_COOLDOWN = 500; 
  public lastAttackTimestamp = signal(0); 
  private lastAttackTime = 0;
  
  initialize(canvas: HTMLCanvasElement) {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x111827); 
    this.scene.fog = new THREE.Fog(0x111827, 10, 40);

    this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.camera.position.set(0, 15, 10);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    this.scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1);
    dirLight.position.set(10, 20, 10);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    this.scene.add(dirLight);

    // Player Setup
    this.playerGroup = new THREE.Group();
    this.playerGroup.position.y = 0.5;
    
    this.playerMesh = this.assets.getMesh('player');
    this.playerMesh.position.set(0, 0, 0); 
    
    this.playerGroup.add(this.playerMesh);
    this.scene.add(this.playerGroup);

    this.generateLevel();

    window.addEventListener('resize', this.onWindowResize.bind(this));
    window.addEventListener('keydown', (e) => this.keysPressed[e.key.toLowerCase()] = true);
    window.addEventListener('keyup', (e) => this.keysPressed[e.key.toLowerCase()] = false);
    window.addEventListener('mousedown', this.onMouseDown.bind(this));
    window.addEventListener('mousemove', this.onMouseMove.bind(this));

    this.animate();
  }

  startGame() {
    this.state.gameState.update(s => ({ ...s, isMainMenu: false }));
    this.playerGroup.position.set(0, 0.5, 0);
    this.camera.position.set(0, 14, 12);
    this.camera.lookAt(this.playerGroup.position);
  }

  // --- Level Generation ---
  private generateLevel() {
    const level = this.state.gameState().currentLevel;
    
    const biomeIndex = Math.floor((level - 1) / 5);
    const hues = [220, 280, 10, 120, 40]; 
    const hue = hues[biomeIndex % hues.length];
    
    const skyColor = new THREE.Color(`hsl(${hue}, 40%, 15%)`);
    this.scene.background = skyColor;
    this.scene.fog = new THREE.Fog(skyColor, 10, 50);

    // Cleanup
    this.enemies.forEach(e => {
        this.scene.remove(e.mesh);
        this.scene.remove(e.healthBar);
    });
    this.enemies = [];
    this.projectiles.forEach(p => this.scene.remove(p.mesh));
    this.projectiles = [];
    this.aoeZones.forEach(a => this.scene.remove(a.mesh));
    this.aoeZones = [];
    this.lootDrops.forEach(l => this.scene.remove(l.mesh));
    this.lootDrops = [];
    if (this.portal) {
        this.scene.remove(this.portal);
        (this.portal as any) = null;
    }
    this.state.activeBoss.set(null);

    // Floor
    if (!this.floorPlane) {
        const floorGeo = new THREE.PlaneGeometry(100, 100);
        const floorMat = new THREE.MeshStandardMaterial({ 
            color: 0x1f2937, 
            roughness: 0.8,
            side: THREE.DoubleSide 
        });
        this.floorPlane = new THREE.Mesh(floorGeo, floorMat);
        this.floorPlane.rotation.x = -Math.PI / 2;
        this.floorPlane.receiveShadow = true;
        this.floorPlane.name = 'floor';
        this.scene.add(this.floorPlane);
    }

    const isBoss = level % 10 === 0;
    this.state.gameState.update(s => ({ ...s, isBossLevel: isBoss }));

    const enemyCount = isBoss ? 1 : 4 + Math.floor(level / 1.5);
    
    if (isBoss) {
      this.spawnEnemy(true); 
      for(let i=0; i<2; i++) this.spawnEnemy(false);
    } else {
      for (let i = 0; i < enemyCount; i++) {
        this.spawnEnemy(false);
      }
    }

    if (isBoss) {
        this.state.addNotification(`BOSS BATTLE: STAGE ${level}`, 'boss');
    } else {
        this.state.addNotification(`Entering Stage ${level}`, 'info');
    }
    
    this.playerGroup.position.set(0, 0.5, 0);
  }

  private spawnEnemy(isBoss: boolean) {
    const color = isBoss ? 0xa855f7 : 0xef4444;
    const mesh = this.assets.getMesh(isBoss ? 'boss' : 'enemy', color);
    
    const angle = Math.random() * Math.PI * 2;
    const radius = 8 + Math.random() * 12; 
    mesh.position.set(Math.cos(angle) * radius, isBoss ? 1.5 : 0.6, Math.sin(angle) * radius);
    
    if (isBoss) {
      mesh.scale.set(3, 3, 3);
    }

    this.scene.add(mesh);
    
    const healthBar = this.assets.createHealthBar();
    healthBar.position.copy(mesh.position);
    healthBar.position.y += isBoss ? 4 : 1.2;
    this.scene.add(healthBar);
    
    const level = this.state.gameState().currentLevel;
    let baseHp = 30 * Math.pow(1.15, level);
    if (isBoss) baseHp *= 8;

    const abilities: EnemyAbility[] = [];
    if (isBoss) {
        abilities.push({ name: 'Nova', type: 'aoe', damageMult: 1.5, cooldown: 8000, lastUsed: 0, range: 8, radius: 5, castTime: 2000 });
        abilities.push({ name: 'Fireball', type: 'ranged', damageMult: 1.2, cooldown: 4000, lastUsed: 0, range: 15, projectileColor: 0xff4500 });
        abilities.push({ name: 'Enrage', type: 'buff', damageMult: 0, cooldown: 15000, lastUsed: 0, range: 0 });
    } else {
        const rand = Math.random();
        if (rand < 0.3) {
            abilities.push({ name: 'Rock Throw', type: 'ranged', damageMult: 0.8, cooldown: 5000, lastUsed: 0, range: 10, projectileColor: 0x888888 });
        } else if (rand > 0.8) {
             abilities.push({ name: 'Smash', type: 'aoe', damageMult: 1.2, cooldown: 6000, lastUsed: 0, range: 3, radius: 2.5, castTime: 1500 });
        }
    }

    const enemy = {
        mesh,
        healthBar,
        hp: baseHp,
        maxHp: baseHp,
        stats: { damage: 5 + (level * 1.5) },
        id: Math.random(),
        isBoss,
        abilities
    };

    this.enemies.push(enemy);

    if (isBoss) {
      this.state.activeBoss.set({ name: `Level ${level} Guardian`, hp: baseHp, maxHp: baseHp });
    }
  }

  // --- Game Loop ---
  private animate() {
    if (!this.renderer) return;

    this.animationFrameId = requestAnimationFrame(this.animate.bind(this));
    
    if (this.state.gameState().isPaused) return;

    const delta = this.clock.getDelta();
    const time = Date.now() * 0.001;
    const now = Date.now();

    if (this.state.gameState().isMainMenu) {
      const orbitSpeed = 0.2;
      const radius = 20;
      this.camera.position.x = Math.sin(time * orbitSpeed) * radius;
      this.camera.position.z = Math.cos(time * orbitSpeed) * radius;
      this.camera.position.y = 15;
      this.camera.lookAt(0, 0, 0);
      this.lootDrops.forEach(l => l.mesh.rotation.y += delta);
      return; 
    }

    // Raycast Logic
    this.raycaster.setFromCamera(this.mouse, this.camera);
    if (this.floorPlane) {
        const intersects = this.raycaster.intersectObject(this.floorPlane);
        if (intersects.length > 0) {
            const point = intersects[0].point;
            point.y = this.playerGroup.position.y;
            this.playerGroup.lookAt(point);
        }
    }

    // Movement
    const speed = this.MOVEMENT_SPEED * (this.state.playerStats().agility / 20 + 1); 
    const moveDir = new THREE.Vector3();
    if (this.keysPressed['w']) moveDir.z -= 1;
    if (this.keysPressed['s']) moveDir.z += 1;
    if (this.keysPressed['a']) moveDir.x -= 1;
    if (this.keysPressed['d']) moveDir.x += 1;

    if (moveDir.length() > 0) {
        moveDir.normalize().multiplyScalar(speed);
        this.playerGroup.position.add(moveDir);
    }

    // Visual Cooldown
    if (this.playerMesh && this.playerMesh.material) {
        const mat = this.playerMesh.material as THREE.MeshStandardMaterial; // Note: if array material this might need update but kept simple for now as array access is specific in creation
        // Note: Logic for emissive flashing might fail if 'material' is array.
        // Let's fix this for array material support
        if (Array.isArray(this.playerMesh.material)) {
           // Apply to base materials
           this.playerMesh.material.forEach((m: any) => {
               const timeSinceAttack = now - this.lastAttackTime;
               if (timeSinceAttack < this.ATTACK_COOLDOWN) {
                  if (m.emissive) { m.emissive.setHex(0x000000); m.emissiveIntensity = 0; }
               } else {
                  // Only flash blue on blue parts, keep yellow constant? 
                  // Or just flash everything.
                  if (m.color.getHex() === 0xfacc15) return; // Skip yellow face
                  if (m.emissive) { m.emissive.setHex(0x3b82f6); m.emissiveIntensity = 0.2 + (Math.sin(now * 0.005) + 1) * 0.3; }
               }
           });
        } else {
           const mat = this.playerMesh.material as THREE.MeshStandardMaterial;
            const timeSinceAttack = now - this.lastAttackTime;
            if (timeSinceAttack < this.ATTACK_COOLDOWN) {
                 if (mat.emissive) { mat.emissive.setHex(0x000000); mat.emissiveIntensity = 0; }
            } else {
                 if (mat.emissive) { mat.emissive.setHex(0x3b82f6); mat.emissiveIntensity = 0.2 + (Math.sin(now * 0.005) + 1) * 0.3; }
            }
        }
    }

    // Camera
    const camOffset = new THREE.Vector3(0, 14, 12);
    const targetPos = this.playerGroup.position.clone().add(camOffset); 
    this.camera.position.lerp(targetPos, 0.1);
    this.camera.lookAt(this.playerGroup.position);

    this.updateProjectiles(delta);
    this.updateAoEZones(now);

    // Enemies
    this.enemies.forEach(enemy => {
        enemy.healthBar.position.copy(enemy.mesh.position);
        enemy.healthBar.position.y += enemy.isBoss ? 4 : 1.2;
        enemy.healthBar.lookAt(this.camera.position); 
        const hpPercent = Math.max(0, enemy.hp / enemy.maxHp);
        enemy.healthBar.children[1].scale.x = hpPercent;

        const dist = enemy.mesh.position.distanceTo(this.playerGroup.position);
        
        let abilityUsed = false;
        for (const ability of enemy.abilities) {
            if (now - ability.lastUsed > ability.cooldown) {
                if (ability.type === 'buff' && enemy.hp < enemy.maxHp * 0.5) {
                    this.castAbility(enemy, ability);
                    abilityUsed = true;
                    break;
                }
                if ((ability.type === 'ranged' || ability.type === 'aoe') && dist < ability.range) {
                    this.castAbility(enemy, ability);
                    abilityUsed = true;
                    break;
                }
            }
        }

        if (!abilityUsed) {
            if (dist > (enemy.isBoss ? 4 : 1.5)) {
                const dir = new THREE.Vector3().subVectors(this.playerGroup.position, enemy.mesh.position).normalize();
                const moveSpeed = 0.04 + (this.state.gameState().currentLevel * 0.002);
                enemy.mesh.position.add(dir.multiplyScalar(enemy.isBoss ? moveSpeed * 0.8 : moveSpeed));
                enemy.mesh.lookAt(this.playerGroup.position);
            } else {
                if (Math.random() < 0.015) { 
                    this.takeDamage(enemy.stats.damage);
                    enemy.mesh.position.y += 0.5;
                    setTimeout(() => enemy.mesh.position.y -= 0.5, 200);
                }
            }
        }
    });

    this.lootDrops.forEach((loot, index) => {
        loot.mesh.rotation.y += delta;
        loot.mesh.position.y = 0.5 + Math.sin(time * 2 + loot.floatOffset) * 0.2;
        if (loot.mesh.position.distanceTo(this.playerGroup.position) < 1.5) {
            this.pickupItem(index);
        }
    });

    if (this.portal) {
       this.portal.rotation.z += delta;
       if (this.portal.position.distanceTo(this.playerGroup.position) < 2) {
           this.nextLevel();
       }
    }

    this.renderer.render(this.scene, this.camera);
  }

  // --- Logic Helpers ---
  
  private castAbility(enemy: any, ability: EnemyAbility) {
      ability.lastUsed = Date.now();
      switch (ability.type) {
          case 'ranged': this.spawnEnemyProjectile(enemy, ability); break;
          case 'aoe': this.spawnEnemyAoE(enemy, ability); break;
          case 'buff': this.performEnemyBuff(enemy, ability); break;
      }
  }

  private spawnEnemyProjectile(enemy: any, ability: EnemyAbility) {
      const mesh = this.assets.getMesh('projectile', ability.projectileColor);
      mesh.position.copy(enemy.mesh.position);
      mesh.position.y = 1;
      const dir = new THREE.Vector3().subVectors(this.playerGroup.position, enemy.mesh.position).normalize();
      const velocity = dir.multiplyScalar(10);
      this.scene.add(mesh);
      this.projectiles.push({ mesh, velocity, damage: enemy.stats.damage * ability.damageMult, ownerId: enemy.id, lifeTime: 3 });
  }

  private spawnEnemyAoE(enemy: any, ability: EnemyAbility) {
      const radius = ability.radius || 3;
      const mesh = this.assets.createAoEMarker(radius, 0xff0000);
      mesh.position.copy(this.playerGroup.position); 
      mesh.position.y = 0.05;
      this.scene.add(mesh);
      this.aoeZones.push({
          mesh,
          damage: enemy.stats.damage * ability.damageMult,
          detonationTime: Date.now() + (ability.castTime || 1500),
          radius,
          ownerId: enemy.id
      });
      this.state.addLog(`${enemy.isBoss ? 'Boss' : 'Enemy'} casting ${ability.name}!`, 'info');
  }

  private performEnemyBuff(enemy: any, ability: EnemyAbility) {
      enemy.hp = Math.min(enemy.maxHp, enemy.hp + enemy.maxHp * 0.2);
      if (enemy.isBoss && this.state.activeBoss()) {
           this.state.activeBoss.update(b => b ? { ...b, hp: enemy.hp } : null);
      }
      this.state.addLog(`${enemy.isBoss ? 'Boss' : 'Enemy'} used ${ability.name}!`, 'info');
  }

  private updateProjectiles(delta: number) {
      for (let i = this.projectiles.length - 1; i >= 0; i--) {
          const p = this.projectiles[i];
          p.lifeTime -= delta;
          p.mesh.position.add(p.velocity.clone().multiplyScalar(delta));
          
          if (p.mesh.position.distanceTo(this.playerGroup.position) < 1.0) {
              this.takeDamage(p.damage);
              this.scene.remove(p.mesh);
              this.projectiles.splice(i, 1);
              continue;
          }
          if (p.lifeTime <= 0) {
              this.scene.remove(p.mesh);
              this.projectiles.splice(i, 1);
          }
      }
  }

  private updateAoEZones(now: number) {
      for (let i = this.aoeZones.length - 1; i >= 0; i--) {
          const zone = this.aoeZones[i];
          const timeLeft = zone.detonationTime - now;
          if (timeLeft > 0) {
              zone.mesh.scale.setScalar(Math.sin(now * 0.01) * 0.2 + 0.8);
          } else {
              if (this.playerGroup.position.distanceTo(zone.mesh.position) < zone.radius) {
                  this.takeDamage(zone.damage);
              }
              const explosion = new THREE.Mesh(new THREE.SphereGeometry(zone.radius), new THREE.MeshBasicMaterial({ color: 0xff4400, transparent: true, opacity: 0.5 }));
              explosion.position.copy(zone.mesh.position);
              this.scene.add(explosion);
              setTimeout(() => this.scene.remove(explosion), 200);
              this.scene.remove(zone.mesh);
              this.aoeZones.splice(i, 1);
          }
      }
  }

  private performAttack() {
      // 1. Calculate direction to mouse
      const startPos = this.playerGroup.position.clone();
      let forward = new THREE.Vector3(0, 0, -1);
      
      this.raycaster.setFromCamera(this.mouse, this.camera);
      if (this.floorPlane) {
          const intersects = this.raycaster.intersectObject(this.floorPlane);
          if (intersects.length > 0) {
              const point = intersects[0].point;
              point.y = startPos.y;
              
              // Ensure player faces the attack direction immediately
              this.playerGroup.lookAt(point);
              
              forward = new THREE.Vector3().subVectors(point, startPos).normalize();
          }
      }
      
      const startRot = this.playerGroup.rotation.clone();
      
      // 2. Visuals
      this.playerMesh.scale.set(1.3, 1.3, 1.3);
      this.playerMesh.position.z = -0.7; 
      setTimeout(() => {
          this.playerMesh.scale.set(1, 1, 1);
          this.playerMesh.position.set(0, 0, 0); 
      }, 150);

      this.createSwordSwing(startPos.clone().add(forward.clone().multiplyScalar(0.7)), startRot);
      const damage = this.calculatePlayerDamage();
      
      // 3. Hit Detection
      // Range: 3.5 units
      // Angle: Dot product > 0.5 (approx 120 degree cone)
      const range = 3.5;
      const coneThreshold = 0.5;

      this.enemies = this.enemies.filter(enemy => {
          const toEnemy = new THREE.Vector3().subVectors(enemy.mesh.position, startPos);
          const dist = toEnemy.length();
          
          if (dist <= range) {
             const dirToEnemy = toEnemy.clone().normalize();
             const angle = forward.dot(dirToEnemy);
             
             // Check Cone OR Point Blank (inside model)
             if (dist < 1.0 || angle > coneThreshold) { 
                 enemy.hp -= damage;
                 this.createHitEffect(enemy.mesh.position.clone().add(new THREE.Vector3(0, 0.8, 0)));
                 this.state.addLog(`Dealt ${damage} damage`, 'damage');
                 if (!enemy.isBoss) enemy.mesh.position.add(toEnemy.multiplyScalar(1.5));
                 if (enemy.isBoss && this.state.activeBoss()) this.state.activeBoss.update(b => b ? { ...b, hp: enemy.hp } : null);
                 
                 if (enemy.hp <= 0) {
                     this.killEnemy(enemy);
                     return false; 
                 }
                 const mat = enemy.mesh.material as THREE.MeshStandardMaterial;
                 mat.color.setHex(0xffffff);
                 setTimeout(() => mat.color.setHex(enemy.isBoss ? 0xa855f7 : 0xef4444), 100);
             }
          }
          return true; 
      });

      if (this.enemies.length === 0 && !this.portal) {
         this.portal = this.assets.getMesh('portal');
         this.portal.position.copy(this.playerGroup.position).add(new THREE.Vector3(0, 0, -8)); 
         this.portal.rotation.x = -Math.PI / 2;
         this.portal.position.y = 0.5;
         this.scene.add(this.portal);
         this.state.addNotification("Portal Opened!", 'info');
      }
  }

  private createSwordSwing(position: THREE.Vector3, rotation: THREE.Euler) {
      const group = new THREE.Group();
      group.position.copy(position);
      group.position.y = 1.0;
      group.rotation.copy(rotation);
      
      const mat1 = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.6, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false });
      
      // Adjust geometry to center the arc on the local Y-axis 
      // which will be mapped to +Z (Forward) by rotation
      // RingGeometry: 0 rad is +X, PI/2 is +Y.
      // Arc is PI/6 to 5PI/6 (centered at PI/2).
      const mesh1 = new THREE.Mesh(new THREE.RingGeometry(1.4, 2.6, 16, 1, Math.PI/6, 2*Math.PI/3), mat1);
      
      // Rotate around X by +90 degrees.
      // X axis stays X.
      // Y axis (Up) -> Z axis (Forward).
      // Z axis (Forward) -> -Y axis (Down).
      // This centers the arc (originally at +Y) to +Z, which aligns with player forward direction.
      mesh1.rotateX(Math.PI / 2);
      
      group.add(mesh1);
      this.scene.add(group);
      
      let progress = 0;
      const animate = () => {
          progress += 0.1;
          if (progress >= 1) { this.scene.remove(group); return; }
          group.scale.setScalar(1 + progress * 0.3);
          
          requestAnimationFrame(animate);
      };
      animate();
  }

  private createHitEffect(position: THREE.Vector3) {
      const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5), new THREE.MeshBasicMaterial({ color: 0xfffc40, transparent: true, opacity: 1, blending: THREE.AdditiveBlending }));
      mesh.position.copy(position);
      this.scene.add(mesh);
      let progress = 0;
      const animate = () => {
          progress += 0.1;
          if (progress >= 1) { this.scene.remove(mesh); return; }
          mesh.scale.setScalar(1 + progress * 2);
          mesh.material.opacity = 1 - progress;
          requestAnimationFrame(animate);
      };
      animate();
  }

  calculatePlayerDamage(): number {
      const stats = this.state.playerStats();
      const weapon = this.state.equipment()['MainHand'];
      let dmg = (stats.strength * 2) + (weapon?.stats.damage || 0);
      dmg = dmg * (0.9 + Math.random() * 0.2);
      if (Math.random() * 100 < ((stats.dexterity * 0.5) + (weapon?.stats.critChance || 0))) {
          dmg *= 2;
          this.state.addLog("CRITICAL HIT!", 'damage');
      }
      return Math.floor(dmg);
  }

  takeDamage(amount: number) {
      const defense = (this.state.equipment()['Armor']?.stats.defense || 0) + (this.state.playerStats().vitality * 0.8);
      const finalDmg = Math.max(1, Math.floor(amount * (100 / (100 + defense)))); 
      this.state.playerStats.update(s => ({ ...s, hp: Math.max(0, s.hp - finalDmg) }));
      this.state.addLog(`Took ${finalDmg} damage!`, 'damage');
      if (this.state.playerStats().hp <= 0) {
          this.state.addNotification("YOU DIED", 'boss');
          this.setPaused(true);
      }
  }

  killEnemy(enemy: any) {
      this.scene.remove(enemy.mesh);
      this.scene.remove(enemy.healthBar);
      if (enemy.isBoss) this.state.activeBoss.set(null);
      
      const level = this.state.gameState().currentLevel;
      const xpGain = Math.floor((30 * Math.pow(level, 1.1)) * (enemy.isBoss ? 10 : 1));
      this.state.gainXp(xpGain);
      
      let goldDrop = 1 + Math.floor(level * 0.5) + (enemy.isBoss ? 50 + (level * 5) : Math.floor(Math.random() * 3));
      this.state.playerStats.update(s => ({ ...s, gold: s.gold + goldDrop }));
      this.state.addLog(`Found ${goldDrop} Gold`, 'gold');

      if (Math.random() < (enemy.isBoss ? 1.0 : 0.05)) {
          this.dropLoot(enemy.mesh.position, enemy.isBoss ? 'Epic' : undefined);
      }
  }

  dropLoot(position: THREE.Vector3, forcedRarity?: Rarity) {
      const item = this.generateRandomItem(this.state.gameState().currentLevel, forcedRarity);
      const color = this.getRarityColorHex(item.rarity);
      const mesh = this.assets.getMesh('loot', color);
      mesh.position.copy(position);
      mesh.position.y = 0.5;
      mesh.add(this.assets.createLootBeam(color));
      this.scene.add(mesh);
      this.lootDrops.push({ mesh, item, floatOffset: Math.random() * 10 });
      this.state.addLog(`${item.rarity} Drop!`, 'loot');
  }

  pickupItem(index: number) {
      const loot = this.lootDrops[index];
      this.scene.remove(loot.mesh);
      this.lootDrops.splice(index, 1);
      
      if (this.state.inventory().length < 20) {
          this.state.inventory.update(inv => [...inv, loot.item]);
          this.state.addNotification(`Obtained: ${loot.item.name}`, 'loot');
      } else {
          this.state.addLog("Inventory Full!", 'info');
      }
  }

  generateRandomItem(level: number, forcedRarity?: Rarity): Item {
      let rarity: Rarity = 'Common';
      const roll = Math.random();
      if (forcedRarity) rarity = forcedRarity;
      else if (roll > 0.99) rarity = 'Legendary';
      else if (roll > 0.98) rarity = 'Epic';
      else if (roll > 0.90) rarity = 'Rare';
      else if (roll > 0.75) rarity = 'Uncommon';

      const isWeapon = Math.random() > 0.5;
      const dbCategory = isWeapon ? ITEM_DATABASE.Weapons : ITEM_DATABASE.Armors;
      const template = dbCategory[Math.floor(Math.random() * dbCategory.length)];
      
      const totalPower = level * 1.5 * { Common: 1, Uncommon: 1.5, Rare: 2.2, Epic: 3.5, Legendary: 5.5 }[rarity];
      const stats: ItemStats = {};
      
      if (isWeapon) {
          stats.damage = Math.floor(10 + totalPower * (template as any).dmgMult);
          if (rarity !== 'Common') stats.strength = Math.floor(totalPower * 0.2);
          if (rarity === 'Legendary') stats.critChance = 5 + Math.floor(Math.random() * 10);
      } else {
          stats.defense = Math.floor(5 + totalPower * (template as any).defMult);
          if (rarity !== 'Common') stats.vitality = Math.floor(totalPower * 0.2);
      }
      
      return {
          id: Math.random().toString(36).substr(2, 9),
          name: `${rarity} ${template.name}`,
          type: isWeapon ? 'Weapon' : 'Armor',
          subType: (template as any).type,
          rarity,
          minLevel: Math.max(1, level - (rarity === 'Legendary' ? 0 : 2)),
          stats,
          icon: template.icon,
          slot: isWeapon ? 'MainHand' : 'Armor' 
      };
  }

  getRarityColorHex(rarity: Rarity): number {
      switch (rarity) {
          case 'Common': return 0x9ca3af;
          case 'Uncommon': return 0x22c55e;
          case 'Rare': return 0x3b82f6;
          case 'Epic': return 0xa855f7;
          case 'Legendary': return 0xf97316;
          default: return 0xffffff;
      }
  }

  nextLevel() {
      this.state.gameState.update(s => ({ ...s, currentLevel: s.currentLevel + 1 }));
      this.generateLevel();
  }

  // --- Interaction Hooks ---
  onMouseDown(e: MouseEvent) {
      if (this.state.gameState().isPaused || this.state.gameState().isMainMenu) return;
      const now = Date.now();
      if (now - this.lastAttackTime > this.ATTACK_COOLDOWN) {
          this.performAttack();
          this.lastAttackTime = now;
          this.lastAttackTimestamp.set(now);
      }
  }

  onMouseMove(e: MouseEvent) {
    this.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
  }

  onWindowResize() {
      if (!this.camera || !this.renderer) return;
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  setPaused(paused: boolean) {
      this.state.gameState.update(s => ({ ...s, isPaused: paused }));
      if (!paused) this.clock.getDelta(); 
  }

  dispose() {
      if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
      this.renderer?.dispose();
  }
}