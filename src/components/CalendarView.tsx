import React, { useState } from 'react';
import { useEffect } from 'react';
import { ChevronLeft, ChevronRight, Play, Pause, Download, FileAudio } from 'lucide-react';
import { CityType, RadioType } from '../types';
import { apiService } from '../services/api';
import { Recording } from '../services/api';

interface AudioPlayerState {
  currentTime: number;
  duration: number;
  isPlaying: boolean;
}

interface CalendarViewProps {
  selectedCity: CityType;
  selectedRadio: RadioType;
}

const CalendarView: React.FC<CalendarViewProps> = ({ 
  selectedCity, 
  selectedRadio 
}) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [audioElements, setAudioElements] = useState<Map<string, HTMLAudioElement>>(new Map());
  const [audioStates, setAudioStates] = useState<Map<string, AudioPlayerState>>(new Map());

  // Cargar grabaciones desde el backend
  useEffect(() => {
    const loadRecordings = async () => {
      try {
        const data = await apiService.getRecordingsByCity(selectedCity, selectedRadio);
        setRecordings(data);
      } catch (err) {
        console.error('Error loading recordings:', err);
        // Fallback a datos mock en caso de error
        const { generateMockRecordings } = await import('../utils/mockData');
        setRecordings(generateMockRecordings(selectedCity, selectedRadio));
      } finally {
        if (initialLoading) setInitialLoading(false);
      }
    };

    loadRecordings();

    // Configurar actualización silenciosa cada 30 segundos
    const interval = setInterval(() => {
      loadRecordings();
    }, 30000); // 30 segundos

    // Limpiar interval al desmontar el componente
    return () => clearInterval(interval);
  }, [selectedCity, selectedRadio]);

  const today = new Date();
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);
  const firstDayWeekday = firstDayOfMonth.getDay();

  const days = [];
  const daysInMonth = lastDayOfMonth.getDate();

  // Add empty cells for days before the first day of the month
  for (let i = 0; i < firstDayWeekday; i++) {
    days.push(null);
  }

  // Add all days of the month
  for (let day = 1; day <= daysInMonth; day++) {
    days.push(day);
  }

  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  const weekDays = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'];

  const previousMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
    setSelectedDay(null);
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
    setSelectedDay(null);
  };

  const getRecordingsForDay = (day: number) => {
    const dayDate = new Date(year, month, day);
    return recordings.filter(recording => {
      const recordingDate = new Date(recording.timestamp);
      return recordingDate.getDate() === day &&
             recordingDate.getMonth() === month &&
             recordingDate.getFullYear() === year;
    });
  };

  const isToday = (day: number) => {
    return today.getDate() === day &&
           today.getMonth() === month &&
           today.getFullYear() === year;
  };

  const handleDayClick = (day: number) => {
    setSelectedDay(selectedDay === day ? null : day);
  };

  const handlePlayPause = (recordingId: string) => {
    const recording = recordings.find(r => r.id === recordingId);
    if (!recording) return;

    let audio = audioElements.get(recordingId);
    
    if (!audio) {
      audio = new Audio(apiService.getAudioUrl(recording.city, recording.radioName, recording.fileName));
      audio.addEventListener('ended', () => setPlayingId(null));
      audio.addEventListener('error', (e) => {
        console.error('Error playing audio:', e);
        setPlayingId(null);
      });
      
      // Agregar listeners para el temporizador
      audio.addEventListener('loadedmetadata', () => {
        setAudioStates(prev => new Map(prev.set(recordingId, {
          currentTime: 0,
          duration: audio!.duration,
          isPlaying: false
        })));
      });
      
      audio.addEventListener('timeupdate', () => {
        setAudioStates(prev => new Map(prev.set(recordingId, {
          currentTime: audio!.currentTime,
          duration: audio!.duration,
          isPlaying: !audio!.paused
        })));
      });
      
      setAudioElements(prev => new Map(prev.set(recordingId, audio!)));
    }

    if (playingId === recordingId) {
      audio.pause();
      setPlayingId(null);
    } else {
      // Pause any other playing audio
      audioElements.forEach((otherAudio, otherId) => {
        if (otherId !== recordingId) {
          otherAudio.pause();
        }
      });
      
      audio.play().catch(console.error);
      setPlayingId(recordingId);
    }
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('es-PE', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getSelectedDayRecordings = () => {
    if (!selectedDay) return [];
    return getRecordingsForDay(selectedDay);
  };

  const handleDownload = (recording: Recording) => {
    const downloadUrl = apiService.getDownloadUrl(recording.city, recording.radioName, recording.fileName);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = recording.fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Calendar - Columna izquierda más pequeña */}
      <div className="lg:col-span-1">
        <div className="bg-slate-800 rounded-lg shadow-lg border border-slate-700 p-4">
          {/* Calendar Header */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-white">
              {monthNames[month]} {year}
            </h2>
            <div className="flex gap-1">
              <button
                onClick={previousMonth}
                className="p-1.5 hover:bg-slate-700 text-white rounded-lg transition-colors"
              >
                <ChevronLeft size={18} />
              </button>
              <button
                onClick={nextMonth}
                className="p-1.5 hover:bg-slate-700 text-white rounded-lg transition-colors"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>

          {/* Calendar Grid más compacto */}
          <div className="grid grid-cols-7 gap-1">
            {/* Week days header */}
            {weekDays.map((day) => (
              <div key={day} className="p-1 text-center text-xs font-medium text-slate-400 uppercase">
                {day}
              </div>
            ))}

            {/* Calendar days */}
            {days.map((day, index) => {
              const uniqueKey = `${year}-${month}-${index}`;
              
              if (day === null) {
                return <div key={uniqueKey} className="p-1"></div>;
              }

              const dayRecordings = getRecordingsForDay(day);
              const hasRecordings = dayRecordings.length > 0;
              const isSelected = selectedDay === day;

              return (
                <div
                  key={uniqueKey}
                  onClick={() => handleDayClick(day)}
                  className={`min-h-[50px] p-1 rounded-md cursor-pointer transition-all duration-200 ${
                    isSelected 
                      ? 'bg-blue-600 border-2 border-blue-400 shadow-lg scale-105' 
                      : isToday(day) 
                        ? 'bg-red-600 border-2 border-red-400 hover:bg-red-700' 
                        : hasRecordings 
                          ? 'bg-green-600 border-2 border-green-400 hover:bg-green-700' 
                          : 'bg-slate-700 border border-slate-600 hover:bg-slate-600'
                  }`}
                >
                  <div className="text-xs font-bold text-white text-center">
                    {day}
                  </div>
                  
                  {hasRecordings && (
                    <div className="text-center mt-1">
                      <div className="flex items-center justify-center gap-0.5">
                        <FileAudio size={10} className="text-white" />
                        <span className="text-xs text-white font-medium">
                          {dayRecordings.length}
                        </span>
                      </div>
                      <div className="text-xs text-white opacity-90">
                        archivos
                      </div>
                    </div>
                  )}
                  
                  {isToday(day) && (
                    <div className="text-xs text-white text-center mt-1 font-bold">
                      HOY
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          
          {/* Legend más compacta */}
          <div className="flex items-center justify-center gap-3 mt-3 pt-3 border-t border-slate-600">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-red-600 rounded border border-red-400"></div>
              <span className="text-xs text-slate-300">Hoy</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-green-600 rounded border border-green-400"></div>
              <span className="text-xs text-slate-300">Con grabaciones</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-blue-600 rounded border border-blue-400"></div>
              <span className="text-xs text-slate-300">Seleccionado</span>
            </div>
          </div>
        </div>

        {/* Info box debajo del calendario */}
        {!selectedDay && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-4">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-blue-100 rounded-lg">
                <FileAudio className="text-blue-600" size={16} />
              </div>
              <div>
                <p className="text-blue-800 font-medium text-sm">Selecciona un día</p>
                <p className="text-blue-600 text-xs">Haz clic para ver grabaciones</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Selected Day Recordings Detail - Columna derecha */}
      <div className="lg:col-span-1">
        <div className="bg-white rounded-lg shadow-sm border h-full">
          <div className="px-4 py-3 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">
              {selectedDay 
                ? `Grabaciones del ${selectedDay} de ${monthNames[month]} - ${selectedRadio}`
                : `Grabaciones de Hoy - ${selectedRadio}`
              }
            </h3>
            {selectedDay && (
              <p className="text-sm text-gray-600 mt-1">
                {getSelectedDayRecordings().length} grabaciones encontradas
              </p>
            )}
          </div>
          
          <div className="p-4 max-h-[500px] overflow-y-auto">
            {selectedDay ? (
              <div className="grid gap-2">
                {getSelectedDayRecordings().length > 0 ? (
                  getSelectedDayRecordings().map((recording) => (
                    <div
                      key={recording.id}
                      className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => handlePlayPause(recording.id)}
                          className="p-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                          {playingId === recording.id ? (
                            <Pause size={14} />
                          ) : (
                            <Play size={14} />
                          )}
                        </button>
                        
                        <div>
                          <p className="font-medium text-sm text-gray-900">{recording.fileName}</p>
                          <p className="text-xs text-gray-600">
                            {formatTime(recording.timestamp)} · {recording.duration}
                            {/* Temporizador de reproducción */}
                            {playingId === recording.id && audioStates.get(recording.id) && (
                              <span className="ml-2 text-blue-600 font-medium">
                                · {formatDuration(audioStates.get(recording.id)!.currentTime)} / 
                                {formatDuration(audioStates.get(recording.id)!.duration)}
                              </span>
                            )}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">{recording.fileSize}</span>
                        <button 
                          onClick={() => handleDownload(recording)}
                          className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-100 rounded-lg transition-colors"
                        >
                          <Download size={14} />
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8">
                    <FileAudio className="mx-auto h-10 w-10 text-gray-400 mb-3" />
                    <p className="text-gray-500 text-sm">No hay grabaciones para este día</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="grid gap-2">
                {recordings.slice(0, 8).map((recording) => (
                  <div
                    key={recording.id}
                    className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => handlePlayPause(recording.id)}
                        className="p-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        {playingId === recording.id ? (
                          <Pause size={14} />
                        ) : (
                          <Play size={14} />
                        )}
                      </button>
                      
                      <div>
                        <p className="font-medium text-sm text-gray-900">{recording.fileName}</p>
                        <p className="text-xs text-gray-600">
                          {formatTime(recording.timestamp)} · {recording.duration}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">{recording.fileSize}</span>
                      <button 
                        onClick={() => handleDownload(recording)}
                        className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-100 rounded-lg transition-colors"
                      >
                        <Download size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CalendarView;