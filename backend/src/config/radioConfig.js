export const RADIO_CONFIG = {
  LIMA: {
    EXITOSA: {
      device: 'plughw:USB,0',
      outputPath: '/home/GRARADIOS/LIMA/EXITOSA',
      name: 'EXITOSA'
    },
    KARIBEÑA: {
      device: 'plughw:Pro,0',
      outputPath: '/home/GRARADIOS/LIMA/KARIBENA',
      name: 'KARIBEÑA'
    },
    'LA KALLE': {
      device: 'plughw:USB_1,0',
      outputPath: '/home/GRARADIOS/LIMA/LAKALLE',
      name: 'LA KALLE'
    }
  }
};

// Configuración de ffmpeg para cada radio
export const FFMPEG_CONFIG = {
  audioFilters: [
    'pan=mono|c0=c0+c1',
    'volume=3.5',
    'loudnorm=I=-16:LRA=11:TP=-1.5',
    'highpass=f=80',
    'lowpass=f=16000',
    'equalizer=f=2500:width_type=o:width=1:g=6'
  ].join(','),
  
  outputOptions: [
    '-c:a libmp3lame',
    '-ac 1',
    '-b:a 56k',
    '-compression_level 5',
    '-ar 44100'
  ]
};

// Horarios de grabación (24 horas, cada 30 minutos)
export const RECORDING_SCHEDULE = {
  interval: 30, // minutos
  startHour: 0,
  endHour: 23,
  duration: 30 // minutos por grabación
};