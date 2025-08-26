import React, { useRef, useState, useEffect, useCallback } from 'react';
import { 
  X, Play, Pause, Save, RotateCcw, Volume2, 
  SkipBack, SkipForward, ChevronLeft, ChevronRight,
  Scissors, Download, ZoomIn, ZoomOut, Maximize2,
  AlertCircle, Check, Clock, FileAudio
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

const AudioTrimmer = ({ isOpen, onClose, recording }) => {
  // Estados principales
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [startTrim, setStartTrim] = useState(0);
  const [endTrim, setEndTrim] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [waveformData, setWaveformData] = useState([]);
  
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
  const [volume, setVolume] = useState(1);
  const [isLooping, setIsLooping] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  
  // Estados para inputs de tiempo
  const [startTimeInput, setStartTimeInput] = useState('00:00.00');
  const [endTimeInput, setEndTimeInput] = useState('00:00.00');
  
  // Refs
  const audioRef = useRef(null);
  const waveformRef = useRef(null);
  const timelineRef = useRef(null);
  const containerRef = useRef(null);
  const animationRef = useRef(0);

  // Generar forma de onda detallada
  const generateWaveform = useCallback((audioDuration = 1800) => {
    const sampleCount = Math.round(200 * Math.max(1, zoomLevel));
    const mockData = [];
    
    for (let i = 0; i < sampleCount; i++) {
      const position = i / sampleCount;
      
      // Simular patrones de audio realistas
      let amplitude = 0.4 + Math.random() * 0.3;
      
      // Variaciones por sección
      if (position < 0.05 || position > 0.95) amplitude *= 0.5; // Intro/outro
      if (position > 0.4 && position < 0.6) amplitude *= 1.3; // Sección central
      
      // Añadir variación sinusoidal
      amplitude += Math.sin(i * 0.1) * 0.05 + Math.cos(i * 0.07) * 0.03;
      amplitude = Math.max(0.1, Math.min(1, amplitude));
      
      mockData.push(amplitude);
    }
    
    setWaveformData(mockData);
    if (audioDuration) {
      setDuration(audioDuration);
      setEndTrim(audioDuration);
      setViewportEnd(Math.min(audioDuration, 600));
      updateTimeInputs(0, audioDuration);
    }
  }, [zoomLevel]);

  // Formatear tiempo para inputs
  const formatTimeForInput = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  };

  // Parsear tiempo desde input
  const parseTimeFromInput = (input) => {
    const match = input.match(/^(\d{1,2}):(\d{2})\.?(\d{0,2})$/);
    if (!match) return null;
    
    const mins = parseInt(match[1], 10);
    const secs = parseInt(match[2], 10);
    const ms = parseInt(match[3] || '0', 10);
    
    if (secs >= 60) return null;
    
    return mins * 60 + secs + ms / 100;
  };

  // Actualizar inputs de tiempo
  const updateTimeInputs = (start, end) => {
    setStartTimeInput(formatTimeForInput(start));
    setEndTimeInput(formatTimeForInput(end));
  };

  // Manejar cambio en input de tiempo de inicio
  const handleStartTimeInputChange = (value) => {
    setStartTimeInput(value);
    const time = parseTimeFromInput(value);
    if (time !== null && time >= 0 && time < endTrim) {
      setStartTrim(time);
    }
  };

  // Manejar cambio en input de tiempo de fin
  const handleEndTimeInputChange = (value) => {
    setEndTimeInput(value);
    const time = parseTimeFromInput(value);
    if (time !== null && time > startTrim && time <= duration) {
      setEndTrim(time);
    }
  };

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
    const baseUrl = 'http://192.168.10.49:3001';
    const cleanRadio = recording.radioName.replace(/\s+/g, '');
    const encodedCity = encodeURIComponent(recording.city);
    const encodedRadio = encodeURIComponent(cleanRadio);
    const encodedFileName = encodeURIComponent(recording.fileName);
    const audioUrl = `${baseUrl}/audio/${encodedCity}/${encodedRadio}/${encodedFileName}`;
    
    console.log('Loading audio:', audioUrl);
    
    audio.src = audioUrl;
    audio.preload = 'metadata';
    audioRef.current = audio;

    audio.addEventListener('loadedmetadata', () => {
      console.log('Audio loaded, duration:', audio.duration);
      setDuration(audio.duration);
      setEndTrim(audio.duration);
      setAudioLoaded(true);
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
      
      if (isLooping && audio.currentTime >= endTrim) {
        audio.currentTime = startTrim;
      }
    });

    audio.addEventListener('ended', () => {
      if (!isLooping) {
        setIsPlaying(false);
      }
    });

    audio.addEventListener('error', (e) => {
      console.error('Audio load error:', e);
      setError('Error al cargar el audio');
      setAudioLoaded(false);
    });

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
    };
  }, [isOpen, recording, isLooping, endTrim, startTrim, duration]);

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
    
    ctx.clearRect(0, 0, width, height);
    
    // Fondo
    ctx.fillStyle = '#1e293b';
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
    ctx.strokeStyle = '#475569';
    ctx.fillStyle = '#94a3b8';
    ctx.font = '11px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    
    const firstMarker = Math.ceil(viewportStart / timeInterval) * timeInterval;
    
    for (let time = firstMarker; time <= viewportEnd; time += timeInterval) {
      const x = ((time - viewportStart) / visibleDuration) * width;
      
      // Línea vertical
      const isMajor = time % 60 === 0;
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
        const label = secs === 0 ? 
          `${mins.toString().padStart(2, '0')}:00` : 
          `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        
        ctx.fillStyle = '#e2e8f0';
        ctx.fillText(label, x, height - 15);
      }
    }
  }, [viewportStart, viewportEnd, zoomLevel]);

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
    
    ctx.clearRect(0, 0, width, height);
    
    // Fondo oscuro
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, width, height);
    
    // Línea central
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, centerY);
    ctx.lineTo(width, centerY);
    ctx.stroke();
    
    const visibleDuration = viewportEnd - viewportStart;
    
    // Área de selección
    if (duration > 0) {
      const startX = Math.max(0, ((startTrim - viewportStart) / visibleDuration) * width);
      const endX = Math.min(width, ((endTrim - viewportStart) / visibleDuration) * width);
      
      // Fondo de selección
      ctx.fillStyle = 'rgba(34, 197, 94, 0.2)';
      ctx.fillRect(startX, 0, endX - startX, height);
    }
    
    // Dibujar forma de onda
    const samplesPerPixel = Math.ceil(waveformData.length / (duration * pixelsPerSecond));
    
    ctx.strokeStyle = '#22c55e';
    ctx.fillStyle = '#22c55e';
    
    for (let x = 0; x < width; x++) {
      const time = viewportStart + (x / width) * visibleDuration;
      const sampleIndex = Math.floor((time / duration) * waveformData.length);
      
      if (sampleIndex < waveformData.length) {
        const amplitude = waveformData[sampleIndex] || 0;
        const barHeight = amplitude * (height * 0.8);
        
        const isInSelection = time >= startTrim && time <= endTrim;
        
        ctx.fillStyle = isInSelection ? '#22c55e' : '#475569';
        
        // Dibujar barra superior e inferior (estilo espejo)
        ctx.fillRect(x, centerY - barHeight/2, 1, barHeight/2);
        ctx.fillRect(x, centerY, 1, barHeight/2);
      }
    }
    
    // Marcadores de recorte
    if (startTrim >= viewportStart && startTrim <= viewportEnd) {
      const startX = ((startTrim - viewportStart) / visibleDuration) * width;
      drawTrimHandle(ctx, startX, height, 'start', '#3b82f6');
    }
    
    if (endTrim >= viewportStart && endTrim <= viewportEnd) {
      const endX = ((endTrim - viewportStart) / visibleDuration) * width;
      drawTrimHandle(ctx, endX, height, 'end', '#3b82f6');
    }
    
    // Línea de reproducción
    if (currentTime >= viewportStart && currentTime <= viewportEnd) {
      const playheadX = ((currentTime - viewportStart) / visibleDuration) * width;
      
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(playheadX, 0);
      ctx.lineTo(playheadX, height);
      ctx.stroke();
    }
  }, [waveformData, currentTime, startTrim, endTrim, viewportStart, viewportEnd, duration, pixelsPerSecond]);

  // Dibujar handle de recorte
  const drawTrimHandle = (ctx, x, height, type, color) => {
    // Línea vertical
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
    
    // Handle triangular
    const size = 8;
    ctx.fillStyle = color;
    ctx.beginPath();
    
    if (type === 'start') {
      ctx.moveTo(x, 0);
      ctx.lineTo(x + size, 0);
      ctx.lineTo(x + size, size);
      ctx.lineTo(x, size * 2);
    } else {
      ctx.moveTo(x, 0);
      ctx.lineTo(x - size, 0);
      ctx.lineTo(x - size, size);
      ctx.lineTo(x, size * 2);
    }
    
    ctx.closePath();
    ctx.fill();
  };

  // Actualizar canvas cuando cambian las dependencias
  useEffect(() => {
    drawTimeline();
    drawWaveform();
  }, [drawTimeline, drawWaveform]);

  // Manejar zoom con rueda del mouse (directo, sin Ctrl)
  const handleWheel = useCallback((e) => {
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
  const handleWaveformMouseDown = (e) => {
    if (!waveformRef.current || !duration) return;
    
    const rect = waveformRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const visibleDuration = viewportEnd - viewportStart;
    const clickTime = viewportStart + (x / rect.width) * visibleDuration;
    
    // Detectar si se hizo clic en un handle
    const startX = ((startTrim - viewportStart) / visibleDuration) * rect.width;
    const endX = ((endTrim - viewportStart) / visibleDuration) * rect.width;
    
    if (Math.abs(x - startX) < 10 && startTrim >= viewportStart && startTrim <= viewportEnd) {
      setIsDraggingStart(true);
    } else if (Math.abs(x - endX) < 10 && endTrim >= viewportStart && endTrim <= viewportEnd) {
      setIsDraggingEnd(true);
    } else if (e.button === 1 || e.shiftKey) {
      // Botón medio o Shift para pan
      setIsPanning(true);
      setPanStartX(e.clientX);
      setPanStartViewport(viewportStart);
    } else {
      // Click normal - mover playhead
      if (audioRef.current) {
        audioRef.current.currentTime = clickTime;
        setCurrentTime(clickTime);
      }
    }
  };

  const handleWaveformMouseMove = (e) => {
    if (!waveformRef.current) return;
    
    const rect = waveformRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const visibleDuration = viewportEnd - viewportStart;
    const time = viewportStart + (x / rect.width) * visibleDuration;
    
    if (isDraggingStart) {
      setStartTrim(Math.max(0, Math.min(endTrim - 0.1, time)));
      updateTimeInputs(Math.max(0, Math.min(endTrim - 0.1, time)), endTrim);
    } else if (isDraggingEnd) {
      setEndTrim(Math.min(duration, Math.max(startTrim + 0.1, time)));
      updateTimeInputs(startTrim, Math.min(duration, Math.max(startTrim + 0.1, time)));
    } else if (isPanning) {
      const deltaX = e.clientX - panStartX;
      const timeDelta = -(deltaX / rect.width) * visibleDuration;
      
      const newStart = Math.max(0, Math.min(duration - visibleDuration, panStartViewport + timeDelta));
      setViewportStart(newStart);
      setViewportEnd(newStart + visibleDuration);
    }
  };

  const handleWaveformMouseUp = () => {
    setIsDraggingStart(false);
    setIsDraggingEnd(false);
    setIsPanning(false);
  };

  // Controles de reproducción
  const handlePlayPause = () => {
    if (!audioRef.current) return;
    
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.volume = volume;
      audioRef.current.playbackRate = playbackRate;
      
      if (currentTime < startTrim || currentTime >= endTrim) {
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
      
      if (!response.ok) throw new Error('Error al recortar');
      
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
      setTimeout(onClose, 2000);
      
    } catch (err) {
      console.error('Error:', err);
      setError('Error al procesar el recorte');
    } finally {
      setIsProcessing(false);
    }
  };

  // Formatear tiempo para display
  const formatTimeDisplay = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
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

        {/* Barra de tiempo de recorte */}
        <div className="bg-gray-800 px-6 py-3 flex items-center justify-between border-b border-gray-700">
          <div className="flex items-center gap-6">
            {/* Input de tiempo de inicio */}
            <div className="flex items-center gap-2">
              <Scissors className="text-blue-400" size={18} />
              <label className="text-gray-400 text-sm">Inicio:</label>
              <input
                type="text"
                value={startTimeInput}
                onChange={(e) => handleStartTimeInputChange(e.target.value)}
                className="bg-gray-700 text-white px-3 py-1 rounded w-24 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="00:00.00"
              />
            </div>
            
            {/* Separador */}
            <div className="text-gray-600">—</div>
            
            {/* Input de tiempo de fin */}
            <div className="flex items-center gap-2">
              <Scissors className="text-red-400" size={18} />
              <label className="text-gray-400 text-sm">Fin:</label>
              <input
                type="text"
                value={endTimeInput}
                onChange={(e) => handleEndTimeInputChange(e.target.value)}
                className="bg-gray-700 text-white px-3 py-1 rounded w-24 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-red-500"
                placeholder="00:00.00"
              />
            </div>
            
            {/* Duración de la selección */}
            <div className="flex items-center gap-2 border-l border-gray-600 pl-6">
              <Clock className="text-green-400" size={18} />
              <span className="text-gray-400 text-sm">Duración:</span>
              <span className="text-green-400 font-bold">
                {formatTimeDisplay(endTrim - startTrim)}
              </span>
            </div>
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

        {/* Área principal */}
        <div className="bg-gray-850 p-4">
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
            </div>
            
            {/* Info de vista */}
            <div className="text-gray-500 text-xs">
              Vista: {formatTimeDisplay(viewportStart)} - {formatTimeDisplay(viewportEnd)}
            </div>
          </div>
        </div>

        {/* Controles de reproducción */}
        <div className="bg-gray-800 px-6 py-4 border-t border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* Controles principales */}
              <button
                onClick={handlePlayPause}
                disabled={!audioLoaded}
                className="p-3 bg-gray-700 hover:bg-gray-600 text-white rounded-full transition-colors disabled:opacity-50"
              >
                {isPlaying ? <Pause size={20} /> : <Play size={20} />}
              </button>
              
              <button
                onClick={() => {
                  if (audioRef.current) {
                    audioRef.current.currentTime = Math.max(0, currentTime - 5);
                  }
                }}
                className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-full transition-all"
                title="Retroceder 5s"
              >
                <ChevronLeft size={18} />
              </button>
              
              <button
                onClick={() => {
                  if (audioRef.current) {
                    audioRef.current.currentTime = Math.min(duration, currentTime + 5);
                  }
                }}
                className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-full transition-all"
                title="Adelantar 5s"
              >
                <ChevronRight size={18} />
              </button>
              
              <button
                onClick={() => {
                  if (audioRef.current) {
                    audioRef.current.currentTime = 0;
                    setCurrentTime(0);
                  }
                }}
                className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-full transition-all"
                title="Ir al inicio"
              >
                <SkipBack size={18} />
              </button>
              
              <button
                onClick={() => {
                  if (audioRef.current) {
                    audioRef.current.currentTime = duration;
                    setCurrentTime(duration);
                  }
                }}
                className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-full transition-all"
                title="Ir al final"
              >
                <SkipForward size={18} />
              </button>
              
              {/* Loop */}
              <button
                onClick={() => setIsLooping(!isLooping)}
                className={`p-2 rounded-full transition-all ${
                  isLooping 
                    ? 'text-green-400 bg-gray-700' 
                    : 'text-gray-400 hover:text-white hover:bg-gray-700'
                }`}
                title="Repetir selección"
              >
                <RotateCcw size={18} />
              </button>
              
              {/* Separador */}
              <div className="w-px h-8 bg-gray-600 mx-2" />
              
              {/* Volumen */}
              <div className="flex items-center gap-2">
                <Volume2 className="text-gray-400" size={18} />
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
                className="bg-gray-700 text-white px-2 py-1 rounded text-sm focus:outline-none focus:ring-2 focus:ring-gray-500"
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
      </div>
    </div>
  );
};

export default AudioTrimmer;