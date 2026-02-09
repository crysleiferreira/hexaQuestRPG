import { Component, output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-start-screen',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
        <h1 class="text-9xl font-black text-transparent bg-clip-text bg-gradient-to-b from-blue-400 to-purple-600 mb-6 drop-shadow-lg text-outline tracking-tighter">HEXAQUEST</h1>
        <p class="text-xl text-gray-300 mb-12 tracking-widest uppercase font-bold">3D Action RPG</p>
        
        <button (click)="startGame.emit()" class="group relative px-12 py-5 bg-white text-black font-black text-2xl uppercase tracking-widest hover:scale-105 transition duration-200 shadow-[0_0_20px_rgba(255,255,255,0.5)] hover:shadow-[0_0_40px_rgba(255,255,255,0.8)] clip-path-polygon">
           Start Game
           <div class="absolute inset-0 border-2 border-white scale-110 opacity-0 group-hover:scale-105 group-hover:opacity-100 transition duration-300"></div>
        </button>
        
        <div class="mt-8 text-gray-400 text-sm font-mono flex gap-8">
           <div class="flex flex-col items-center"><span class="text-white font-bold border border-white/30 px-2 py-1 rounded">W A S D</span><span class="mt-1">Move</span></div>
           <div class="flex flex-col items-center"><span class="text-white font-bold border border-white/30 px-2 py-1 rounded">MOUSE</span><span class="mt-1">Aim</span></div>
           <div class="flex flex-col items-center"><span class="text-white font-bold border border-white/30 px-2 py-1 rounded">CLICK</span><span class="mt-1">Attack</span></div>
           <div class="flex flex-col items-center"><span class="text-white font-bold border border-white/30 px-2 py-1 rounded">I / ESC</span><span class="mt-1">Inventory</span></div>
        </div>
     </div>
  `
})
export class StartScreenComponent {
  startGame = output<void>();
}