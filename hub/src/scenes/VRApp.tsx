'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { XR, Hands } from '@react-three/xr';
import { getPlatform } from '../boot/platform';
import { HubOverlay } from '../ui/HubOverlay';
import { VRHUD } from './VRHUD';
import { HubWorld } from './HubWorld';
import { TestLabWorld } from './TestLabWorld';
import { useSceneStore } from '../store/sceneStore';
import type { VRPlatform } from '@vr/core';

type EnterVRFn = () => Promise<void>;

export default function VRApp() {
  const [platform, setPlatform] = useState<VRPlatform | null>(null);
  const [booting, setBooting] = useState(true);
  const [bootError, setBootError] = useState<string | null>(null);
  const [enterVR, setEnterVR] = useState<EnterVRFn | null>(null);
  const booted = useRef(false);

  useEffect(() => {
    if (booted.current) return;
    booted.current = true;

    const p = getPlatform();
    p.runtime
      .boot()
      .then(() => {
        setPlatform(p);
        setBooting(false);
      })
      .catch((err: unknown) => {
        setBootError(String(err));
        setBooting(false);
      });
  }, []);

  const handleEnterVRReady = useCallback((fn: EnterVRFn) => {
    setEnterVR(() => fn);
  }, []);

  if (booting) return <div style={styles.status}>Iniciando VR Platform…</div>;
  if (bootError) return <div style={styles.error}>Erro ao iniciar: {bootError}</div>;
  if (!platform) return null;

  return (
    <div style={styles.root}>
      <Canvas
        style={styles.canvas}
        gl={{ antialias: true }}
        camera={{ fov: 70, near: 0.01, far: 1000, position: [0, 1.6, 3] }}
      >
        <XR>
          <XRBridge onEnterVRReady={handleEnterVRReady} />
          <SceneRenderer />
          <Hands />
          <VRHUD onButton={(i) => console.log('[HUD] botão', i)} />
        </XR>
      </Canvas>

      <HubOverlay platform={platform} onEnterVR={enterVR ?? undefined} />
    </div>
  );
}

/** Renderiza o mundo ativo conforme o sceneStore. */
function SceneRenderer() {
  const active = useSceneStore((s) => s.active);

  return (
    <>
      {active === 'hub'          && <HubWorld />}
      {active === 'test-lab'     && <TestLabWorld />}
      {/* training-room e inventory serão adicionados quando implementados */}
      {(active === 'training-room' || active === 'inventory') && <PlaceholderWorld name={active} />}
    </>
  );
}

/** Placeholder para módulos ainda não implementados. */
function PlaceholderWorld({ name }: { name: string }) {
  const setActive = useSceneStore((s) => s.setActive);
  return (
    <>
      <ambientLight intensity={0.6} />
      <color attach="background" args={['#0a0a18']} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[20, 20]} />
        <meshStandardMaterial color="#111122" roughness={0.9} />
      </mesh>
      {/* Cubo de retorno — clique/pinch para voltar ao hub */}
      <mesh
        position={[0, 1.2, -1.5]}
        onClick={() => setActive('hub')}
      >
        <boxGeometry args={[0.3, 0.3, 0.3]} />
        <meshStandardMaterial color="#ff3300" emissive="#ff1100" emissiveIntensity={2} />
      </mesh>
      <pointLight position={[0, 2, 0]} color="#5544ff" intensity={1} distance={5} />
      {/* Aviso visual: módulo {name} em construção */}
      <mesh position={[0, 1.8, -2]}>
        <planeGeometry args={[1.5, 0.4]} />
        <meshBasicMaterial color="#220011" transparent opacity={0.7} />
      </mesh>
    </>
  );
}

/** Conecta o renderer ao WebXR. */
function XRBridge({ onEnterVRReady }: { onEnterVRReady: (fn: EnterVRFn) => void }) {
  const { gl } = useThree();

  useEffect(() => {
    gl.xr.enabled = true;

    const enter: EnterVRFn = async () => {
      if (!navigator.xr) {
        console.warn('[XR] WebXR não disponível neste navegador/dispositivo.');
        return;
      }
      try {
        const session = await navigator.xr.requestSession('immersive-vr', {
          requiredFeatures: ['local-floor'],
          optionalFeatures: ['bounded-floor', 'hand-tracking'],
        });
        await gl.xr.setSession(session);
      } catch (err) {
        console.error('[XR] Falha ao iniciar sessão:', err);
      }
    };

    onEnterVRReady(enter);
  }, [gl, onEnterVRReady]);

  return null;
}

const styles = {
  root: {
    width: '100vw',
    height: '100vh',
    position: 'relative' as const,
    overflow: 'hidden',
  },
  canvas: {
    position: 'absolute' as const,
    inset: 0,
  },
  status: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh',
    color: '#aaa',
    fontSize: '1.1rem',
    background: '#0d0d1a',
  },
  error: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh',
    color: '#f55',
    fontSize: '1.1rem',
    background: '#0d0d1a',
  },
} as const;
