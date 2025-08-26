import React, { useState } from 'react';
import { Calendar, Clock, Filter, Download, X } from 'lucide-react';

interface AdvancedFiltersProps {
  onApplyFilters: (filters: FilterCriteria) => void;
  onClearFilters: () => void;
  isOpen: boolean;
  onClose: () => void;
  totalRecordings: number;
  filteredCount: number;
}

export interface FilterCriteria {
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  minDuration: string;
  maxDuration: string;
  minSize: string;
  maxSize: string;
}

const AdvancedFilters: React.FC<AdvancedFiltersProps> = ({
  onApplyFilters,
  onClearFilters,
  isOpen,
  onClose,
  totalRecordings,
  filteredCount
}) => {
  const [filters, setFilters] = useState<FilterCriteria>({
    startDate: '',
    endDate: '',
    startTime: '',
    endTime: '',
    minDuration: '',
    maxDuration: '',
    minSize: '',
    maxSize: ''
  });

  const handleInputChange = (field: keyof FilterCriteria, value: string) => {
    setFilters(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleApplyFilters = () => {
    onApplyFilters(filters);
  };

  const handleClearFilters = () => {
    setFilters({
      startDate: '',
      endDate: '',
      startTime: '',
      endTime: '',
      minDuration: '',
      maxDuration: '',
      minSize: '',
      maxSize: ''
    });
    onClearFilters();
  };

  const setQuickDateRange = (days: number) => {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - days);
    
    setFilters(prev => ({
      ...prev,
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0]
    }));
  };

  const setQuickTimeRange = (start: string, end: string) => {
    setFilters(prev => ({
      ...prev,
      startTime: start,
      endTime: end
    }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Filter className="text-blue-600" size={20} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Filtros Avanzados</h2>
              <p className="text-sm text-gray-600">
                {filteredCount} de {totalRecordings} grabaciones
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Rango de Fechas */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Calendar className="text-blue-600" size={20} />
              <h3 className="text-lg font-semibold text-gray-900">Rango de Fechas</h3>
            </div>
            
            {/* Botones rápidos de fecha */}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setQuickDateRange(1)}
                className="px-3 py-1 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm"
              >
                Último día
              </button>
              <button
                onClick={() => setQuickDateRange(7)}
                className="px-3 py-1 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm"
              >
                Última semana
              </button>
              <button
                onClick={() => setQuickDateRange(30)}
                className="px-3 py-1 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm"
              >
                Último mes
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Fecha de inicio
                </label>
                <input
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => handleInputChange('startDate', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Fecha de fin
                </label>
                <input
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => handleInputChange('endDate', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          {/* Rango de Horarios */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Clock className="text-green-600" size={20} />
              <h3 className="text-lg font-semibold text-gray-900">Rango de Horarios</h3>
            </div>

            {/* Botones rápidos de horario */}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setQuickTimeRange('06:00', '12:00')}
                className="px-3 py-1 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm"
              >
                Mañana (06:00 - 12:00)
              </button>
              <button
                onClick={() => setQuickTimeRange('12:00', '18:00')}
                className="px-3 py-1 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm"
              >
                Tarde (12:00 - 18:00)
              </button>
              <button
                onClick={() => setQuickTimeRange('18:00', '24:00')}
                className="px-3 py-1 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm"
              >
                Noche (18:00 - 24:00)
              </button>
              <button
                onClick={() => setQuickTimeRange('07:00', '09:00')}
                className="px-3 py-1 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors text-sm"
              >
                07:00 - 09:00
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Hora de inicio
                </label>
                <input
                  type="time"
                  value={filters.startTime}
                  onChange={(e) => handleInputChange('startTime', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Hora de fin
                </label>
                <input
                  type="time"
                  value={filters.endTime}
                  onChange={(e) => handleInputChange('endTime', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          {/* Filtros adicionales */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Duración */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">Duración (minutos)</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Mínimo
                  </label>
                  <input
                    type="number"
                    placeholder="0"
                    value={filters.minDuration}
                    onChange={(e) => handleInputChange('minDuration', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Máximo
                  </label>
                  <input
                    type="number"
                    placeholder="60"
                    value={filters.maxDuration}
                    onChange={(e) => handleInputChange('maxDuration', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            {/* Tamaño */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">Tamaño (MB)</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Mínimo
                  </label>
                  <input
                    type="number"
                    placeholder="0"
                    value={filters.minSize}
                    onChange={(e) => handleInputChange('minSize', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Máximo
                  </label>
                  <input
                    type="number"
                    placeholder="50"
                    value={filters.maxSize}
                    onChange={(e) => handleInputChange('maxSize', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Ejemplo de uso */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-medium text-blue-900 mb-2">Ejemplo de tu consulta:</h4>
            <p className="text-blue-800 text-sm">
              "Grabaciones del 14-06-2025 desde las 07:00 hasta el 17-06-2025 a las 09:00"
            </p>
            <div className="mt-2 text-xs text-blue-600">
              • Fecha inicio: 2025-06-14<br/>
              • Fecha fin: 2025-06-17<br/>
              • Hora inicio: 07:00<br/>
              • Hora fin: 09:00
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50">
          <div className="text-sm text-gray-600">
            Se encontraron <span className="font-medium text-gray-900">{filteredCount}</span> grabaciones
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleClearFilters}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Limpiar Filtros
            </button>
            <button
              onClick={handleApplyFilters}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Filter size={16} />
              Aplicar Filtros
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdvancedFilters;