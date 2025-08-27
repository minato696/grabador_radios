// src/App.tsx
import React, { useState } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import RadioTabs from './components/RadioTabs';
import RecordingsList from './components/RecordingsList';
import CalendarView from './components/CalendarView';
import { CityType, RadioType, ViewType } from './types';

function App() {
  const [selectedCity, setSelectedCity] = useState<CityType>('LIMA');
  const [selectedRadio, setSelectedRadio] = useState<RadioType>('EXITOSA');
  const [currentView, setCurrentView] = useState<ViewType>('list');

  // Ciudades en desarrollo
  const inDevelopmentCities = ['AREQUIPA', 'CHICLAYO', 'TRUJILLO'];
  const isCityInDevelopment = inDevelopmentCities.includes(selectedCity);

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <Sidebar 
        selectedCity={selectedCity} 
        onCitySelect={setSelectedCity}
      />
      
      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <Header 
          selectedCity={selectedCity}
          selectedRadio={selectedRadio}
          currentView={currentView}
          onViewChange={setCurrentView}
        />
        
        {/* Radio Tabs */}
        <RadioTabs 
          selectedCity={selectedCity}
          selectedRadio={selectedRadio}
          onRadioSelect={setSelectedRadio}
        />
        
        {/* Content Area */}
        <div className="flex-1 p-6">
          {isCityInDevelopment ? (
            <DevelopmentMessage city={selectedCity} />
          ) : currentView === 'list' ? (
            <RecordingsList 
              selectedCity={selectedCity}
              selectedRadio={selectedRadio}
            />
          ) : (
            <CalendarView 
              selectedCity={selectedCity}
              selectedRadio={selectedRadio}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// Componente para el mensaje "En desarrollo"
function DevelopmentMessage({ city }: { city: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full">
      <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-8 max-w-md text-center shadow-lg">
        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Filial {city} en desarrollo</h2>
        <p className="text-gray-600 mb-4">
          La filial {city} se encuentra actualmente en desarrollo. Estamos trabajando para implementar todas las funcionalidades pronto.
        </p>
        <p className="text-sm text-blue-600 font-medium">
          Por favor, utiliza la filial LIMA para acceder a todas las funcionalidades disponibles.
        </p>
      </div>
    </div>
  );
}

export default App;