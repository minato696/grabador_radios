import React, { useState } from 'react';
import { Calendar, List, Download, Search, FileArchive, Clock } from 'lucide-react';
import { CityType, RadioType, ViewType } from '../types';
import DownloadRangeModal from './DownloadRangeModal';

interface HeaderProps {
  selectedCity: CityType;
  selectedRadio: RadioType;
  currentView: ViewType;
  onViewChange: (view: ViewType) => void;
}

const Header: React.FC<HeaderProps> = ({ 
  selectedCity, 
  selectedRadio, 
  currentView, 
  onViewChange 
}) => {
  const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);

  return (
    <>
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              Grabaciones - {selectedCity}
            </h1>
            <p className="text-slate-600 mt-1">
              Radio {selectedRadio} · Grabaciones automáticas cada 30 minutos
            </p>
          </div>

          <div className="flex items-center gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Buscar grabaciones..."
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent w-64"
              />
            </div>

            {/* View Toggle */}
            <div className="flex bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => onViewChange('list')}
                className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all ${
                  currentView === 'list'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <List size={16} />
                Lista
              </button>
              <button
                onClick={() => onViewChange('calendar')}
                className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all ${
                  currentView === 'calendar'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Calendar size={16} />
                Calendario
              </button>
            </div>

            {/* Download Buttons */}
            <div className="flex gap-2">
              {/* Descarga por Rango */}
              <button 
                onClick={() => setIsDownloadModalOpen(true)}
                className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
                title="Descargar por rango de fecha y hora"
              >
                <Clock size={16} />
                Por Rango
              </button>
              
              {/* Descargar Todo */}
              <button className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
                <Download size={16} />
                Todo Hoy
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de descarga por rango */}
      <DownloadRangeModal
        isOpen={isDownloadModalOpen}
        onClose={() => setIsDownloadModalOpen(false)}
        selectedCity={selectedCity}
        selectedRadio={selectedRadio}
      />
    </>
  );
};

export default Header;