import * as THREE from 'three';
import type { SceneController as ISceneController } from '@vr/module-sdk';

/**
 * Owns the Three.js scene graph.
 * Modules create isolated groups — nothing leaks when they unmount.
 *
 * Scene hierarchy:
 *   root
 *     baseEnvironment
 *     xrRig
 *     globalLights
 *     sharedUIAnchors
 *     activeModuleGroup  ← swapped per module
 *     overlayGroup
 */
export class SceneController implements ISceneController {
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly renderer: THREE.WebGLRenderer | null = null;

  private moduleGroups = new Map<string, THREE.Group>();
  private activeGroup: THREE.Group;

  constructor() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(70, 1, 0.01, 1000);

    // Base lights
    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    const dir = new THREE.DirectionalLight(0xffffff, 0.8);
    dir.position.set(5, 10, 7);
    this.scene.add(ambient, dir);

    // Active module container
    this.activeGroup = new THREE.Group();
    this.activeGroup.name = '__activeModuleGroup';
    this.scene.add(this.activeGroup);
  }

  createModuleGroup(moduleId: string): THREE.Group {
    const group = new THREE.Group();
    group.name = `module:${moduleId}`;
    this.moduleGroups.set(moduleId, group);
    return group;
  }

  addToActiveGroup(group: unknown): void {
    this.activeGroup.add(group as THREE.Group);
  }

  removeModuleGroup(moduleId: string): void {
    const group = this.moduleGroups.get(moduleId);
    if (!group) return;

    // Recursively dispose geometries / materials / textures
    group.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        for (const mat of mats) mat.dispose();
      }
    });

    this.activeGroup.remove(group);
    this.moduleGroups.delete(moduleId);
  }

  /** Attach an HTMLCanvasElement and start the render loop (optional in tests). */
  attachRenderer(canvas: HTMLCanvasElement): void {
    const r = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    r.xr.enabled = true;
    (this as { renderer: THREE.WebGLRenderer | null }).renderer = r;
    this.fitToWindow(r);
    window.addEventListener('resize', () => this.fitToWindow(r));
    r.setAnimationLoop(() => r.render(this.scene, this.camera));
  }

  private fitToWindow(r: THREE.WebGLRenderer): void {
    r.setSize(window.innerWidth, window.innerHeight);
    r.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
  }
}
