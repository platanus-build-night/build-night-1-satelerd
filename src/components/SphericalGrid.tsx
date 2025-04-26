'use client';

import * as THREE from 'three';
import { useMemo } from 'react';

interface SphericalGridProps {
  radius: number;
  latitudeLines?: number;
  longitudeLines?: number;
  segmentsPerLine?: number;
  color?: THREE.ColorRepresentation;
  totalDays?: number;
}

const lineMaterial = new THREE.LineBasicMaterial({ vertexColors: false });

export default function SphericalGrid({
  radius,
  latitudeLines = 7,
  totalDays = 366,
  color = '#444'
}: SphericalGridProps) {

  const daysPerYearGrid = 366;
  const longitudeLinesPerYear = Math.ceil(daysPerYearGrid / 7);

  const arcRadius = radius * 2.5;
  const arcBaseHeight = 5;
  const daySpread = 60;

  const geometry = useMemo(() => {
    const vertices = [];
    const geometry = new THREE.BufferGeometry();

    const getPosition = (dayIndex: number, dayOfWeek: number): THREE.Vector3 => {
      const t = daysPerYearGrid > 1 ? dayIndex / (daysPerYearGrid - 1) : 0;
      const angle = (t - 0.5) * Math.PI;
      const y = arcBaseHeight + arcRadius * Math.cos(angle);
      const z = arcRadius * Math.sin(angle);
      const x = (dayOfWeek - 3.5) * daySpread;
      return new THREE.Vector3(x, y, z);
    };

    const numberOfYears = Math.ceil(totalDays / daysPerYearGrid);
    const arcSpacing = daySpread * 7 * 1.2;

    for (let yearIndex = 0; yearIndex < numberOfYears; yearIndex++) {
      const xOffset = (yearIndex - Math.floor(numberOfYears / 2)) * arcSpacing;

      for (let d = 0; d < latitudeLines - 1; d++) {
        const dayOfWeek = d + 0.5;
        for (let i = 0; i < daysPerYearGrid - 1; i++) {
          const p1_base = getPosition(i, dayOfWeek);
          const p2_base = getPosition(i + 1, dayOfWeek);
          vertices.push(p1_base.x + xOffset, p1_base.y, p1_base.z);
          vertices.push(p2_base.x + xOffset, p2_base.y, p2_base.z);
        }
      }

      const steps = longitudeLinesPerYear;
      for (let s = 0; s < steps; s++) {
        const dayIndex = (s + 0.5) / steps * daysPerYearGrid;
        if (dayIndex >= daysPerYearGrid) continue;

        for (let d = 0; d < latitudeLines - 1; d++) {
          const p1_base = getPosition(dayIndex, d);
          const p2_base = getPosition(dayIndex, d + 1);
          vertices.push(p1_base.x + xOffset, p1_base.y, p1_base.z);
          vertices.push(p2_base.x + xOffset, p2_base.y, p2_base.z);
        }
      }
    }

    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    return geometry;

  }, [latitudeLines, longitudeLinesPerYear, totalDays, arcRadius]);

  const material = useMemo(() => {
    const mat = lineMaterial.clone();
    mat.color = new THREE.Color(color);
    return mat;
  }, [color]);

  return (
    <lineSegments geometry={geometry} material={material} />
  );
} 