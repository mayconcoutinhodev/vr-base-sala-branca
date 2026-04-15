'use client'

/**
 * TestLabWorld — Sala de Testes de Interação
 *
 * Marcadores visuais nos joints das mãos + painéis que reagem a:
 *   • Punho fechado (fist) L/D
 *   • Beliscão (pinch) L/D
 *   • Toque em esferas (index/thumb tip)
 *   • Aplauso (mãos juntas)
 *   • Movimento rápido (wave)
 *
 * Botão de saída: feche o punho dentro da esfera vermelha de "voltar".
 */

import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useSceneStore } from '../store/sceneStore'

// ─── Constantes ───────────────────────────────────────────────────────────────

const FIST_CLOSE   = 0.115
const FIST_OPEN    = 0.155
const PINCH_DIST   = 0.04
const TOUCH_RADIUS = 0.08
const CLAP_DIST    = 0.18
const EXIT_RADIUS  = 0.40

const TOUCH_TARGETS: [number, number, number][] = [
  [-0.40, 1.20, -0.80],
  [-0.20, 1.40, -0.80],
  [ 0.00, 1.50, -0.80],
  [ 0.20, 1.40, -0.80],
  [ 0.40, 1.20, -0.80],
]

// ─── Tipo HandData ────────────────────────────────────────────────────────────

interface HandData {
  wrist:     THREE.Vector3
  indexTip:  THREE.Vector3
  middleTip: THREE.Vector3
  thumbTip:  THREE.Vector3
  fist:      boolean
  prevFist:  boolean
  pinching:  boolean
  hasData:   boolean
  prevWrist: THREE.Vector3
  velocity:  number
}

const mkHand = (): HandData => ({
  wrist:     new THREE.Vector3(),
  indexTip:  new THREE.Vector3(),
  middleTip: new THREE.Vector3(),
  thumbTip:  new THREE.Vector3(),
  fist:      false,
  prevFist:  false,
  pinching:  false,
  hasData:   false,
  prevWrist: new THREE.Vector3(),
  velocity:  0,
})

// ─── Componente ───────────────────────────────────────────────────────────────

export function TestLabWorld() {
  const setActive = useSceneStore((s) => s.setActive)

  const lh = useRef<HandData>(mkHand())
  const rh = useRef<HandData>(mkHand())

  // Joint markers — esquerda (azul)
  const lWristM  = useRef<THREE.Mesh>(null)
  const lIndexM  = useRef<THREE.Mesh>(null)
  const lThumbM  = useRef<THREE.Mesh>(null)
  // Joint markers — direita (laranja)
  const rWristM  = useRef<THREE.Mesh>(null)
  const rIndexM  = useRef<THREE.Mesh>(null)
  const rThumbM  = useRef<THREE.Mesh>(null)

  // Painéis de estado
  const lFistBox  = useRef<THREE.Mesh>(null)
  const rFistBox  = useRef<THREE.Mesh>(null)
  const lPinchBox = useRef<THREE.Mesh>(null)
  const rPinchBox = useRef<THREE.Mesh>(null)
  const clapBox   = useRef<THREE.Mesh>(null)
  const lWaveBox  = useRef<THREE.Mesh>(null)
  const rWaveBox  = useRef<THREE.Mesh>(null)

  // Touch targets
  const touchMeshes = useRef<(THREE.Mesh | null)[]>(new Array(TOUCH_TARGETS.length).fill(null))

  // Exit sphere
  const exitMesh = useRef<THREE.Mesh>(null)
  const exitCooldown = useRef(1.5)  // evita sair imediatamente ao entrar

  const setMatColor = (mesh: THREE.Mesh | null, hex: number, emissive = hex, intensity = 1) => {
    if (!mesh) return
    const m = mesh.material as THREE.MeshStandardMaterial
    m.color.setHex(hex)
    m.emissive.setHex(emissive)
    m.emissiveIntensity = intensity
  }

  useFrame(({ gl }, delta, xrFrame) => {

    // Cooldown de saída ao entrar na sala
    if (exitCooldown.current > 0) exitCooldown.current -= delta

    // ── Lê joints ────────────────────────────────────────────────────────────
    lh.current.hasData = false
    rh.current.hasData = false

    if (xrFrame) {
      const refSpace = gl.xr.getReferenceSpace()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const frame = xrFrame as any

      if (refSpace) {
        for (const src of frame.session.inputSources as any[]) {
          if (!src.hand) continue

          const hand = src.handedness === 'left' ? lh.current : rh.current
          hand.prevWrist.copy(hand.wrist)
          hand.prevFist = hand.fist
          hand.hasData = true

          const readPos = (name: string, out: THREE.Vector3) => {
            const joint = src.hand.get(name)
            if (!joint) return
            const pose = frame.getJointPose(joint, refSpace)
            if (pose) out.set(
              pose.transform.position.x,
              pose.transform.position.y,
              pose.transform.position.z,
            )
          }

          readPos('wrist',             hand.wrist)
          readPos('index-finger-tip',  hand.indexTip)
          readPos('middle-finger-tip', hand.middleTip)
          readPos('thumb-tip',         hand.thumbTip)

          hand.velocity = hand.wrist.distanceTo(hand.prevWrist) / Math.max(delta, 0.001)

          const iDist = hand.indexTip.distanceTo(hand.wrist)
          if (!hand.fist && iDist < FIST_CLOSE) hand.fist = true
          if ( hand.fist && iDist > FIST_OPEN)  hand.fist = false

          hand.pinching = hand.indexTip.distanceTo(hand.thumbTip) < PINCH_DIST
        }
      }
    }

    // ── Joint markers ─────────────────────────────────────────────────────────
    const posOrHide = (mesh: THREE.Mesh | null, hand: HandData, pos: THREE.Vector3) => {
      if (!mesh) return
      mesh.visible = hand.hasData
      if (hand.hasData) mesh.position.copy(pos)
    }

    posOrHide(lWristM.current, lh.current, lh.current.wrist)
    posOrHide(lIndexM.current, lh.current, lh.current.indexTip)
    posOrHide(lThumbM.current, lh.current, lh.current.thumbTip)
    posOrHide(rWristM.current, rh.current, rh.current.wrist)
    posOrHide(rIndexM.current, rh.current, rh.current.indexTip)
    posOrHide(rThumbM.current, rh.current, rh.current.thumbTip)

    // ── Fist ──────────────────────────────────────────────────────────────────
    setMatColor(lFistBox.current,
      lh.current.fist ? 0x00ff44 : 0x223322,
      lh.current.fist ? 0x00ff44 : 0x001100,
      lh.current.fist ? 3 : 0.2,
    )
    setMatColor(rFistBox.current,
      rh.current.fist ? 0x00ff44 : 0x223322,
      rh.current.fist ? 0x00ff44 : 0x001100,
      rh.current.fist ? 3 : 0.2,
    )

    // ── Pinch ─────────────────────────────────────────────────────────────────
    setMatColor(lPinchBox.current,
      lh.current.pinching ? 0xffee00 : 0x333300,
      lh.current.pinching ? 0xffee00 : 0x111100,
      lh.current.pinching ? 4 : 0.2,
    )
    setMatColor(rPinchBox.current,
      rh.current.pinching ? 0xffee00 : 0x333300,
      rh.current.pinching ? 0xffee00 : 0x111100,
      rh.current.pinching ? 4 : 0.2,
    )

    // ── Clap ──────────────────────────────────────────────────────────────────
    const clapping = lh.current.hasData && rh.current.hasData &&
      lh.current.wrist.distanceTo(rh.current.wrist) < CLAP_DIST
    setMatColor(clapBox.current,
      clapping ? 0xff6600 : 0x331500,
      clapping ? 0xff6600 : 0x110500,
      clapping ? 4 : 0.2,
    )

    // ── Wave ──────────────────────────────────────────────────────────────────
    setMatColor(lWaveBox.current,
      lh.current.velocity > 1.2 ? 0xff44ff : 0x220022,
      lh.current.velocity > 1.2 ? 0xff44ff : 0x110011,
      lh.current.velocity > 1.2 ? 4 : 0.2,
    )
    setMatColor(rWaveBox.current,
      rh.current.velocity > 1.2 ? 0xff44ff : 0x220022,
      rh.current.velocity > 1.2 ? 0xff44ff : 0x110011,
      rh.current.velocity > 1.2 ? 4 : 0.2,
    )

    // ── Touch targets ─────────────────────────────────────────────────────────
    const tips = [
      lh.current.hasData ? lh.current.indexTip : null,
      lh.current.hasData ? lh.current.thumbTip  : null,
      rh.current.hasData ? rh.current.indexTip  : null,
      rh.current.hasData ? rh.current.thumbTip  : null,
    ].filter(Boolean) as THREE.Vector3[]

    for (let i = 0; i < TOUCH_TARGETS.length; i++) {
      const mesh = touchMeshes.current[i]
      if (!mesh) continue
      const [tx, ty, tz] = TOUCH_TARGETS[i]!
      const tp = new THREE.Vector3(tx, ty, tz)
      const touched = tips.some(t => t.distanceTo(tp) < TOUCH_RADIUS)
      const m = mesh.material as THREE.MeshStandardMaterial
      m.color.setHex(touched ? 0xff2222 : 0x4488ff)
      m.emissive.setHex(touched ? 0xff0000 : 0x112244)
      m.emissiveIntensity = touched ? 5 : 0.5
      mesh.scale.setScalar(touched ? 1.35 : 1.0)
    }

    // ── Botão de saída ────────────────────────────────────────────────────────
    if (exitCooldown.current <= 0 && exitMesh.current) {
      const exitPos = new THREE.Vector3(0, 1.0, 1.5)
      const dL = lh.current.hasData ? lh.current.wrist.distanceTo(exitPos) : Infinity
      const dR = rh.current.hasData ? rh.current.wrist.distanceTo(exitPos) : Infinity
      const inExit = Math.min(dL, dR) < EXIT_RADIUS

      const m = exitMesh.current.material as THREE.MeshStandardMaterial
      m.emissiveIntensity = inExit ? 3.5 : 1.0
      m.opacity           = inExit ? 0.6 : 0.25

      const fistInExit = inExit && (
        (lh.current.hasData && lh.current.fist && !lh.current.prevFist) ||
        (rh.current.hasData && rh.current.fist && !rh.current.prevFist)
      )
      if (fistInExit) {
        exitCooldown.current = 1.5
        setActive('hub')
      }
    }
  })

  return (
    <>
      {/* ── Ambiente da sala de testes ── */}
      <ambientLight intensity={0.5} />
      <directionalLight position={[3, 6, 3]} intensity={1} castShadow />
      <pointLight position={[0, 3, 0]} intensity={0.7} color="#8877ff" />

      <color attach="background" args={['#0d0d1a']} />
      <fog attach="fog" args={['#0d0d1a', 8, 30]} />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[20, 20]} />
        <meshStandardMaterial color="#1a1a2e" roughness={0.9} />
      </mesh>
      <gridHelper args={[20, 20, '#2a2a4a', '#1e1e3a']} position={[0, 0.001, 0]} />

      {/* ── Painel de fundo ── */}
      <mesh position={[0, 1.6, -1.05]}>
        <planeGeometry args={[2.2, 0.85]} />
        <meshBasicMaterial color="#080818" transparent opacity={0.88} />
      </mesh>

      {/* ── Indicadores de gesto ── */}

      {/* Fist L */}
      <mesh ref={lFistBox} position={[-0.82, 1.82, -1.0]}>
        <boxGeometry args={[0.30, 0.16, 0.015]} />
        <meshStandardMaterial color="#223322" emissive="#001100" emissiveIntensity={0.2} />
      </mesh>
      {/* Fist R */}
      <mesh ref={rFistBox} position={[-0.46, 1.82, -1.0]}>
        <boxGeometry args={[0.30, 0.16, 0.015]} />
        <meshStandardMaterial color="#223322" emissive="#001100" emissiveIntensity={0.2} />
      </mesh>
      {/* Pinch L */}
      <mesh ref={lPinchBox} position={[-0.10, 1.82, -1.0]}>
        <boxGeometry args={[0.30, 0.16, 0.015]} />
        <meshStandardMaterial color="#333300" emissive="#111100" emissiveIntensity={0.2} />
      </mesh>
      {/* Pinch R */}
      <mesh ref={rPinchBox} position={[0.26, 1.82, -1.0]}>
        <boxGeometry args={[0.30, 0.16, 0.015]} />
        <meshStandardMaterial color="#333300" emissive="#111100" emissiveIntensity={0.2} />
      </mesh>
      {/* Clap */}
      <mesh ref={clapBox} position={[0.62, 1.82, -1.0]}>
        <boxGeometry args={[0.30, 0.16, 0.015]} />
        <meshStandardMaterial color="#331500" emissive="#110500" emissiveIntensity={0.2} />
      </mesh>
      {/* Wave L */}
      <mesh ref={lWaveBox} position={[-0.82, 1.60, -1.0]}>
        <boxGeometry args={[0.30, 0.14, 0.015]} />
        <meshStandardMaterial color="#220022" emissive="#110011" emissiveIntensity={0.2} />
      </mesh>
      {/* Wave R */}
      <mesh ref={rWaveBox} position={[-0.46, 1.60, -1.0]}>
        <boxGeometry args={[0.30, 0.14, 0.015]} />
        <meshStandardMaterial color="#220022" emissive="#110011" emissiveIntensity={0.2} />
      </mesh>

      {/* ── Touch targets ── */}
      {TOUCH_TARGETS.map(([x, y, z], i) => (
        <mesh
          key={i}
          ref={el => { touchMeshes.current[i] = el }}
          position={[x, y, z]}
        >
          <sphereGeometry args={[TOUCH_RADIUS, 16, 12]} />
          <meshStandardMaterial
            color="#4488ff"
            emissive="#112244"
            emissiveIntensity={0.5}
            transparent
            opacity={0.85}
          />
        </mesh>
      ))}

      {/* ── Joint markers — mão ESQUERDA (azul) ── */}
      <mesh ref={lWristM} visible={false}>
        <sphereGeometry args={[0.020, 8, 8]} />
        <meshStandardMaterial color="#2255ff" emissive="#2255ff" emissiveIntensity={3} />
      </mesh>
      <mesh ref={lIndexM} visible={false}>
        <sphereGeometry args={[0.012, 8, 8]} />
        <meshStandardMaterial color="#44aaff" emissive="#44aaff" emissiveIntensity={4} />
      </mesh>
      <mesh ref={lThumbM} visible={false}>
        <sphereGeometry args={[0.012, 8, 8]} />
        <meshStandardMaterial color="#88ccff" emissive="#88ccff" emissiveIntensity={4} />
      </mesh>

      {/* ── Joint markers — mão DIREITA (laranja) ── */}
      <mesh ref={rWristM} visible={false}>
        <sphereGeometry args={[0.020, 8, 8]} />
        <meshStandardMaterial color="#ff4422" emissive="#ff4422" emissiveIntensity={3} />
      </mesh>
      <mesh ref={rIndexM} visible={false}>
        <sphereGeometry args={[0.012, 8, 8]} />
        <meshStandardMaterial color="#ff8844" emissive="#ff8844" emissiveIntensity={4} />
      </mesh>
      <mesh ref={rThumbM} visible={false}>
        <sphereGeometry args={[0.012, 8, 8]} />
        <meshStandardMaterial color="#ffcc88" emissive="#ffcc88" emissiveIntensity={4} />
      </mesh>

      {/* ── Botão de saída — esfera vermelha atrás do jogador ── */}
      <mesh ref={exitMesh} position={[0, 1.0, 1.5]}>
        <sphereGeometry args={[EXIT_RADIUS, 16, 12]} />
        <meshStandardMaterial
          color="#ff2200"
          emissive="#ff0000"
          emissiveIntensity={1.0}
          transparent
          opacity={0.25}
          depthWrite={false}
          side={2}
        />
      </mesh>
      {/* Anel de destaque do exit */}
      <mesh position={[0, 1.0, 1.5]}>
        <torusGeometry args={[EXIT_RADIUS, 0.012, 8, 32]} />
        <meshStandardMaterial color="#ff2200" emissive="#ff0000" emissiveIntensity={2} />
      </mesh>
    </>
  )
}
