import React, { useState } from 'react';
import { X, Download, Calendar, Clock, FileArchive, AlertCircle } from 'lucide-react';
import { CityType, RadioType } from '../types';

interface DownloadRangeModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedCity: CityType;
  selectedRadio: RadioType;
}

const DownloadRangeModal: React.FC<DownloadRangeModalProps> = ({
  isOpen,
  onClose,
  selectedCity,
  selectedRadio
}) => {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [startTime, setStartTime] = useState('07:00');
  const [endTime, setEndTime] = useState('09:00');
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState('');
  const [error, setError] = useState('');

  // Presets de tiempo comunes
  const timePresets = [
    { label: 'Mañana (06:00 - 09:00)', start: '06:00', end: '09:00' },
    { label: 'Programa 1 (07:00 - 09:00)', start: '07:00', end: '09:00' },
    { label: 'Mediodía (12:00 - 14:00)', start: '12:00', end: '14:00' },
    { label: 'Tarde (18:00 - 20:00)', start: '18:00', end: '20:00' },
    { label: 'Noche (20:00 - 22:00)', start: '20:00', end: '22:00' },
    { label: 'Día completo (00:00 - 23:59)', start: '00:00', end: '23:59' }
  ];

  // Presets de fecha
  const setDatePreset = (preset: string) => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const lastWeek = new Date(today);
    lastWeek.setDate(today.getDate() - 7);
    const lastMonth = new Date(today);
    lastMonth.setMonth(today.getMonth() - 1);

    switch (preset) {
      case 'today':
        setStartDate(formatDate(today));
        setEndDate(formatDate(today));
        break;
      case 'yesterday':
        setStartDate(formatDate(yesterday));
        setEndDate(formatDate(yesterday));
        break;
      case 'last7days':
        setStartDate(formatDate(lastWeek));
        setEndDate(formatDate(today));
        break;
      case 'lastMonth':
        setStartDate(formatDate(lastMonth));
        setEndDate(formatDate(today));
        break;
      case 'specific':
        // Ejemplo específico: 14 al 17 de junio
        setStartDate('2025-06-14');
        setEndDate('2025-06-17');
        setStartTime('07:00');
        setEndTime('09:00');
        break;
    }
  };

  const formatDate = (date: Date): string => {
    return date.toISOString().split('T')[0];
  };

  const handleDownload = async () => {
    setError('');
    
    if (!startDate || !endDate || !startTime || !endTime) {
      setError('Por favor complete todos los campos');
      return;
    }

    setIsDownloading(true);
    setDownloadProgress('Preparando descarga...');

    try {
      const params = new URLSearchParams({
        city: selectedCity,
        radio: selectedRadio,
        startDate,
        endDate,
        startTime,
        endTime
      });

      const response = await fetch(`http://192.168.10.49:3001/api/recordings/download-range?${params}`, {
        method: 'GET',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al descargar archivos');
      }

      setDownloadProgress('Descargando archivo comprimido...');

      // Obtener el nombre del archivo del header
      const contentDisposition = response.headers.get('content-disposition');
      const fileNameMatch = contentDisposition?.match(/filename="(.+)"/);
      const fileName = fileNameMatch ? fileNameMatch[1] : `${selectedRadio}_${startDate}_${endDate}.zip`;

      // Crear blob y descargar
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      setDownloadProgress('¡Descarga completada!');
      
      // Cerrar modal después de 2 segundos
      setTimeout(() => {
        onClose();
        resetForm();
      }, 2000);

    } catch (err) {
      console.error('Error:', err);
      setError(err instanceof Error ? err.message : 'Error al descargar archivos');
      setDownloadProgress('');
    } finally {
      setIsDownloading(false);
    }
  };

  const resetForm = () => {
    setStartDate('');
    setEndDate('');
    setStartTime('07:00');
    setEndTime('09:00');
    setDownloadProgress('');
    setError('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <FileArchive className="text-blue-600" size={20} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Descarga por Rango</h2>
              <p className="text-sm text-gray-600">
                {selectedCity} - {selectedRadio}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isDownloading}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Presets de fecha */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <Calendar size={16} />
              Selección rápida de fechas
            </h3>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setDatePreset('today')}
                className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm transition-colors"
              >
                Hoy
              </button>
              <button
                onClick={() => setDatePreset('yesterday')}
                className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm transition-colors"
              >
                Ayer
              </button>
              <button
                onClick={() => setDatePreset('last7days')}
                className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm transition-colors"
              >
                Últimos 7 días
              </button>
              <button
                onClick={() => setDatePreset('lastMonth')}
                className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm transition-colors"
              >
                Último mes
              </button>
              <button
                onClick={() => setDatePreset('specific')}
                className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 text-sm transition-colors"
              >
                14-17 Junio (Ejemplo)
              </button>
            </div>
          </div>

          {/* Rango de fechas */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Fecha de inicio
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={isDownloading}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Fecha de fin
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={isDownloading}
              />
            </div>
          </div>

          {/* Presets de hora */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <Clock size={16} />
              Horarios comunes
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {timePresets.map((preset) => (
                <button
                  key={preset.label}
                  onClick={() => {
                    setStartTime(preset.start);
                    setEndTime(preset.end);
                  }}
                  className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm transition-colors text-left"
                  disabled={isDownloading}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Rango de horas */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Hora de inicio
              </label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={isDownloading}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Hora de fin
              </label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={isDownloading}
              />
            </div>
          </div>

          {/* Ejemplo visual */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-medium text-blue-900 mb-2">Tu selección actual:</h4>
            <p className="text-blue-800 text-sm">
              {startDate && endDate ? (
                <>
                  Desde el <strong>{startDate}</strong> a las <strong>{startTime}</strong><br/>
                  Hasta el <strong>{endDate}</strong> a las <strong>{endTime}</strong>
                </>
              ) : (
                'Selecciona un rango de fechas y horas'
              )}
            </p>
            {startDate && endDate && (
              <div className="mt-2 text-xs text-blue-600">
                • Se descargarán todas las grabaciones que inicien dentro de este rango<br/>
                • El archivo se comprimirá en formato ZIP<br/>
                • Nombre: {selectedRadio}_{startDate}_{endDate}.zip
              </div>
            )}
          </div>

          {/* Progress */}
          {downloadProgress && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-green-600 border-t-transparent"></div>
                <p className="text-green-800 font-medium">{downloadProgress}</p>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center gap-2">
                <AlertCircle className="text-red-600" size={20} />
                <p className="text-red-800">{error}</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50">
          <p className="text-sm text-gray-600">
            Los archivos se descargarán en un ZIP
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => {
                onClose();
                resetForm();
              }}
              disabled={isDownloading}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleDownload}
              disabled={isDownloading || !startDate || !endDate}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isDownloading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                  Descargando...
                </>
              ) : (
                <>
                  <Download size={16} />
                  Descargar ZIP
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DownloadRangeModal;