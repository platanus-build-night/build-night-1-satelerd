'use client';

import * as THREE from 'three';
import { useMemo } from 'react';
import { Html } from '@react-three/drei';

interface Contribution {
    date: string;
    count: number;
    weekday: number;
    year: number;
}

interface YearLabelsProps {
    contributions: Contribution[];
    radius: number;
}

export default function YearLabels({ contributions, radius }: YearLabelsProps) {

    // Encontrar los puntos de inicio de cada año
    const yearStartPoints = useMemo(() => {
        if (!contributions || contributions.length === 0) return [];

        const points: { year: number; position: THREE.Vector3 }[] = [];

        // --- Primero, contar los años distintos para centrar --- 
        const distinctYears = Array.from(new Set(contributions.map(c => c.year))).sort();
        const numberOfYears = distinctYears.length;

        // --- Replicar lógica de offset y getPosition --- 
        const daySpread = 60; // Mismo valor
        const arcSpacing = daySpread * 7 * 1.2; // Mismo valor

        // getPosition ahora recibe el xOffset precalculado
        const getPosition = (dayIndex: number, dayOfWeek: number, xOffset: number): THREE.Vector3 => {
            // const totalDays = contributions.length; // <-- No usado
            // const daysPerYear = 366; // O usar días por año para cálculo de t?
            const arcRadius = radius * 2.5; // ¡Asegurarse de que coincide!
            const arcBaseHeight = 5;

            // Calcular t para el inicio del año (usando dayIndex relativo al total?)
            // Usar t=0 para colocar la etiqueta al INICIO del arco.
            const t = 0;
            const angle = (t - 0.5) * Math.PI; 
            const y = arcBaseHeight + arcRadius * Math.cos(angle);
            const z = arcRadius * Math.sin(angle);

            // Posicionar la etiqueta en el centro lateral (baseX=0) + offset
            const baseX = (3 - 3) * daySpread; // x = 0
            const x = baseX + xOffset;
            return new THREE.Vector3(x, y, z);
        };

        let currentYear = 0;
        let yearIndex = 0;
        contributions.forEach((contrib, index) => {
            if (contrib.year !== currentYear) {
                currentYear = contrib.year;
                // Calcular el offset para este año específico
                const xOffset = (yearIndex - Math.floor(numberOfYears / 2)) * arcSpacing;
                // Calcular posición para el primer día del año
                const position = getPosition(index, contrib.weekday, xOffset);
                points.push({ year: currentYear, position });
                yearIndex++; // Incrementar para el siguiente offset
            }
        });

        return points;
    }, [contributions, radius]);

    return (
        <>
            {yearStartPoints.map(({ year, position }) => (
                <Html key={year} position={position} center /* distanceFactor={15} */ >
                    <div style={{ ...labelStyle, backgroundColor: 'transparent' }}>
                        {year}
                    </div>
                </Html>
            ))}
        </>
    );
}

const labelStyle: React.CSSProperties = {
    color: '#aaa',
    fontSize: '1.5em',
    fontWeight: 'bold',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    padding: '2px 8px',
    borderRadius: '4px',
    whiteSpace: 'nowrap',
    // Para texto vertical (opcional, ajustar):
    // transform: 'rotate(90deg)',
    // transformOrigin: 'left top',
}; 