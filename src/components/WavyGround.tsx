'use client';

import * as THREE from 'three';
import { useMemo, forwardRef } from 'react';
import { createNoise2D } from 'simplex-noise';

// --- Constantes para cálculo de tamaño (duplicadas de Stars/Scene) ---
const daySpread = 60;
const arcSpacing = daySpread * 7 * 1.2; // Mismo cálculo que en Stars/Grid
const groundMargin = arcSpacing * 1.5; // Margen extra a cada lado del suelo
// --- Fin Constantes tamaño ---

// --- Constantes para ruido y color (existentes) ---
const noiseFrequencyX = 0.005; // Frecuencia de ruido separada para X
const noiseFrequencyZ = 0.01; // Frecuencia de ruido Z (profundidad)
const noiseAmplitude = 5;  // Qué tan altas son las colinas
const baseColor = new THREE.Color(0x448844); // Verde base más oscuro
const tipColor = new THREE.Color(0x99dd77); // Verde claro para picos
const tempColor = new THREE.Color(); // Para cálculos
// --- Fin Constantes ruido/color ---

// --- Interface para props (Añadir contributions) ---
interface Contribution {
    date: string;
    count: number;
    weekday: number;
    year: number;
}

interface WavyGroundProps {
    contributions: Contribution[];
    // Podríamos añadir más props si fueran necesarias
}
// --- Fin Interface ---

// Usar forwardRef para poder pasar una ref al mesh desde el componente padre
const WavyGround = forwardRef<THREE.Mesh, WavyGroundProps>(({ contributions }, ref) => {
  const noise2D = useMemo(() => createNoise2D(), []);

  const geometry = useMemo(() => {
    // --- Calcular Tamaño del Suelo --- 
    let totalWidth = 1000; // Valor por defecto si no hay contribuciones
    let totalDepth = 1000; // Profundidad (Z) por defecto

    if (contributions && contributions.length > 0) {
        // Re-calcular yearSegments (lógica duplicada)
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
        if (currentYear !== 0) {
            yearSegments.push({ year: currentYear, startIndex, count: contributions.length - startIndex });
        }
        yearSegments.sort((a, b) => a.year - b.year);

        const numberOfArcs = yearSegments.length;
        if (numberOfArcs > 1) {
            totalWidth = (numberOfArcs - 1) * arcSpacing + groundMargin * 2;
        } else {
            // Si solo hay un año, usar un ancho razonable
            totalWidth = daySpread * 7 + groundMargin * 2;
        }
        // Podríamos ajustar la profundidad también si quisiéramos
        totalDepth = totalWidth * 0.8; // Hacerlo un poco menos profundo que ancho
    }
    // --- Fin Cálculo Tamaño --- 

    // --- Crear Geometría --- 
    const widthSegments = Math.max(50, Math.round(totalWidth / 20)); // Segmentos proporcionales al ancho
    const depthSegments = Math.max(50, Math.round(totalDepth / 20)); // Segmentos proporcionales a la profundidad

    const planeGeo = new THREE.PlaneGeometry(totalWidth, totalDepth, widthSegments, depthSegments);
    planeGeo.rotateX(-Math.PI / 2); // Rotar para que sea horizontal

    // --- Aplicar Ruido y Color (Ajustar frecuencia) --- 
    const positions = planeGeo.attributes.position;
    const colors = new Float32Array(positions.count * 3); // Array para colores RGB
    const vertex = new THREE.Vector3();

    for (let i = 0; i < positions.count; i++) {
      vertex.fromBufferAttribute(positions, i);
      // Calcular ruido basado en la posición XZ con frecuencias separadas
      const noiseValue = noise2D(vertex.x * noiseFrequencyX, vertex.z * noiseFrequencyZ);
      // Aplicar desplazamiento en Y
      const height = noiseValue * noiseAmplitude;
      positions.setY(i, height);

      // Calcular color basado en altura (sin cambios)
      const colorFactor = (noiseValue + 1) / 2; // Mapear -1..1 a 0..1
      tempColor.lerpColors(baseColor, tipColor, colorFactor);
      colors[i * 3] = tempColor.r;
      colors[i * 3 + 1] = tempColor.g;
      colors[i * 3 + 2] = tempColor.b;
    }

    planeGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    planeGeo.computeVertexNormals();
    return planeGeo;
  }, [contributions, noise2D]); // Depender de contributions ahora

  return (
    // Usar la ref reenviada
    <mesh ref={ref} geometry={geometry} position={[0, -1, 0]} receiveShadow>
        <meshStandardMaterial side={THREE.DoubleSide} vertexColors={true} flatShading={false} /> {/* Asegurar flatShading = false */}
    </mesh>
  );
});

WavyGround.displayName = 'WavyGround';
export default WavyGround; 