import React, { useRef, useState, useEffect, useCallback } from 'react';
import { 
  X, Play, Pause, Save, RotateCcw, Volume2, 
  SkipBack, SkipForward, ChevronLeft, ChevronRight,
  Scissors, Download, ZoomIn, ZoomOut, Maximize2,
  AlertCircle, Check, Clock, FileAudio, MoveHorizontal,
  Bookmark, ChevronsRight, ChevronsLeft, 
  Info, RefreshCw, Volume1
} from 'lucide-react';

interface Recording {
  id: string;
  fileName: string;
  city: string;
  radioName: string;
  timestamp: string;
  duration: string;
  fileSize: string;
  url: string;
}

interface AudioTrimmerProps {
  isOpen: boolean;
  onClose: () => void;
  recording: Recording | null;
}

const AudioTrimmer: React.FC<AudioTrimmerProps> = ({ isOpen, onClose, recording }) => {
  // Estados principales
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [startTrim, setStartTrim] = useState(0);
  const [endTrim, setEndTrim] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [waveformData, setWaveformData] = useState<number[]>([]);
  
  // Estados de visualización
  const [zoomLevel, setZoomLevel] = useState(1);
  const [viewportStart, setViewportStart] = useState(0);
  const [viewportEnd, setViewportEnd] = useState(600); // 10 minutos por defecto
  const [pixelsPerSecond, setPixelsPerSecond] = useState(2);
  
  // Estados de interacción
  const [isDraggingStart, setIsDraggingStart] = useState(false);
  const [isDraggingEnd, setIsDraggingEnd] = useState(false);
  const [isDraggingPlayhead, setIsDraggingPlayhead] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [panStartX, setPanStartX] = useState(0);
  const [panStartViewport, setPanStartViewport] = useState(0);
  const [audioLoaded, setAudioLoaded] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [isLooping, setIsLooping] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showTrimMarkers, setShowTrimMarkers] = useState(true);
  const [showInfo, setShowInfo] = useState(true);
  
  // Estados para inputs de tiempo
  const [startTimeInput, setStartTimeInput] = useState('00:00.00');
  const [endTimeInput, setEndTimeInput] = useState('00:00.00');
  
  // Estados para características avanzadas
  const [isPlayingSelection, setIsPlayingSelection] = useState(false);
  const [favoritePositions, setFavoritePositions] = useState<{label: string, time: number}[]>([]);
  const [selectionPreview, setSelectionPreview] = useState<{duration: number, size: string} | null>(null);
  
  // Refs
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const waveformRef = useRef<HTMLCanvasElement | null>(null);
  const timelineRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const waveformContainerRef = useRef<HTMLDivElement | null>(null);
  const animationRef = useRef<number>(0);

  // Generar forma de onda más realista
  const generateWaveform = useCallback((audioDuration = 1800) => {
    const sampleCount = Math.min(10000, Math.round(1000 * Math.max(1, zoomLevel)));
    const mockData: number[] = [];
    
    // Generar datos aleatorios pero más realistas para la forma de onda
    for (let i = 0; i < sampleCount; i++) {
      const position = i / sampleCount;
      
      // Base amplitude between 0.2 and 0.8
      let amplitude = 0.2 + Math.random() * 0.6;
      
      // Add patterns that resemble speech - more variation
      const fastOscillation = Math.sin(i * 0.3) * 0.1;
      const mediumOscillation = Math.sin(i * 0.05) * 0.2;
      const slowOscillation = Math.sin(i * 0.01) * 0.3;
      
      // Combine oscillations for more natural patterns
      amplitude += fastOscillation + mediumOscillation + slowOscillation;
      
      // Simulate silent parts occasionally
      if (Math.random() < 0.05) {
        const silenceLength = Math.floor(Math.random() * 10) + 5;
        for (let j = 0; j < silenceLength && i < sampleCount; j++, i++) {
          mockData.push(0.05 + Math.random() * 0.1); // Near silence
        }
        i--; // Adjust for the loop increment
        continue;
      }
      
      // Simulate louder sections occasionally
      if (Math.random() < 0.1 && mockData.length > 0) {
        const loudLength = Math.floor(Math.random() * 20) + 10;
        const loudBase = 0.7 + Math.random() * 0.3;
        for (let j = 0; j < loudLength && i < sampleCount; j++, i++) {
          mockData.push(loudBase - Math.random() * 0.3);
        }
        i--; // Adjust for the loop increment
        continue;
      }
      
      // Keep amplitude in bounds
      amplitude = Math.max(0.05, Math.min(1, amplitude));
      mockData.push(amplitude);
    }
    
    setWaveformData(mockData);
    if (audioDuration) {
      setDuration(audioDuration);
      setEndTrim(audioDuration);
      setViewportEnd(Math.min(audioDuration, 600));
      updateTimeInputs(0, audioDuration);
      updateSelectionPreview(0, audioDuration);
    }
  }, [zoomLevel]);

  // Formatear tiempo para inputs
  const formatTimeForInput = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  };

  // Parsear tiempo desde input
  const parseTimeFromInput = (input: string): number | null => {
    const match = input.match(/^(\d{1,2}):(\d{2})\.?(\d{0,2})$/);
    if (!match) return null;
    
    const mins = parseInt(match[1], 10);
    const secs = parseInt(match[2], 10);
    const ms = parseInt(match[3] || '0', 10);
    
    if (secs >= 60) return null;
    
    return mins * 60 + secs + ms / 100;
  };

  // Actualizar inputs de tiempo
  const updateTimeInputs = (start: number, end: number) => {
    setStartTimeInput(formatTimeForInput(start));
    setEndTimeInput(formatTimeForInput(end));
  };

  // Actualizar previsualización de selección
  const updateSelectionPreview = (start: number, end: number) => {
    const selectionDuration = end - start;
    // Aproximadamente 7KB por segundo para audio mono a 56kbps
    const estimatedSizeBytes = selectionDuration * 7000;
    const sizeString = formatFileSize(estimatedSizeBytes);
    
    setSelectionPreview({
      duration: selectionDuration,
      size: sizeString
    });
  };

  // Formatear tamaño de archivo
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  // Manejar cambio en input de tiempo de inicio
  const handleStartTimeInputChange = (value: string) => {
    setStartTimeInput(value);
    const time = parseTimeFromInput(value);
    if (time !== null && time >= 0 && time < endTrim) {
      setStartTrim(time);
      updateSelectionPreview(time, endTrim);
    }
  };

  // Manejar cambio en input de tiempo de fin
  const handleEndTimeInputChange = (value: string) => {
    setEndTimeInput(value);
    const time = parseTimeFromInput(value);
    if (time !== null && time > startTrim && time <= duration) {
      setEndTrim(time);
      updateSelectionPreview(startTrim, time);
    }
  };

  // Manejar acciones de teclado
  useEffect(() => {
    if (!isOpen) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === ' ') { // Espacio para play/pause
        e.preventDefault();
        handlePlayPause();
      } else if (e.key === 'ArrowLeft') { // Izquierda para retroceder
        e.preventDefault();
        const jumpAmount = e.shiftKey ? 10 : 5;
        if (audioRef.current) {
          audioRef.current.currentTime = Math.max(0, currentTime - jumpAmount);
        }
      } else if (e.key === 'ArrowRight') { // Derecha para avanzar
        e.preventDefault();
        const jumpAmount = e.shiftKey ? 10 : 5;
        if (audioRef.current) {
          audioRef.current.currentTime = Math.min(duration, currentTime + jumpAmount);
        }
      } else if (e.key === 'i' || e.key === 'I') { // I para marcar inicio
        e.preventDefault();
        setStartTrim(currentTime);
        updateTimeInputs(currentTime, endTrim);
        updateSelectionPreview(currentTime, endTrim);
      } else if (e.key === 'o' || e.key === 'O') { // O para marcar fin
        e.preventDefault();
        setEndTrim(currentTime);
        updateTimeInputs(startTrim, currentTime);
        updateSelectionPreview(startTrim, currentTime);
      } else if (e.key === 'l' || e.key === 'L') { // L para activar/desactivar loop
        e.preventDefault();
        setIsLooping(!isLooping);
      } else if (e.key === 's' && (e.ctrlKey || e.metaKey)) { // Ctrl+S para guardar
        e.preventDefault();
        handleSaveTrim();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, isLooping, currentTime, duration, startTrim, endTrim]);

  // Inicialización
  useEffect(() => {
    if (!isOpen || !recording) return;
    
    setCurrentTime(0);
    setStartTrim(0);
    setError(null);
    setSuccess(null);
    setAudioLoaded(false);
    setZoomLevel(1);
    setViewportStart(0);
    setLoadingProgress(0);
    
    generateWaveform();
    
    if (recording.duration) {
      try {
        const [minutes, seconds] = recording.duration.split(':').map(Number);
        const durationInSeconds = minutes * 60 + seconds;
        if (!isNaN(durationInSeconds) && durationInSeconds > 0) {
          setDuration(durationInSeconds);
          setEndTrim(durationInSeconds);
          generateWaveform(durationInSeconds);
        }
      } catch (err) {
        console.error('Error parsing duration:', err);
      }
    }
  }, [isOpen, recording]);

  // Cargar audio
  useEffect(() => {
    if (!isOpen || !recording) return;

    const audio = new Audio();
    audioRef.current = audio;
    
    // Configurar URL del audio
    const baseUrl = 'http://192.168.10.49:3001';
    const cleanRadio = recording.radioName.replace(/\\s+/g, '');
    const encodedCity = encodeURIComponent(recording.city);
    const encodedRadio = encodeURIComponent(cleanRadio);
    const encodedFileName = encodeURIComponent(recording.fileName);
    const audioUrl = `${baseUrl}/audio/${encodedCity}/${encodedRadio}/${encodedFileName}`;
    
    console.log('Loading audio:', audioUrl);
    
    audio.src = audioUrl;
    audio.preload = 'metadata';
    audio.volume = volume;

    // Eventos del elemento de audio
    audio.addEventListener('loadedmetadata', () => {
      console.log('Audio metadata loaded, duration:', audio.duration);
      setLoadingProgress(30);
    });
    
    audio.addEventListener('progress', () => {
      // Estimar progreso de carga
      if (audio.duration > 0) {
        for (let i = 0; i < audio.buffered.length; i++) {
          if (audio.buffered.start(i) <= audio.currentTime && 
              audio.currentTime <= audio.buffered.end(i)) {
            const progress = (audio.buffered.end(i) / audio.duration) * 100;
            setLoadingProgress(Math.min(90, 30 + progress * 0.6));
            break;
          }
        }
      }
    });
    
    audio.addEventListener('canplaythrough', () => {
      console.log('Audio can play through, duration:', audio.duration);
      setDuration(audio.duration);
      setEndTrim(audio.duration);
      setAudioLoaded(true);
      setLoadingProgress(100);
      generateWaveform(audio.duration);
    });

    audio.addEventListener('timeupdate', () => {
      setCurrentTime(audio.currentTime);
      
      // Auto-scroll si es necesario
      if (audio.currentTime < viewportStart || audio.currentTime > viewportEnd) {
        const viewportDuration = viewportEnd - viewportStart;
        const newStart = Math.max(0, audio.currentTime - viewportDuration / 4);
        setViewportStart(newStart);
        setViewportEnd(Math.min(duration, newStart + viewportDuration));
      }
      
      // Gestionar loop de selección
      if (isLooping && audio.currentTime >= endTrim) {
        audio.currentTime = startTrim;
      }
    });

    audio.addEventListener('ended', () => {
      if (isLooping) {
        audio.currentTime = startTrim;
        audio.play().catch(console.error);
      } else {
        setIsPlaying(false);
        setIsPlayingSelection(false);
      }
    });

    audio.addEventListener('error', (e) => {
      console.error('Audio load error:', e);
      setError('Error al cargar el audio. Intente nuevamente.');
      setAudioLoaded(false);
    });

    // Cleanup al desmontar
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
        audioRef.current.removeAttribute('src');
        audioRef.current = null;
      }
    };
  }, [isOpen, recording, isLooping, endTrim, startTrim, duration, volume]);

  // Actualizar zoom
  useEffect(() => {
    if (duration > 0) {
      const visibleDuration = duration / zoomLevel;
      const center = (viewportStart + viewportEnd) / 2;
      
      setViewportStart(Math.max(0, center - visibleDuration / 2));
      setViewportEnd(Math.min(duration, center + visibleDuration / 2));
      setPixelsPerSecond(2 * zoomLevel);
    }
  }, [zoomLevel]);

  // Actualizar inputs cuando cambian los valores
  useEffect(() => {
    updateTimeInputs(startTrim, endTrim);
    updateSelectionPreview(startTrim, endTrim);
  }, [startTrim, endTrim]);

  // Dibujar línea de tiempo
  const drawTimeline = useCallback(() => {
    if (!timelineRef.current || !containerRef.current) return;
    
    const canvas = timelineRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    canvas.width = containerRef.current.clientWidth;
    canvas.height = 40;
    
    const width = canvas.width;
    const height = canvas.height;
    
    // Limpiar canvas
    ctx.clearRect(0, 0, width, height);
    
    // Fondo
    ctx.fillStyle = '#0f172a';  // Azul muy oscuro
    ctx.fillRect(0, 0, width, height);
    
    // Calcular intervalo de tiempo basado en zoom
    const visibleDuration = viewportEnd - viewportStart;
    let timeInterval;
    
    if (zoomLevel <= 0.5) timeInterval = 600; // 10 minutos
    else if (zoomLevel <= 1) timeInterval = 300; // 5 minutos  
    else if (zoomLevel <= 2) timeInterval = 60; // 1 minuto
    else if (zoomLevel <= 5) timeInterval = 30; // 30 segundos
    else if (zoomLevel <= 10) timeInterval = 10; // 10 segundos
    else if (zoomLevel <= 20) timeInterval = 5; // 5 segundos
    else timeInterval = 1; // 1 segundo
    
    // Dibujar marcadores de tiempo
    ctx.strokeStyle = '#475569';  // Gris medio
    ctx.fillStyle = '#e2e8f0';    // Gris claro
    ctx.font = '11px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    
    const firstMarker = Math.ceil(viewportStart / timeInterval) * timeInterval;
    
    // Dibujar líneas de cuadrícula
    ctx.strokeStyle = '#1e293b';  // Azul oscuro
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let time = firstMarker; time <= viewportEnd; time += timeInterval / 2) {
      const x = ((time - viewportStart) / visibleDuration) * width;
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
    }
    ctx.stroke();
    
    // Dibujar marcadores principales de tiempo
    for (let time = firstMarker; time <= viewportEnd; time += timeInterval) {
      const x = ((time - viewportStart) / visibleDuration) * width;
      
      // Línea vertical
      const isMajor = time % (timeInterval * 2) === 0;
      ctx.strokeStyle = isMajor ? '#64748b' : '#334155';
      ctx.lineWidth = isMajor ? 2 : 1;
      
      ctx.beginPath();
      ctx.moveTo(x, height - 10);
      ctx.lineTo(x, height);
      ctx.stroke();
      
      // Etiqueta de tiempo (solo para marcadores principales)
      if (isMajor || zoomLevel > 5) {
        const mins = Math.floor(time / 60);
        const secs = Math.floor(time % 60);
        let label;
        
        if (zoomLevel > 10) {
          // Formato detallado mm:ss para zoom alto
          label = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        } else if (secs === 0 || zoomLevel > 5) {
          // Formato simplificado para otros niveles
          label = secs === 0 ? 
            `${mins.toString().padStart(2, '0')}:00` : 
            `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        } else {
          continue; // Skip non-minute labels at lower zoom
        }
        
        ctx.fillStyle = '#e2e8f0';
        ctx.fillText(label, x, height - 15);
      }
    }
    
    // Marcar el tiempo actual en la línea de tiempo
    if (currentTime >= viewportStart && currentTime <= viewportEnd) {
      const x = ((currentTime - viewportStart) / visibleDuration) * width;
      
      // Triángulo marcador
      ctx.fillStyle = '#fbbf24';  // Amarillo
      ctx.beginPath();
      ctx.moveTo(x - 8, 0);
      ctx.lineTo(x + 8, 0);
      ctx.lineTo(x, 8);
      ctx.closePath();
      ctx.fill();
    }
  }, [viewportStart, viewportEnd, zoomLevel, currentTime]);

  // Dibujar forma de onda
  const drawWaveform = useCallback(() => {
    if (!waveformRef.current || !containerRef.current || waveformData.length === 0) return;
    
    const canvas = waveformRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    canvas.width = containerRef.current.clientWidth;
    canvas.height = 120;
    
    const width = canvas.width;
    const height = canvas.height;
    const centerY = height / 2;
    
    // Limpiar canvas
    ctx.clearRect(0, 0, width, height);
    
    // Fondo oscuro
    ctx.fillStyle = '#1e293b';  // Azul oscuro
    ctx.fillRect(0, 0, width, height);
    
    // Líneas de cuadrícula
    ctx.strokeStyle = '#334155';  // Azul grisáceo
    ctx.lineWidth = 1;
    
    // Líneas horizontales de cuadrícula
    const gridLines = 5;
    ctx.beginPath();
    for (let i = 1; i < gridLines; i++) {
      const y = i * (height / gridLines);
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
    }
    ctx.stroke();
    
    // Línea central
    ctx.strokeStyle = '#475569';  // Gris medio
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, centerY);
    ctx.lineTo(width, centerY);
    ctx.stroke();
    
    const visibleDuration = viewportEnd - viewportStart;
    
    // Área de selección
    if (duration > 0 && showTrimMarkers) {
      const startX = Math.max(0, ((startTrim - viewportStart) / visibleDuration) * width);
      const endX = Math.min(width, ((endTrim - viewportStart) / visibleDuration) * width);
      
      // Fondo de selección
      ctx.fillStyle = 'rgba(34, 197, 94, 0.15)';  // Verde transparente
      ctx.fillRect(startX, 0, endX - startX, height);
      
      // Bordes de selección
      ctx.strokeStyle = 'rgba(34, 197, 94, 0.8)';  // Verde más opaco
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(startX, 0);
      ctx.lineTo(startX, height);
      ctx.moveTo(endX, 0);
      ctx.lineTo(endX, height);
      ctx.stroke();
    }
    
    // Dibujar forma de onda
    ctx.lineWidth = 2;
    
    // Determinar rango visible de muestras
    const startSampleIndex = Math.floor((viewportStart / duration) * waveformData.length);
    const endSampleIndex = Math.ceil((viewportEnd / duration) * waveformData.length);
    const visibleSamples = endSampleIndex - startSampleIndex;
    
    // Número de píxeles por muestra
    const pixelsPerSample = width / visibleSamples;
    
    // Si hay demasiadas muestras, agrupamos para evitar sobrecargar el render
    const stride = Math.max(1, Math.floor(visibleSamples / width));
    
    // Primera pasada: fondo de la forma de onda (más claro)
    ctx.strokeStyle = '#64748b';  // Gris medio
    ctx.fillStyle = '#64748b';
    ctx.beginPath();
    
    for (let x = 0; x < width; x++) {
      const sampleIndex = startSampleIndex + Math.floor(x / pixelsPerSample);
      
      if (sampleIndex < waveformData.length) {
        // Tomar máximo de un grupo de muestras para suavizar
        let maxAmplitude = 0;
        for (let s = 0; s < stride; s++) {
          const idx = sampleIndex + s;
          if (idx < waveformData.length) {
            maxAmplitude = Math.max(maxAmplitude, waveformData[idx]);
          }
        }
        
        const barHeight = maxAmplitude * (height * 0.7);
        
        // Dibujar líneas para forma de onda (reflejo en espejo)
        ctx.moveTo(x, centerY - barHeight/2);
        ctx.lineTo(x, centerY + barHeight/2);
      }
    }
    ctx.stroke();
    
    // Segunda pasada: Dibujar forma de onda detallada (más clara y brillante)
    ctx.beginPath();
    
    for (let x = 0; x < width; x++) {
      const time = viewportStart + (x / width) * visibleDuration;
      const isInSelection = time >= startTrim && time <= endTrim;
      
      const sampleIndex = startSampleIndex + Math.floor(x / pixelsPerSample);
      
      if (sampleIndex < waveformData.length) {
        // Tomar máximo de un grupo de muestras para suavizar
        let maxAmplitude = 0;
        for (let s = 0; s < stride; s++) {
          const idx = sampleIndex + s;
          if (idx < waveformData.length) {
            maxAmplitude = Math.max(maxAmplitude, waveformData[idx]);
          }
        }
        
        const barHeight = maxAmplitude * (height * 0.7);
        
        // Dibujar barras para forma de onda (reflejo en espejo)
        ctx.fillStyle = isInSelection ? '#4ade80' : '#94a3b8'; // Verde para selección, gris claro para resto
        ctx.fillRect(x, centerY - barHeight/2, 1, barHeight/2);
        ctx.fillRect(x, centerY, 1, barHeight/2);
      }
    }
    
    // Marcadores de recorte
    if (showTrimMarkers) {
      if (startTrim >= viewportStart && startTrim <= viewportEnd) {
        const startX = ((startTrim - viewportStart) / visibleDuration) * width;
        drawTrimHandle(ctx, startX, height, 'start', '#3b82f6'); // Azul
      }
      
      if (endTrim >= viewportStart && endTrim <= viewportEnd) {
        const endX = ((endTrim - viewportStart) / visibleDuration) * width;
        drawTrimHandle(ctx, endX, height, 'end', '#3b82f6'); // Azul
      }
    }
    
    // Línea de reproducción (playhead)
    if (currentTime >= viewportStart && currentTime <= viewportEnd) {
      const playheadX = ((currentTime - viewportStart) / visibleDuration) * width;
      
      // Sombra para mejor visibilidad
      ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
      ctx.shadowBlur = 3;
      
      // Línea de playhead
      ctx.strokeStyle = '#fbbf24'; // Amarillo
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(playheadX, 0);
      ctx.lineTo(playheadX, height);
      ctx.stroke();
      
      // Círculo en parte superior
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.arc(playheadX, 10, 5, 0, Math.PI * 2);
      ctx.fill();
      
      // Restablecer sombra
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
    }
    
    // Dibujar favoritos si existen
    favoritePositions.forEach(favorite => {
      if (favorite.time >= viewportStart && favorite.time <= viewportEnd) {
        const x = ((favorite.time - viewportStart) / visibleDuration) * width;
        
        // Marcador de favorito
        ctx.fillStyle = '#fb923c'; // Naranja
        ctx.beginPath();
        ctx.arc(x, height - 15, 4, 0, Math.PI * 2);
        ctx.fill();
        
        // Etiqueta
        ctx.font = '10px Inter, system-ui, sans-serif';
        ctx.fillStyle = '#fef3c7'; // Amarillo claro
        ctx.textAlign = 'center';
        ctx.fillText(favorite.label, x, height - 5);
      }
    });
  }, [waveformData, currentTime, startTrim, endTrim, viewportStart, viewportEnd, duration, pixelsPerSecond, showTrimMarkers, favoritePositions]);

  // Dibujar handle de recorte
  const drawTrimHandle = (ctx: CanvasRenderingContext2D, x: number, height: number, type: 'start' | 'end', color: string) => {
    // Sombra para mejor visibilidad
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 5;
    
    // Línea vertical más gruesa y visible
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
    
    // Handle triangular más grande y visible
    const size = 12;
    ctx.fillStyle = color;
    
    if (type === 'start') {
      // Triángulo más grande para marcar inicio (apuntando a la derecha)
      ctx.beginPath();
      ctx.moveTo(x, height/2);
      ctx.lineTo(x - size, height/2 - size);
      ctx.lineTo(x - size, height/2 + size);
      ctx.closePath();
      ctx.fill();
      
      // Borde del triángulo para mayor visibilidad
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    } else {
      // Triángulo más grande para marcar fin (apuntando a la izquierda)
      ctx.beginPath();
      ctx.moveTo(x, height/2);
      ctx.lineTo(x + size, height/2 - size);
      ctx.lineTo(x + size, height/2 + size);
      ctx.closePath();
      ctx.fill();
      
      // Borde del triángulo para mayor visibilidad
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    
    // Restablecer sombra
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    
    // Indicador de tiempo con fondo más visible
    ctx.font = 'bold 12px Inter, system-ui, sans-serif';
    
    const time = type === 'start' ? startTrim : endTrim;
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    const msecs = Math.floor((time % 1) * 100);
    const timeText = `${mins}:${secs.toString().padStart(2, '0')}.${msecs.toString().padStart(2, '0')}`;
    
    // Fondo para el texto más amplio y visible
    const textWidth = ctx.measureText(timeText).width + 16;
    const textHeight = 22;
    const textY = type === 'start' ? 25 : height - 25;
    
    // Fondo con borde
    ctx.fillStyle = color;
    ctx.fillRect(x - textWidth/2, textY - textHeight/2, textWidth, textHeight);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.strokeRect(x - textWidth/2, textY - textHeight/2, textWidth, textHeight);
    
    // Texto con sombra para mejor legibilidad
    ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
    ctx.shadowBlur = 2;
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(timeText, x, textY);
    
    // Restablecer sombra
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
  };

  // Actualizar canvas cuando cambian las dependencias
  useEffect(() => {
    drawTimeline();
    drawWaveform();
  }, [drawTimeline, drawWaveform]);

  // Manejar zoom con rueda del mouse
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    
    const delta = e.deltaY;
    const zoomFactor = 1.1;
    
    if (delta > 0) {
      // Zoom out
      setZoomLevel(prev => Math.max(0.1, prev / zoomFactor));
    } else {
      // Zoom in
      setZoomLevel(prev => Math.min(50, prev * zoomFactor));
    }
  }, []);

  // Manejar interacción con la forma de onda
  const handleWaveformMouseDown = (e: React.MouseEvent) => {
    if (!waveformRef.current || !duration) return;
    
    const rect = waveformRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const visibleDuration = viewportEnd - viewportStart;
    const clickTime = viewportStart + (x / rect.width) * visibleDuration;
    
    // Detectar si se hizo clic en un handle
    const startX = ((startTrim - viewportStart) / visibleDuration) * rect.width;
    const endX = ((endTrim - viewportStart) / visibleDuration) * rect.width;
    
    // Aumentar el área de detección para facilitar la selección de los manejadores
    const handleDetectionArea = 15; // píxeles
    
    if (Math.abs(x - startX) < handleDetectionArea && startTrim >= viewportStart && startTrim <= viewportEnd) {
      setIsDraggingStart(true);
      // Destacar visualmente que se está arrastrando
      if (waveformRef.current) {
        waveformRef.current.style.cursor = 'col-resize';
      }
    } else if (Math.abs(x - endX) < handleDetectionArea && endTrim >= viewportStart && endTrim <= viewportEnd) {
      setIsDraggingEnd(true);
      // Destacar visualmente que se está arrastrando
      if (waveformRef.current) {
        waveformRef.current.style.cursor = 'col-resize';
      }
    } else if (e.button === 1 || e.shiftKey) {
      // Botón medio o Shift para pan
      setIsPanning(true);
      setPanStartX(e.clientX);
      setPanStartViewport(viewportStart);
      if (waveformRef.current) {
        waveformRef.current.style.cursor = 'grabbing';
      }
    } else if (e.altKey) {
      // Alt + click para añadir favorito
      const label = prompt('Nombre para este marcador:', `Punto ${favoritePositions.length + 1}`);
      if (label) {
        setFavoritePositions([...favoritePositions, { label, time: clickTime }]);
      }
    } else if (e.ctrlKey || e.metaKey) {
      // Ctrl/Cmd + click para establecer inicio o fin según qué mitad de la onda
      if (x < rect.width / 2) {
        // Mitad izquierda - establecer inicio
        setStartTrim(clickTime);
        updateTimeInputs(clickTime, endTrim);
        updateSelectionPreview(clickTime, endTrim);
      } else {
        // Mitad derecha - establecer fin
        setEndTrim(clickTime);
        updateTimeInputs(startTrim, clickTime);
        updateSelectionPreview(startTrim, clickTime);
      }
    } else {
      // Click normal - mover playhead
      if (audioRef.current) {
        audioRef.current.currentTime = clickTime;
        setCurrentTime(clickTime);
      }
    }
  };

  const handleWaveformMouseMove = (e: React.MouseEvent) => {
    if (!waveformRef.current) return;
    
    const rect = waveformRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const visibleDuration = viewportEnd - viewportStart;
    const time = viewportStart + (x / rect.width) * visibleDuration;
    
    if (isDraggingStart) {
      const newStart = Math.max(0, Math.min(endTrim - 0.1, time));
      setStartTrim(newStart);
      updateTimeInputs(newStart, endTrim);
      updateSelectionPreview(newStart, endTrim);
      
      // Actualizar cursor para indicar que se está arrastrando
      if (waveformRef.current) {
        waveformRef.current.style.cursor = 'col-resize';
      }
    } else if (isDraggingEnd) {
      const newEnd = Math.min(duration, Math.max(startTrim + 0.1, time));
      setEndTrim(newEnd);
      updateTimeInputs(startTrim, newEnd);
      updateSelectionPreview(startTrim, newEnd);
      
      // Actualizar cursor para indicar que se está arrastrando
      if (waveformRef.current) {
        waveformRef.current.style.cursor = 'col-resize';
      }
    } else if (isPanning) {
      const deltaX = e.clientX - panStartX;
      const timeDelta = -(deltaX / rect.width) * visibleDuration;
      
      const newStart = Math.max(0, Math.min(duration - (viewportEnd - viewportStart), panStartViewport + timeDelta));
      setViewportStart(newStart);
      setViewportEnd(newStart + visibleDuration);
      
      // Actualizar cursor durante el desplazamiento
      if (waveformRef.current) {
        waveformRef.current.style.cursor = 'grabbing';
      }
    } else {
      // Verificar si el cursor está sobre un marcador
      const startX = ((startTrim - viewportStart) / visibleDuration) * rect.width;
      const endX = ((endTrim - viewportStart) / visibleDuration) * rect.width;
      
      if (Math.abs(x - startX) < 15 || Math.abs(x - endX) < 15) {
        // Cursor sobre un marcador
        if (waveformRef.current) {
          waveformRef.current.style.cursor = 'col-resize';
        }
      } else {
        // Cursor normal
        if (waveformRef.current) {
          waveformRef.current.style.cursor = 'crosshair';
        }
      }
    }
  };

  const handleWaveformMouseUp = () => {
    setIsDraggingStart(false);
    setIsDraggingEnd(false);
    setIsPanning(false);
    
    // Restaurar cursor
    if (waveformRef.current) {
      waveformRef.current.style.cursor = 'crosshair';
    }
  };

  // Funciones para establecer puntos de recorte
  const setStartAtCurrent = () => {
    setStartTrim(currentTime);
    updateTimeInputs(currentTime, endTrim);
    updateSelectionPreview(currentTime, endTrim);
  };
  
  const setEndAtCurrent = () => {
    setEndTrim(currentTime);
    updateTimeInputs(startTrim, currentTime);
    updateSelectionPreview(startTrim, currentTime);
  };

  // Reproducir selección
  const playSelection = () => {
    if (!audioRef.current) return;
    
    audioRef.current.currentTime = startTrim;
    audioRef.current.play()
      .then(() => {
        setIsPlaying(true);
        setIsPlayingSelection(true);
      })
      .catch(err => {
        console.error('Error playing selection:', err);
        setError('Error al reproducir la selección');
      });
  };

  // Controles de reproducción
  const handlePlayPause = () => {
    if (!audioRef.current) return;
    
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
      setIsPlayingSelection(false);
    } else {
      audioRef.current.volume = volume;
      audioRef.current.playbackRate = playbackRate;
      
      // Si está fuera del área seleccionada, mover al inicio de la selección
      if (isPlayingSelection || currentTime < startTrim || currentTime >= endTrim) {
        audioRef.current.currentTime = startTrim;
      }
      
      audioRef.current.play()
        .then(() => {
          setIsPlaying(true);
          setError(null);
        })
        .catch(err => {
          console.error('Play error:', err);
          setError('Error al reproducir');
          setIsPlaying(false);
        });
    }
  };

  // Guardar recorte
  const handleSaveTrim = async () => {
    if (!recording || startTrim >= endTrim) {
      setError('Selección inválida');
      return;
    }
    
    setIsProcessing(true);
    setError(null);
    setSuccess(null);
    
    try {
      const response = await fetch('http://192.168.10.49:3001/api/recordings/trim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          city: recording.city,
          radio: recording.radioName,
          fileName: recording.fileName,
          startTime: startTrim,
          endTime: endTrim
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al recortar');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `${recording.fileName.replace('.mp3', '')}_RECORTE_${formatTimeForInput(startTrim).replace(':', '-').replace('.', '-')}_${formatTimeForInput(endTrim).replace(':', '-').replace('.', '-')}.mp3`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      setTimeout(() => window.URL.revokeObjectURL(url), 100);
      
      setSuccess('¡Audio recortado exitosamente!');
      setTimeout(() => {
        onClose();
      }, 2000);
      
    } catch (err) {
      console.error('Error:', err);
      setError(`Error al procesar el recorte: ${err instanceof Error ? err.message : 'Error desconocido'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Formatear tiempo para display
  const formatTimeDisplay = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  };

  // Crear presets de selección
  const applySelectionPreset = (preset: string) => {
    switch(preset) {
      case 'first30s':
        setStartTrim(0);
        setEndTrim(Math.min(30, duration));
        break;
      case 'first1m':
        setStartTrim(0);
        setEndTrim(Math.min(60, duration));
        break;
      case 'last30s':
        setStartTrim(Math.max(0, duration - 30));
        setEndTrim(duration);
        break;
      case 'last1m':
        setStartTrim(Math.max(0, duration - 60));
        setEndTrim(duration);
        break;
      case 'middle1m':
        const middle = duration / 2;
        setStartTrim(Math.max(0, middle - 30));
        setEndTrim(Math.min(duration, middle + 30));
        break;
      case 'all':
        setStartTrim(0);
        setEndTrim(duration);
        break;
    }
  };

  if (!isOpen || !recording) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-lg shadow-2xl w-full max-w-7xl max-h-[95vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gray-800 p-4 flex items-center justify-between border-b border-gray-700">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <FileAudio className="text-green-400" size={20} />
              <span className="text-white font-medium">{recording.fileName}</span>
            </div>
            <div className="text-gray-400 text-sm">
              {recording.radioName} · {recording.city}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-700 rounded transition-colors"
          >
            <X className="text-gray-400" size={20} />
          </button>
        </div>

      {/* Barra de herramientas superior */}
      <div className="bg-gray-800 px-6 py-3 flex items-center justify-between border-b border-gray-700">
        <div className="flex items-center gap-6">
          {/* Selector de marcador de inicio */}
          <div className="flex items-center gap-2">
            <Bookmark className="text-blue-400" size={18} />
            <label className="text-gray-400 text-sm">Inicio:</label>
            <input
              type="text"
              value={startTimeInput}
              onChange={(e) => handleStartTimeInputChange(e.target.value)}
              className="bg-gray-700 text-white px-3 py-1 rounded w-24 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="00:00.00"
            />
            <button 
              onClick={setStartAtCurrent}
              className="p-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center justify-center"
              title="Establecer inicio en posición actual"
            >
              <ChevronLeft size={16} />
            </button>
          </div>
          
          {/* Separador */}
          <div className="text-gray-600">—</div>
          
          {/* Selector de marcador de fin */}
          <div className="flex items-center gap-2">
            <Bookmark className="text-red-400" size={18} />
            <label className="text-gray-400 text-sm">Fin:</label>
            <input
              type="text"
              value={endTimeInput}
              onChange={(e) => handleEndTimeInputChange(e.target.value)}
              className="bg-gray-700 text-white px-3 py-1 rounded w-24 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-red-500"
              placeholder="00:00.00"
            />
            <button 
              onClick={setEndAtCurrent}
              className="p-1.5 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors flex items-center justify-center"
              title="Establecer fin en posición actual"
            >
              <ChevronRight size={16} />
            </button>
          </div>
          
          {/* Duración de la selección */}
          <div className="flex items-center gap-2 border-l border-gray-600 pl-6">
            <Clock className="text-green-400" size={18} />
            <span className="text-gray-400 text-sm">Duración:</span>
            <span className="text-green-400 font-bold">
              {formatTimeDisplay(endTrim - startTrim)}
            </span>
            {selectionPreview && (
              <span className="text-gray-400 text-xs ml-2">
                ({selectionPreview.size})
              </span>
            )}
          </div>
        </div>
        
        {/* Presets de selección */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <button 
              className="px-3 py-2 bg-gray-700 text-gray-300 rounded hover:bg-gray-600 transition-colors text-sm font-medium"
              onClick={() => document.getElementById('presets-dropdown')?.classList.toggle('hidden')}
            >
              Presets
            </button>
            <div id="presets-dropdown" className="absolute right-0 mt-1 bg-gray-800 rounded-lg shadow-lg border border-gray-700 py-1 z-10 hidden w-40">
              <button 
                onClick={() => applySelectionPreset('first30s')}
                className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-700"
              >
                Primeros 30s
              </button>
              <button 
                onClick={() => applySelectionPreset('first1m')}
                className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-700"
              >
                Primer minuto
              </button>
              <button 
                onClick={() => applySelectionPreset('last30s')}
                className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-700"
              >
                Últimos 30s
              </button>
              <button 
                onClick={() => applySelectionPreset('last1m')}
                className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-700"
              >
                Último minuto
              </button>
              <button 
                onClick={() => applySelectionPreset('middle1m')}
                className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-700"
              >
                Minuto central
              </button>
              <button 
                onClick={() => applySelectionPreset('all')}
                className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-700"
              >
                Audio completo
              </button>
            </div>
          </div>
          
          {/* Botón de reproducir selección */}
          <button
            onClick={playSelection}
            disabled={!audioLoaded || isProcessing}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-sm flex items-center gap-2 disabled:opacity-50 font-medium"
          >
            <Play size={16} />
            Reproducir selección
          </button>
        </div>
      </div>

        {/* Área principal - Forma de onda */}
        <div className="bg-gray-850 p-4">
          {!audioLoaded ? (
            <div className="flex flex-col items-center justify-center h-40 bg-gray-800 rounded-lg">
              <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500 mb-3"></div>
              <p className="text-gray-300 text-sm">Cargando audio... {loadingProgress.toFixed(0)}%</p>
            </div>
          ) : (
            <>
              {/* Timeline */}
              <div ref={containerRef} className="mb-2">
                <canvas 
                  ref={timelineRef}
                  className="w-full"
                  style={{ imageRendering: 'crisp-edges' }}
                />
              </div>
              
              {/* Waveform */}
              <div 
                ref={waveformContainerRef}
                className="relative cursor-crosshair select-none"
                onMouseDown={handleWaveformMouseDown}
                onMouseMove={handleWaveformMouseMove}
                onMouseUp={handleWaveformMouseUp}
                onMouseLeave={handleWaveformMouseUp}
                onWheel={handleWheel}
              >
                <canvas 
                  ref={waveformRef}
                  className="w-full"
                  style={{ imageRendering: 'crisp-edges' }}
                />
                
                {/* Ayuda flotante - Opcional */}
                {showInfo && (
                  <div className="absolute top-2 right-2 bg-gray-800 bg-opacity-80 text-xs text-gray-300 p-2 rounded">
                    <div className="flex items-center gap-1">
                      <span className="font-bold">Click:</span> 
                      <span>Mover cursor</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="font-bold">Shift+arrastrar:</span> 
                      <span>Desplazar vista</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="font-bold">Rueda:</span> 
                      <span>Zoom</span>
                    </div>
                    <button 
                      onClick={() => setShowInfo(false)} 
                      className="absolute top-1 right-1 text-gray-400 hover:text-white"
                    >
                      <X size={10} />
                    </button>
                  </div>
                )}
              </div>

              {/* Controles de zoom */}
              <div className="mt-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setZoomLevel(Math.max(0.1, zoomLevel / 1.5))}
                    className="p-1 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-all"
                    title="Alejar"
                  >
                    <ZoomOut size={18} />
                  </button>
                  <span className="text-gray-400 text-sm w-20 text-center font-mono">
                    {zoomLevel < 1 ? `${Math.round(zoomLevel * 100)}%` : `${zoomLevel.toFixed(1)}x`}
                  </span>
                  <button
                    onClick={() => setZoomLevel(Math.min(50, zoomLevel * 1.5))}
                    className="p-1 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-all"
                    title="Acercar"
                  >
                    <ZoomIn size={18} />
                  </button>
                  
                  {/* Reset zoom */}
                  <button
                    onClick={() => {
                      setZoomLevel(1);
                      setViewportStart(0);
                      setViewportEnd(Math.min(duration, 600));
                    }}
                    className="ml-2 p-1 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-all"
                    title="Restablecer vista"
                  >
                    <Maximize2 size={18} />
                  </button>
                  
                  {/* Separador */}
                  <div className="w-px h-6 bg-gray-700 mx-2"></div>
                  
                  {/* Mostrar/ocultar marcadores */}
                  <button
                    onClick={() => setShowTrimMarkers(!showTrimMarkers)}
                    className={`p-1 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-all ${showTrimMarkers ? 'bg-gray-700' : ''}`}
                    title={showTrimMarkers ? "Ocultar marcadores" : "Mostrar marcadores"}
                  >
                    <Scissors size={18} />
                  </button>
                </div>
                
                {/* Info de vista */}
                <div className="text-gray-500 text-xs">
                  Vista: {formatTimeDisplay(viewportStart)} - {formatTimeDisplay(viewportEnd)}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Controles de reproducción */}
        <div className="bg-gray-800 px-6 py-4 border-t border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* Controles principales */}
              <button
                onClick={handlePlayPause}
                disabled={!audioLoaded || isProcessing}
                className="p-3 bg-gray-700 hover:bg-gray-600 text-white rounded-full transition-colors disabled:opacity-50"
              >
                {isPlaying ? <Pause size={20} /> : <Play size={20} />}
              </button>
              
              {/* Retroceder */}
              <button
                onClick={() => {
                  if (audioRef.current) {
                    audioRef.current.currentTime = Math.max(0, currentTime - 5);
                  }
                }}
                disabled={!audioLoaded || isProcessing}
                className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-full transition-all disabled:opacity-50"
                title="Retroceder 5s"
              >
                <ChevronsLeft size={18} />
              </button>
              
              {/* Avanzar */}
              <button
                onClick={() => {
                  if (audioRef.current) {
                    audioRef.current.currentTime = Math.min(duration, currentTime + 5);
                  }
                }}
                disabled={!audioLoaded || isProcessing}
                className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-full transition-all disabled:opacity-50"
                title="Adelantar 5s"
              >
                <ChevronsRight size={18} />
              </button>
              
              {/* Ir al inicio */}
              <button
                onClick={() => {
                  if (audioRef.current) {
                    audioRef.current.currentTime = 0;
                    setCurrentTime(0);
                  }
                }}
                disabled={!audioLoaded || isProcessing}
                className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-full transition-all disabled:opacity-50"
                title="Ir al inicio"
              >
                <SkipBack size={18} />
              </button>
              
              {/* Ir al final */}
              <button
                onClick={() => {
                  if (audioRef.current) {
                    audioRef.current.currentTime = duration;
                    setCurrentTime(duration);
                  }
                }}
                disabled={!audioLoaded || isProcessing}
                className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-full transition-all disabled:opacity-50"
                title="Ir al final"
              >
                <SkipForward size={18} />
              </button>
              
              {/* Loop */}
              <button
                onClick={() => setIsLooping(!isLooping)}
                disabled={!audioLoaded || isProcessing}
                className={`p-2 rounded-full transition-all disabled:opacity-50 ${
                  isLooping 
                    ? 'text-green-400 bg-gray-700' 
                    : 'text-gray-400 hover:text-white hover:bg-gray-700'
                }`}
                title="Repetir selección"
              >
                <RefreshCw size={18} />
              </button>
              
              {/* Separador */}
              <div className="w-px h-8 bg-gray-600 mx-2"></div>
              
              {/* Volumen */}
              <div className="flex items-center gap-2">
                <Volume1 className="text-gray-400" size={18} />
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={volume}
                  onChange={(e) => {
                    const vol = parseFloat(e.target.value);
                    setVolume(vol);
                    if (audioRef.current) audioRef.current.volume = vol;
                  }}
                  className="w-24 accent-green-500"
                />
              </div>
              
              {/* Velocidad */}
              <select
                value={playbackRate}
                onChange={(e) => {
                  const rate = parseFloat(e.target.value);
                  setPlaybackRate(rate);
                  if (audioRef.current) audioRef.current.playbackRate = rate;
                }}
                disabled={!audioLoaded || isProcessing}
                className="bg-gray-700 text-white px-2 py-1 rounded text-sm focus:outline-none focus:ring-2 focus:ring-gray-500 disabled:opacity-50"
              >
                <option value="0.5">0.5x</option>
                <option value="0.75">0.75x</option>
                <option value="1">1x</option>
                <option value="1.25">1.25x</option>
                <option value="1.5">1.5x</option>
                <option value="2">2x</option>
              </select>
            </div>
            
            {/* Tiempo actual */}
            <div className="flex items-center gap-2">
              <span className="text-gray-400 text-sm">Posición:</span>
              <span className="text-white font-mono text-sm">
                {formatTimeDisplay(currentTime)} / {formatTimeDisplay(duration)}
              </span>
            </div>
          </div>
        </div>

        {/* Acciones y atajos */}
        <div className="bg-gray-900 px-6 py-3 border-t border-gray-700 flex items-center justify-between">
          <div className="text-xs text-gray-500">
            <strong className="text-gray-400">Atajos: </strong>
            <span>Espacio: Reproducir/Pausar | I: Marcar inicio | O: Marcar fin | L: Loop | ←/→: -5s/+5s</span>
          </div>
          
          {/* Botón de guardar */}
          <button
            onClick={handleSaveTrim}
            disabled={isProcessing || startTrim >= endTrim || !audioLoaded}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isProcessing ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                Procesando...
              </>
            ) : (
              <>
                <Download size={18} />
                Guardar recorte
              </>
            )}
          </button>
        </div>

        {/* Mensajes de estado */}
        {(error || success) && (
          <div className="px-6 pb-4">
            {error && (
              <div className="bg-red-900/50 border border-red-700 rounded p-3 flex items-center gap-2">
                <AlertCircle className="text-red-400" size={18} />
                <span className="text-red-200 text-sm">{error}</span>
              </div>
            )}
            
            {success && (
              <div className="bg-green-900/50 border border-green-700 rounded p-3 flex items-center gap-2">
                <Check className="text-green-400" size={18} />
                <span className="text-green-200 text-sm">{success}</span>
              </div>
            )}
          </div>
        )}

        {/* Ayuda flotante */}
        {!showInfo && (
          <button 
            onClick={() => setShowInfo(true)}
            className="absolute bottom-4 right-4 p-2 bg-gray-800 rounded-full text-gray-400 hover:text-white"
            title="Mostrar ayuda"
          >
            <Info size={18} />
          </button>
        )}
      </div>
    </div>
  );
};

export default AudioTrimmer;