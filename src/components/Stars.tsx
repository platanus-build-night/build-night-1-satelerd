'use client';

import * as THREE from 'three';
import { useMemo, useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';

interface Contribution {
  date: string;
  count: number;
  weekday: number;
  year: number;
}

// interface TooltipData {
//     date: string;
//     count: number;
// }

interface StarsProps {
  contributions: Contribution[];
  radius: number;
}

const starGeometry = new THREE.SphereGeometry(0.5, 6, 6); // Geometría un poco más simple
const starMaterial = new THREE.MeshStandardMaterial({ 
    emissive: 0xffffff, 
    emissiveIntensity: 0.6, // Ligeramente más brillante?
    roughness: 0.8, 
    vertexColors: true // Mantener para posible variación de color futura
});

// Constante para el color base de las estrellas
const BASE_STAR_COLOR = new THREE.Color(0xffffff);

// Tipo para los datos de instancia
interface InstanceData {
    matrix: THREE.Matrix4;
    color: THREE.Color;
    originalIndex: number; // Índice global para referencia
}

// --- Constantes para Twinkling ---
const TWINKLE_SPEED = 0.5; // Velocidad del parpadeo
const TWINKLE_AMOUNT = 0.3; // Cuánto varía el color (0 a 1)
const PHASE_SHIFT_FACTOR = 0.1; // Cuánto desfase entre días

export default function Stars({ contributions, radius }: StarsProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null!); // Volver a una sola ref
  // Ref para almacenar los datos de instancia calculados
  const instancesRef = useRef<InstanceData[]>([]);

  // Calculamos las posiciones y escalas de las estrellas solo cuando cambian las contribuciones
  const allInstances = useMemo(() => {
    if (!Array.isArray(contributions) || contributions.length === 0) {
        console.warn("Stars component received invalid contributions:", contributions);
        return []; // Devolver array vacío
    }

    // Array único para todas las instancias
    const instances: InstanceData[] = [];

    const matrix = new THREE.Matrix4();
    const arcRadius = radius * 2.5; 
    const arcBaseHeight = 5;
    const daySpread = 60;

    // 1. Identificar años y sus rangos
    const yearSegments: { year: number; startIndex: number; count: number }[] = [];
    let currentYear = 0;
    let startIndex = 0;
    contributions.forEach((contrib, index) => {
        if (contrib.year !== currentYear) {
            if (currentYear !== 0) {
                yearSegments.push({ year: currentYear, startIndex, count: index - startIndex });
            }
            currentYear = contrib.year;
            startIndex = index;
        }
    });
    // Añadir el último año
    if (currentYear !== 0) {
        yearSegments.push({ year: currentYear, startIndex, count: contributions.length - startIndex });
    }
    // Ordenar por año por si acaso
    yearSegments.sort((a, b) => a.year - b.year);

    const numberOfArcs = yearSegments.length;
    const arcSpacing = daySpread * 7 * 1.2; 

    const randomOffsetVector = new THREE.Vector3(); // Reutilizar vector para offset

    // 2. Iterar por cada segmento de año (cada arco)
    yearSegments.forEach((segment, arcIndex) => {
        const xOffset = (arcIndex - Math.floor(numberOfArcs / 2)) * arcSpacing;

        // Iterar por los días de ESTE año
        for (let i = 0; i < segment.count; i++) {
            const globalIndex = segment.startIndex + i;
            const contribution = contributions[globalIndex];
            if (!contribution || contribution.count === 0) continue; 

            const dayOfWeek = contribution.weekday;
            const count = contribution.count;

            if (count > 0) {
                // Calcular posición base (centro de la celda para este día)
                const t = segment.count > 1 ? i / (segment.count - 1) : 0;
                const angle = (t - 0.5) * Math.PI;
                const y = arcBaseHeight + arcRadius * Math.cos(angle);
                const z = arcRadius * Math.sin(angle);
                const baseX = (dayOfWeek - 3) * daySpread;
                const x = baseX + xOffset;
                const basePosition = new THREE.Vector3(x, y, z);

                // Calcular parámetros para este día
                const spreadRadius = Math.log(count + 1) * 5.5; // Radio de dispersión (ajustar factor)
                // Calcular ESCALA BASE para este día (menos agresiva ahora)
                const baseStarScale = 2.5;
                const color = BASE_STAR_COLOR; // Usar color base por ahora

                // Crear `count` estrellas con offsets aleatorios
                for (let j = 0; j < count; j++) {
                    // Offset aleatorio dentro de una esfera
                    randomOffsetVector.set(
                        THREE.MathUtils.randFloatSpread(spreadRadius * 2),
                        THREE.MathUtils.randFloatSpread(spreadRadius * 2),
                        THREE.MathUtils.randFloatSpread(spreadRadius * 2)
                    ).normalize().multiplyScalar(Math.random() * spreadRadius);

                    const starPosition = basePosition.clone().add(randomOffsetVector);

                    // Calcular escala randomizada para ESTA estrella
                    const randomizedScale = baseStarScale * THREE.MathUtils.randFloat(0.4, 1.6);

                    matrix.compose(
                        starPosition,
                        new THREE.Quaternion(),
                        new THREE.Vector3(randomizedScale, randomizedScale, randomizedScale)
                    );

                    instances.push({ matrix: matrix.clone(), color, originalIndex: globalIndex });
                }
            } // Fin if (count > 0)
        }
     }); // Fin del bucle por años
 
    return instances;
  }, [contributions, radius]);

  // Actualizar la ref cuando las instancias cambien
  useEffect(() => {
      instancesRef.current = allInstances;
  }, [allInstances]);

  // --- Actualizar el ÚNICO InstancedMesh (Matrices y Color Base inicial) --- 
  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    // Usar el array combinado
    const instances = instancesRef.current;
    mesh.count = instances.length;
    instances.forEach((instance, i) => {
        mesh.setMatrixAt(i, instance.matrix);
        if (mesh.instanceColor) mesh.setColorAt(i, instance.color);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [allInstances]);

  // --- Animación de Twinkling --- 
  useFrame((state) => {
      const mesh = meshRef.current;
      const time = state.clock.elapsedTime;
      const instances = instancesRef.current;

      if (!mesh || !mesh.instanceColor || instances.length === 0) return;

      // Crear un color temporal para no crear objetos en el bucle
      const tempColor = new THREE.Color();

      for (let i = 0; i < mesh.count; i++) {
          const instance = instances[i];
          if (!instance) continue; // Seguridad

          // Calcular factor de pulso basado en tiempo e índice del DÍA
          const pulseFactor = 
              (1.0 - TWINKLE_AMOUNT) + 
              Math.sin(time * TWINKLE_SPEED + instance.originalIndex * PHASE_SHIFT_FACTOR) * TWINKLE_AMOUNT;
          
          // Aplicar factor al color base y clampear
          tempColor.copy(BASE_STAR_COLOR).multiplyScalar(pulseFactor);
          // No es necesario clampear aquí si BASE_STAR_COLOR es (1,1,1) y pulseFactor se mantiene positivo

          // Establecer el color pulsante
          mesh.setColorAt(i, tempColor);
      }

      // Marcar para actualización
      mesh.instanceColor.needsUpdate = true;
  });

  // Renderizar solo el InstancedMesh
  return (
   <>
       <instancedMesh
           ref={meshRef} 
           // Estimar tamaño máximo: 5 años * 366 días * 50 estrellas/día? = ~91500
           args={[starGeometry, starMaterial, 100000]} // Usar un número grande y fijo
           frustumCulled={false}
       />
   </>
  );
} 