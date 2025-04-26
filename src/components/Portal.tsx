'use client';

import { useRef, forwardRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface PortalProps {
    position?: [number, number, number];
}

// Materiales
// const material1 = new THREE.MeshStandardMaterial({ color: '#0055FF', emissive: '#0033DD', emissiveIntensity: 0.8, roughness: 0.2, metalness: 0.1 });
const material1 = new THREE.MeshBasicMaterial({ color: '#0077FF', wireframe: true });
const particleMaterial = new THREE.MeshStandardMaterial({ color: '#FFFFFF', emissive: '#FFFFFF', emissiveIntensity: 1 });
const innerObjectMaterial = new THREE.MeshNormalMaterial(); // <-- Material para objeto interior

const Portal = forwardRef<THREE.Group, PortalProps>(({ position = [0, 10, -50] }, ref) => {
    const knotRef = useRef<THREE.Mesh>(null!);
    const particlesRef = useRef<THREE.InstancedMesh>(null!);
    const groupRef = useRef<THREE.Group>(null!); // Ref interna para el grupo de partículas
    const innerObjectRef = useRef<THREE.Mesh>(null!); // <-- Ref para objeto interior

    // Geometrías
    const knotGeometry = useMemo(() => new THREE.TorusKnotGeometry(6, 0.8, 100, 16), []);
    const sphereGeometry = useMemo(() => new THREE.SphereGeometry(0.3, 8, 8), []);
    const innerGeometry = useMemo(() => new THREE.IcosahedronGeometry(3, 1), []); // <-- Geometría interior (Icosaedro detallado)
    const particleCount = 50;

    // Posiciones iniciales para partículas (en una esfera)
    const particleTransforms = useMemo(() => {
        const temp = [];
        const matrix = new THREE.Matrix4();
        const basePosition = new THREE.Vector3();
        for (let i = 0; i < particleCount; i++) {
            const phi = Math.acos(-1 + (2 * i) / particleCount);
            const theta = Math.sqrt(particleCount * Math.PI) * phi;
            basePosition.setFromSphericalCoords(12, phi, theta); // Radio 12
            matrix.setPosition(basePosition);
            temp.push(matrix.clone());
        }
        return temp;
    }, []);

    useFrame((state, delta) => {
        const time = state.clock.elapsedTime;

        // Rotar el nudo
        if (knotRef.current) {
            knotRef.current.rotation.y += delta * 0.2;
            knotRef.current.rotation.z -= delta * 0.1;
        }

        // Rotar objeto interior
        if (innerObjectRef.current) {
            innerObjectRef.current.rotation.x += delta * 0.5;
            innerObjectRef.current.rotation.y -= delta * 0.3;
        }

        // Animar partículas
        if (particlesRef.current && groupRef.current) {
            groupRef.current.rotation.y += delta * 0.15; // Rotar el grupo contenedor
            for (let i = 0; i < particleCount; i++) {
                const matrix = particleTransforms[i];
                // Añadir un movimiento sinusoidal individual
                const pulsation = Math.sin(time * (1 + i * 0.05)) * 0.5;
                const currentPosition = new THREE.Vector3().setFromMatrixPosition(matrix);
                currentPosition.multiplyScalar(1 + pulsation * 0.1); // Pulsar ligeramente el radio
                const tempMatrix = new THREE.Matrix4().setPosition(currentPosition);
                particlesRef.current.setMatrixAt(i, tempMatrix);
            }
            particlesRef.current.instanceMatrix.needsUpdate = true;
        }
    });

    return (
        // Group principal con la ref externa y posición
        <group ref={ref} position={position}>
            {/* Nudo más grande */}
            <mesh 
                ref={knotRef} 
                geometry={knotGeometry} 
                material={material1} 
                scale={1.5} // <-- Escalar el nudo
            />
            
            {/* Objeto interior abstracto */}
            <mesh 
                ref={innerObjectRef} 
                geometry={innerGeometry} 
                material={innerObjectMaterial} 
                // Posición en el centro (0,0,0 relativo al grupo)
            />

            {/* Grupo interno para rotar partículas independientemente */}
            <group ref={groupRef}>
                <instancedMesh ref={particlesRef} args={[sphereGeometry, particleMaterial, particleCount]} />
            </group>
        </group>
    );
});

Portal.displayName = 'Portal';

export default Portal; 