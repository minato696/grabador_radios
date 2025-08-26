import React from 'react';
import { BarChart3, Settings, User } from 'lucide-react';
import { CityType } from '../types';

interface SidebarProps {
  selectedCity: CityType;
  onCitySelect: (city: CityType) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ selectedCity, onCitySelect }) => {
  const cities: CityType[] = ['LIMA', 'AREQUIPA', 'CHICLAYO', 'TRUJILLO'];

  return (
    <div className="w-64 bg-slate-900 text-white flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b border-slate-700">
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-3 rounded-lg text-center shadow-lg">
          <h1 className="text-lg font-bold text-white">Radio Cloud System</h1>
          <p className="text-xs text-blue-100 mt-1">Gestión de Grabaciones</p>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto">
        {/* Filiales */}
        <div className="px-4 py-4">
          <h3 className="text-yellow-400 font-semibold mb-4 text-sm uppercase tracking-wider flex items-center gap-2">
            <div className="w-2 h-2 bg-yellow-400 rounded-full"></div>
            Filiales
          </h3>
          <div className="space-y-1">
            {cities.map((city) => (
              <button
                key={city}
                onClick={() => onCitySelect(city)}
                className={`w-full text-left px-4 py-3 rounded-lg transition-all duration-200 hover:bg-slate-800 hover:translate-x-1 group ${
                  selectedCity === city
                    ? 'bg-blue-600 text-white font-medium shadow-lg border-l-4 border-blue-400'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{city}</span>
                  {selectedCity === city && (
                    <div className="w-2 h-2 bg-white rounded-full"></div>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-slate-700 p-4 space-y-3">
        <div className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-800 cursor-pointer transition-all duration-200 hover:translate-x-1">
          <User size={18} />
          <span className="text-sm">exitosa</span>
        </div>
        
        <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-800 transition-all duration-200 hover:translate-x-1">
          <Settings size={18} />
          <span className="text-sm">Panel de Administración</span>
        </button>
        
        <div className="text-center text-xs text-slate-500 pt-2 border-t border-slate-700">
          <p>Área Sistemas</p>
          <p>Radio Exitosa</p>
          <p>Versión 2.4.0 © 2025</p>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;