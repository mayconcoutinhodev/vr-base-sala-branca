'use client'

/**
 * InteractionTest — painel de debug de hand tracking.
 *
 * Mostra:
 *  • Esferas nos joints reais das mãos (wrist, index, middle, thumb)
 *  • Detector de punho (fist) — esquerda e direita separados
 *  • Detector de beliscão (pinch) — esquerda e direita
 *  • Esferas de toque — reagemquando qualquer fingertip entra no raio
 *  • Detector de palma aberta (spread)
 *  • Detector de palmafechar rápido (velocidade)
 *  • Detector de aplauso (mãos juntas)
 */

import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

// ─── Constantes ───────────────────────────────────────────────────────────────

const FIST_CLOSE   = 0.115
const FIST_OPEN    = 0.155
const PINCH_DIST   = 0.04
const TOUCH_RADIUS = 0.08
const CLAP_DIST    = 0.18

// Touch targets: [x, y, z]
const TOUCH_TARGETS: [number, number, number][] = [
  [-0.40, 1.20, -0.80],
  [-0.20, 1.40, -0.80],
  [ 0.00, 1.50, -0.80],
  [ 0.20, 1.40, -0.80],
  [ 0.40, 1.20, -0.80],
]

// ─── Helper ───────────────────────────────────────────────────────────────────

interface HandData {
  wrist:     THREE.Vector3
  indexTip:  THREE.Vector3
  middleTip: THREE.Vector3
  thumbTip:  THREE.Vector3
  ringTip:   THREE.Vector3
  pinkyTip:  THREE.Vector3
  fist:      boolean
  pinching:  boolean
  hasData:   boolean
  prevWrist: THREE.Vector3
  velocity:  number  // m/s
}

const mkHand = (): HandData => ({
  wrist:     new THREE.Vector3(),
  indexTip:  new THREE.Vector3(),
  middleTip: new THREE.Vector3(),
  thumbTip:  new THREE.Vector3(),
  ringTip:   new THREE.Vector3(),
  pinkyTip:  new THREE.Vector3(),
  fist:      false,
  pinching:  false,
  hasData:   false,
  prevWrist: new THREE.Vector3(),
  velocity:  0,
})

// ─── Componente ───────────────────────────────────────────────────────────────

export function InteractionTest() {

  const lh = useRef<HandData>(mkHand())
  const rh = useRef<HandData>(mkHand())

  // refs dos meshes dos joints (mão esquerda: azul, direita: vermelho)
  const lWristM   = useRef<THREE.Mesh>(null)
  const lIndexM   = useRef<THREE.Mesh>(null)
  const lMiddleM  = useRef<THREE.Mesh>(null)
  const lThumbM   = useRef<THREE.Mesh>(null)

  const rWristM   = useRef<THREE.Mesh>(null)
  const rIndexM   = useRef<THREE.Mesh>(null)
  const rMiddleM  = useRef<THREE.Mesh>(null)
  const rThumbM   = useRef<THREE.Mesh>(null)

  // Indicadores de estado
  const lFistBox  = useRef<THREE.Mesh>(null)
  const rFistBox  = useRef<THREE.Mesh>(null)
  const lPinchBox = useRef<THREE.Mesh>(null)
  const rPinchBox = useRef<THREE.Mesh>(null)
  const clapBox   = useRef<THREE.Mesh>(null)
  const lWaveBox  = useRef<THREE.Mesh>(null)
  const rWaveBox  = useRef<THREE.Mesh>(null)

  // Touch targets
  const touchMeshes = useRef<(THREE.Mesh | null)[]>(new Array(TOUCH_TARGETS.length).fill(null))

  const setColor = (mesh: THREE.Mesh | null, hex: number, emissive = hex, intensity = 1) => {
    if (!mesh) return
    const m = mesh.material as THREE.MeshStandardMaterial
    m.color.setHex(hex)
    m.emissive.setHex(emissive)
    m.emissiveIntensity = intensity
  }

  useFrame(({ gl }, delta, xrFrame) => {

    // ── 1. Lê joints ─────────────────────────────────────────────────────────
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

          readPos('wrist',              hand.wrist)
          readPos('index-finger-tip',   hand.indexTip)
          readPos('middle-finger-tip',  hand.middleTip)
          readPos('thumb-tip',          hand.thumbTip)
          readPos('ring-finger-tip',    hand.ringTip)
          readPos('pinky-finger-tip',   hand.pinkyTip)

          // Velocidade do pulso
          hand.velocity = hand.wrist.distanceTo(hand.prevWrist) / Math.max(delta, 0.001)

          // Fist (histerese)
          const iDist = hand.indexTip.distanceTo(hand.wrist)
          if (!hand.fist && iDist < FIST_CLOSE) hand.fist = true
          if ( hand.fist && iDist > FIST_OPEN)  hand.fist = false

          // Pinch
          hand.pinching = hand.indexTip.distanceTo(hand.thumbTip) < PINCH_DIST
        }
      }
    }

    // ── 2. Atualiza marcadores de joint ───────────────────────────────────────
    const posOrHide = (mesh: THREE.Mesh | null, hand: HandData, pos: THREE.Vector3) => {
      if (!mesh) return
      mesh.visible = hand.hasData
      if (hand.hasData) mesh.position.copy(pos)
    }

    posOrHide(lWristM.current,  lh.current, lh.current.wrist)
    posOrHide(lIndexM.current,  lh.current, lh.current.indexTip)
    posOrHide(lMiddleM.current, lh.current, lh.current.middleTip)
    posOrHide(lThumbM.current,  lh.current, lh.current.thumbTip)

    posOrHide(rWristM.current,  rh.current, rh.current.wrist)
    posOrHide(rIndexM.current,  rh.current, rh.current.indexTip)
    posOrHide(rMiddleM.current, rh.current, rh.current.middleTip)
    posOrHide(rThumbM.current,  rh.current, rh.current.thumbTip)

    // ── 3. Fist ───────────────────────────────────────────────────────────────
    setColor(lFistBox.current,
      lh.current.fist ? 0x00ff44 : 0x223322,
      lh.current.fist ? 0x00ff44 : 0x001100,
      lh.current.fist ? 3 : 0.2
    )
    setColor(rFistBox.current,
      rh.current.fist ? 0x00ff44 : 0x223322,
      rh.current.fist ? 0x00ff44 : 0x001100,
      rh.current.fist ? 3 : 0.2
    )

    // ── 4. Pinch ──────────────────────────────────────────────────────────────
    setColor(lPinchBox.current,
      lh.current.pinching ? 0xffee00 : 0x333300,
      lh.current.pinching ? 0xffee00 : 0x111100,
      lh.current.pinching ? 4 : 0.2
    )
    setColor(rPinchBox.current,
      rh.current.pinching ? 0xffee00 : 0x333300,
      rh.current.pinching ? 0xffee00 : 0x111100,
      rh.current.pinching ? 4 : 0.2
    )

    // ── 5. Aplauso (clap) ─────────────────────────────────────────────────────
    const clapping = lh.current.hasData && rh.current.hasData &&
      lh.current.wrist.distanceTo(rh.current.wrist) < CLAP_DIST
    setColor(clapBox.current,
      clapping ? 0xff6600 : 0x331500,
      clapping ? 0xff6600 : 0x110500,
      clapping ? 4 : 0.2
    )

    // ── 6. Wave (velocidade) ──────────────────────────────────────────────────
    const lWaving = lh.current.hasData && lh.current.velocity > 1.2
    const rWaving = rh.current.hasData && rh.current.velocity > 1.2

    setColor(lWaveBox.current,
      lWaving ? 0xff44ff : 0x220022,
      lWaving ? 0xff44ff : 0x110011,
      lWaving ? 4 : 0.2
    )
    setColor(rWaveBox.current,
      rWaving ? 0xff44ff : 0x220022,
      rWaving ? 0xff44ff : 0x110011,
      rWaving ? 4 : 0.2
    )

    // ── 7. Touch targets ──────────────────────────────────────────────────────
    const tips = [
      lh.current.hasData ? lh.current.indexTip  : null,
      lh.current.hasData ? lh.current.thumbTip   : null,
      rh.current.hasData ? rh.current.indexTip   : null,
      rh.current.hasData ? rh.current.thumbTip   : null,
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
      mesh.scale.setScalar(touched ? 1.4 : 1.0)
    }
  })

  return (
    <>
      {/* ── Painel de fundo ── */}
      <mesh position={[0, 1.5, -1.1]}>
        <planeGeometry args={[2.2, 1.1]} />
        <meshBasicMaterial color="#080818" transparent opacity={0.85} />
      </mesh>

      {/* ── Labels visuais (caixinhas coloridas em linha) ── */}
      {/* Fundo das linhas de label */}
      <mesh position={[0, 1.95, -1.05]}>
        <planeGeometry args={[2.0, 0.06]} />
        <meshBasicMaterial color="#1a1a3a" />
      </mesh>

      {/* ── Indicadores de estado — linha superior ── */}

      {/* FIST Esquerda */}
      <mesh ref={lFistBox} position={[-0.80, 1.80, -1.0]}>
        <boxGeometry args={[0.28, 0.18, 0.02]} />
        <meshStandardMaterial color="#223322" emissive="#001100" emissiveIntensity={0.2} />
      </mesh>
      {/* Label FIST L */}
      <mesh position={[-0.80, 1.80, -0.99]}>
        <planeGeometry args={[0.26, 0.04]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.08} />
      </mesh>

      {/* FIST Direita */}
      <mesh ref={rFistBox} position={[-0.45, 1.80, -1.0]}>
        <boxGeometry args={[0.28, 0.18, 0.02]} />
        <meshStandardMaterial color="#223322" emissive="#001100" emissiveIntensity={0.2} />
      </mesh>

      {/* PINCH Esquerda */}
      <mesh ref={lPinchBox} position={[-0.10, 1.80, -1.0]}>
        <boxGeometry args={[0.28, 0.18, 0.02]} />
        <meshStandardMaterial color="#333300" emissive="#111100" emissiveIntensity={0.2} />
      </mesh>

      {/* PINCH Direita */}
      <mesh ref={rPinchBox} position={[0.25, 1.80, -1.0]}>
        <boxGeometry args={[0.28, 0.18, 0.02]} />
        <meshStandardMaterial color="#333300" emissive="#111100" emissiveIntensity={0.2} />
      </mesh>

      {/* CLAP */}
      <mesh ref={clapBox} position={[0.60, 1.80, -1.0]}>
        <boxGeometry args={[0.28, 0.18, 0.02]} />
        <meshStandardMaterial color="#331500" emissive="#110500" emissiveIntensity={0.2} />
      </mesh>

      {/* WAVE Esquerda */}
      <mesh ref={lWaveBox} position={[-0.80, 1.57, -1.0]}>
        <boxGeometry args={[0.28, 0.14, 0.02]} />
        <meshStandardMaterial color="#220022" emissive="#110011" emissiveIntensity={0.2} />
      </mesh>

      {/* WAVE Direita */}
      <mesh ref={rWaveBox} position={[-0.45, 1.57, -1.0]}>
        <boxGeometry args={[0.28, 0.14, 0.02]} />
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

      {/* Linha indicando onde tocar */}
      <mesh position={[0, 1.30, -0.80]}>
        <planeGeometry args={[1.0, 0.003]} />
        <meshBasicMaterial color="#4488ff" transparent opacity={0.4} />
      </mesh>

      {/* ── Marcadores de joint — mão ESQUERDA (azul) ── */}
      {/* Pulso */}
      <mesh ref={lWristM} visible={false}>
        <sphereGeometry args={[0.018, 8, 8]} />
        <meshStandardMaterial color="#2255ff" emissive="#2255ff" emissiveIntensity={3} />
      </mesh>
      {/* Index */}
      <mesh ref={lIndexM} visible={false}>
        <sphereGeometry args={[0.010, 8, 8]} />
        <meshStandardMaterial color="#44aaff" emissive="#44aaff" emissiveIntensity={4} />
      </mesh>
      {/* Middle */}
      <mesh ref={lMiddleM} visible={false}>
        <sphereGeometry args={[0.010, 8, 8]} />
        <meshStandardMaterial color="#22ddff" emissive="#22ddff" emissiveIntensity={4} />
      </mesh>
      {/* Thumb */}
      <mesh ref={lThumbM} visible={false}>
        <sphereGeometry args={[0.010, 8, 8]} />
        <meshStandardMaterial color="#88ccff" emissive="#88ccff" emissiveIntensity={4} />
      </mesh>

      {/* ── Marcadores de joint — mão DIREITA (laranja/vermelho) ── */}
      <mesh ref={rWristM} visible={false}>
        <sphereGeometry args={[0.018, 8, 8]} />
        <meshStandardMaterial color="#ff4422" emissive="#ff4422" emissiveIntensity={3} />
      </mesh>
      <mesh ref={rIndexM} visible={false}>
        <sphereGeometry args={[0.010, 8, 8]} />
        <meshStandardMaterial color="#ff8844" emissive="#ff8844" emissiveIntensity={4} />
      </mesh>
      <mesh ref={rMiddleM} visible={false}>
        <sphereGeometry args={[0.010, 8, 8]} />
        <meshStandardMaterial color="#ffaa22" emissive="#ffaa22" emissiveIntensity={4} />
      </mesh>
      <mesh ref={rThumbM} visible={false}>
        <sphereGeometry args={[0.010, 8, 8]} />
        <meshStandardMaterial color="#ffcc88" emissive="#ffcc88" emissiveIntensity={4} />
      </mesh>

      {/* ── Guia de referência ── */}
      {/* Chão de referência (pequeno) */}
      <mesh position={[0, 0.001, -0.8]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1.2, 0.6]} />
        <meshBasicMaterial color="#1a2a1a" transparent opacity={0.5} />
      </mesh>
    </>
  )
}
