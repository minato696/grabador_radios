import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, 
  Pause, 
  Download, 
  Clock, 
  FileAudio, 
  ChevronLeft, 
  ChevronRight,
  Check,
  CheckSquare,
  Square,
  Package,
  X,
  Scissors
} from 'lucide-react';
import { CityType, RadioType, Recording } from '../types';
import { generateMockRecordings } from '../utils/mockData';
import AudioTrimmer from './AudioTrimmer';

interface RecordingsListProps {
  selectedCity: CityType;
  selectedRadio: RadioType;
}

const RecordingsList: React.FC<RecordingsListProps> = ({ 
  selectedCity, 
  selectedRadio 
}) => {
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const recordingsPerPage = 15;
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalSize, setTotalSize] = useState("0 B");
  const [lastUpdate, setLastUpdate] = useState<string>("Hace 0 min");
  
  // Estados para selección múltiple
  const [selectedRecordings, setSelectedRecordings] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState('');
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Estado para el recortador de audio
  const [isTrimmerOpen, setIsTrimmerOpen] = useState(false);
  const [selectedRecordingForTrim, setSelectedRecordingForTrim] = useState<Recording | null>(null);
  
  // Referencias para la reproducción de audio
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioCache = useRef<Map<string, string>>(new Map());
  
  // Función para actualizar solo los tamaños de archivo
  const updateFileSizes = async () => {
    try {
      const response = await fetch(`http://192.168.10.49:3001/api/recordings/${selectedCity}/${selectedRadio}`);
      if (!response.ok) return;
      
      const data = await response.json();
      if (data.success && data.data.length > 0) {
        setRecordings(prevRecordings => {
          // Actualizar tamaños existentes
          const updatedRecordings = prevRecordings.map(recording => {
            const updatedRecording = data.data.find((r: Recording) => r.id === recording.id);
            if (updatedRecording) {
              return { ...recording, fileSize: updatedRecording.fileSize };
            }
            return recording;
          });
          
          // Agregar nuevos archivos si aparecen
          const currentIds = new Set(prevRecordings.map(r => r.id));
          const newRecordings = data.data.filter((r: Recording) => !currentIds.has(r.id));
          
          if (newRecordings.length > 0) {
            return [...newRecordings, ...updatedRecordings];
          }
          
          return updatedRecordings;
        });
        
        // Actualizar tiempo de última actualización
        const latestRecording = data.data[0];
        const timeDiff = new Date().getTime() - new Date(latestRecording.timestamp).getTime();
        const minutesAgo = Math.floor(timeDiff / (1000 * 60));
        setLastUpdate(`Hace ${minutesAgo} min`);
      }
    } catch (err) {
      // Silenciar errores de actualización automática
    }
  };
  
  // Función principal de carga
  const fetchRecordings = async () => {
    setLoading(true);
    try {
      const response = await fetch(`http://192.168.10.49:3001/api/recordings/${selectedCity}/${selectedRadio}`);
      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }
      const data = await response.json();
      if (data.success) {
        if (data.data.length > 0) {
          setRecordings(data.data);
          const latestRecording = data.data[0];
          const timeDiff = new Date().getTime() - new Date(latestRecording.timestamp).getTime();
          const minutesAgo = Math.floor(timeDiff / (1000 * 60));
          setLastUpdate(`Hace ${minutesAgo} min`);
        } else {
          setRecordings(generateMockRecordings(selectedCity, selectedRadio));
        }
      } else {
        throw new Error(data.error || 'Error desconocido');
      }
    } catch (err) {
      console.error('Error:', err);
      setError(err instanceof Error ? err.message : 'Error al cargar grabaciones');
      setRecordings(generateMockRecordings(selectedCity, selectedRadio));
    } finally {
      setLoading(false);
    }
  };
  
  // Función para cargar estadísticas
  const fetchStorageStats = async () => {
    try {
      const response = await fetch('http://192.168.10.49:3001/api/recordings/stats/storage');
      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }
      const data = await response.json();
      if (data.success) {
        setTotalSize(data.data.totalSizeFormatted);
      }
    } catch (err) {
      console.error('Error al cargar estadísticas:', err);
    }
  };
  
  // Effect para carga inicial
  useEffect(() => {
    fetchRecordings();
    fetchStorageStats();
    
    // Limpiar selecciones al cambiar de ciudad/radio
    setSelectedRecordings(new Set());
    setIsSelectionMode(false);
    
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
        audioRef.current = null;
      }
    };
  }, [selectedCity, selectedRadio]);
  
  // Effect para actualización automática (cada 5 segundos)
  useEffect(() => {
    refreshIntervalRef.current = setInterval(() => {
      updateFileSizes();
      fetchStorageStats();
    }, 5000);
    
    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [selectedCity, selectedRadio]);
  
  // Efecto para limpiar recursos de audio al desmontar
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
        audioRef.current = null;
      }
    };
  }, []);
  
  // Calculate pagination
  const totalPages = Math.ceil(recordings.length / recordingsPerPage);
  const startIndex = (currentPage - 1) * recordingsPerPage;
  const endIndex = startIndex + recordingsPerPage;
  const currentRecordings = recordings.slice(startIndex, endIndex);

  // Manejar selección de grabaciones
  const handleSelectRecording = (recordingId: string) => {
    const newSelected = new Set(selectedRecordings);
    if (newSelected.has(recordingId)) {
      newSelected.delete(recordingId);
    } else {
      newSelected.add(recordingId);
    }
    setSelectedRecordings(newSelected);
  };

  // Seleccionar/Deseleccionar todos en la página actual
  const handleSelectAll = () => {
    const allCurrentIds = currentRecordings.map(r => r.id);
    const allSelected = allCurrentIds.every(id => selectedRecordings.has(id));
    
    if (allSelected) {
      const newSelected = new Set(selectedRecordings);
      allCurrentIds.forEach(id => newSelected.delete(id));
      setSelectedRecordings(newSelected);
    } else {
      const newSelected = new Set(selectedRecordings);
      allCurrentIds.forEach(id => newSelected.add(id));
      setSelectedRecordings(newSelected);
    }
  };

  // Verificar si todos los de la página están seleccionados
  const isAllCurrentSelected = () => {
    if (currentRecordings.length === 0) return false;
    return currentRecordings.every(r => selectedRecordings.has(r.id));
  };

  // Verificar si algunos están seleccionados
  const isSomeSelected = () => {
    return currentRecordings.some(r => selectedRecordings.has(r.id)) && !isAllCurrentSelected();
  };

  // NUEVA FUNCIÓN DE REPRODUCCIÓN MEJORADA
  const handlePlayPause = (recording: Recording) => {
    // Si el mismo audio está sonando, lo detenemos
    if (playingId === recording.id) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
      setPlayingId(null);
      return;
    }
    
    // Construimos la URL del audio
    let audioUrl = audioCache.current.get(recording.id);
    
    if (!audioUrl) {
      const baseUrl = 'http://192.168.10.49:3001';
      const cleanRadio = recording.radioName.replace(/\s+/g, '');
      const encodedRadio = encodeURIComponent(cleanRadio);
      const encodedFileName = encodeURIComponent(recording.fileName);
      audioUrl = `${baseUrl}/audio/${recording.city}/${encodedRadio}/${encodedFileName}`;
      audioCache.current.set(recording.id, audioUrl);
    }
    
    // Si había un audio previo reproduciéndose, lo detenemos
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
    }
    
    // Crear nuevo reproductor
    const newPlayer = new Audio();
    
    // Configurar manejadores de eventos antes de establecer la fuente
    newPlayer.addEventListener('ended', () => {
      setPlayingId(null);
      audioRef.current = null;
    });
    
    newPlayer.addEventListener('error', (e) => {
      console.error('Error al reproducir audio:', e);
      setPlayingId(null);
      audioRef.current = null;
    });
    
    // Cargar y reproducir el audio de manera segura
    newPlayer.preload = 'auto';
    newPlayer.src = audioUrl;
    
    // Intento de reproducción con seguridad adicional
    const playPromise = newPlayer.play();
    
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          // Reproducción exitosa
          setPlayingId(recording.id);
          audioRef.current = newPlayer;
        })
        .catch(err => {
          console.error('Error al iniciar reproducción:', err);
          
          // Limpieza en caso de error
          newPlayer.src = '';
          setPlayingId(null);
          audioRef.current = null;
          
          // Notificación al usuario
          console.log('No se pudo reproducir el audio. Intente nuevamente.');
        });
    }
  };

  // Descargar seleccionados como ZIP
  const handleDownloadSelectedAsZip = async () => {
    if (selectedRecordings.size === 0) return;
    
    setIsDownloading(true);
    setDownloadProgress('Preparando descarga...');
    
    try {
      const selectedFiles = recordings.filter(r => selectedRecordings.has(r.id));
      
      const filesData = selectedFiles.map(f => ({
        city: f.city,
        radio: f.radioName,
        fileName: f.fileName
      }));
      
      setDownloadProgress(`Comprimiendo ${selectedFiles.length} archivos...`);
      
      const response = await fetch('http://192.168.10.49:3001/api/recordings/download-multiple', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ files: filesData })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al descargar archivos');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${selectedRadio}_seleccion_${new Date().getTime()}.zip`;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      setTimeout(() => {
        window.URL.revokeObjectURL(url);
      }, 100);
      
      setDownloadProgress('¡Descarga completada!');
      setTimeout(() => {
        setDownloadProgress('');
        setSelectedRecordings(new Set());
        setIsSelectionMode(false);
      }, 2000);
      
    } catch (err) {
      console.error('Error:', err);
      setDownloadProgress('');
      alert(`Error al descargar archivos: ${err instanceof Error ? err.message : 'Error desconocido'}`);
    } finally {
      setIsDownloading(false);
    }
  };

  // Descargar seleccionados individualmente
  const handleDownloadSelectedIndividual = () => {
    if (selectedRecordings.size === 0) return;
    
    const selectedFiles = recordings.filter(r => selectedRecordings.has(r.id));
    
    selectedFiles.forEach((recording, index) => {
      setTimeout(() => {
        const baseUrl = 'http://192.168.10.49:3001';
        const encodedRadio = encodeURIComponent(recording.radioName.replace(/\s+/g, ''));
        const encodedFileName = encodeURIComponent(recording.fileName);
        const downloadUrl = `${baseUrl}/download/${recording.city}/${encodedRadio}/${encodedFileName}`;
        
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        iframe.src = downloadUrl;
        document.body.appendChild(iframe);
        
        setTimeout(() => {
          document.body.removeChild(iframe);
        }, 5000);
      }, index * 1000);
    });
    
    setDownloadProgress(`Descargando ${selectedFiles.length} archivos...`);
    setTimeout(() => {
      setDownloadProgress('');
      setSelectedRecordings(new Set());
      setIsSelectionMode(false);
    }, selectedFiles.length * 1000 + 2000);
  };

  // Manejar apertura del recortador
  const handleOpenTrimmer = (recording: Recording) => {
    // Asegurarse de que la URL del audio está correcta antes de pasar el recording
    const baseUrl = 'http://192.168.10.49:3001';
    const cleanRadio = recording.radioName.replace(/\s+/g, '');
    const encodedCity = encodeURIComponent(recording.city);
    const encodedRadio = encodeURIComponent(cleanRadio);
    const encodedFileName = encodeURIComponent(recording.fileName);
    const audioUrl = `${baseUrl}/audio/${encodedCity}/${encodedRadio}/${encodedFileName}`;
    
    // Crear una copia del objeto recording con la URL actualizada
    const recordingWithUrl = {
      ...recording,
      url: audioUrl
    };
    
    setSelectedRecordingForTrim(recordingWithUrl);
    setIsTrimmerOpen(true);
    
    // Pausar cualquier reproducción en curso
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
      setPlayingId(null);
      audioRef.current = null;
    }
  };
  
  // Cerrar el recortador
  const handleCloseTrimmer = () => {
    setIsTrimmerOpen(false);
    setSelectedRecordingForTrim(null);
  };

  const handleDownload = (recording: Recording) => {
    const baseUrl = 'http://192.168.10.49:3001';
    const encodedRadio = encodeURIComponent(recording.radioName.replace(/\s+/g, ''));
    const encodedFileName = encodeURIComponent(recording.fileName);
    const downloadUrl = `${baseUrl}/download/${recording.city}/${encodedRadio}/${encodedFileName}`;
    
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = downloadUrl;
    document.body.appendChild(iframe);
    
    setTimeout(() => {
      document.body.removeChild(iframe);
    }, 5000);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
      audioRef.current = null;
      setPlayingId(null);
    }
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      handlePageChange(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      handlePageChange(currentPage + 1);
    }
  };

  const formatDateTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    
    const hours = date.getHours();
    const minutes = date.getMinutes().toString().padStart(2, '0');
    
    const ampm = hours >= 12 ? 'p.m.' : 'a.m.';
    const displayHours = (hours % 12 || 12).toString().padStart(2, '0');
    
    return `${day}/${month}/${year} ${displayHours}:${minutes} ${ampm}`;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Barra de selección múltiple */}
      {isSelectionMode && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center justify-between animate-fade-in">
          <div className="flex items-center gap-4">
            <button
              onClick={() => {
                setIsSelectionMode(false);
                setSelectedRecordings(new Set());
              }}
              className="p-2 hover:bg-blue-100 rounded-lg transition-colors"
            >
              <X size={20} className="text-blue-600" />
            </button>
            <span className="text-blue-800 font-medium">
              {selectedRecordings.size} grabaciones seleccionadas
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadSelectedIndividual}
              disabled={selectedRecordings.size === 0 || isDownloading}
              className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download size={16} />
              Descargar Individual ({selectedRecordings.size})
            </button>
            
            <button
              onClick={handleDownloadSelectedAsZip}
              disabled={selectedRecordings.size === 0 || isDownloading}
              className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isDownloading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                  Procesando...
                </>
              ) : (
                <>
                  <Package size={16} />
                  Descargar como ZIP
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Progreso de descarga */}
      {downloadProgress && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="animate-spin rounded-full h-5 w-5 border-2 border-green-600 border-t-transparent"></div>
            <p className="text-green-800 font-medium">{downloadProgress}</p>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <FileAudio className="text-blue-600" size={20} />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Grabaciones</p>
              <p className="text-xl font-bold text-gray-900">{recordings.length}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Clock className="text-green-600" size={20} />
            </div>
            <div>
              <p className="text-sm text-gray-600">Última Grabación</p>
              <p className="text-sm font-medium text-gray-900">{lastUpdate}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Download className="text-purple-600" size={20} />
            </div>
            <div>
              <p className="text-sm text-gray-600">Tamaño Total</p>
              <p className="text-sm font-medium text-gray-900">{totalSize}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <CheckSquare className="text-orange-600" size={20} />
            </div>
            <div>
              <p className="text-sm text-gray-600">Seleccionados</p>
              <p className="text-sm font-medium text-gray-900">{selectedRecordings.size} archivos</p>
            </div>
          </div>
        </div>
      </div>

      {/* Recordings Table */}
      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">
            Grabaciones - {selectedRadio} (Página {currentPage} de {totalPages || 1})
          </h3>
          
          <button
            onClick={() => setIsSelectionMode(!isSelectionMode)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
              isSelectionMode 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <CheckSquare size={16} />
            {isSelectionMode ? 'Cancelar selección' : 'Seleccionar múltiples'}
          </button>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                {isSelectionMode && (
                  <th className="px-6 py-3 text-left">
                    <button
                      onClick={handleSelectAll}
                      className="p-1 hover:bg-gray-200 rounded transition-colors"
                    >
                      {isAllCurrentSelected() ? (
                        <CheckSquare size={18} className="text-blue-600" />
                      ) : isSomeSelected() ? (
                        <div className="relative">
                          <Square size={18} className="text-gray-400" />
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-2 h-2 bg-blue-600 rounded-sm"></div>
                          </div>
                        </div>
                      ) : (
                        <Square size={18} className="text-gray-400" />
                      )}
                    </button>
                  </th>
                )}
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Archivo
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Fecha de creación
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Fecha de modificación
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Duración
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tamaño
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {currentRecordings.length > 0 ? (
                currentRecordings.map((recording) => (
                  <tr 
                    key={recording.id} 
                    className={`hover:bg-gray-50 transition-colors ${
                      selectedRecordings.has(recording.id) ? 'bg-blue-50' : ''
                    }`}
                  >
                    {isSelectionMode && (
                      <td className="px-6 py-4">
                        <button
                          onClick={() => handleSelectRecording(recording.id)}
                          className="p-1 hover:bg-gray-200 rounded transition-colors"
                        >
                          {selectedRecordings.has(recording.id) ? (
                            <CheckSquare size={18} className="text-blue-600" />
                          ) : (
                            <Square size={18} className="text-gray-400" />
                          )}
                        </button>
                      </td>
                    )}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 rounded-lg">
                          <FileAudio className="text-blue-600" size={16} />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {recording.fileName}
                          </p>
                          <p className="text-xs text-gray-500">MP3 Audio</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <p className="text-sm text-gray-900">{formatDateTime(recording.timestamp)}</p>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <p className="text-sm text-gray-900">{formatDateTime(recording.modifiedAt || recording.timestamp)}</p>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <p className="text-sm text-gray-900">{recording.duration}</p>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <p className="text-sm text-gray-900">{recording.fileSize}</p>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handlePlayPause(recording)}
                          className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                          title={playingId === recording.id ? 'Pausar' : 'Reproducir'}
                        >
                          {playingId === recording.id ? (
                            <Pause size={16} />
                          ) : (
                            <Play size={16} />
                          )}
                        </button>
                        <button
                          onClick={() => handleOpenTrimmer(recording)}
                          className="p-2 text-orange-600 hover:bg-orange-100 rounded-lg transition-colors"
                          title="Recortar audio"
                        >
                          <Scissors size={16} />
                        </button>
                        <button
                          onClick={() => handleDownload(recording)}
                          className="p-2 text-green-600 hover:bg-green-100 rounded-lg transition-colors"
                          title="Descargar"
                        >
                          <Download size={16} />
                        </button>
                        {isSelectionMode && (
                          <button
                            onClick={() => handleSelectRecording(recording.id)}
                            className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                            title="Seleccionar"
                          >
                            <Check size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={isSelectionMode ? 7 : 6} className="px-6 py-10 text-center">
                    <FileAudio className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                    <p className="text-gray-500">No hay grabaciones disponibles</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {recordings.length > 0 && (
          <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
            <p className="text-sm text-gray-700">
              Mostrando <span className="font-medium">{startIndex + 1}-{Math.min(endIndex, recordings.length)}</span> de{' '}
              <span className="font-medium">{recordings.length}</span> grabaciones
            </p>
            
            <div className="flex items-center gap-2">
              <button 
                onClick={handlePrevPage}
                disabled={currentPage === 1}
                className="flex items-center gap-1 px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft size={16} />
                Anterior
              </button>
              
              <div className="flex gap-1">
                {Array.from({ length: Math.min(5, totalPages || 1) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }
                  
                  return (
                    <button
                      key={pageNum}
                      onClick={() => handlePageChange(pageNum)}
                      className={`px-3 py-2 text-sm rounded-md transition-colors ${
                        currentPage === pageNum
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>
              
              <button 
                onClick={handleNextPage}
                disabled={currentPage === totalPages}
                className="flex items-center gap-1 px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Siguiente
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mt-4">
          <p className="text-red-700 font-medium">Error: {error}</p>
          <p className="text-red-600 mt-1">Mostrando datos de ejemplo temporalmente.</p>
        </div>
      )}
      
      {/* Componente de recorte de audio */}
      <AudioTrimmer 
        isOpen={isTrimmerOpen}
        onClose={handleCloseTrimmer}
        recording={selectedRecordingForTrim}
      />
    </div>
  );
};

export default RecordingsList;