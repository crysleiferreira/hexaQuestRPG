import { Injectable } from '@angular/core';
import * as THREE from 'three';

@Injectable({
  providedIn: 'root'
})
export class AssetService {
  
  getMesh(type: 'player' | 'enemy' | 'boss' | 'loot' | 'portal' | 'projectile', color?: number): THREE.Mesh {
    let geo, mat;

    switch (type) {
      case 'player':
        geo = new THREE.BoxGeometry(1, 1, 1);
        const baseMat = new THREE.MeshStandardMaterial({ color: 0x3b82f6, roughness: 0.3 });
        const faceMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.3 }); // Yellow for front
        // Box faces: +x, -x, +y, -y, +z, -z. 
        // We use +z as forward for lookAt alignment.
        mat = [baseMat, baseMat, baseMat, baseMat, faceMat, baseMat];
        break;
      case 'enemy':
        geo = new THREE.SphereGeometry(0.6, 16, 16);
        mat = new THREE.MeshStandardMaterial({ color: color || 0xef4444, roughness: 0.5 });
        break;
      case 'boss':
        geo = new THREE.CylinderGeometry(0.8, 1.2, 3, 16);
        mat = new THREE.MeshStandardMaterial({ 
          color: color || 0xa855f7, 
          emissive: 0x581c87, 
          emissiveIntensity: 0.8,
          roughness: 0.2
        });
        break;
      case 'loot':
        geo = new THREE.TetrahedronGeometry(0.3);
        mat = new THREE.MeshStandardMaterial({ color: color || 0xffd700, wireframe: false });
        break;
      case 'portal':
        geo = new THREE.TorusGeometry(1.5, 0.2, 16, 32);
        mat = new THREE.MeshBasicMaterial({ color: 0x60a5fa });
        break;
      case 'projectile':
        geo = new THREE.SphereGeometry(0.3, 8, 8);
        mat = new THREE.MeshBasicMaterial({ color: color || 0xffa500 });
        break;
      default:
        geo = new THREE.BoxGeometry(1, 1, 1);
        mat = new THREE.MeshStandardMaterial({ color: 0xffffff });
    }

    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
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
    const geo = new THREE.CylinderGeometry(radius, radius, 0.1, 32);
    const mat = new THREE.MeshBasicMaterial({ 
        color: color, 
        transparent: true, 
        opacity: 0.3,
        depthWrite: false 
    });
    return new THREE.Mesh(geo, mat);
  }

  createHealthBar(): THREE.Group {
    const group = new THREE.Group();
    
    // Background (Dark Grey)
    const bgGeo = new THREE.PlaneGeometry(1.2, 0.15);
    const bgMat = new THREE.MeshBasicMaterial({ color: 0x4b5563 });
    const bg = new THREE.Mesh(bgGeo, bgMat);
    
    // Foreground (Green)
    const fgGeo = new THREE.PlaneGeometry(1.1, 0.1);
    fgGeo.translate(0.55, 0, 0); // Pivot left
    const fgMat = new THREE.MeshBasicMaterial({ color: 0x22c55e });
    const fg = new THREE.Mesh(fgGeo, fgMat);
    fg.position.x = -0.55; 
    fg.position.z = 0.01; 

    group.add(bg);
    group.add(fg);
    
    return group;
  }
}