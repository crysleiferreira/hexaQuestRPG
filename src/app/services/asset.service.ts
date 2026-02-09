import { Injectable } from '@angular/core';
import * as THREE from 'three';
// @ts-ignore
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader';
// @ts-ignore
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';

@Injectable({
  providedIn: 'root'
})
export class AssetService {
  
  private textureLoader: THREE.TextureLoader;
  private modelCache: { [key: string]: THREE.Group } = {};

  // We will prioritize procedural generation for reliability
  private readonly ASSETS = {
    floorTexture: 'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/terrain/grasslight-big.jpg'
  };

  constructor() {
    const manager = new THREE.LoadingManager();
    this.textureLoader = new THREE.TextureLoader(manager);
  }

  getFloorTexture(): THREE.Texture {
      const tex = this.textureLoader.load(this.ASSETS.floorTexture, undefined, undefined, () => {
          // Error handler for texture
          console.warn('Texture failed to load, using fallback color');
      });
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(10, 10);
      tex.colorSpace = THREE.SRGBColorSpace;
      return tex;
  }

  getMesh(type: 'player' | 'enemy' | 'boss' | 'loot' | 'portal' | 'projectile', color?: number): THREE.Object3D {
    // Check Cache
    if (this.modelCache[type]) return this.modelCache[type].clone();

    let mesh: THREE.Object3D;

    switch (type) {
        case 'player':
            mesh = this.createVoxelKnight();
            break;
        case 'enemy':
            mesh = this.createVoxelGoblin();
            break;
        case 'boss':
            mesh = this.createVoxelDemon();
            break;
        case 'loot':
            mesh = this.createLootBox(color || 0xffd700);
            break;
        case 'portal':
            mesh = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.2, 16, 32), new THREE.MeshBasicMaterial({ color: 0x60a5fa }));
            break;
        case 'projectile':
            mesh = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 8), new THREE.MeshBasicMaterial({ color: color || 0xffa500 }));
            break;
        default:
            mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0xffffff }));
    }

    mesh.castShadow = true;
    mesh.receiveShadow = true;
    
    // Cache complex procedural models
    if (['player', 'enemy', 'boss'].includes(type)) {
        this.modelCache[type] = mesh as THREE.Group;
        return mesh.clone();
    }
    
    return mesh;
  }

  // --- Procedural Voxel Generators ---

  private createVoxelKnight(): THREE.Group {
      const group = new THREE.Group();
      
      const metalMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.3, metalness: 0.8 });
      const blueMat = new THREE.MeshStandardMaterial({ color: 0x2563eb });
      const skinMat = new THREE.MeshStandardMaterial({ color: 0xffe0bd });

      // Body
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.7, 0.4), metalMat);
      body.position.y = 0.75;
      
      // Head
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), metalMat);
      head.position.y = 1.4;

      // Visor (Eyes)
      const visor = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.1, 0.42), new THREE.MeshStandardMaterial({ color: 0x000000 }));
      visor.position.y = 1.4;

      // Arms
      const armGeo = new THREE.BoxGeometry(0.2, 0.6, 0.2);
      const leftArm = new THREE.Mesh(armGeo, metalMat);
      leftArm.position.set(-0.5, 0.7, 0);
      const rightArm = new THREE.Mesh(armGeo, metalMat);
      rightArm.position.set(0.5, 0.7, 0);

      // Legs
      const legGeo = new THREE.BoxGeometry(0.25, 0.6, 0.25);
      const leftLeg = new THREE.Mesh(legGeo, blueMat);
      leftLeg.position.set(-0.2, 0.3, 0);
      const rightLeg = new THREE.Mesh(legGeo, blueMat);
      rightLeg.position.set(0.2, 0.3, 0);

      // Sword
      const swordHandle = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.4, 0.1), new THREE.MeshStandardMaterial({ color: 0x475569 }));
      swordHandle.position.set(0.6, 0.5, 0.3);
      swordHandle.rotation.x = Math.PI / 4;
      
      const swordBlade = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.8, 0.05), new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 1.0, emissive: 0x111111 }));
      swordBlade.position.copy(swordHandle.position);
      swordBlade.position.y += 0.5;
      swordBlade.position.z -= 0.2;
      swordBlade.rotation.x = Math.PI / 4;

      // Cape
      const cape = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.9, 0.1), new THREE.MeshStandardMaterial({ color: 0xef4444 }));
      cape.position.set(0, 0.8, -0.25);
      cape.rotation.x = 0.1;

      group.add(body, head, visor, leftArm, rightArm, leftLeg, rightLeg, swordHandle, swordBlade, cape);
      
      // Rotate 180 to face camera correctly if needed, or adjust game logic. Game expects +Z forward?
      // Usually +Z is towards camera. We want character facing away from camera (-Z).
      group.rotation.y = Math.PI; 

      return group;
  }

  private createVoxelGoblin(): THREE.Group {
      const group = new THREE.Group();
      
      const skinMat = new THREE.MeshStandardMaterial({ color: 0x4ade80 }); // Green
      const clothMat = new THREE.MeshStandardMaterial({ color: 0x78350f }); // Brown

      // Body
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.3), clothMat);
      body.position.y = 0.5;

      // Head
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.35, 0.4), skinMat);
      head.position.y = 1.0;

      // Ears
      const earGeo = new THREE.ConeGeometry(0.08, 0.3, 4);
      const leftEar = new THREE.Mesh(earGeo, skinMat);
      leftEar.position.set(-0.25, 1.0, 0);
      leftEar.rotation.z = Math.PI / 3;
      const rightEar = new THREE.Mesh(earGeo, skinMat);
      rightEar.position.set(0.25, 1.0, 0);
      rightEar.rotation.z = -Math.PI / 3;

      // Arms
      const armGeo = new THREE.BoxGeometry(0.15, 0.5, 0.15);
      const leftArm = new THREE.Mesh(armGeo, skinMat);
      leftArm.position.set(-0.35, 0.5, 0);
      const rightArm = new THREE.Mesh(armGeo, skinMat);
      rightArm.position.set(0.35, 0.5, 0);

      // Legs
      const legGeo = new THREE.BoxGeometry(0.2, 0.4, 0.2);
      const leftLeg = new THREE.Mesh(legGeo, clothMat);
      leftLeg.position.set(-0.15, 0.2, 0);
      const rightLeg = new THREE.Mesh(legGeo, clothMat);
      rightLeg.position.set(0.15, 0.2, 0);

      // Dagger
      const dagger = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.4, 0.1), new THREE.MeshStandardMaterial({ color: 0x94a3b8 }));
      dagger.position.set(0.35, 0.4, 0.2);
      dagger.rotation.x = Math.PI / 2;

      group.add(body, head, leftEar, rightEar, leftArm, rightArm, leftLeg, rightLeg, dagger);
      group.rotation.y = Math.PI;
      return group;
  }

  private createVoxelDemon(): THREE.Group {
      const group = new THREE.Group();
      
      const skinMat = new THREE.MeshStandardMaterial({ color: 0x7f1d1d }); // Dark Red
      const armorMat = new THREE.MeshStandardMaterial({ color: 0x1e293b }); // Dark Grey

      // Body - Bulky
      const body = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.4, 0.8), skinMat);
      body.position.y = 1.5;

      // Head
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.7), skinMat);
      head.position.y = 2.6;

      // Horns
      const hornGeo = new THREE.ConeGeometry(0.1, 0.6, 8);
      const leftHorn = new THREE.Mesh(hornGeo, new THREE.MeshStandardMaterial({ color: 0xfef08a }));
      leftHorn.position.set(-0.25, 3.0, 0);
      leftHorn.rotation.z = 0.3;
      const rightHorn = new THREE.Mesh(hornGeo, new THREE.MeshStandardMaterial({ color: 0xfef08a }));
      rightHorn.position.set(0.25, 3.0, 0);
      rightHorn.rotation.z = -0.3;

      // Arms
      const armGeo = new THREE.BoxGeometry(0.4, 1.2, 0.4);
      const leftArm = new THREE.Mesh(armGeo, skinMat);
      leftArm.position.set(-0.9, 1.5, 0);
      const rightArm = new THREE.Mesh(armGeo, skinMat);
      rightArm.position.set(0.9, 1.5, 0);

      // Legs
      const legGeo = new THREE.BoxGeometry(0.5, 1.0, 0.5);
      const leftLeg = new THREE.Mesh(legGeo, armorMat);
      leftLeg.position.set(-0.4, 0.5, 0);
      const rightLeg = new THREE.Mesh(legGeo, armorMat);
      rightLeg.position.set(0.4, 0.5, 0);

      // Wings (Simple Boxes)
      const wingGeo = new THREE.BoxGeometry(1.5, 1.0, 0.1);
      const leftWing = new THREE.Mesh(wingGeo, new THREE.MeshStandardMaterial({ color: 0x000000 }));
      leftWing.position.set(-1.0, 2.2, -0.4);
      leftWing.rotation.y = 0.4;
      const rightWing = new THREE.Mesh(wingGeo, new THREE.MeshStandardMaterial({ color: 0x000000 }));
      rightWing.position.set(1.0, 2.2, -0.4);
      rightWing.rotation.y = -0.4;

      group.add(body, head, leftHorn, rightHorn, leftArm, rightArm, leftLeg, rightLeg, leftWing, rightWing);
      group.rotation.y = Math.PI;
      return group;
  }

  private createLootBox(color: number): THREE.Mesh {
      const geo = new THREE.BoxGeometry(0.4, 0.4, 0.4);
      const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.2, metalness: 0.8 });
      const mesh = new THREE.Mesh(geo, mat);
      
      // Floating animation helper can be added here or handled in game loop
      return mesh;
  }

  createLootBeam(color: number): THREE.Mesh {
    const geo = new THREE.CylinderGeometry(0.1, 0.1, 20, 8, 1, true);
    const mat = new THREE.MeshBasicMaterial({
      color: color,
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const beam = new THREE.Mesh(geo, mat);
    beam.position.y = 10;
    return beam;
  }

  createAoEMarker(radius: number, color: number): THREE.Mesh {
    const geo = new THREE.RingGeometry(radius * 0.9, radius, 32);
    // Rotate to lie flat
    const mat = new THREE.MeshBasicMaterial({ 
        color: color, 
        transparent: true, 
        opacity: 0.5,
        side: THREE.DoubleSide,
        depthWrite: false 
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    return mesh;
  }

  createHealthBar(): THREE.Group {
    const group = new THREE.Group();
    // Background
    const bg = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.15), new THREE.MeshBasicMaterial({ color: 0x000000 }));
    // Foreground
    const fg = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.1), new THREE.MeshBasicMaterial({ color: 0x22c55e }));
    fg.position.z = 0.01;
    
    // Align left for scaling
    fg.geometry.translate(0.55, 0, 0); 
    fg.position.x = -0.55;

    group.add(bg, fg);
    return group;
  }
}