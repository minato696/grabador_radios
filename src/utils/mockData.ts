import { Recording, CityType, RadioType } from '../types';

export const generateMockRecordings = (city: CityType, radio: RadioType): Recording[] => {
  const recordings: Recording[] = [];
  const now = new Date();
  
  // Generate recordings for the last 7 days, every 30 minutes during the day
  for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
    for (let hour = 0; hour < 24; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const timestamp = new Date(now);
        timestamp.setDate(now.getDate() - dayOffset);
        timestamp.setHours(hour, minute, 0, 0);
        
        // Fecha de modificación (30 minutos después de la creación)
        const modifiedAt = new Date(timestamp);
        modifiedAt.setMinutes(modifiedAt.getMinutes() + 30);
        
        const id = `${city}-${radio}-${timestamp.getTime()}`;
        
        // Formato: EXITOSA_25-08-2025_19-00-00.mp3
        const dayStr = timestamp.getDate().toString().padStart(2, '0');
        const month = (timestamp.getMonth() + 1).toString().padStart(2, '0');
        const year = timestamp.getFullYear();
        const hours = timestamp.getHours().toString().padStart(2, '0');
        const minutes = timestamp.getMinutes().toString().padStart(2, '0');
        const seconds = "00";
        
        const fileName = `${radio}_${dayStr}-${month}-${year}_${hours}-${minutes}-${seconds}.mp3`;
        
        recordings.push({
          id,
          radioName: radio,
          city,
          fileName,
          timestamp: timestamp.toISOString(),
          modifiedAt: modifiedAt.toISOString(),
          duration: '30:00',
          fileSize: `${Math.floor(Math.random() * 10 + 12)} MB`,
          url: `/audio/${city}/${radio}/${fileName}`
        });
      }
    }
  }
  
  return recordings.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
};