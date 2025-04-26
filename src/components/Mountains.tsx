'use client';

import * as THREE from 'three';
import { useMemo, useRef, useEffect } from 'react';

// Geometría base para las montañas (cono) - ELIMINAR ESTA CONSTANTE - YA NO SE USA

// Material base - AHORA habilitamos vertexColors - ACTUALIZACIÓN: Quitamos vertexColors y usamos flatShading
const mountainMaterial = new THREE.MeshStandardMaterial({
  color: 0x9999AA, // Un color base gris-azulado para roca
  roughness: 0.9,
  metalness: 0.1,
  // vertexColors: true // *** Quitar Vertex Colors ***
  flatShading: true, // *** Añadir Flat Shading ***
});

// Quitar lógica de colores de vértice (ya no se usa)
// const snowColor = new THREE.Color(0xffffff);
// const rockColor = new THREE.Color(0x888899);
// const tempColor = new THREE.Color();

interface MountainsProps {
  count?: number; // Cuántas montañas generar
  radius?: number; // Radio del anillo donde se distribuyen
}

// Ajustar parámetros para más montañas y mayor dispersión
const INNER_RING_RATIO = 0.7; // Porcentaje de montañas en el anillo cercano
const OUTER_RADIUS_FACTOR = 2.5; // Qué tan lejos pueden llegar las montañas exteriores

export default function Mountains({ count = 120, radius = 400 }: MountainsProps) { // Aumentar count por defecto
  const meshRef = useRef<THREE.InstancedMesh>(null!);

  // Geometría base - se crea y usa aquí
  const baseGeometry = useMemo(() => {
      // Usar DodecahedronGeometry
      const baseRadius = 15; // Ajustar radio base para la nueva geometría
      const detail = 0; // 0 para el dodecaedro base
      const geo = new THREE.DodecahedronGeometry(baseRadius, detail);

      // Eliminar cálculo de colores de vértice
      // const positions = geo.attributes.position;
      // const colors = new Float32Array(positions.count * 3);
      // const vertex = new THREE.Vector3();
      // const snowLineFactor = 0.6;
      // ... (código de color eliminado) ...
      // geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      
      // Asegurarse de que las normales estén calculadas (puede que no sea necesario para flat shading)
      geo.computeVertexNormals(); 

      return geo;
  }, []);

  // Calcular posiciones y escalas aleatorias
  const instances = useMemo(() => {
    const temp = [];
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const rotation = new THREE.Euler();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3();

    const innerCount = Math.floor(count * INNER_RING_RATIO);
    const outerCount = count - innerCount;

    // 1. Montañas del Anillo Interior (como antes)
    for (let i = 0; i < innerCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = radius * (0.8 + Math.random() * 0.4);
      position.set(Math.cos(angle) * r, 0, Math.sin(angle) * r);

      const scaleFactorX = 1.0 + Math.random() * 2.5;
      const scaleFactorY = 1.5 + Math.random() * 4.0; // Aumentar un poco la altura máxima aquí también
      scale.set(scaleFactorX, scaleFactorY, scaleFactorX);

      rotation.set(0, Math.random() * Math.PI, 0);
      quaternion.setFromEuler(rotation);

      matrix.compose(position, quaternion, scale);
      temp.push(matrix.clone());
    }

    // 2. Montañas Exteriores Dispersas
    for (let i = 0; i < outerCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      // Radio mayor y más variable, asegurando que esté más allá del anillo interior
      const r = radius * (1.5 + Math.random() * (OUTER_RADIUS_FACTOR - 1.5)); 
      position.set(Math.cos(angle) * r, 0, Math.sin(angle) * r);

      // Permitir que las montañas exteriores sean MÁS GRANDES
      const scaleFactorX = 1.5 + Math.random() * 3.5; 
      const scaleFactorY = 2.5 + Math.random() * 6.0; // Rango de altura significativamente mayor
      scale.set(scaleFactorX, scaleFactorY, scaleFactorX);

      rotation.set(0, Math.random() * Math.PI, 0);
      quaternion.setFromEuler(rotation);

      matrix.compose(position, quaternion, scale);
      temp.push(matrix.clone());
    }

    return temp;
  }, [count, radius]);

  // Actualizar matrices en InstancedMesh (sin cambios)
  useEffect(() => {
    if (!meshRef.current) return;
    // Asegurarse de que el tamaño del InstancedMesh coincida con el count total
    if (meshRef.current.count !== count) {
        meshRef.current.instanceMatrix.needsUpdate = true; // Forzar update si el count cambia
    } 
    meshRef.current.count = instances.length; // Establecer el count correcto
    instances.forEach((matrix, i) => {
      meshRef.current.setMatrixAt(i, matrix);
    });
    meshRef.current.instanceMatrix.needsUpdate = true; 
  }, [instances, count]); // Añadir count a las dependencias

  return (
    // Usar la baseGeometry actualizada y añadir frustumCulled={false}
    <instancedMesh 
        ref={meshRef} 
        // Pasar el count total aquí también en la creación inicial
        args={[baseGeometry, mountainMaterial, count]} 
        castShadow 
        receiveShadow 
        frustumCulled={false} // *** Añadir Frustum Culling = false ***
    />
  );
} 