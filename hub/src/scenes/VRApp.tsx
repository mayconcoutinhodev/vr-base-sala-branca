'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { XR, Hands } from '@react-three/xr';
import { getPlatform } from '../boot/platform';
import { HubOverlay } from '../ui/HubOverlay';
import { VRHUD } from './VRHUD';
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
          <HubScene />
          {/* Renderiza modelos 3D das mãos */}
          <Hands />
          {/* HUD sempre à frente com joystick + botões */}
          <VRHUD onButton={(i) => console.log('[HUD] botão', i)} />
        </XR>
      </Canvas>

      <HubOverlay platform={platform} onEnterVR={enterVR ?? undefined} />
    </div>
  );
}

/** Ambiente básico visível da sala hub. */
function HubScene() {
  return (
    <>
      {/* Iluminação */}
      <ambientLight intensity={0.5} />
      <directionalLight position={[5, 8, 5]} intensity={1} castShadow />
      <pointLight position={[0, 3, 0]} intensity={0.8} color="#8877ff" />

      {/* Céu / fog */}
      <color attach="background" args={['#0d0d1a']} />
      <fog attach="fog" args={['#0d0d1a', 10, 40]} />

      {/* Chão */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[30, 30]} />
        <meshStandardMaterial color="#1a1a2e" roughness={0.9} metalness={0.1} />
      </mesh>

      {/* Grade no chão para dar profundidade */}
      <gridHelper args={[30, 30, '#2a2a4a', '#1e1e3a']} position={[0, 0.001, 0]} />

      {/* Teto */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 5, 0]}>
        <planeGeometry args={[30, 30]} />
        <meshStandardMaterial color="#0a0a18" roughness={1} side={2} />
      </mesh>

      {/* Parede fundo */}
      <mesh position={[0, 2.5, -8]}>
        <planeGeometry args={[16, 5]} />
        <meshStandardMaterial color="#12122a" roughness={0.8} />
      </mesh>

      {/* Portais dos módulos — cubos flutuantes como pontos de entrada */}
      <ModulePortal position={[-3, 1.2, -5]} color="#5a4fcf" label="Training Room" />
      <ModulePortal position={[3, 1.2, -5]} color="#2d8a6e" label="Inventory" />

      {/* Luz de foco no centro */}
      <spotLight
        position={[0, 5, 0]}
        angle={0.4}
        penumbra={0.5}
        intensity={1.5}
        color="#ffffff"
        castShadow
      />
    </>
  );
}

interface PortalProps {
  position: [number, number, number];
  color: string;
  label: string;
}

function ModulePortal({ position, color }: PortalProps) {
  return (
    <group position={position}>
      {/* Frame */}
      <mesh castShadow>
        <boxGeometry args={[1.4, 2.2, 0.1]} />
        <meshStandardMaterial color={color} roughness={0.3} metalness={0.6} />
      </mesh>
      {/* Brilho interior */}
      <mesh position={[0, 0, 0.06]}>
        <planeGeometry args={[1.1, 1.9]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.6}
          transparent
          opacity={0.4}
        />
      </mesh>
      {/* Luz pontual para iluminar a área */}
      <pointLight color={color} intensity={0.6} distance={4} />
    </group>
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
