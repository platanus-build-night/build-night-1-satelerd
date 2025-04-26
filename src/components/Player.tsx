'use client';

import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { RefObject, useState, useEffect, useMemo, useRef } from 'react';
// import { PointerLockControls } from '@react-three/drei'; // No necesitamos importar aquí si usamos any

interface PlayerProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  controlsRef: RefObject<any>; // Usar any y deshabilitar linter
  groundRef: RefObject<THREE.Mesh>;
  portalRef: RefObject<THREE.Group>; // Portal ref ahora es Group
  isLocked: boolean;
  onInteract: () => void; // Añadir la función callback
  onCanInteractChange: (canInteract: boolean) => void; // Callback para notificar cambio de estado
}

const playerHeight = 5;
const movementSpeed = 30; // Velocidad de movimiento (ajustable)
const sprintFactor = 2.5; // Factor de velocidad al sprintar (Restaurado)
const normalFov = 90;    // FOV normal
const zoomedFov = 30;    // FOV con zoom más pronunciado
const raycaster = new THREE.Raycaster();
const downVector = new THREE.Vector3(0, -1, 0);
const interactDistance = 20; // Distancia máxima para interactuar con el portal
// --- Constantes para Salto ---
const jumpForce = 30;    // Impulso inicial del salto
const gravity = 70;      // Aceleración de la gravedad
// --- Fin Constantes Salto ---

export default function Player({ controlsRef, groundRef, portalRef, isLocked, onInteract, onCanInteractChange }: PlayerProps) {

  // Estado para teclas de movimiento
  const [moveState, setMoveState] = useState({
    forward: false,
    backward: false,
    left: false,
    right: false,
  });

  // Estado para indicar si se puede interactuar
  const [canInteract, setCanInteract] = useState(false);
  // Ref para estado de sprint (Shift)
  const isSprinting = useRef(false);
  // Ref para estado de zoom (tecla 'q')
  const isZooming = useRef(false);
  // --- Refs/Estado para Salto ---
  const velocityY = useRef(0);       // Velocidad vertical actual
  const isAirborne = useRef(true);   // ¿Está el jugador en el aire?
  // --- Fin Refs/Estado Salto ---

  // Notificar cambio de estado canInteract
  useEffect(() => {
      onCanInteractChange(canInteract);
  }, [canInteract, onCanInteractChange]);

  // Listeners de teclado para MOVIMIENTO (WASD, Shift), ZOOM (Q) y SALTO (Espacio)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      switch (event.key.toLowerCase()) {
        case 'w': setMoveState(s => ({ ...s, forward: true })); break;
        case 's': setMoveState(s => ({ ...s, backward: true })); break;
        case 'a': setMoveState(s => ({ ...s, left: true })); break;
        case 'd': setMoveState(s => ({ ...s, right: true })); break;
        case 'shift': isSprinting.current = true; break;
        case 'q': isZooming.current = true; break;
        case ' ': // Barra espaciadora
          if (!isAirborne.current) { // Solo saltar si está en el suelo
            velocityY.current = jumpForce;
            isAirborne.current = true;
          }
          break;
      }
    };
    const handleKeyUp = (event: KeyboardEvent) => {
      switch (event.key.toLowerCase()) {
        case 'w': setMoveState(s => ({ ...s, forward: false })); break;
        case 's': setMoveState(s => ({ ...s, backward: false })); break;
        case 'a': setMoveState(s => ({ ...s, left: false })); break;
        case 'd': setMoveState(s => ({ ...s, right: false })); break;
        case 'shift': isSprinting.current = false; break;
        case 'q': isZooming.current = false; break;
      }
    };

    if (isLocked) {
      // Añadir listeners solo si está bloqueado
      window.addEventListener('keydown', handleKeyDown);
      window.addEventListener('keyup', handleKeyUp);
    } else {
      // Quitar listeners y resetear estado si no está bloqueado
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      setMoveState({ forward: false, backward: false, left: false, right: false });
      isSprinting.current = false; // Asegurarse de resetear Sprint
      isZooming.current = false; // Asegurar resetear zoom al desbloquear
    }

    // Limpieza al desmontar o cambiar isLocked
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isLocked]);

  // Listener de teclado para INTERACCIÓN (E)
  useEffect(() => {
    const handleInteractionKey = (event: KeyboardEvent) => {
        // Verificar si estamos en modo FPS (isLocked) y si podemos interactuar
        if (isLocked && canInteract && event.key.toLowerCase() === 'e') {
            onInteract();
            controlsRef.current?.unlock();
        }
    };
    window.addEventListener('keydown', handleInteractionKey);
    return () => {
        window.removeEventListener('keydown', handleInteractionKey);
    };
  }, [isLocked, canInteract, onInteract, controlsRef]); // <- Mantener dependencias aquí

  // Vectores para cálculo (memoizados para eficiencia)
  const forwardVector = useMemo(() => new THREE.Vector3(), []);
  const rightVector = useMemo(() => new THREE.Vector3(), []);
  const moveDirection = useMemo(() => new THREE.Vector3(), []);

  useFrame((state, delta) => {
    if (isLocked && groundRef.current && controlsRef.current?.getObject && portalRef.current) {
      const camera = controlsRef.current.getObject();
      const dt = Math.min(delta, 0.1); // Clampear delta time para evitar saltos grandes

      // --- Movimiento Horizontal --- (Sin cambios)
      camera.getWorldDirection(forwardVector);
      rightVector.crossVectors(camera.up, forwardVector).normalize();

      moveDirection.set(0, 0, 0);
      if (moveState.forward) moveDirection.add(forwardVector);
      if (moveState.backward) moveDirection.sub(forwardVector);
      if (moveState.left) moveDirection.add(rightVector);
      if (moveState.right) moveDirection.sub(rightVector);

      moveDirection.y = 0;
      moveDirection.normalize();

      const currentSpeed = isSprinting.current ? movementSpeed * sprintFactor : movementSpeed;
      if (moveDirection.lengthSq() > 0) {
        camera.position.addScaledVector(moveDirection, currentSpeed * dt);
      }

      // --- Lógica de Salto y Gravedad --- 
      if (isAirborne.current) {
        velocityY.current -= gravity * dt; // Aplicar gravedad
      }
      // Aplicar velocidad vertical (incluso si es 0 o negativa)
      camera.position.y += velocityY.current * dt;

      // --- Lógica de Zoom (FOV) --- (Sin cambios)
      const targetFov = isZooming.current ? zoomedFov : normalFov;
      if (camera.fov !== targetFov) {
          camera.fov = targetFov;
          camera.updateProjectionMatrix();
      }

      // --- Grounding --- (Modificado para Salto)
      raycaster.set(camera.position, downVector);
      const groundIntersects = raycaster.intersectObject(groundRef.current);
      const isOnGround = groundIntersects.length > 0 && groundIntersects[0].distance <= playerHeight + 0.1; // Pequeño margen

      if (isOnGround) {
          const groundY = groundIntersects[0].point.y;
          // Si está en el suelo o ha caído por debajo
          if (camera.position.y <= groundY + playerHeight) {
              camera.position.y = groundY + playerHeight; // Ajustar altura exacta
              if (velocityY.current < 0) { // Solo resetear si estaba cayendo
                 velocityY.current = 0;
              }
              isAirborne.current = false; // Marcar como en el suelo
          }
      } else {
          // Si no hay suelo detectado debajo (o está muy lejos), está en el aire
          isAirborne.current = true;
      }

      // --- Interacción con Portal --- (Sin cambios)
      const pointer = new THREE.Vector2(0, 0);
      raycaster.setFromCamera(pointer, camera);
      // Intersectar con los hijos del grupo (los anillos)
      const portalIntersects = raycaster.intersectObjects(portalRef.current.children, false); // false = no recursivo (solo anillos)

      let lookingAtPortal = false;
      if (portalIntersects.length > 0) {
          // Verificar si el portal intersectado es el más cercano y está dentro del rango
          if (portalIntersects[0].distance < interactDistance) {
              lookingAtPortal = true;
          }
      }

      if (lookingAtPortal && !canInteract) {
          setCanInteract(true);
          // TODO: Cambiar apariencia del portal o mostrar tooltip
          // (portalRef.current.material as THREE.MeshStandardMaterial).color.set('lime');
      } else if (!lookingAtPortal && canInteract) {
          setCanInteract(false);
          // TODO: Restaurar apariencia del portal
          // (portalRef.current.material as THREE.MeshStandardMaterial).color.set('purple');
      }
    }
  });

  // Este componente no renderiza nada visible, solo ejecuta lógica en useFrame
  return null;
} 