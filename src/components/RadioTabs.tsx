import React from 'react';
import { Radio } from 'lucide-react';
import { CityType, RadioType, RADIO_CONFIG } from '../types';

interface RadioTabsProps {
  selectedCity: CityType;
  selectedRadio: RadioType;
  onRadioSelect: (radio: RadioType) => void;
}

const RadioTabs: React.FC<RadioTabsProps> = ({ 
  selectedCity, 
  selectedRadio, 
  onRadioSelect 
}) => {
  const radios = RADIO_CONFIG[selectedCity];

  return (
    <div className="bg-white border-b border-gray-200 shadow-sm">
      <div className="px-6 py-2">
        <div className="flex items-center space-x-1">
          {radios.map((radio) => (
            <button
              key={radio}
              onClick={() => onRadioSelect(radio)}
              className={`flex items-center gap-2 px-4 py-3 rounded-lg font-medium text-sm transition-all duration-200 ${
                selectedRadio === radio
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-gray-600 hover:text-blue-600 hover:bg-blue-50'
              }`}
            >
              <Radio size={16} />
              {radio}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default RadioTabs;