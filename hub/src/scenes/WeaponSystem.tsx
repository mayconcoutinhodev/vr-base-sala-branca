'use client'

/**
 * WeaponSystem
 *
 * Pickup:   Qualquer mão perto da arma + fechar o punho → pega.
 *           Esfera azul mostra o raio. Fica verde quando a mão está dentro.
 * Segurar:  Arma segue o pulso da mão que pegou.
 * Atirar:   Dedo do meio curva (gatilho) → cubo vermelho brilhoso.
 * Soltar:   Mão abre → arma cai com gravidade.
 */

import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

// ─── Configuração ─────────────────────────────────────────────────────────────

const TABLE_POS   = new THREE.Vector3(0, 0, -1.5)
const TABLE_H     = 0.85
const WEAPON_IDLE = new THREE.Vector3(TABLE_POS.x, TABLE_H + 0.07, TABLE_POS.z)

const PICKUP_RANGE  = 0.60   // m
const DROP_COOLDOWN = 0.5    // s

// Fist — index-tip → wrist
const FIST_CLOSE = 0.115
const FIST_OPEN  = 0.155

// Trigger — middle-tip → wrist
const TRIGGER_CLOSE = 0.085
const TRIGGER_OPEN  = 0.115

const PROJ_SPEED    = 9.0
const PROJ_LIFE     = 3.0
const PROJ_GRAVITY  = -3.5
const WEAPON_GRAVITY = -9.8
const MAX_PROJ      = 24

// ─── Scratch ─────────────────────────────────────────────────────────────────

const _aimDir  = new THREE.Vector3()
const _spawnPt = new THREE.Vector3()

// ─── Tipos ───────────────────────────────────────────────────────────────────

type WeaponState = 'idle' | 'held' | 'falling'

interface HandData {
  wrist:      THREE.Vector3
  indexTip:   THREE.Vector3
  middleTip:  THREE.Vector3
  wristQ:     THREE.Quaternion
  fist:       boolean
  prevFist:   boolean
  trigger:    boolean
  prevTrigger:boolean
  hasData:    boolean
}

interface Proj {
  alive: boolean
  pos:   THREE.Vector3
  vel:   THREE.Vector3
  age:   number
}

const mkHand = (): HandData => ({
  wrist:       new THREE.Vector3(),
  indexTip:    new THREE.Vector3(),
  middleTip:   new THREE.Vector3(),
  wristQ:      new THREE.Quaternion(),
  fist:        false,
  prevFist:    false,
  trigger:     false,
  prevTrigger: false,
  hasData:     false,
})

// ─── Componente ──────────────────────────────────────────────────────────────

export function WeaponSystem() {

  const wState    = useRef<WeaponState>('idle')
  const wPos      = useRef(WEAPON_IDLE.clone())
  const wQuat     = useRef(new THREE.Quaternion())
  const wVel      = useRef(new THREE.Vector3())
  const weaponGrp = useRef<THREE.Group>(null)
  const glowMat   = useRef<THREE.MeshStandardMaterial>(null)
  const rangeMat  = useRef<THREE.MeshStandardMaterial>(null)
  const dropCool  = useRef(0)
  const canFire   = useRef(true)

  // Mão que está segurando a arma ('left' | 'right' | null)
  const gunHand = useRef<'left' | 'right' | null>(null)

  const lh = useRef<HandData>(mkHand())
  const rh = useRef<HandData>(mkHand())

  const projs = useRef<Proj[]>(
    Array.from({ length: MAX_PROJ }, () => ({
      alive: false,
      pos: new THREE.Vector3(),
      vel: new THREE.Vector3(),
      age: 0,
    }))
  )
  const projMeshes = useRef<(THREE.Mesh | null)[]>(new Array(MAX_PROJ).fill(null))

  function fire(hand: HandData) {
    const slot = projs.current.findIndex(p => !p.alive)
    if (slot < 0) return

    if (hand.hasData) {
      _aimDir.copy(hand.indexTip).sub(hand.wrist).normalize()
    } else {
      _aimDir.set(0, 0, -1).applyQuaternion(wQuat.current)
    }

    _spawnPt.copy(wPos.current).addScaledVector(_aimDir, 0.15)

    const p = projs.current[slot]!
    p.pos.copy(_spawnPt)
    p.vel.copy(_aimDir).multiplyScalar(PROJ_SPEED)
    p.age   = 0
    p.alive = true
  }

  useFrame(({ gl }, delta, xrFrame) => {

    // ── 1. Lê articulações de AMBAS as mãos ──────────────────────────────────
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
          hand.hasData    = true
          hand.prevFist   = hand.fist
          hand.prevTrigger = hand.trigger

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

          readPos('index-finger-tip',  hand.indexTip)
          readPos('middle-finger-tip', hand.middleTip)
          readPos('wrist',             hand.wrist)

          const wj = src.hand.get('wrist')
          if (wj) {
            const pose = frame.getJointPose(wj, refSpace)
            if (pose) {
              const o = pose.transform.orientation
              hand.wristQ.set(o.x, o.y, o.z, o.w)
            }
          }

          // Fist (histerese)
          const iDist = hand.indexTip.distanceTo(hand.wrist)
          if (!hand.fist && iDist < FIST_CLOSE) hand.fist = true
          if ( hand.fist && iDist > FIST_OPEN)  hand.fist = false

          // Trigger (histerese)
          const mDist = hand.middleTip.distanceTo(hand.wrist)
          if (!hand.trigger && mDist < TRIGGER_CLOSE) hand.trigger = true
          if ( hand.trigger && mDist > TRIGGER_OPEN)  hand.trigger = false
        }
      }
    }

    // ── 2. Cooldown de drop ───────────────────────────────────────────────────
    if (dropCool.current > 0) dropCool.current -= delta

    // ── 3. Estado da arma ─────────────────────────────────────────────────────

    if (wState.current === 'idle') {

      // Verifica AMBAS as mãos para pickup
      let inRange = false
      let pickingHand: 'left' | 'right' | null = null

      const checkHand = (hand: HandData, side: 'left' | 'right') => {
        if (!hand.hasData) return
        const dist = hand.wrist.distanceTo(wPos.current)
        if (dist < PICKUP_RANGE && dropCool.current <= 0) {
          inRange = true
          // Pega ao fechar o punho (qualquer momento — fist ativo)
          if (hand.fist) pickingHand = side
        }
      }

      checkHand(lh.current, 'left')
      checkHand(rh.current, 'right')

      // Feedback visual
      if (rangeMat.current) {
        rangeMat.current.color.setHex(inRange ? 0x44ff44 : 0x4488ff)
        rangeMat.current.emissive.setHex(inRange ? 0x44ff44 : 0x4488ff)
        rangeMat.current.opacity = inRange ? 0.30 : 0.10
      }
      if (glowMat.current) {
        glowMat.current.color.setHex(inRange ? 0x44ff44 : 0x4488ff)
        glowMat.current.emissive.setHex(inRange ? 0x44ff44 : 0x4488ff)
        glowMat.current.emissiveIntensity = inRange ? 6 : 3
      }

      if (pickingHand) {
        wState.current = 'held'
        gunHand.current = pickingHand
        canFire.current = true
      }
    }

    else if (wState.current === 'held') {
      const hand = gunHand.current === 'left' ? lh.current : rh.current

      // Solta quando abre a mão
      if (hand.hasData && !hand.fist) {
        wState.current = 'falling'
        wVel.current.set(0, 0.3, 0)
        dropCool.current = DROP_COOLDOWN
        gunHand.current = null
      } else {
        // Segue o pulso
        if (hand.hasData) {
          wPos.current.copy(hand.wrist)
          wQuat.current.copy(hand.wristQ)
        }

        // Dispara ao puxar o gatilho
        if (hand.hasData && hand.trigger && !hand.prevTrigger && canFire.current) {
          fire(hand)
          canFire.current = false
        }
        if (!hand.trigger) canFire.current = true
      }

      if (rangeMat.current) rangeMat.current.opacity = 0
      if (glowMat.current) {
        glowMat.current.color.setHex(0x4488ff)
        glowMat.current.emissive.setHex(0x4488ff)
        glowMat.current.emissiveIntensity = 3
      }
    }

    else if (wState.current === 'falling') {
      wVel.current.y += WEAPON_GRAVITY * delta
      wPos.current.addScaledVector(wVel.current, delta)

      if (wPos.current.y < 0.05) {
        wPos.current.y = 0.05
        wVel.current.set(0, 0, 0)
        wState.current = 'idle'
      }
    }

    if (weaponGrp.current) {
      weaponGrp.current.position.copy(wPos.current)
      weaponGrp.current.quaternion.copy(wQuat.current)
    }

    // ── 4. Projéteis ─────────────────────────────────────────────────────────
    for (let i = 0; i < MAX_PROJ; i++) {
      const p    = projs.current[i]!
      const mesh = projMeshes.current[i]

      if (!p.alive) { if (mesh) mesh.visible = false; continue }

      p.age += delta
      p.vel.y += PROJ_GRAVITY * delta
      p.pos.addScaledVector(p.vel, delta)

      if (p.pos.y < 0.02 || p.age > PROJ_LIFE) {
        p.alive = false
        if (mesh) mesh.visible = false
        continue
      }

      if (mesh) {
        mesh.visible = true
        mesh.position.copy(p.pos)
        mesh.rotation.x += delta * 5
        mesh.rotation.y += delta * 3
      }
    }
  })

  return (
    <>
      {/* ── Mesa ── */}
      <group position={TABLE_POS.toArray() as [number,number,number]}>
        <mesh position={[0, TABLE_H, 0]} castShadow receiveShadow>
          <boxGeometry args={[1.2, 0.06, 0.65]} />
          <meshStandardMaterial color="#6b3d1e" roughness={0.85} />
        </mesh>
        <mesh position={[0, TABLE_H - 0.02, 0]}>
          <boxGeometry args={[1.24, 0.025, 0.68]} />
          <meshStandardMaterial color="#4a2a10" roughness={0.9} />
        </mesh>
        {([[-0.52,-0.28],[0.52,-0.28],[-0.52,0.28],[0.52,0.28]] as [number,number][]).map(([x,z],i) => (
          <mesh key={i} position={[x, TABLE_H / 2, z]} castShadow>
            <boxGeometry args={[0.06, TABLE_H, 0.06]} />
            <meshStandardMaterial color="#4a2a10" roughness={0.9} />
          </mesh>
        ))}
        <pointLight position={[0, TABLE_H + 0.7, 0]} color="#ffcc88" intensity={1.2} distance={3} />
      </group>

      {/* ── Arma + esfera de alcance ── */}
      <group ref={weaponGrp}>
        {/* Esfera indicadora de pickup */}
        <mesh>
          <sphereGeometry args={[PICKUP_RANGE, 16, 12]} />
          <meshStandardMaterial
            ref={rangeMat}
            color="#4488ff"
            emissive="#4488ff"
            emissiveIntensity={0.4}
            transparent
            opacity={0.10}
            depthWrite={false}
            side={2}
          />
        </mesh>

        {/* Cano */}
        <mesh position={[0, 0.005, -0.09]} castShadow>
          <boxGeometry args={[0.025, 0.025, 0.18]} />
          <meshStandardMaterial color="#1a1a1a" roughness={0.2} metalness={0.9} />
        </mesh>
        {/* Corpo */}
        <mesh position={[0, 0, 0.01]} castShadow>
          <boxGeometry args={[0.04, 0.035, 0.07]} />
          <meshStandardMaterial color="#222" roughness={0.3} metalness={0.8} />
        </mesh>
        {/* Cabo */}
        <mesh position={[0, -0.055, 0.025]} castShadow>
          <boxGeometry args={[0.038, 0.09, 0.045]} />
          <meshStandardMaterial color="#111" roughness={0.6} metalness={0.5} />
        </mesh>
        {/* Gatilho dourado */}
        <mesh position={[0, -0.018, 0.015]}>
          <boxGeometry args={[0.006, 0.022, 0.015]} />
          <meshStandardMaterial color="#c8a020" roughness={0.3} metalness={1} />
        </mesh>
        {/* Glow do cano */}
        <mesh position={[0, 0.005, -0.185]}>
          <boxGeometry args={[0.012, 0.012, 0.012]} />
          <meshStandardMaterial
            ref={glowMat}
            color="#4488ff"
            emissive="#4488ff"
            emissiveIntensity={3}
            transparent
            opacity={0.9}
          />
        </mesh>
      </group>

      {/* ── Projéteis ── */}
      {Array.from({ length: MAX_PROJ }, (_, i) => (
        <mesh key={i} ref={el => { projMeshes.current[i] = el }} visible={false}>
          <boxGeometry args={[0.06, 0.06, 0.06]} />
          <meshStandardMaterial
            color="#ff1111"
            emissive="#ff0000"
            emissiveIntensity={2.5}
            roughness={0.1}
            metalness={0.4}
          />
        </mesh>
      ))}
    </>
  )
}
