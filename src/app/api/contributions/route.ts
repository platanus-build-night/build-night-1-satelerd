import { NextRequest, NextResponse } from 'next/server';

// !! ADVERTENCIA DE SEGURIDAD !!
// Usar el token directamente aquí es inseguro.
// TODO: Cambiar a process.env.GITHUB_TOKEN inmediatamente.
// Se lee desde las variables de entorno (.env.local para desarrollo)
// const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_GRAPHQL_URL = 'https://api.github.com/graphql';

// Definimos interfaces para un tipado más estricto
interface ContributionDay {
  contributionCount: number;
  date: string;
  weekday: number; // Incluido en la query aunque no se use directamente en la normalización
}

interface ContributionWeek {
  contributionDays: ContributionDay[];
}

// Definimos la query GraphQL como una constante
// ACTUALIZADO: Añadir parámetros $from y $to
const GITHUB_CONTRIBUTIONS_QUERY = `
  query GitHubContributions($username: String!, $from: DateTime!, $to: DateTime!) {
    user(login: $username) {
      contributionsCollection(from: $from, to: $to) {
        contributionCalendar {
          totalContributions
          weeks {
            contributionDays {
              contributionCount
              date
              weekday
            }
          }
        }
      }
    }
  }
`;

// Función para aplanar la respuesta de la API
// ACTUALIZADO: Añadir el año a cada contribución
function flattenContributions(calendar: { weeks: ContributionWeek[] }): Contribution[] {
  const contributions: Contribution[] = [];
  calendar.weeks.forEach(week => {
    week.contributionDays.forEach(day => {
      if (day.date) { // Asegurarse de que la fecha existe
        contributions.push({
          date: day.date,
          count: day.contributionCount,
          weekday: day.weekday,
          year: parseInt(day.date.substring(0, 4), 10) // Extraer año
        });
      }
    });
  });
  return contributions;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const username = searchParams.get('username');

  if (!username) {
    return NextResponse.json({ error: 'Username query parameter is required' }, { status: 400 });
  }

  const token = process.env.GITHUB_TOKEN;
  if (!token) {
      return NextResponse.json({ error: 'GitHub token not configured' }, { status: 500 });
  }

  try {
    const allContributions: Contribution[] = [];
    const currentYear = new Date().getFullYear();
    const yearsToFetch = 5;

    for (let i = 0; i < yearsToFetch; i++) {
        const year = currentYear - i;
        // Definir fechas exactas para este año (ISOString)
        const fromDate = new Date(year, 0, 1).toISOString(); // Enero 1
        // Usar fin de año o hoy si es el año actual
        const toDate = (i === 0) ? new Date().toISOString() : new Date(year, 11, 31).toISOString(); // Dic 31

        const variables = {
            username,
            from: fromDate,
            to: toDate
        };

        console.log(`Fetching contributions for ${username}, year ${year}...`);

        const response = await fetch(GITHUB_GRAPHQL_URL, {
          method: 'POST',
          headers: {
            'Authorization': `bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query: GITHUB_CONTRIBUTIONS_QUERY,
            variables,
          }),
          next: { revalidate: 3600 } // Cache individual por año
        });

        if (!response.ok) {
            const errorData = await response.text();
            console.error(`GitHub API Error for year ${year}:`, errorData);
            // Continuar con otros años si uno falla?
            // Por ahora, devolvemos error si alguna llamada falla.
            return NextResponse.json({ error: `GitHub API responded with ${response.status} for year ${year}`, details: errorData }, { status: response.status });
        }

        const data = await response.json();

        if (data.errors) {
            console.error(`GitHub GraphQL Errors for year ${year}:`, JSON.stringify(data.errors, null, 2));
            // Continuar o devolver error?
            return NextResponse.json({ error: `Error fetching data for year ${year}`, details: data.errors }, { status: 400 });
        }

        const contributionCalendar = data?.data?.user?.contributionsCollection?.contributionCalendar;

        if (contributionCalendar) {
           // Aplanar y añadir contribuciones de este año al array total
           const yearContributions = flattenContributions(contributionCalendar);
           allContributions.push(...yearContributions);
        } else {
           console.warn(`No contribution calendar data found for year ${year}`);
        }
    } // Fin del bucle for

    // Ordenar todas las contribuciones por fecha (ascendente) antes de devolver
    allContributions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    console.log(`Returning ${allContributions.length} total contributions.`);
    return NextResponse.json(allContributions);

  } catch (error) {
    console.error('Error fetching GitHub contributions:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Añadir la interfaz Contribution actualizada
interface Contribution {
  date: string;
  count: number;
  weekday: number;
  year: number; // <-- Añadido
}

// Tipos para la respuesta de la API de GitHub
// interface GitHubContributionDay {
// } 