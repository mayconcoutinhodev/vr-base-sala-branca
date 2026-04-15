'use client'

/**
 * HubWorld — Sala Branca
 *
 * Sala limpa com portais para cada módulo.
 * Aproxime-se de um portal → partículas explodem (estilo Minecraft).
 * Fique 3 segundos perto → teleporta para o mundo.
 */

import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useSceneStore, type SceneName } from '../store/sceneStore'

// ─── Definições dos portais ───────────────────────────────────────────────────

interface PortalDef {
  id: SceneName
  position: [number, number, number]
  color: number      // hex int
  emissive: number
}

const PORTALS: PortalDef[] = [
  { id: 'test-lab',      position: [-2.5, 0, -4], color: 0x0d3330, emissive: 0x00ddcc },
  { id: 'training-room', position: [ 0.0, 0, -5], color: 0x1a0d33, emissive: 0x9966ff },
  { id: 'inventory',     position: [ 2.5, 0, -4], color: 0x0d2a14, emissive: 0x33ff88 },
]

// Portal frame dimensions (local, grupo ancorado no chão)
const FRAME_W   = 1.5
const FRAME_H   = 2.6
const FRAME_Y   = FRAME_H / 2   // centro do frame em relação ao grupo (y=0 = chão)

// Raio de proximidade (câmera = cabeça)
const ENTER_RADIUS = 1.1
const ENTER_TIME   = 3.0   // segundos para entrar

// Partículas
const MAX_P      = 120
const SPAWN_RATE = 18    // partículas/segundo quando longe
const SPAWN_NEAR = 55    // partículas/segundo quando perto
const P_LIFE_MIN = 1.2
const P_LIFE_MAX = 2.8
const P_SPEED    = 0.55  // velocidade base para cima

// ─── Portal ───────────────────────────────────────────────────────────────────

interface PortalProps { def: PortalDef; onEnter: (id: SceneName) => void }

// Estado de cada partícula (arrays paralelos para performance)
interface PState {
  alive:   boolean
  x: number; y: number; z: number   // posição local ao grupo
  vx: number; vy: number; vz: number
  life: number   // restante
  maxLife: number
}

function mkParticles(): PState[] {
  return Array.from({ length: MAX_P }, () => ({
    alive: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0, maxLife: 1,
  }))
}

function spawnParticle(p: PState, emissive: number) {
  // Nasce na face do portal (interior)
  p.alive   = true
  p.x       = (Math.random() - 0.5) * (FRAME_W - 0.3)
  p.y       = Math.random() * FRAME_H * 0.9 + FRAME_H * 0.05
  p.z       = 0.06 + Math.random() * 0.04
  p.vx      = (Math.random() - 0.5) * 0.18
  p.vy      = P_SPEED + Math.random() * 0.4
  p.vz      = (Math.random() - 0.5) * 0.12
  p.maxLife = P_LIFE_MIN + Math.random() * (P_LIFE_MAX - P_LIFE_MIN)
  p.life    = p.maxLife
  void emissive  // usado pela cor do material, não por partícula
}

function Portal({ def, onEnter }: PortalProps) {
  const groupRef   = useRef<THREE.Group>(null)
  const frameMat   = useRef<THREE.MeshStandardMaterial>(null)
  const innerMat   = useRef<THREE.MeshStandardMaterial>(null)
  const fillBarRef = useRef<THREE.Mesh>(null)

  // Buffer de posições das partículas (THREE.Points imperativo)
  const posArr  = useMemo(() => new Float32Array(MAX_P * 3).fill(9999), [])
  const posAttr = useRef<THREE.BufferAttribute>(null)

  // Estado das partículas
  const particles = useRef<PState[]>(mkParticles())
  const spawnAcc  = useRef(0)   // acumulador de spawn fracionário

  // Estado de entrada
  const entered  = useRef(false)
  const hoverT   = useRef(0)
  const pulseT   = useRef(0)
  const inRange  = useRef(false)

  useFrame(({ camera }, delta) => {
    if (entered.current) return

    // ── 1. Checa proximidade da câmera ────────────────────────────────────────
    const cx = camera.position.x - def.position[0]
    const cy = camera.position.y - FRAME_Y
    const cz = camera.position.z - def.position[2]
    const camDist = Math.sqrt(cx * cx + cy * cy + cz * cz)
    inRange.current = camDist < ENTER_RADIUS

    // ── 2. Timer de entrada ───────────────────────────────────────────────────
    if (inRange.current) {
      hoverT.current = Math.min(hoverT.current + delta, ENTER_TIME)
      if (hoverT.current >= ENTER_TIME) {
        entered.current = true
        onEnter(def.id)
        return
      }
    } else {
      hoverT.current = Math.max(hoverT.current - delta * 1.5, 0)
    }

    const progress = hoverT.current / ENTER_TIME

    // ── 3. Spawn de partículas ────────────────────────────────────────────────
    const rate = inRange.current
      ? SPAWN_NEAR + (SPAWN_NEAR - SPAWN_RATE) * progress
      : SPAWN_RATE * 0.3   // poucas partículas quando longe (portal "respirando")

    spawnAcc.current += rate * delta
    while (spawnAcc.current >= 1) {
      spawnAcc.current -= 1
      const slot = particles.current.findIndex(p => !p.alive)
      if (slot >= 0) spawnParticle(particles.current[slot]!, def.emissive)
    }

    // ── 4. Atualiza partículas ────────────────────────────────────────────────
    const ps = particles.current
    for (let i = 0; i < MAX_P; i++) {
      const p = ps[i]!
      const base = i * 3

      if (!p.alive) {
        posArr[base]     = 9999
        posArr[base + 1] = 9999
        posArr[base + 2] = 9999
        continue
      }

      p.life -= delta
      if (p.life <= 0 || p.y > FRAME_H + 0.5) {
        p.alive = false
        posArr[base] = posArr[base + 1] = posArr[base + 2] = 9999
        continue
      }

      // Movimento estilo Minecraft: sobe com drift lateral e pequena aceleração
      p.vy  += (Math.random() - 0.5) * 0.1 * delta  // leve turbulência vertical
      p.vx  += (Math.random() - 0.5) * 0.2 * delta
      p.x   += p.vx * delta
      p.y   += p.vy * delta
      p.z   += p.vz * delta

      // Posição no buffer (local ao grupo)
      posArr[base]     = p.x
      posArr[base + 1] = p.y
      posArr[base + 2] = p.z
    }

    if (posAttr.current) posAttr.current.needsUpdate = true

    // ── 5. Visuais do frame ────────────────────────────────────────────────────
    pulseT.current += delta * (inRange.current ? 4 : 1.5)
    const pulse = Math.sin(pulseT.current) * 0.5 + 0.5

    if (frameMat.current) {
      frameMat.current.emissiveIntensity = inRange.current
        ? 1.0 + pulse * 2.0 + progress * 2.0
        : 0.4 + pulse * 0.3
    }
    if (innerMat.current) {
      innerMat.current.opacity = inRange.current
        ? 0.45 + pulse * 0.25 + progress * 0.2
        : 0.22 + pulse * 0.08
      innerMat.current.emissiveIntensity = inRange.current
        ? 1.5 + pulse + progress * 2
        : 0.4
    }

    // Barra de progresso
    if (fillBarRef.current) {
      fillBarRef.current.scale.x = Math.max(progress, 0.001)
      const m = fillBarRef.current.material as THREE.MeshStandardMaterial
      m.emissiveIntensity = 1.5 + progress * 4
      m.opacity = inRange.current ? 0.9 : 0
    }
  })

  const [px, , pz] = def.position
  const emHex = '#' + def.emissive.toString(16).padStart(6, '0')
  const colHex = '#' + def.color.toString(16).padStart(6, '0')

  return (
    <group ref={groupRef} position={[px, 0, pz]}>

      {/* ── Frame ── */}
      <mesh position={[0, FRAME_Y, 0]} castShadow>
        <boxGeometry args={[FRAME_W, FRAME_H, 0.10]} />
        <meshStandardMaterial
          ref={frameMat}
          color={colHex}
          emissive={emHex}
          emissiveIntensity={0.4}
          roughness={0.15}
          metalness={0.8}
        />
      </mesh>

      {/* ── Interior brilhante ── */}
      <mesh position={[0, FRAME_Y, 0.06]}>
        <planeGeometry args={[FRAME_W - 0.3, FRAME_H - 0.3]} />
        <meshStandardMaterial
          ref={innerMat}
          color={emHex}
          emissive={emHex}
          emissiveIntensity={0.4}
          transparent
          opacity={0.22}
          depthWrite={false}
        />
      </mesh>

      {/* ── Partículas ── */}
      <points>
        <bufferGeometry>
          <bufferAttribute
            ref={posAttr}
            attach="attributes-position"
            array={posArr}
            count={MAX_P}
            itemSize={3}
          />
        </bufferGeometry>
        <pointsMaterial
          color={emHex}
          size={0.028}
          sizeAttenuation
          transparent
          opacity={0.92}
          depthWrite={false}
        />
      </points>

      {/* ── Barra de progresso (base do portal) ── */}
      {/* Fundo */}
      <mesh position={[0, 0.03, 0.07]}>
        <planeGeometry args={[FRAME_W - 0.1, 0.06]} />
        <meshStandardMaterial color="#111" transparent opacity={0.6} />
      </mesh>
      {/* Fill */}
      <mesh ref={fillBarRef} position={[0, 0.03, 0.08]} scale={[0.001, 1, 1]}>
        <planeGeometry args={[FRAME_W - 0.14, 0.052]} />
        <meshStandardMaterial
          color={emHex}
          emissive={emHex}
          emissiveIntensity={1.5}
          transparent
          opacity={0}
          depthWrite={false}
        />
      </mesh>

      {/* ── Luz pontual ── */}
      <pointLight
        position={[0, FRAME_Y, 0.6]}
        color={emHex}
        intensity={0.9}
        distance={3.5}
      />
    </group>
  )
}

// ─── HubWorld ─────────────────────────────────────────────────────────────────

export function HubWorld() {
  const setActive = useSceneStore((s) => s.setActive)

  return (
    <>
      {/* Iluminação branca e limpa */}
      <ambientLight intensity={1.4} />
      <directionalLight position={[2, 8, 4]}  intensity={1.4} castShadow color="#ffffff" />
      <directionalLight position={[-4, 6, -2]} intensity={0.5} color="#ddeeff" />

      <color attach="background" args={['#f2f2f8']} />
      <fog attach="fog" args={['#f2f2f8', 14, 32]} />

      {/* Chão */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[30, 30]} />
        <meshStandardMaterial color="#eaeaf2" roughness={0.88} />
      </mesh>
      <gridHelper args={[20, 20, '#ccccdd', '#dddde8']} position={[0, 0.001, 0]} />

      {/* Teto */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 5, 0]}>
        <planeGeometry args={[30, 30]} />
        <meshStandardMaterial color="#f5f5ff" roughness={1} side={2} />
      </mesh>

      {/* Paredes */}
      <mesh position={[-6, 2.5, -3]}>
        <planeGeometry args={[14, 5]} />
        <meshStandardMaterial color="#ececf5" roughness={0.9} />
      </mesh>
      <mesh position={[6, 2.5, -3]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[14, 5]} />
        <meshStandardMaterial color="#ececf5" roughness={0.9} />
      </mesh>
      <mesh position={[0, 2.5, -7]}>
        <planeGeometry args={[14, 5]} />
        <meshStandardMaterial color="#e8e8f2" roughness={0.9} />
      </mesh>

      {/* Portais */}
      {PORTALS.map((p) => (
        <Portal key={p.id} def={p} onEnter={setActive} />
      ))}

      {/* Spot central */}
      <spotLight
        position={[0, 5, -2]}
        angle={0.55}
        penumbra={0.4}
        intensity={1.8}
        color="#ffffff"
        castShadow
      />
    </>
  )
}
