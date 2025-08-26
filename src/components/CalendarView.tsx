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

    // Configurar actualización silenciosa cada 5 segundos
    const interval = setInterval(() => {
      loadRecordings();
    }, 5000); // 5 segundos para ver cambios más rápido

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

  const weekDays = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

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
    <div className="space-y-6">
      {/* Calendar Header */}
      <div className="bg-slate-800 rounded-lg shadow-lg border border-slate-700 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white">
            {monthNames[month]} {year}
          </h2>
          <div className="flex gap-2">
            <button
              onClick={previousMonth}
              className="p-2 hover:bg-slate-700 text-white rounded-lg transition-colors"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              onClick={nextMonth}
              className="p-2 hover:bg-slate-700 text-white rounded-lg transition-colors"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-1">
          {/* Week days header */}
          {weekDays.map((day) => (
            <div key={day} className="p-3 text-center text-sm font-medium text-slate-400 uppercase tracking-wider">
              {day}
            </div>
          ))}

          {/* Calendar days */}
          {days.map((day, index) => {
            if (day === null) {
              return <div key={index} className="p-3"></div>;
            }

            const dayRecordings = getRecordingsForDay(day);
            const hasRecordings = dayRecordings.length > 0;
            const isSelected = selectedDay === day;

            return (
              <div
                key={day}
                onClick={() => handleDayClick(day)}
                className={`min-h-[80px] p-2 rounded-lg cursor-pointer transition-all duration-200 ${
                  isSelected 
                    ? 'bg-blue-600 border-2 border-blue-400 shadow-lg' 
                    : isToday(day) 
                      ? 'bg-red-600 border-2 border-red-400 hover:bg-red-700' 
                      : hasRecordings 
                        ? 'bg-green-600 border-2 border-green-400 hover:bg-green-700' 
                        : 'bg-slate-700 border-2 border-slate-600 hover:bg-slate-600'
                }`}
              >
                <div className="text-sm font-bold mb-1 text-white text-center">
                  {day}
                </div>
                
                {hasRecordings && (
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1 mb-1">
                      <FileAudio size={12} className="text-white" />
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
                  <div className="text-xs text-white text-center mt-1 font-medium">
                    HOY
                  </div>
                )}
              </div>
            );
          })}
        </div>
        
        {/* Legend */}
        <div className="flex items-center justify-center gap-6 mt-4 pt-4 border-t border-slate-600">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-red-600 rounded border-2 border-red-400"></div>
            <span className="text-sm text-slate-300">Hoy</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-600 rounded border-2 border-green-400"></div>
            <span className="text-sm text-slate-300">Con grabaciones</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-blue-600 rounded border-2 border-blue-400"></div>
            <span className="text-sm text-slate-300">Seleccionado</span>
          </div>
        </div>
      </div>

      {/* Selected Day Recordings Detail */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="px-6 py-4 border-b border-gray-200">
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
        
        <div className="p-6">
          {selectedDay ? (
            <div className="grid gap-3">
              {getSelectedDayRecordings().length > 0 ? (
                getSelectedDayRecordings().map((recording) => (
                  <div
                    key={recording.id}
                    className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <button
                        onClick={() => handlePlayPause(recording.id)}
                        className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        {playingId === recording.id ? (
                          <Pause size={16} />
                        ) : (
                          <Play size={16} />
                        )}
                      </button>
                      
                      <div>
                        <p className="font-medium text-gray-900">{recording.fileName}</p>
                        <p className="text-sm text-gray-600">
                          {formatTime(recording.timestamp)} · {recording.duration}
                          {/* Temporizador de reproducción */}
                          {playingId === recording.id && audioStates.get(recording.id) && (
                            <span className="ml-2 text-blue-600 font-medium">
                              · {formatDuration(audioStates.get(recording.id)!.currentTime)} / 
                              {formatDuration(audioStates.get(recording.id)!.duration)}
                            </span>
                          )}
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
                      <span className="text-sm text-gray-500">{recording.fileSize}</span>
                      <button 
                        onClick={() => handleDownload(recording)}
                        className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-100 rounded-lg transition-colors"
                      >
                        <Download size={16} />
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8">
                  <FileAudio className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                  <p className="text-gray-500">No hay grabaciones para este día</p>
                </div>
              )}
            </div>
          ) : (
            <div className="grid gap-3">
              {recordings.slice(0, 8).map((recording) => (
                <div
                  key={recording.id}
                  className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => handlePlayPause(recording.id)}
                      className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      {playingId === recording.id ? (
                        <Pause size={16} />
                      ) : (
                        <Play size={16} />
                      )}
                    </button>
                    
                    <div>
                      <p className="font-medium text-gray-900">{recording.fileName}</p>
                      <p className="text-sm text-gray-600">
                        {formatTime(recording.timestamp)} · {recording.duration}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500">{recording.fileSize}</span>
                    <button 
                      onClick={() => handleDownload(recording)}
                      className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-100 rounded-lg transition-colors"
                    >
                      <Download size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      
      {!selectedDay && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <FileAudio className="text-blue-600" size={20} />
            </div>
            <div>
              <p className="text-blue-800 font-medium">Selecciona un día en el calendario</p>
              <p className="text-blue-600 text-sm">Haz clic en cualquier día para ver sus grabaciones específicas</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CalendarView;