import React, { useRef, useState, useEffect } from 'react';
import { X, Play, Pause, Download, Scissors } from 'lucide-react';

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
  // Essential states
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [startTrim, setStartTrim] = useState(0);
  const [endTrim, setEndTrim] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [audioLoaded, setAudioLoaded] = useState(false);
  
  // Input states for direct time entry
  const [startTimeInput, setStartTimeInput] = useState('00:00.00');
  const [endTimeInput, setEndTimeInput] = useState('00:00.00');
  
  // Refs
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Format time for display
  const formatTimeDisplay = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  };

  // Format time for inputs
  const formatTimeForInput = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  };

  // Parse time from input
  const parseTimeFromInput = (input: string): number | null => {
    const match = input.match(/^(\d{1,2}):(\d{2})\.?(\d{0,2})$/);
    if (!match) return null;
    
    const mins = parseInt(match[1], 10);
    const secs = parseInt(match[2], 10);
    const ms = parseInt(match[3] || '0', 10);
    
    if (secs >= 60) return null;
    
    return mins * 60 + secs + ms / 100;
  };

  // Update time inputs
  const updateTimeInputs = (start: number, end: number) => {
    setStartTimeInput(formatTimeForInput(start));
    setEndTimeInput(formatTimeForInput(end));
  };

  // Initialize audio and trim points
  useEffect(() => {
    if (!isOpen || !recording) return;
    
    setCurrentTime(0);
    setStartTrim(0);
    setError(null);
    setSuccess(null);
    setAudioLoaded(false);
    
    // Create audio element
    const audio = new Audio();
    audioRef.current = audio;
    
    // Configure URL of the audio
    audio.src = recording.url;
    audio.preload = 'metadata';
    
    // Set up event listeners
    audio.addEventListener('loadedmetadata', () => {
      console.log('Audio metadata loaded, duration:', audio.duration);
      setDuration(audio.duration);
      setEndTrim(audio.duration);
      updateTimeInputs(0, audio.duration);
    });
    
    audio.addEventListener('canplaythrough', () => {
      console.log('Audio can play through');
      setAudioLoaded(true);
    });
    
    audio.addEventListener('timeupdate', () => {
      setCurrentTime(audio.currentTime);
    });
    
    audio.addEventListener('ended', () => {
      setIsPlaying(false);
    });
    
    audio.addEventListener('error', (e) => {
      console.error('Audio load error:', e);
      setError('Error al cargar el audio. Intente nuevamente.');
      setAudioLoaded(false);
    });
    
    // Cleanup on unmount
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
        audioRef.current.removeAttribute('src');
        audioRef.current = null;
      }
    };
  }, [isOpen, recording]);

  // Handle start time input change
  const handleStartTimeInputChange = (value: string) => {
    setStartTimeInput(value);
    const time = parseTimeFromInput(value);
    if (time !== null && time >= 0 && time < endTrim) {
      setStartTrim(time);
    }
  };

  // Handle end time input change
  const handleEndTimeInputChange = (value: string) => {
    setEndTimeInput(value);
    const time = parseTimeFromInput(value);
    if (time !== null && time > startTrim && time <= duration) {
      setEndTrim(time);
    }
  };
  
  // Set start trim to current time
  const setStartAtCurrent = () => {
    setStartTrim(currentTime);
    updateTimeInputs(currentTime, endTrim);
  };
  
  // Set end trim to current time
  const setEndAtCurrent = () => {
    setEndTrim(currentTime);
    updateTimeInputs(startTrim, currentTime);
  };

  // Play/pause audio
  const handlePlayPause = () => {
    if (!audioRef.current) return;
    
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      // If outside the trim area, move to the start trim position
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
  
  // Save trimmed audio
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

  // Handle timeline click
  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || !audioLoaded) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = clickX / rect.width;
    const clickTime = percentage * duration;
    
    audioRef.current.currentTime = clickTime;
    setCurrentTime(clickTime);
  };

  if (!isOpen || !recording) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-lg shadow-2xl w-full max-w-3xl max-h-[95vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gray-800 p-4 flex items-center justify-between border-b border-gray-700">
          <h2 className="text-white font-medium">{recording.fileName}</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-700 rounded transition-colors"
          >
            <X className="text-gray-400" size={20} />
          </button>
        </div>

        {/* Main content */}
        <div className="p-6">
          {/* Time controls */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              {/* Start trim */}
              <div>
                <label className="block text-gray-400 text-sm mb-1">Inicio:</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={startTimeInput}
                    onChange={(e) => handleStartTimeInputChange(e.target.value)}
                    className="bg-gray-800 text-white px-3 py-2 rounded w-24 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button 
                    onClick={setStartAtCurrent}
                    className="p-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                    title="Establecer inicio en posición actual"
                  >
                    Marcar
                  </button>
                </div>
              </div>
              
              {/* End trim */}
              <div>
                <label className="block text-gray-400 text-sm mb-1">Fin:</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={endTimeInput}
                    onChange={(e) => handleEndTimeInputChange(e.target.value)}
                    className="bg-gray-800 text-white px-3 py-2 rounded w-24 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                  <button 
                    onClick={setEndAtCurrent}
                    className="p-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                    title="Establecer fin en posición actual"
                  >
                    Marcar
                  </button>
                </div>
              </div>
            </div>
            
            <div>
              <span className="text-gray-400 text-sm">Duración:</span>
              <span className="text-green-400 font-bold ml-2">
                {formatTimeDisplay(endTrim - startTrim)}
              </span>
            </div>
          </div>
          
          {/* Audio timeline */}
          <div 
            className="h-24 bg-gray-800 rounded-lg mb-6 overflow-hidden cursor-pointer relative"
            onClick={handleTimelineClick}
          >
            {/* Simple visualization */}
            <div className="absolute inset-0 flex items-center">
              <div className="w-full h-1/2 bg-gray-700">
                {/* Audio progress bar */}
                <div 
                  className="h-full bg-blue-600"
                  style={{ width: `${(currentTime / duration) * 100}%` }}
                ></div>
              </div>
            </div>
            
            {/* Start trim marker */}
            <div 
              className="absolute top-0 bottom-0 w-1 bg-blue-500"
              style={{ left: `${(startTrim / duration) * 100}%` }}
            >
              <div className="w-3 h-3 bg-blue-500 rounded-full -ml-1.5 -mt-1"></div>
            </div>
            
            {/* End trim marker */}
            <div 
              className="absolute top-0 bottom-0 w-1 bg-red-500"
              style={{ left: `${(endTrim / duration) * 100}%` }}
            >
              <div className="w-3 h-3 bg-red-500 rounded-full -ml-1.5 -mt-1"></div>
            </div>
            
            {/* Current position */}
            <div 
              className="absolute top-0 bottom-0 w-0.5 bg-yellow-400"
              style={{ left: `${(currentTime / duration) * 100}%` }}
            >
              <div className="w-3 h-3 bg-yellow-400 rounded-full -ml-1.5 -mt-1"></div>
            </div>
            
            {/* Selected area */}
            <div 
              className="absolute top-0 bottom-0 bg-green-500 opacity-20"
              style={{ 
                left: `${(startTrim / duration) * 100}%`,
                width: `${((endTrim - startTrim) / duration) * 100}%`
              }}
            ></div>
          </div>

          {/* Playback controls */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={handlePlayPause}
                disabled={!audioLoaded || isProcessing}
                className="p-3 bg-gray-700 hover:bg-gray-600 text-white rounded-full transition-colors disabled:opacity-50"
              >
                {isPlaying ? <Pause size={20} /> : <Play size={20} />}
              </button>
              
              <span className="text-white font-mono">
                {formatTimeDisplay(currentTime)} / {formatTimeDisplay(duration)}
              </span>
            </div>
            
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
          
          {/* Instructions */}
          <div className="mt-6 p-4 bg-gray-800 rounded-lg">
            <h3 className="text-white font-medium flex items-center gap-2 mb-2">
              <Scissors size={16} />
              Instrucciones:
            </h3>
            <ol className="text-gray-300 text-sm space-y-1 list-decimal pl-5">
              <li>Haz clic en la línea de tiempo para posicionar el cursor</li>
              <li>Usa los botones "Marcar" para establecer los puntos de inicio y fin</li>
              <li>También puedes ingresar los tiempos manualmente (formato: mm:ss.ms)</li>
              <li>Presiona el botón "Guardar recorte" para descargar el audio recortado</li>
            </ol>
          </div>
          
          {/* Messages */}
          {error && (
            <div className="mt-4 bg-red-900/50 border border-red-700 rounded p-3 flex items-center gap-2">
              <span className="text-red-200 text-sm">{error}</span>
            </div>
          )}
          
          {success && (
            <div className="mt-4 bg-green-900/50 border border-green-700 rounded p-3 flex items-center gap-2">
              <span className="text-green-200 text-sm">{success}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AudioTrimmer;