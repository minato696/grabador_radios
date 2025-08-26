import cron from 'node-cron';
import { spawn } from 'child_process';
import { RADIO_CONFIG, FFMPEG_CONFIG, RECORDING_SCHEDULE } from '../config/radioConfig.js';

export class RecordingScheduler {
  constructor(fileManager) {
    this.fileManager = fileManager;
    this.activeRecordings = new Map();
    this.scheduledTasks = new Map();
  }

  async initialize() {
    console.log('📅 Configurando programación de grabaciones...');
    
    // Programar grabaciones cada 30 minutos
    const cronExpression = '0,30 * * * *'; // Cada 30 minutos en punto
    
    cron.schedule(cronExpression, async () => {
      await this.startScheduledRecordings();
    });

    console.log('✅ Grabaciones programadas cada 30 minutos');
  }

  async startScheduledRecordings() {
    const now = new Date();
    console.log(`🎵 Iniciando grabaciones programadas: ${now.toLocaleString('es-PE')}`);

    // Iniciar grabación para todas las ciudades y radios
    for (const [city, radios] of Object.entries(RADIO_CONFIG)) {
      for (const [radioName, config] of Object.entries(radios)) {
        try {
          await this.startRecording(city, radioName);
        } catch (error) {
          console.error(`❌ Error al iniciar grabación ${city}/${radioName}:`, error.message);
        }
      }
    }
  }

  async startRecording(city, radioName) {
    const recordingKey = `${city}-${radioName}`;
    
    // Verificar si ya hay una grabación activa
    if (this.activeRecordings.has(recordingKey)) {
      console.log(`⚠️ Ya hay una grabación activa para ${city}/${radioName}`);
      return { status: 'already_active' };
    }

    const config = RADIO_CONFIG[city]?.[radioName];
    if (!config) {
      throw new Error(`Configuración no encontrada para ${city}/${radioName}`);
    }

    // Crear nombre de archivo con formato específico
    const now = new Date();
    const fileName = this.generateFileName(radioName, now);
    const fullPath = `${config.outputPath}/${fileName}`;

    // Asegurar que el directorio existe
    await this.fileManager.ensureDirectory(config.outputPath);

    console.log(`🎙️ Iniciando grabación: ${city}/${radioName} -> ${fileName}`);

    // Construir comando ffmpeg
    const ffmpegArgs = [
      '-f', 'alsa',
      '-i', config.device,
      '-ac', '2',
      '-af', FFMPEG_CONFIG.audioFilters,
      ...FFMPEG_CONFIG.outputOptions,
      '-t', `${RECORDING_SCHEDULE.duration * 60}`, // duración en segundos
      fullPath
    ];

    // Iniciar proceso ffmpeg
    const ffmpegProcess = spawn('ffmpeg', ffmpegArgs);
    
    // Configurar manejo de eventos
    ffmpegProcess.stdout.on('data', (data) => {
      // console.log(`ffmpeg stdout: ${data}`);
    });

    ffmpegProcess.stderr.on('data', (data) => {
      // console.log(`ffmpeg stderr: ${data}`);
    });

    ffmpegProcess.on('close', (code) => {
      console.log(`✅ Grabación completada: ${city}/${radioName} (código: ${code})`);
      this.activeRecordings.delete(recordingKey);
    });

    ffmpegProcess.on('error', (error) => {
      console.error(`❌ Error en grabación ${city}/${radioName}:`, error);
      this.activeRecordings.delete(recordingKey);
    });

    // Guardar referencia del proceso
    this.activeRecordings.set(recordingKey, {
      process: ffmpegProcess,
      city,
      radioName,
      fileName,
      startTime: now,
      fullPath
    });

    return {
      status: 'started',
      fileName,
      startTime: now,
      duration: RECORDING_SCHEDULE.duration
    };
  }

  async stopRecording(city, radioName) {
    const recordingKey = `${city}-${radioName}`;
    const recording = this.activeRecordings.get(recordingKey);

    if (!recording) {
      throw new Error(`No hay grabación activa para ${city}/${radioName}`);
    }

    console.log(`🛑 Deteniendo grabación: ${city}/${radioName}`);
    
    // Enviar señal SIGTERM para terminar gracefully
    recording.process.kill('SIGTERM');
    
    // Remover de grabaciones activas
    this.activeRecordings.delete(recordingKey);

    return {
      status: 'stopped',
      fileName: recording.fileName,
      duration: Math.floor((Date.now() - recording.startTime.getTime()) / 1000)
    };
  }

  async stopAllRecordings() {
    console.log('🛑 Deteniendo todas las grabaciones activas...');
    
    const promises = [];
    for (const [key, recording] of this.activeRecordings.entries()) {
      promises.push(this.stopRecording(recording.city, recording.radioName));
    }

    await Promise.allSettled(promises);
    console.log('✅ Todas las grabaciones detenidas');
  }

  generateFileName(radioName, date) {
    // Formato: EXITOSA_25-08-2025_19-42-16.mp3
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    
    return `${radioName}_${day}-${month}-${year}_${hours}-${minutes}-${seconds}.mp3`;
  }

  getActiveRecordings() {
    const active = [];
    for (const [key, recording] of this.activeRecordings.entries()) {
      active.push({
        key,
        city: recording.city,
        radioName: recording.radioName,
        fileName: recording.fileName,
        startTime: recording.startTime,
        duration: Math.floor((Date.now() - recording.startTime.getTime()) / 1000)
      });
    }
    return active;
  }

  getNextScheduledTime() {
    const now = new Date();
    const nextRun = new Date(now);
    
    // Calcular próxima ejecución (cada 30 minutos)
    const currentMinutes = now.getMinutes();
    if (currentMinutes < 30) {
      nextRun.setMinutes(30, 0, 0);
    } else {
      nextRun.setHours(now.getHours() + 1, 0, 0, 0);
    }
    
    return nextRun;
  }
}