// backend/src/services/recordingScheduler.js

import cron from 'node-cron';
import { spawn } from 'child_process';
import fs from 'fs-extra';
import path from 'path';
import { RADIO_CONFIG, FFMPEG_CONFIG, RECORDING_SCHEDULE } from '../config/radioConfig.js';

export class RecordingScheduler {
  constructor(fileManager) {
    this.fileManager = fileManager;
    this.activeRecordings = new Map();
    this.scheduledTasks = new Map();
    this.recordingHistory = [];
  }

  async initialize() {
    console.log('\n════════════════════════════════════════════════════════════');
    console.log('     📻 SISTEMA DE GRABACIÓN - RADIO EXITOSA LIMA 📻');
    console.log('════════════════════════════════════════════════════════════\n');
    
    // Verificar ffmpeg
    const ffmpegOk = await this.verifyFfmpeg();
    if (!ffmpegOk) {
      console.error('⚠️ ADVERTENCIA: ffmpeg no está correctamente instalado');
    }
    
    // Verificar dispositivos de audio SOLO PARA LIMA
    await this.verifyAudioDevices();
    
    // INICIAR GRABACIÓN INMEDIATAMENTE
    console.log('\n🚀 INICIANDO GRABACIONES DE LIMA INMEDIATAMENTE...\n');
    await this.startScheduledRecordings();
    
    // Programar grabaciones cada 30 minutos
    const cronExpression = '0,30 * * * *'; // Cada 30 minutos en punto
    
    const task = cron.schedule(cronExpression, async () => {
      console.log('\n⏰ Ejecutando grabación programada (cada 30 minutos)');
      await this.startScheduledRecordings();
    });

    this.scheduledTasks.set('main', task);
    console.log('✅ Sistema configurado para grabar cada 30 minutos');
    
    // Mostrar próxima ejecución
    const next = this.getNextScheduledTime();
    console.log(`⏭️ Próxima grabación automática: ${next.toLocaleString('es-PE')}\n`);
  }

  async verifyFfmpeg() {
    return new Promise((resolve) => {
      const ffmpeg = spawn('ffmpeg', ['-version']);
      
      ffmpeg.on('error', (err) => {
        console.error('❌ ffmpeg no está instalado:', err.message);
        console.error('   Instala con: sudo apt install ffmpeg');
        resolve(false);
      });
      
      ffmpeg.on('close', (code) => {
        if (code === 0) {
          console.log('✅ ffmpeg instalado correctamente');
          resolve(true);
        } else {
          console.error('⚠️ ffmpeg con problemas');
          resolve(false);
        }
      });
    });
  }

  async verifyAudioDevices() {
    console.log('🎤 Verificando dispositivos de audio para LIMA...\n');
    
    // Listar todos los dispositivos disponibles
    await this.listAllAudioDevices();
    
    console.log('\n📋 Estado de dispositivos configurados para LIMA:');
    console.log('─'.repeat(50));
    
    // SOLO verificar dispositivos de LIMA
    const limaRadios = RADIO_CONFIG.LIMA;
    
    for (const [radioName, config] of Object.entries(limaRadios)) {
      const deviceExists = await this.checkAudioDevice(config.device);
      if (deviceExists) {
        console.log(`✅ ${radioName.padEnd(10)} : ${config.device} - FUNCIONANDO`);
      } else {
        console.log(`❌ ${radioName.padEnd(10)} : ${config.device} - NO ENCONTRADO`);
        await this.suggestAlternativeDevice(radioName);
      }
    }
    console.log('─'.repeat(50));
  }

  async listAllAudioDevices() {
    return new Promise((resolve) => {
      console.log('🔊 Dispositivos de audio detectados en el sistema:');
      console.log('─'.repeat(50));
      const arecord = spawn('arecord', ['-l']);
      
      let output = '';
      arecord.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      arecord.on('close', () => {
        if (output) {
          console.log(output);
        } else {
          console.log('   ⚠️ No se detectaron dispositivos de audio');
        }
        resolve();
      });
    });
  }

  async suggestAlternativeDevice(radioName) {
    console.log(`   🔍 Buscando alternativas para ${radioName}...`);
    
    const alternatives = [
      'hw:0,0',
      'hw:1,0',
      'hw:2,0',
      'plughw:0,0',
      'plughw:1,0',
      'plughw:2,0',
      'default'
    ];
    
    for (const device of alternatives) {
      const exists = await this.checkAudioDevice(device);
      if (exists) {
        console.log(`      💡 Alternativa encontrada: ${device}`);
        break;
      }
    }
  }

  async checkAudioDevice(device) {
    return new Promise((resolve) => {
      const arecord = spawn('arecord', ['-D', device, '-d', '0.1', '-f', 'cd', '-t', 'raw']);
      
      let errorOutput = '';
      let timeout;
      
      timeout = setTimeout(() => {
        arecord.kill();
        resolve(false);
      }, 2000);
      
      arecord.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });
      
      arecord.on('close', (code) => {
        clearTimeout(timeout);
        const deviceExists = code === 0 || 
                           (!errorOutput.includes('No such file or directory') && 
                            !errorOutput.includes('No such device'));
        resolve(deviceExists);
      });
      
      arecord.on('error', () => {
        clearTimeout(timeout);
        resolve(false);
      });
    });
  }

  async startScheduledRecordings() {
    const now = new Date();
    console.log(`\n${'═'.repeat(60)}`);
    console.log(`🎵 INICIANDO GRABACIONES - SOLO LIMA`);
    console.log(`📅 ${now.toLocaleString('es-PE')}`);
    console.log(`⏱️ Duración: ${RECORDING_SCHEDULE.duration} minutos`);
    console.log(`${'═'.repeat(60)}\n`);

    let successCount = 0;
    let failCount = 0;

    // SOLO grabar radios de LIMA
    const limaRadios = RADIO_CONFIG.LIMA;
    
    for (const [radioName, config] of Object.entries(limaRadios)) {
      try {
        console.log(`🎯 Iniciando: LIMA / ${radioName}`);
        const result = await this.startRecording('LIMA', radioName);
        
        if (result.status === 'started') {
          successCount++;
          console.log(`   ✅ Grabación iniciada: ${result.fileName}\n`);
        } else if (result.status === 'already_active') {
          console.log(`   ⏸️ Ya está grabando\n`);
        } else {
          failCount++;
          console.log(`   ⚠️ No se pudo iniciar: ${result.status}\n`);
        }
      } catch (error) {
        failCount++;
        console.error(`   ❌ Error: ${error.message}\n`);
      }
    }

    console.log(`${'═'.repeat(60)}`);
    console.log(`📊 RESUMEN:`);
    console.log(`   ✅ Grabaciones exitosas: ${successCount} de 3`);
    if (failCount > 0) {
      console.log(`   ❌ Grabaciones fallidas: ${failCount}`);
    }
    console.log(`   📁 Archivos en: /home/GRARADIOS/LIMA/`);
    console.log(`${'═'.repeat(60)}\n`);
  }

  async startRecording(city, radioName) {
    const recordingKey = `${city}-${radioName}`;
    
    // Verificar si ya hay una grabación activa
    if (this.activeRecordings.has(recordingKey)) {
      return { status: 'already_active' };
    }

    const config = RADIO_CONFIG[city]?.[radioName];
    if (!config) {
      throw new Error(`Configuración no encontrada para ${city}/${radioName}`);
    }

    // Crear nombre de archivo
    const now = new Date();
    const fileName = this.generateFileName(radioName, now);
    const fullPath = `${config.outputPath}/${fileName}`;

    // Asegurar que el directorio existe
    await this.fileManager.ensureDirectory(config.outputPath);

    console.log(`   📝 Dispositivo: ${config.device}`);
    console.log(`   💾 Archivo: ${fileName}`);

    // Calcular tiempo hasta el próximo intervalo programado (XX:00 o XX:30)
    const currentMinutes = now.getMinutes();
    const currentSeconds = now.getSeconds();
    
    // Convertir todo a segundos para mayor precisión
    const secondsToNextInterval = currentMinutes < 30 
      ? (30 - currentMinutes) * 60 - currentSeconds
      : (60 - currentMinutes) * 60 - currentSeconds;
    
    // Convertir a minutos para mostrar en logs y redondear hacia arriba
    const minutesToNextInterval = Math.ceil(secondsToNextInterval / 60);
    
    // Si falta menos de la duración estándar para el próximo intervalo,
    // ajustar la duración para que termine justo en el intervalo
    const standardDurationSeconds = RECORDING_SCHEDULE.duration * 60;
    const adjustedDurationSeconds = secondsToNextInterval < standardDurationSeconds 
      ? secondsToNextInterval 
      : standardDurationSeconds;
    
    const adjustedDurationMinutes = Math.ceil(adjustedDurationSeconds / 60);
    
    console.log(`   ⏱️ Duración: ${adjustedDurationMinutes} minutos ${
      adjustedDurationMinutes < RECORDING_SCHEDULE.duration 
        ? `(ajustada para terminar en el próximo intervalo XX:00/XX:30)`
        : ''
    }`);

    // Construir comando ffmpeg con duración ajustada
    const ffmpegArgs = [
      '-f', 'alsa',
      '-i', config.device,
      '-ac', '2',
      '-af', FFMPEG_CONFIG.audioFilters,
      ...FFMPEG_CONFIG.outputOptions,
      '-t', `${adjustedDurationSeconds}`,  // Duración en segundos
      '-y',
      fullPath
    ];

    // Iniciar proceso ffmpeg
    const ffmpegProcess = spawn('ffmpeg', ffmpegArgs);
    
    let errorLog = '';
    let hasError = false;
    
    ffmpegProcess.stderr.on('data', (data) => {
      const message = data.toString();
      errorLog += message;
      
      if (message.includes('No such device') || 
          message.includes('cannot open audio device') ||
          message.includes('Input/output error')) {
        hasError = true;
        console.error(`   ❌ Error de dispositivo: ${message.slice(0, 100)}`);
      }
    });

    ffmpegProcess.on('close', (code) => {
      const recording = this.activeRecordings.get(recordingKey);
      const duration = recording ? Math.floor((Date.now() - recording.startTime.getTime()) / 1000) : 0;
      
      if (code === 0) {
        console.log(`\n✅ Completado: ${radioName}`);
        console.log(`   📁 ${fileName}`);
        
        if (fs.existsSync(fullPath)) {
          const stats = fs.statSync(fullPath);
          console.log(`   📊 Tamaño: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
          console.log(`   ⏱️ Duración: ${Math.floor(duration / 60)}:${(duration % 60).toString().padStart(2, '0')}\n`);
        }
        
        this.recordingHistory.push({
          city,
          radioName,
          fileName,
          startTime: recording?.startTime,
          endTime: new Date(),
          status: 'completed',
          duration
        });
      } else {
        console.error(`\n❌ Falló: ${radioName} (código ${code})`);
        if (errorLog) {
          console.error(`   Error: ${errorLog.slice(-200)}\n`);
        }
        
        this.recordingHistory.push({
          city,
          radioName,
          fileName,
          startTime: recording?.startTime,
          endTime: new Date(),
          status: 'failed',
          error: errorLog.slice(-200)
        });
      }
      
      this.activeRecordings.delete(recordingKey);
    });

    ffmpegProcess.on('error', (error) => {
      console.error(`❌ Error ffmpeg ${radioName}: ${error.message}`);
      this.activeRecordings.delete(recordingKey);
      return { status: 'error', error: error.message };
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

    // COMENTADO: No necesitamos esto ya que cron se encarga de la programación
    // setTimeout(() => {
    //   console.log(`⏰ Reiniciando grabación: ${radioName}`);
    //   this.startRecording(city, radioName);
    // }, RECORDING_SCHEDULE.duration * 60 * 1000);

    return {
      status: 'started',
      fileName,
      startTime: now,
      duration: adjustedDurationMinutes
    };
  }

  async stopRecording(city, radioName) {
    const recordingKey = `${city}-${radioName}`;
    const recording = this.activeRecordings.get(recordingKey);

    if (!recording) {
      throw new Error(`No hay grabación activa para ${city}/${radioName}`);
    }

    console.log(`🛑 Deteniendo: ${radioName}`);
    recording.process.kill('SIGTERM');
    this.activeRecordings.delete(recordingKey);

    return {
      status: 'stopped',
      fileName: recording.fileName,
      duration: Math.floor((Date.now() - recording.startTime.getTime()) / 1000)
    };
  }

  async stopAllRecordings() {
    console.log('🛑 Deteniendo todas las grabaciones...');
    
    const promises = [];
    for (const [key, recording] of this.activeRecordings.entries()) {
      promises.push(this.stopRecording(recording.city, recording.radioName));
    }

    await Promise.allSettled(promises);
    console.log('✅ Todas las grabaciones detenidas');
  }

  generateFileName(radioName, date) {
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    
    const cleanRadioName = radioName.replace(/\s+/g, '').replace(/Ñ/g, 'N');
    
    return `${cleanRadioName}_${day}-${month}-${year}_${hours}-${minutes}-${seconds}.mp3`;
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
    
    const currentMinutes = now.getMinutes();
    if (currentMinutes < 30) {
      nextRun.setMinutes(30, 0, 0);
    } else {
      nextRun.setHours(now.getHours() + 1, 0, 0, 0);
    }
    
    return nextRun;
  }

  getRecordingHistory() {
    return this.recordingHistory.slice(-20);
  }

  async forceStartRecording() {
    console.log('\n🚀 Forzando inicio de grabaciones...');
    await this.startScheduledRecordings();
    return true;
  }
}