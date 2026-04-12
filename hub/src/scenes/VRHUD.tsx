'use client'

/**
 * VRHUD — painel world-space sempre à frente do usuário.
 *
 * Locomoção (mão esquerda):
 *   Feche a mão (punho) → captura posição como centro do joystick.
 *   Com o punho fechado, mova a mão:
 *     - para frente  → anda para frente
 *     - para trás    → anda para trás
 *     - para o lado  → anda para o lado
 *   Abra a mão → para de andar.
 *
 * Botões (mão direita):
 *   Belisca (polegar + indicador) apontando para um botão → ativa.
 */

import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

// ─── Parâmetros ───────────────────────────────────────────────────────────────

const HUD_DIST   = 0.70   // metros à frente
const HUD_DY     = -0.18  // abaixo dos olhos
const MOVE_SPEED = 2.5    // m/s
const JOY_SCALE  = 5.0    // sensibilidade (1 m de deslocamento = 5 = máx)
const JOY_DEAD   = 0.04   // dead zone em metros

// Detecção de punho fechado:
// Quando o indicador está recolhido, a ponta fica perto do pulso.
// < FIST_CLOSE → fechado | > FIST_OPEN → aberto (histerese evita flicker)
const FIST_CLOSE = 0.090  // metros
const FIST_OPEN  = 0.120  // metros

const PINCH_DIST = 0.035  // beliscão (mão direita)

const BTN = [
  { y:  0.075, baseColor: 0x5a3f9a, hotColor: 0xaa88ff },
  { y:  0.000, baseColor: 0x1e5a5a, hotColor: 0x44dddd },
  { y: -0.075, baseColor: 0x6a2a3a, hotColor: 0xff5588 },
]

// ─── Scratch ─────────────────────────────────────────────────────────────────

const _hudTarget = new THREE.Vector3()
const _hudEuler  = new THREE.Euler()
const _flatQuat  = new THREE.Quaternion()
const _offset    = new THREE.Vector3()
const _delta     = new THREE.Vector3()
const _camRight  = new THREE.Vector3()
const _camFwd    = new THREE.Vector3()
const _moveDir   = new THREE.Vector3()
const _localPt   = new THREE.Vector3()
const _invMat    = new THREE.Matrix4()

// ─── Estado de uma mão ────────────────────────────────────────────────────────

interface Hand {
  indexTip:     THREE.Vector3
  thumbTip:     THREE.Vector3
  wrist:        THREE.Vector3
  fist:         boolean   // mão fechada?
  prevFist:     boolean
  fistOrigin:   THREE.Vector3 | null  // posição do punho quando fechou
  pinching:     boolean
  prevPinching: boolean
}

const mkHand = (): Hand => ({
  indexTip:     new THREE.Vector3(),
  thumbTip:     new THREE.Vector3(),
  wrist:        new THREE.Vector3(),
  fist:         false,
  prevFist:     false,
  fistOrigin:   null,
  pinching:     false,
  prevPinching: false,
})

// ─── Componente ───────────────────────────────────────────────────────────────

export interface VRHUDCallbacks {
  onButton?: (index: number) => void
}

export function VRHUD({ onButton }: VRHUDCallbacks) {
  const hudRef  = useRef<THREE.Group>(null)
  const knobRef = useRef<THREE.Mesh>(null)
  const baseRef = useRef<THREE.Mesh>(null)  // muda de cor quando fechado
  const btnRefs = useRef<(THREE.Mesh | null)[]>([])

  const lh  = useRef<Hand>(mkHand())
  const rh  = useRef<Hand>(mkHand())
  const joy = useRef(new THREE.Vector2())

  useFrame(({ camera: cam, gl }, delta, xrFrame) => {

    // ── 1. HUD segue câmera (só yaw) ─────────────────────────────────────────
    if (hudRef.current) {
      _hudEuler.setFromQuaternion(cam.quaternion, 'YXZ')
      _hudEuler.x = 0
      _hudEuler.z = 0
      _flatQuat.setFromEuler(_hudEuler)

      _offset.set(0, HUD_DY, -HUD_DIST).applyQuaternion(cam.quaternion)
      _hudTarget.copy(cam.position).add(_offset)

      hudRef.current.position.lerp(_hudTarget, 0.07)
      hudRef.current.quaternion.slerp(_flatQuat, 0.07)
    }

    // ── 2. Lê articulações das mãos ──────────────────────────────────────────
    if (xrFrame) {
      const refSpace = gl.xr.getReferenceSpace()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const frame = xrFrame as any

      if (refSpace) {
        for (const src of frame.session.inputSources as any[]) {
          if (!src.hand) continue
          const hand = src.handedness === 'left' ? lh.current : rh.current
          hand.prevFist     = hand.fist
          hand.prevPinching = hand.pinching

          const read = (name: string, out: THREE.Vector3) => {
            const joint = src.hand.get(name)
            if (!joint) return
            const pose = frame.getJointPose(joint, refSpace)
            if (pose) out.set(
              pose.transform.position.x,
              pose.transform.position.y,
              pose.transform.position.z,
            )
          }

          read('index-finger-tip', hand.indexTip)
          read('thumb-tip',        hand.thumbTip)
          read('wrist',            hand.wrist)

          // ── Detecção de punho (histerese) ──
          const tipToWrist = hand.indexTip.distanceTo(hand.wrist)
          if (!hand.fist && tipToWrist < FIST_CLOSE) {
            hand.fist = true
          } else if (hand.fist && tipToWrist > FIST_OPEN) {
            hand.fist = false
          }

          // ── Captura centro no momento em que fecha o punho ──
          if (hand.fist && !hand.prevFist) {
            hand.fistOrigin = hand.wrist.clone()
          }
          if (!hand.fist) {
            hand.fistOrigin = null
          }

          // Beliscão (mão direita)
          hand.pinching = hand.indexTip.distanceTo(hand.thumbTip) < PINCH_DIST
        }
      }
    }

    // ── 3. Joystick — punho esquerdo fechado + mover ──────────────────────────
    const leftHand = lh.current
    const hasFist  = leftHand.fist && leftHand.fistOrigin !== null

    if (hasFist) {
      // Delta do pulso em relação ao centro capturado
      _delta.copy(leftHand.wrist).sub(leftHand.fistOrigin!)

      // Eixos horizontais da câmera (ignora pitch)
      _hudEuler.setFromQuaternion(cam.quaternion, 'YXZ')
      _hudEuler.x = 0
      _hudEuler.z = 0
      _flatQuat.setFromEuler(_hudEuler)
      _camRight.set(1, 0, 0).applyQuaternion(_flatQuat)
      _camFwd.set(0, 0, -1).applyQuaternion(_flatQuat)

      let jx = _delta.dot(_camRight) * JOY_SCALE
      let jy = _delta.dot(_camFwd)   * JOY_SCALE

      // Dead zone
      if (Math.abs(jx) < JOY_DEAD * JOY_SCALE) jx = 0
      if (Math.abs(jy) < JOY_DEAD * JOY_SCALE) jy = 0

      joy.current.set(jx, jy).clampLength(0, 1)
    } else {
      joy.current.set(0, 0)
    }

    // Visual do knob + cor da base
    if (knobRef.current) {
      knobRef.current.position.x = joy.current.x * 0.060
      knobRef.current.position.y = joy.current.y * 0.060
    }
    if (baseRef.current) {
      const mat = baseRef.current.material as THREE.MeshBasicMaterial
      mat.color.setHex(hasFist ? 0x2a1a5a : 0x131328)
    }

    // ── 4. Locomoção ─────────────────────────────────────────────────────────
    const jLen = joy.current.length()
    if (jLen > 0.01) {
      _hudEuler.setFromQuaternion(cam.quaternion, 'YXZ')
      _hudEuler.x = 0
      _hudEuler.z = 0
      _flatQuat.setFromEuler(_hudEuler)

      _moveDir
        .set(joy.current.x, 0, -joy.current.y)
        .applyQuaternion(_flatQuat)
        .normalize()
        .multiplyScalar(MOVE_SPEED * delta * jLen)

      // Em XR mover o rig (pai da câmera), não a câmera diretamente
      const rig = cam.parent
      if (rig && rig.isObject3D && rig.type !== 'Scene') {
        rig.position.add(_moveDir)
      } else {
        cam.position.add(_moveDir)
      }
    }

    // ── 5. Botões — mão direita ───────────────────────────────────────────────
    if (!hudRef.current) return

    _invMat.copy(hudRef.current.matrixWorld).invert()
    _localPt.copy(rh.current.indexTip).applyMatrix4(_invMat)

    for (let i = 0; i < BTN.length; i++) {
      const mesh = btnRefs.current[i]
      if (!mesh) continue
      const mat = mesh.material as THREE.MeshBasicMaterial
      const btn = BTN[i]!

      const inZone =
        _localPt.x > 0.13 && _localPt.x < 0.31 &&
        Math.abs(_localPt.y - btn.y) < 0.032 &&
        Math.abs(_localPt.z) < 0.15

      mat.color.setHex(inZone ? btn.hotColor : btn.baseColor)

      if (inZone && rh.current.pinching && !rh.current.prevPinching) {
        onButton?.(i)
      }
    }
  })

  return (
    <group ref={hudRef}>

      {/* Fundo */}
      <mesh position={[0, 0, -0.002]}>
        <planeGeometry args={[0.76, 0.32]} />
        <meshBasicMaterial color="#1a1030" transparent opacity={0.35} />
      </mesh>
      <mesh>
        <planeGeometry args={[0.73, 0.29]} />
        <meshBasicMaterial color="#07070f" transparent opacity={0.82} />
      </mesh>

      {/* ── ESQUERDA: Joystick ── */}
      <mesh ref={baseRef} position={[-0.245, 0, 0.001]}>
        <circleGeometry args={[0.072, 48]} />
        <meshBasicMaterial color="#131328" />
      </mesh>
      <mesh position={[-0.245, 0, 0.0012]}>
        <ringGeometry args={[0.062, 0.072, 48]} />
        <meshBasicMaterial color="#5a4aaa" />
      </mesh>
      <Cone p={[-0.245,  0.090, 0.002]} r={0} />
      <Cone p={[-0.245, -0.090, 0.002]} r={Math.PI} />
      <Cone p={[-0.155,  0,     0.002]} r={Math.PI / 2} />
      <Cone p={[-0.335,  0,     0.002]} r={-Math.PI / 2} />
      <mesh ref={knobRef} position={[-0.245, 0, 0.003]}>
        <circleGeometry args={[0.030, 32]} />
        <meshBasicMaterial color="#8877ee" />
      </mesh>

      {/* Divisor */}
      <mesh>
        <planeGeometry args={[0.002, 0.24]} />
        <meshBasicMaterial color="#3a2a6a" transparent opacity={0.5} />
      </mesh>

      {/* ── DIREITA: Botões ── */}
      {BTN.map((btn, i) => (
        <mesh
          key={i}
          ref={el => { btnRefs.current[i] = el }}
          position={[0.22, btn.y, 0.001]}
        >
          <planeGeometry args={[0.18, 0.056]} />
          <meshBasicMaterial color={btn.baseColor} />
        </mesh>
      ))}

      {/* Cursor central */}
      <mesh position={[0, 0, 0.012]}>
        <ringGeometry args={[0.006, 0.010, 24]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.5} />
      </mesh>
    </group>
  )
}

function Cone({ p, r }: { p: [number, number, number]; r: number }) {
  return (
    <mesh position={p} rotation={[0, 0, r]}>
      <coneGeometry args={[0.009, 0.018, 3]} />
      <meshBasicMaterial color="#6a5aaa" transparent opacity={0.7} />
    </mesh>
  )
}
