import React, { useRef, useState, useEffect } from 'react';
import { X, Download, Scissors, Play, Pause, Save, RotateCcw, Check } from 'lucide-react';
import { Recording } from '../types';

interface AudioTrimmerProps {
  isOpen: boolean;
  onClose: () => void;
  recording: Recording | null;
}

const AudioTrimmer: React.FC<AudioTrimmerProps> = ({ isOpen, onClose, recording }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [startTrim, setStartTrim] = useState(0);
  const [endTrim, setEndTrim] = useState(0);
  const [isTrimming, setIsTrimming] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [waveformData, setWaveformData] = useState<number[]>([]);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const waveformRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const animationRef = useRef<number>(0);

  // Inicializar la forma de onda y la duración incluso si hay errores
  useEffect(() => {
    if (!isOpen || !recording) return;
    
    // Generar la forma de onda por defecto inmediatamente, incluso antes de cargar el audio
    // Esto asegura que tengamos una interfaz visual incluso si el audio falla
    generateMockWaveform();
    
    // Intentar obtener la duración del archivo desde la información del recording
    // Formato esperado: "30:00" (minutos:segundos)
    if (recording.duration) {
      try {
        const [minutes, seconds] = recording.duration.split(':').map(Number);
        const durationInSeconds = minutes * 60 + seconds;
        if (!isNaN(durationInSeconds) && durationInSeconds > 0) {
          setDuration(durationInSeconds);
          setEndTrim(durationInSeconds);
          generateMockWaveform(durationInSeconds);
        }
      } catch (err) {
        console.error('Error al parsear duración:', err);
      }
    }
  }, [isOpen, recording]);

  useEffect(() => {
    if (!isOpen || !recording) return;

    // Crear un nuevo elemento de audio
    const audio = new Audio();
    
    // Construir la URL correctamente
    const baseUrl = 'http://192.168.10.49:3001';
    const cleanRadio = recording.radioName.replace(/\s+/g, '');
    const encodedCity = encodeURIComponent(recording.city);
    const encodedRadio = encodeURIComponent(cleanRadio);
    const encodedFileName = encodeURIComponent(recording.fileName);
    const audioUrl = `${baseUrl}/audio/${encodedCity}/${encodedRadio}/${encodedFileName}`;
    
    console.log('URL de audio:', audioUrl);
    
    audio.src = audioUrl;
    audioRef.current = audio;

    // Escuchar eventos de audio
    audio.addEventListener('loadedmetadata', () => {
      console.log('Audio cargado, duración:', audio.duration);
      setDuration(audio.duration);
      setEndTrim(audio.duration);
      generateMockWaveform(audio.duration);
    });

    audio.addEventListener('timeupdate', () => {
      setCurrentTime(audio.currentTime);
    });

    audio.addEventListener('ended', () => {
      setIsPlaying(false);
      cancelAnimationFrame(animationRef.current);
    });

    audio.addEventListener('error', (e) => {
      console.error('Error al cargar el audio:', e);
      setError('Error al cargar el audio');
      setIsPlaying(false);
    });

    // Limpiar al cerrar
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
      cancelAnimationFrame(animationRef.current);
    };
  }, [isOpen, recording]);

  // Generar datos de forma de onda simulados
  const generateMockWaveform = (audioDuration: number = 1800) => {
    const sampleCount = 100; // Número de muestras para la visualización
    const mockData: number[] = [];
    
    for (let i = 0; i < sampleCount; i++) {
      // Generar valores de amplitud entre 0.1 y 1.0
      // Con una forma que simula una onda de audio real (más alta en el medio)
      const position = i / sampleCount;
      const centeredness = 1 - Math.abs(position - 0.5) * 2; // 1 en el centro, 0 en los extremos
      
      // Añadir algo de aleatoriedad para que parezca una forma de onda real
      const randomFactor = Math.random() * 0.4 + 0.3;
      const amplitude = (randomFactor + centeredness * 0.3) * 0.8;
      
      mockData.push(amplitude);
    }
    
    setWaveformData(mockData);
    setDuration(audioDuration || 1800); // 30 minutos por defecto si no hay duración
    setEndTrim(audioDuration || 1800);
    drawWaveform(mockData);
  };

  // Dibujar la forma de onda en el canvas
  const drawWaveform = (data: number[]) => {
    if (!waveformRef.current || !containerRef.current) return;
    
    const canvas = waveformRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Ajustar el tamaño del canvas al contenedor
    canvas.width = containerRef.current.clientWidth;
    canvas.height = 80;
    
    const width = canvas.width;
    const height = canvas.height;
    
    // Limpiar el canvas
    ctx.clearRect(0, 0, width, height);
    
    // Dibujar la forma de onda
    const barWidth = width / data.length;
    const barGap = Math.max(1, barWidth * 0.2);
    const actualBarWidth = barWidth - barGap;
    
    ctx.fillStyle = '#e2e8f0'; // Color para la región fuera del recorte
    
    // Dibujar todo el audio primero
    for (let i = 0; i < data.length; i++) {
      const x = i * barWidth;
      const barHeight = data[i] * height * 0.8;
      
      // Dibujar barra de waveform
      ctx.fillRect(
        x + barGap/2, 
        (height - barHeight) / 2, 
        actualBarWidth, 
        barHeight
      );
    }
    
    // Dibujar la región seleccionada
    if (duration > 0) {
      // Convertir tiempo a posición en el canvas
      const startPos = (startTrim / duration) * width;
      const endPos = (endTrim / duration) * width;
      
      // Dibujar la región seleccionada
      ctx.fillStyle = '#3b82f6'; // Color para la región seleccionada
      
      for (let i = 0; i < data.length; i++) {
        const x = i * barWidth;
        
        // Solo dibujar si está dentro del rango seleccionado
        if (x >= startPos && x <= endPos) {
          const barHeight = data[i] * height * 0.8;
          
          ctx.fillRect(
            x + barGap/2, 
            (height - barHeight) / 2, 
            actualBarWidth, 
            barHeight
          );
        }
      }
      
      // Dibujar marcadores de inicio y fin
      ctx.fillStyle = '#1e40af';
      ctx.fillRect(startPos, 0, 2, height);
      ctx.fillRect(endPos, 0, 2, height);
      
      // Dibujar la posición actual de reproducción
      if (isPlaying && audioRef.current) {
        const playheadPos = (currentTime / duration) * width;
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(playheadPos, 0, 2, height);
      }
    }
  };

  // Redibujar la forma de onda cuando cambian los tiempos
  useEffect(() => {
    if (waveformData.length > 0) {
      drawWaveform(waveformData);
    }
  }, [startTrim, endTrim, currentTime, isPlaying]);

  // Manejar la reproducción
  const handlePlayPause = () => {
    if (!audioRef.current) {
      setError('No se pudo inicializar el reproductor de audio');
      return;
    }
    
    try {
      if (isPlaying) {
        audioRef.current.pause();
        cancelAnimationFrame(animationRef.current);
        setIsPlaying(false);
      } else {
        // Si estamos fuera del rango seleccionado, reiniciar al inicio del recorte
        if (currentTime < startTrim || currentTime > endTrim) {
          audioRef.current.currentTime = startTrim;
        }
        
        // Intenta reproducir y captura cualquier error
        audioRef.current.play()
          .then(() => {
            setIsPlaying(true);
            
            // Actualizar la animación
            const animate = () => {
              if (audioRef.current) {
                setCurrentTime(audioRef.current.currentTime);
                
                // Pausar si salimos del rango de recorte
                if (audioRef.current.currentTime >= endTrim) {
                  audioRef.current.pause();
                  setIsPlaying(false);
                  return;
                }
              }
              animationRef.current = requestAnimationFrame(animate);
            };
            
            animate();
          })
          .catch(err => {
            console.error('Error al iniciar reproducción:', err);
            setError('No se puede reproducir el audio. ' + err.message);
            setIsPlaying(false);
          });
      }
    } catch (err) {
      console.error('Error en handlePlayPause:', err);
      setError('Error al controlar la reproducción: ' + (err instanceof Error ? err.message : 'Error desconocido'));
      setIsPlaying(false);
    }
  };

  // Manejar clics en la forma de onda
  const handleWaveformClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!waveformRef.current || !audioRef.current || duration === 0) return;
    
    const rect = waveformRef.current.getBoundingClientRect();
    const clickPosition = e.clientX - rect.left;
    const clickTime = (clickPosition / rect.width) * duration;
    
    if (isTrimming) {
      // Si estamos recortando, ajustar el final del recorte
      setEndTrim(clickTime);
      setIsTrimming(false);
    } else {
      // Si no estamos recortando, ajustar el inicio del recorte
      setStartTrim(clickTime);
      setEndTrim(duration);
      setIsTrimming(true);
    }
    
    // Actualizar la posición de reproducción
    audioRef.current.currentTime = clickTime;
    setCurrentTime(clickTime);
  };

  // Función para procesar y descargar el audio recortado
  const handleSaveTrim = async () => {
    if (!recording) {
      setError('No hay grabación seleccionada');
      return;
    }
    
    // Validar que los tiempos son válidos
    if (startTrim >= endTrim) {
      setError('El tiempo de inicio debe ser menor que el tiempo final');
      return;
    }
    
    setIsProcessing(true);
    setError(null);
    setSuccess(null);
    
    try {
      console.log('Enviando solicitud de recorte:', {
        city: recording.city,
        radio: recording.radioName,
        fileName: recording.fileName,
        startTime: startTrim,
        endTime: endTrim
      });
      
      // Llamar al endpoint de recorte
      const response = await fetch('http://192.168.10.49:3001/api/recordings/trim', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          city: recording.city,
          radio: recording.radioName,
          fileName: recording.fileName,
          startTime: startTrim,
          endTime: endTrim
        }),
      });
      
      if (!response.ok) {
        let errorMessage = 'Error al recortar el audio';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch (e) {
          // Si no podemos parsear la respuesta como JSON, usamos el mensaje por defecto
        }
        throw new Error(errorMessage);
      }
      
      // Verificar el tipo de contenido de la respuesta
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        // Si la respuesta es JSON, podría ser un error
        const data = await response.json();
        if (!data.success) {
          throw new Error(data.error || 'Error al recortar el audio');
        }
      } else {
        // Si la respuesta es un blob, descargarlo
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        
        // Crear nombre para el archivo recortado
        const originalName = recording.fileName.replace('.mp3', '');
        const startFormatted = formatTime(startTrim);
        const endFormatted = formatTime(endTrim);
        const trimmedFileName = `${originalName}_RECORTE_${startFormatted}-${endFormatted}.mp3`;
        
        // Descargar el archivo
        const link = document.createElement('a');
        link.href = url;
        link.download = trimmedFileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Liberar URL
        setTimeout(() => {
          window.URL.revokeObjectURL(url);
        }, 100);
        
        setSuccess('¡Audio recortado y descargado correctamente!');
      }
    } catch (err) {
      console.error('Error al recortar:', err);
      setError(err instanceof Error ? err.message : 'Error al procesar el recorte');
    } finally {
      setIsProcessing(false);
    }
  };

  // Formatear tiempo en formato mm:ss
  const formatTime = (timeInSeconds: number): string => {
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    return `${minutes.toString().padStart(2, '0')}_${seconds.toString().padStart(2, '0')}`;
  };

  // Formatear tiempo para mostrar
  const formatTimeDisplay = (timeInSeconds: number): string => {
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Resetear selección
  const resetSelection = () => {
    setStartTrim(0);
    setEndTrim(duration);
    setIsTrimming(false);
    
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      setCurrentTime(0);
    }
  };

  if (!isOpen || !recording) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Scissors className="text-blue-600" size={20} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Recortar Audio</h2>
              <p className="text-sm text-gray-600">
                {recording.fileName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Waveform & Controls */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <div className="mb-4" ref={containerRef}>
              <canvas 
                ref={waveformRef} 
                height={80} 
                className="w-full cursor-pointer"
                onClick={handleWaveformClick}
              />
            </div>
            
            {/* Tiempo actual */}
            <div className="flex justify-between text-sm text-gray-600 mb-2">
              <span>{formatTimeDisplay(startTrim)}</span>
              <span>{formatTimeDisplay(currentTime)}</span>
              <span>{formatTimeDisplay(endTrim)}</span>
            </div>
            
            {/* Controles de reproducción */}
            <div className="flex items-center justify-center gap-4">
              <button
                onClick={handlePlayPause}
                disabled={isProcessing}
                className="p-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors"
              >
                {isPlaying ? <Pause size={20} /> : <Play size={20} />}
              </button>
              
              <button
                onClick={resetSelection}
                disabled={isProcessing}
                className="p-2 text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                title="Reiniciar selección"
              >
                <RotateCcw size={20} />
              </button>
            </div>
          </div>

          {/* Instrucciones */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-medium text-blue-800 mb-2">Instrucciones:</h3>
            <ol className="text-sm text-blue-700 list-decimal pl-5 space-y-1">
              <li>Haz clic en la forma de onda para seleccionar el <strong>punto de inicio</strong> del recorte.</li>
              <li>Haz clic nuevamente para seleccionar el <strong>punto final</strong> del recorte.</li>
              <li>Utiliza el botón de reproducción para escuchar la selección.</li>
              <li>Cuando estés satisfecho, haz clic en "Guardar recorte".</li>
            </ol>
          </div>

          {/* Duración seleccionada */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Duración seleccionada:</p>
                <p className="text-lg font-bold text-gray-900">
                  {formatTimeDisplay(endTrim - startTrim)}
                </p>
              </div>
              
              <div>
                <p className="text-sm text-gray-600">Tiempo original:</p>
                <p className="text-lg font-bold text-gray-900">
                  {formatTimeDisplay(duration)}
                </p>
              </div>
            </div>
          </div>

          {/* Mensajes de estado */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center gap-2">
                <div className="p-1 bg-red-100 rounded-full">
                  <X className="text-red-600" size={16} />
                </div>
                <p className="text-red-800">{error}</p>
              </div>
            </div>
          )}

          {success && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center gap-2">
                <div className="p-1 bg-green-100 rounded-full">
                  <Check className="text-green-600" size={16} />
                </div>
                <p className="text-green-800">{success}</p>
              </div>
            </div>
          )}

          {isProcessing && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-600 border-t-transparent"></div>
                <p className="text-blue-800 font-medium">Procesando recorte...</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50">
          <div className="text-sm text-gray-600">
            El audio recortado se descargará como un nuevo archivo
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={isProcessing}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleSaveTrim}
              disabled={isProcessing || startTrim >= endTrim}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isProcessing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                  Procesando...
                </>
              ) : (
                <>
                  <Save size={16} />
                  Guardar recorte
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AudioTrimmer;