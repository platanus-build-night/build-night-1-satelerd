'use client'; // Marcar como cliente porque usa next/dynamic con ssr: false
import dynamic from 'next/dynamic';
import { useState, useEffect, useCallback } from 'react';
import ContributionGraph from '@/components/ContributionGraph';
import { Joystick } from 'react-joystick-component';
import { IJoystickUpdateEvent } from 'react-joystick-component/build/lib/Joystick';

// Definir la interfaz para los datos de contribución que esperamos de la API
interface Contribution {
  date: string;
  count: number;
  weekday: number;
  year: number;
}

// Tipos para los datos del Joystick (simplificado)
interface JoystickData {
    x: number | null; // Eje X (-1 a 1)
    y: number | null; // Eje Y (-1 a 1)
    direction: string | null; // FORWARD, BACKWARD, LEFT, RIGHT
    distance: number | null; // Distancia desde el centro (0 a 1 o más? revisar doc)
}

// Definir TooltipData aquí o importarla
interface TooltipData {
    date: string;
    count: number;
    year?: number;
}

// Importamos el componente Scene dinámicamente y deshabilitamos SSR
const Scene = dynamic(() => import('@/components/Scene'), {
  ssr: false,
  loading: () => <p style={{ color: 'white', textAlign: 'center', marginTop: '20%' }}>Loading 3D Scene...</p> // Opcional: Muestra algo mientras carga
});

export default function Home() {
  // Estados deben estar definidos DENTRO del componente
  const [username, setUsername] = useState<string>('satelerd');
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isInputVisible, setIsInputVisible] = useState<boolean>(false); // Estado para visibilidad
  const [canInteractWithPortal, setCanInteractWithPortal] = useState<boolean>(false); // Estado para prompt HUD
  const [isMobile, setIsMobile] = useState<boolean>(false); // Estado para detectar móvil
  const [hoveredStarData, setHoveredStarData] = useState<TooltipData | null>(null); // Estado para tooltip

  // Estados para los Joysticks
  const [moveJoystickData, setMoveJoystickData] = useState<JoystickData>({ x: null, y: null, direction: null, distance: null });
  const [lookJoystickData, setLookJoystickData] = useState<JoystickData>({ x: null, y: null, direction: null, distance: null });

  // Detectar móvil al montar
  useEffect(() => {
      const checkMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      setIsMobile(checkMobile);
  }, []);

  // useCallback también debe estar DENTRO del componente si usa estados/setters
  const fetchContributions = useCallback(async (user: string) => {
    if (!user) return;
    console.log(`[page.tsx] Fetching contributions for: ${user}`);
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/contributions?username=${encodeURIComponent(user)}`);
      if (!response.ok) {
        const errorData = await response.json();
        console.error(`[page.tsx] API Error ${response.status}:`, errorData);
        throw new Error(errorData.error || `Error: ${response.status}`);
      }
      const data: Contribution[] = await response.json();
      console.log(`[page.tsx] Received ${data.length} contributions. Setting state.`);
      setContributions(data);
    } catch (err) {
      let errorMessage = 'Failed to fetch contributions';
      if (err instanceof Error) {
          errorMessage = err.message;
      }
      console.error("[page.tsx] Failed to fetch contributions:", err);
      setError(errorMessage);
      setContributions([]);
    } finally {
      console.log(`[page.tsx] Finished fetching for: ${user}`);
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchContributions(username);
  }, [fetchContributions, username]);

  const handleUserSubmit = (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const formData = new FormData(event.currentTarget);
      const newUser = formData.get('usernameInput') as string;
      setUsername(newUser);
      setIsInputVisible(false); // Ocultar input después de enviar
  };

  // Función para mostrar el input (se pasará a Player)
  const showUserInput = useCallback(() => {
      console.log("[page.tsx] Showing user input");
      setIsInputVisible(true);
      // Podríamos querer desbloquear el puntero aquí, pero es más fácil hacerlo en Scene/Player
  }, []);

  // --- Handlers para Joysticks ---
  const handleMove = useCallback((event: IJoystickUpdateEvent) => {
    // Mapear event.type a null si es necesario? El tipo base es number | null
    setMoveJoystickData({
        x: event.x, 
        y: event.y, 
        direction: event.direction, 
        distance: event.distance
    });
  }, []);

  const handleMoveStop = useCallback(() => {
    setMoveJoystickData({ x: null, y: null, direction: null, distance: null });
  }, []);

  const handleLook = useCallback((event: IJoystickUpdateEvent) => {
    setLookJoystickData({
        x: event.x,
        y: event.y,
        direction: event.direction,
        distance: event.distance
    });
  }, []);

  const handleLookStop = useCallback(() => {
    setLookJoystickData({ x: null, y: null, direction: null, distance: null });
  }, []);

  // --- Callback para Hover de Estrella ---
  const handleStarHover = useCallback((data: TooltipData | null) => {
    setHoveredStarData(data);
  }, []);

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden' }}>
      {/* Mover UI superpuesta aquí, condicional a isInputVisible */} 
      {isInputVisible && (
          <div style={modalOverlayStyle}>
            <div style={modalContentStyle}>
              <h2 style={{ color: '#E0E0E0', marginBottom: '20px', marginTop: '0', textAlign: 'center' }}>Change GitHub User</h2>
              <form onSubmit={handleUserSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px', width: '100%' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    <label htmlFor='usernameInput' style={{ color: '#B0B0B0', fontSize: '14px' }}>Username:</label>
                    <input
                        id='usernameInput' // Asociar con label
                        type="text"
                        name="usernameInput"
                        defaultValue={username}
                        placeholder="Enter GitHub Username"
                        style={inputStyle} // Usar estilo constante
                        autoFocus
                        required // Hacerlo requerido
                    />
                </div>
                {error && <p style={{ color: '#FF6B6B', marginTop: '0px', marginBottom: '0px', fontSize: '14px', textAlign: 'center' }}>Error: {error}</p>}
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', marginTop: '10px' }}>
                    <button type="button" onClick={() => setIsInputVisible(false)} style={{ ...buttonStyle, backgroundColor: '#555' }}>
                        Cancel
                    </button>
                    <button type="submit" disabled={isLoading} style={{ ...buttonStyle, backgroundColor: isLoading ? '#4CAF50' : '#4CAF50' }}>
                        {isLoading ? 'Loading...' : 'Load Sky'}
                    </button>
                </div>
              </form>
            </div>
          </div>
      )}

      {/* HUD Estático (Gráfico, Crosshair, Prompt E) */} 
      <div style={hudTopRightStyle}> {/* Mover gráfico a su propio contenedor */} 
        <ContributionGraph contributions={contributions} />
      </div>
      <div style={crosshairStyle}>+</div>
      {!isMobile && canInteractWithPortal && (
          <div style={interactPromptStyle}>[E] Interact</div>
      )}

      {/* Tooltip Estrella (HUD Condicional Top-Left) */} 
      {hoveredStarData && (
          <div style={starTooltipStyle}>
              <div>Date: {hoveredStarData.date}</div>
              {hoveredStarData.year && <div>Year: {hoveredStarData.year}</div>}
              <div>Contributions: {hoveredStarData.count}</div>
          </div>
      )}

      {/* Joysticks (solo en móvil) */} 
      {isMobile && (
          <>
              {/* Joystick Izquierdo (Vista/Look) */} 
              <div style={{ position: 'absolute', bottom: '30px', left: '30px', zIndex: 6 }}>
                  <Joystick 
                      size={100} 
                      baseColor="rgba(255, 255, 255, 0.2)" 
                      stickColor="rgba(255, 255, 255, 0.5)" 
                      move={handleLook} // <-- IZQUIERDO para VISTA
                      stop={handleLookStop}
                      throttle={150} 
                      // minDistance={25} // Quizás no necesario para mirar
                  />
              </div>
              {/* Joystick Derecho (Movimiento/Move) */} 
              <div style={{ position: 'absolute', bottom: '30px', right: '30px', zIndex: 6 }}>
                  <Joystick 
                      size={100} 
                      baseColor="rgba(255, 255, 255, 0.2)" 
                      stickColor="rgba(255, 255, 255, 0.5)" 
                      move={handleMove} // <-- DERECHO para MOVER
                      stop={handleMoveStop}
                      throttle={150}
                      minDistance={25} // Mantener para movimiento
                  />
              </div>
          </>
      )}

      <Scene 
          contributions={contributions} 
          onInteract={showUserInput} 
          onCanInteractChange={setCanInteractWithPortal}
          moveJoystick={moveJoystickData}
          lookJoystick={lookJoystickData}
          onStarHover={handleStarHover} // <-- Pasar handler
      /> 
    </div>
  );
}

// --- Estilos para el Modal ---
const modalOverlayStyle: React.CSSProperties = {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
};

const modalContentStyle: React.CSSProperties = {
    background: '#2D2D2D',
    padding: '30px',
    borderRadius: '10px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    boxShadow: '0 5px 15px rgba(0,0,0,0.3)',
    minWidth: '300px',
};

const inputStyle: React.CSSProperties = {
    padding: '10px',
    color: '#FFFFFF',
    borderRadius: '4px',
    border: '1px solid #555',
    fontSize: '16px',
    backgroundColor: '#444'
};

const buttonStyle: React.CSSProperties = {
    padding: '10px 20px',
    borderRadius: '4px',
    border: 'none',
    color: 'white',
    cursor: 'pointer',
    fontSize: '16px',
    flexGrow: 1, // Para que ambos botones ocupen espacio
};

// Estilo para el Crosshair
const crosshairStyle: React.CSSProperties = {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    color: 'white',
    fontSize: '20px',
    fontWeight: 'bold',
    pointerEvents: 'none', // Muy importante
    zIndex: 5, // Asegurar que esté sobre el canvas pero debajo del modal
};

// Estilo para el Prompt de Interacción
const interactPromptStyle: React.CSSProperties = {
    position: 'absolute',
    top: 'calc(50% + 30px)', // Posicionar debajo del crosshair
    left: '50%',
    transform: 'translate(-50%, -50%)',
    color: 'white',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    padding: '5px 10px',
    borderRadius: '5px',
    fontSize: '16px',
    pointerEvents: 'none',
    zIndex: 5,
};

const hudTopRightStyle: React.CSSProperties = {
    position: 'absolute',
    top: '10px',
    right: '10px',
    zIndex: 1,
};

const starTooltipStyle: React.CSSProperties = {
    position: 'absolute',
    top: '10px',
    left: '10px',
    background: 'rgba(0, 0, 0, 0.7)',
    color: 'white',
    padding: '8px 12px',
    borderRadius: '6px',
    fontSize: '14px',
    pointerEvents: 'none',
    zIndex: 5, // Mismo nivel que crosshair/prompt E
};
