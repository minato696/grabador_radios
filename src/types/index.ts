export type CityType = 'LIMA' | 'AREQUIPA' | 'CHICLAYO' | 'TRUJILLO';

export type RadioType = 'EXITOSA' | 'KARIBEÑA' | 'LA KALLE';

export type ViewType = 'list' | 'calendar';

export interface Recording {
  id: string;
  radioName: RadioType;
  city: CityType;
  fileName: string;
  timestamp: string;
  modifiedAt: string;
  duration: string;
  fileSize: string;
  url: string;
}

export interface RadioConfig {
  [key in CityType]: RadioType[];
}

export const RADIO_CONFIG: RadioConfig = {
  LIMA: ['EXITOSA', 'KARIBEÑA', 'LA KALLE'],
  AREQUIPA: ['EXITOSA', 'KARIBEÑA', 'LA KALLE'],
  CHICLAYO: ['EXITOSA', 'KARIBEÑA', 'LA KALLE'],
  TRUJILLO: ['EXITOSA', 'KARIBEÑA', 'LA KALLE']
};