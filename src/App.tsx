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
          {currentView === 'list' ? (
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

export default App;