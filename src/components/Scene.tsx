'use client'; // Este componente *sí* necesita ejecutarse en el cliente

import * as THREE from 'three'; // Importar THREE completo
import { Canvas, useThree } from '@react-three/fiber'; // Importar Canvas y useThree
import { PointerLockControls, Html } from '@react-three/drei'; // Importar el componente para usar typeof
import { useRef, useState, useEffect, useMemo } from 'react'; // Necesitamos useEffect y useMemo
import Stars from './Stars'; // Importar el nuevo componente
import WavyGround from './WavyGround'; // Importar suelo ondulado
import Player from './Player'; // Importar el nuevo componente Player
import Mountains from './Mountains'; // Importar Montañas
import Portal from './Portal'; // Importar el Portal
import MobilePlayer from './MobilePlayer'; // Importar el nuevo componente MobilePlayer
import { EffectComposer, Bloom } from '@react-three/postprocessing'; // <-- IMPORTAR EFECTOS
import SphericalGrid from './SphericalGrid'; // <-- IMPORTAR GRID ESFÉRICO OTRA VEZ
import YearLabels from './YearLabels'; // <-- IMPORTAR ETIQUETAS DE AÑO

// Definir interfaces (asegurar que Contribution incluye 'year')
interface Contribution {
  date: string;
  count: number;
  weekday: number;
  year: number; // <-- Asegurarse de que está aquí
}

// Tipos para los datos del Joystick (importados o definidos en page.tsx)
interface JoystickData {
    x: number | null; 
    y: number | null; 
    direction: string | null; 
    distance: number | null;
}

// Definir las props que acepta el componente
interface SceneProps {
  contributions: Contribution[];
  onInteract: () => void; // Callback para iniciar interacción
  onCanInteractChange: (canInteract: boolean) => void; // Callback para estado de interacción
  moveJoystick: JoystickData; // Añadir prop
  lookJoystick: JoystickData; // Añadir prop
  onStarHover: (data: TooltipData | null) => void; // <-- Mantener esta prop para actualizar el HUD
}

// Interfaz para los datos del tooltip (puede ir en otro sitio)
interface TooltipData {
    date: string;
    count: number;
    year?: number; // <-- Añadir año (opcional por si acaso)
}

// Componente interno para manejar la lógica dependiente del contexto de R3F
function SceneContent({ 
    contributions, 
    onInteract, 
    onCanInteractChange, 
    moveJoystick, 
    lookJoystick, 
    onStarHover // <-- Recibir prop para actualizar HUD
}: SceneProps) {
  const { gl, camera } = useThree(); // <-- Obtener solo gl y camera aquí
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const controlsRef = useRef<any>(null); // <-- Volver a any para simplificar
  const groundRef = useRef<THREE.Mesh>(null!);
  const portalRef = useRef<THREE.Group>(null!);
  const invisibleArcSurfaceRef = useRef<THREE.Mesh>(null!); // <-- Ref para la superficie invisible
  const [isLocked, setIsLocked] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const starRadius = 200; 

  // Re-calcular segmentos de año para el mapeo inverso del tooltip
  const yearSegments = useMemo(() => {
      if (!contributions || contributions.length === 0) return [];
      const segments: { year: number; startIndex: number; count: number }[] = [];
      let currentYear = 0;
      let startIndex = 0;
      contributions.forEach((contrib, index) => {
          if (contrib.year !== currentYear) {
              if (currentYear !== 0) {
                  segments.push({ year: currentYear, startIndex, count: index - startIndex });
              }
              currentYear = contrib.year;
              startIndex = index;
          }
      });
      if (currentYear !== 0) {
          segments.push({ year: currentYear, startIndex, count: contributions.length - startIndex });
      }
      segments.sort((a, b) => a.year - b.year);
      return segments;
  }, [contributions]);

  // --- Lógica de Tooltip por Celda --- 
  const lastHoveredIndex = useRef<number | null>(null);

  const handlePointerMoveOnArc = (event: THREE.Intersection) => {
      // Necesitamos yearSegments calculados
      if (!event || !contributions || contributions.length === 0 || !yearSegments || yearSegments.length === 0) return;

      const point = event.point;

      // Replicar constantes de Stars.tsx
      const arcBaseHeight = 5;
      const daySpread = 60;
      const arcSpacing = daySpread * 7 * 1.2; // Mismo cálculo que en Stars/Grid
      const numberOfArcs = yearSegments.length;

      // --- Mapeo Inverso --- 
      // 1. Calcular a qué arco (año) corresponde el punto X
      const approxArcIndex = Math.round((point.x / arcSpacing) + Math.floor(numberOfArcs / 2));
      const targetArcIndex = Math.max(0, Math.min(numberOfArcs - 1, approxArcIndex));
      const segment = yearSegments[targetArcIndex];
      if (!segment) return; // Seguridad

      // 2. Calcular Y, Z -> angle -> relative_t (0 a 1 dentro del año)
      // atan2(z, y - arcBaseHeight) = angle = (t - 0.5) * PI
      const angle = Math.atan2(point.z, point.y - arcBaseHeight);
      const relative_t = (angle / Math.PI) + 0.5;

      // 3. Calcular índice del día DENTRO del año
      const approxDayIndexInYear = relative_t * (segment.count - 1);

      // 4. Calcular índice GLOBAL en el array contributions
      const dayIndexWithinYear = Math.max(0, Math.min(segment.count - 1, Math.round(approxDayIndexInYear)));
      const globalDayIndex = segment.startIndex + dayIndexWithinYear;

      // --- Evitar actualizaciones innecesarias --- 
      if (globalDayIndex === lastHoveredIndex.current) return;
      lastHoveredIndex.current = globalDayIndex;

      // --- Buscar Contribución y Actualizar HUD --- 
      const contribution = contributions[globalDayIndex];
      if (contribution) {
          onStarHover({ date: contribution.date, count: contribution.count, year: contribution.year });
      } else {
          // console.log(`Contribution NOT found for global index: ${globalDayIndex}`); // Comentado
          onStarHover(null); // No debería pasar si los índices están bien
      }
  };

  const handlePointerOutOfArc = () => {
      if (lastHoveredIndex.current !== null) {
         lastHoveredIndex.current = null;
         onStarHover(null);
      }
  };

  // Detección simple de móvil (podría mejorarse)
  useEffect(() => {
      const checkMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      console.log("Is Mobile?", checkMobile);
      setIsMobile(checkMobile);
      // Forzar OrbitControls si PointerLock no está disponible (mejor que userAgent)
      // const isPointerLockAvailable = 'pointerLockElement' in document || 'mozPointerLockElement' in document || 'webkitPointerLockElement' in document;
      // setIsMobile(!isPointerLockAvailable);
  }, []);

  useEffect(() => {
      const canvasElement = gl.domElement;
      if (!isMobile || !canvasElement) return;

      const onCanvasPointerDown = (event: PointerEvent) => {
          if (!portalRef.current) return;

          const pointer = new THREE.Vector2();
          pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
          pointer.y = - (event.clientY / window.innerHeight) * 2 + 1;

          const raycaster = new THREE.Raycaster();
          raycaster.setFromCamera(pointer, camera);
          const intersects = raycaster.intersectObject(portalRef.current);

          if (intersects.length > 0 && intersects[0].distance < interactDistance * 1.5) {
              console.log("INTERACTION TRIGGERED (Tap)");
              onInteract();
          }
      };

      canvasElement.addEventListener('pointerdown', onCanvasPointerDown);
      return () => {
          canvasElement.removeEventListener('pointerdown', onCanvasPointerDown);
      };

  }, [isMobile, gl.domElement, camera, portalRef, onInteract]); // Añadir dependencias

  return (
    <>
      {/* Superficie invisible para raycasting del tooltip */}
      <mesh 
         ref={invisibleArcSurfaceRef} 
         visible={false} // Invisible
         onPointerMove={(e) => {
             // Detener propagación para no interferir con otras interacciones si es necesario
             // e.stopPropagation(); 
             // Pasar solo la primera intersección al handler
             if(e.intersections.length > 0) handlePointerMoveOnArc(e.intersections[0]);
         }}
         onPointerOut={handlePointerOutOfArc}
      >
          {/* Usar una esfera grande como aproximación del arco */}
          {/* Ajustar el radio si es necesario para que coincida mejor */}
          <sphereGeometry args={[starRadius * 1.2, 32, 32]} />{/* Radio ligeramente mayor? */}
          <meshBasicMaterial side={THREE.DoubleSide} />
      </mesh>

      {/* Envolver contenido 3D con EffectComposer */} 
      <EffectComposer>
        {/* Añadir Niebla */} 
        {/* La niebla puede interactuar de forma extraña con postprocessing a veces,
            quizás sea mejor quitarla o ajustarla si usamos bloom */}
        {/* <fog attach="fog" args={['#0A0A18', 100, 600]} /> */}

        {/* Iluminación Nocturna */} 
        <hemisphereLight args={[0x444488, 0x111122, 0.8]} />
        <directionalLight
            position={[40, 60, -50]}
            intensity={0.3}
            castShadow
            shadow-mapSize-width={1024}
            shadow-mapSize-height={1024}
        />

        {/* Renderizar las estrellas */} 
        <Stars contributions={contributions} radius={starRadius} />

        {/* Añadir la cuadrícula adaptada al arcoiris vertical */}
        <SphericalGrid 
            radius={starRadius} 
            latitudeLines={7} // Días semana
            longitudeLines={Math.ceil((contributions.length || 366) / 7)} // Calcular dinámicamente
            totalDays={contributions.length || 366} // Pasar total días real si está disponible
            color="#181818" // Un poco más oscuro
        />

        {/* Añadir las etiquetas de año */}
        <YearLabels contributions={contributions} radius={starRadius} />

        {/* Suelo ondulado */} 
        <WavyGround ref={groundRef} contributions={contributions} />

        {/* Montañas */} 
        <Mountains count={120} radius={400} />

        {/* Portal de interacción - Añadir prop de posición */} 
        <Portal ref={portalRef} position={[0, 15, -50]} />

        {/* Efecto Bloom */} 
        <Bloom 
            intensity={0.6} // Intensidad general del brillo
            luminanceThreshold={0.3} // Qué tan brillante debe ser algo para brillar (0=todo, 1=nada)
            luminanceSmoothing={0.2} // Suavizado del umbral
            mipmapBlur // Mejora calidad del blur
        />
      </EffectComposer>

      {/* Controles y Player FUERA del EffectComposer */} 
      {isMobile ? (
        <MobilePlayer 
            groundRef={groundRef} 
            moveJoystick={moveJoystick} 
            lookJoystick={lookJoystick} 
        />
      ) : (
        <>
          <PointerLockControls
              ref={controlsRef}
              onLock={() => setIsLocked(true)}
              onUnlock={() => setIsLocked(false)}
          />
          <Player
              controlsRef={controlsRef}
              groundRef={groundRef}
              portalRef={portalRef}
              isLocked={isLocked}
              onInteract={onInteract}
              onCanInteractChange={onCanInteractChange}
          />
        </>
      )}

      {/* Overlays HTML FUERA del EffectComposer */} 
      {!isMobile && !isLocked && (
        <Html center style={{ pointerEvents: 'none' }}> 
            <div style={overlayStyle}>
                Click to Explore
            </div>
        </Html>
      )}
    </>
  );
}

export default function Scene({ 
    contributions, 
    onInteract, 
    onCanInteractChange, 
    moveJoystick, // Recibir prop
    lookJoystick, // Recibir prop
    onStarHover // <-- Recibir prop
}: SceneProps) {

  return (
    <div style={{ width: '100%', height: '100%' }}>
        <Canvas
            style={{ background: '#0A0A18' }}
            camera={{ 
                fov: 90, 
                position: [0, playerHeight, 0], 
                near: 0.1, // Plano cercano (mantener default)
                far: 5000 // Aumentar plano lejano significativamente
            }}
            shadows
        >
           <SceneContent 
               contributions={contributions} 
               onInteract={onInteract} 
               onCanInteractChange={onCanInteractChange} 
               moveJoystick={moveJoystick} // Pasar prop
               lookJoystick={lookJoystick} // Pasar prop
               onStarHover={onStarHover} // <-- Pasar prop
           />
        </Canvas>
    </div>
  );
}

// Estilos para el overlay (reutilizados)
const overlayStyle: React.CSSProperties = {
    color: 'white',
    background: 'rgba(0,0,0,0.7)',
    padding: '10px 20px',
    borderRadius: '8px',
    fontSize: '1.1em',
    textAlign: 'center',
    pointerEvents: 'none'
};

// Constantes movidas fuera si es posible
const playerHeight = 5;
const interactDistance = 20;
 