import React, { useState, useEffect } from 'react';
import { Play, Pause, Download, Clock, FileAudio, ChevronLeft, ChevronRight } from 'lucide-react';
import { CityType, RadioType, Recording } from '../types';
import { generateMockRecordings } from '../utils/mockData';

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
  const [audioPlayer, setAudioPlayer] = useState<HTMLAudioElement | null>(null);
  const [totalSize, setTotalSize] = useState("2.4 GB");
  const [lastUpdate, setLastUpdate] = useState<string>("Hace 15 min");
  
  useEffect(() => {
    // Función para cargar grabaciones del backend
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
            // Actualizar la información de última grabación
            const latestRecording = data.data[0];
            const timeDiff = new Date().getTime() - new Date(latestRecording.timestamp).getTime();
            const minutesAgo = Math.floor(timeDiff / (1000 * 60));
            setLastUpdate(`Hace ${minutesAgo} min`);
          } else {
            // No hay grabaciones, usar datos mock
            setRecordings(generateMockRecordings(selectedCity, selectedRadio));
          }
        } else {
          throw new Error(data.error || 'Error desconocido');
        }
      } catch (err) {
        console.error('Error:', err);
        setError(err instanceof Error ? err.message : 'Error al cargar grabaciones');
        // Usar datos mock como fallback
        setRecordings(generateMockRecordings(selectedCity, selectedRadio));
      } finally {
        setLoading(false);
      }
    };
    
    // Cargar estadísticas de almacenamiento
    const fetchStorageStats = async () => {
      try {
        // Intentar cargar estadísticas del backend
        const response = await fetch('http://192.168.10.49:3001/api/recordings/stats/storage');
        if (!response.ok) {
          throw new Error(`Error ${response.status}: ${response.statusText}`);
        }
        const data = await response.json();
        if (data.success) {
          setTotalSize(data.data.totalSizeFormatted);
        } else {
          throw new Error(data.error || 'Error desconocido');
        }
      } catch (err) {
        console.error('Error al cargar estadísticas:', err);
        // Usar valor por defecto
        setTotalSize("2.4 GB");
      }
    };
    
    fetchRecordings();
    fetchStorageStats();
    
    // Limpiar reproductor de audio al desmontar
    return () => {
      if (audioPlayer) {
        audioPlayer.pause();
        audioPlayer.currentTime = 0;
      }
    };
  }, [selectedCity, selectedRadio]);
  
  // Calculate pagination
  const totalPages = Math.ceil(recordings.length / recordingsPerPage);
  const startIndex = (currentPage - 1) * recordingsPerPage;
  const endIndex = startIndex + recordingsPerPage;
  const currentRecordings = recordings.slice(startIndex, endIndex);

  const handlePlayPause = (recording: Recording) => {
    if (playingId === recording.id) {
      // Si ya está reproduciendo, detenerlo
      if (audioPlayer) {
        audioPlayer.pause();
        audioPlayer.currentTime = 0;
      }
      setPlayingId(null);
      setAudioPlayer(null);
    } else {
      // Si hay otro audio reproduciéndose, detenerlo
      if (audioPlayer) {
        audioPlayer.pause();
        audioPlayer.currentTime = 0;
      }
      
      // Crear nuevo reproductor de audio con URL codificada correctamente
      const baseUrl = 'http://192.168.10.49:3001';
      
      // Codificar correctamente los componentes de la URL
      const encodedRadio = encodeURIComponent(recording.radioName.replace(/\s+/g, ''));
      const encodedFileName = encodeURIComponent(recording.fileName);
      const audioUrl = `${baseUrl}/audio/${recording.city}/${encodedRadio}/${encodedFileName}`;
      
      console.log('Intentando reproducir:', audioUrl);
      
      const newPlayer = new Audio(audioUrl);
      newPlayer.onended = () => {
        setPlayingId(null);
        setAudioPlayer(null);
      };
      
      newPlayer.onerror = (e) => {
        console.error('Error al reproducir audio:', e);
        alert('Error al reproducir el archivo de audio. El archivo podría no existir en el servidor.');
        setPlayingId(null);
        setAudioPlayer(null);
      };
      
      newPlayer.play().catch(err => {
        console.error('Error al iniciar reproducción:', err);
        alert('No se puede reproducir el audio. Verifique que el archivo exista en el servidor.');
        setPlayingId(null);
        setAudioPlayer(null);
      });
      
      setPlayingId(recording.id);
      setAudioPlayer(newPlayer);
    }
  };

  const handleDownload = (recording: Recording) => {
    const baseUrl = 'http://192.168.10.49:3001';
    
    // Codificar correctamente los componentes de la URL
    const encodedRadio = encodeURIComponent(recording.radioName.replace(/\s+/g, ''));
    const encodedFileName = encodeURIComponent(recording.fileName);
    const downloadUrl = `${baseUrl}/audio/${recording.city}/${encodedRadio}/${encodedFileName}`;
    
    console.log('Iniciando descarga:', downloadUrl);
    
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = recording.fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    // Detener cualquier reproducción al cambiar de página
    if (audioPlayer) {
      audioPlayer.pause();
      audioPlayer.currentTime = 0;
      setAudioPlayer(null);
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

  // Funciones de formato
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
              <FileAudio className="text-orange-600" size={20} />
            </div>
            <div>
              <p className="text-sm text-gray-600">Página Actual</p>
              <p className="text-sm font-medium text-gray-900">{currentPage} de {totalPages || 1}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Recordings Table */}
      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            Grabaciones - {selectedRadio} (Página {currentPage} de {totalPages || 1})
          </h3>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
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
                  <tr key={recording.id} className="hover:bg-gray-50 transition-colors">
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
                          onClick={() => handleDownload(recording)}
                          className="p-2 text-green-600 hover:bg-green-100 rounded-lg transition-colors"
                          title="Descargar"
                        >
                          <Download size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center">
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
              
              {/* Page Numbers */}
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

      {/* Error message if present */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mt-4">
          <p className="text-red-700 font-medium">Error: {error}</p>
          <p className="text-red-600 mt-1">Mostrando datos de ejemplo temporalmente.</p>
        </div>
      )}
    </div>
  );
};

export default RecordingsList;