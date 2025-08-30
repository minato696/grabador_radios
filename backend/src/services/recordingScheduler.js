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
    
    // Determinar si debemos iniciar grabación inmediatamente
    const now = new Date();
    const currentMinutes = now.getMinutes();
    const currentSeconds = now.getSeconds();
    
    console.log(`\n🕐 Hora actual: ${now.toLocaleTimeString('es-PE')}`);
    console.log(`   Minutos: ${currentMinutes}, Segundos: ${currentSeconds}\n`);
    
    // Si estamos cerca de un intervalo de grabación (dentro de los primeros 5 minutos)
    // O si es exactamente 00 o 30 minutos, iniciamos grabación
    if (currentMinutes === 0 || currentMinutes === 30 || 
        (currentMinutes < 5) || (currentMinutes >= 30 && currentMinutes < 35)) {
      console.log('🚀 INICIANDO GRABACIONES INMEDIATAMENTE (dentro del intervalo de grabación)...\n');
      await this.startScheduledRecordings();
    } else {
      console.log('⏳ Esperando al próximo intervalo de grabación...\n');
      const nextTime = this.getNextScheduledTime();
      console.log(`⏭️ Próxima grabación: ${nextTime.toLocaleString('es-PE')}\n`);
    }
    
    // Programar grabaciones cada 30 minutos EN PUNTO
    // IMPORTANTE: El cron se ejecuta en minutos 0 y 30 de cada hora
    const cronExpression = '0,30 * * * *'; // Minuto 0 y 30 de cada hora
    
    console.log('📅 Configurando cron con expresión:', cronExpression);
    
    const task = cron.schedule(cronExpression, async () => {
      const execTime = new Date();
      console.log('\n⏰ CRON EJECUTADO:', execTime.toLocaleTimeString('es-PE'));
      
      // Detener todas las grabaciones activas antes de iniciar nuevas
      await this.stopAllRecordings();
      
      // Iniciar nuevas grabaciones programadas
      await this.startScheduledRecordings();
    }, {
      scheduled: true,
      timezone: "America/Lima" // Asegurar zona horaria de Lima
    });

    this.scheduledTasks.set('main', task);
    
    // Mostrar información de programación
    console.log('✅ Sistema configurado para grabar:');
    console.log('   • Cada 30 minutos (XX:00 y XX:30)');
    console.log('   • Duración: 30 minutos por grabación');
    console.log('   • Total: 48 grabaciones por día\n');
    
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
    console.log(`⏱️ Duración: ${RECORDING_SCHEDULE.duration} minutos (fija)`);
    console.log(`${'═'.repeat(60)}\n`);

    let successCount = 0;
    let failCount = 0;

    // SOLO grabar radios de LIMA
    const limaRadios = RADIO_CONFIG.LIMA;
    
    for (const [radioName, config] of Object.entries(limaRadios)) {
      try {
        console.log(`🎯 Iniciando: LIMA / ${radioName}`);
        
        // Primero, detener cualquier grabación activa para esta radio
        const recordingKey = `LIMA-${radioName}`;
        if (this.activeRecordings.has(recordingKey)) {
          console.log(`   ⚠️ Deteniendo grabación anterior para ${radioName}`);
          await this.stopRecording('LIMA', radioName);
        }
        
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
      console.log(`   ⚠️ Ya existe una grabación activa para ${radioName}`);
      // Detener la grabación anterior antes de iniciar una nueva
      await this.stopRecording(city, radioName).catch(err => {
        console.error(`   ❌ Error al detener grabación anterior: ${err.message}`);
      });
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

    // IMPORTANTE: Usar duración FIJA de 30 minutos
    const durationSeconds = RECORDING_SCHEDULE.duration * 60; // 30 * 60 = 1800 segundos
    
    console.log(`   ⏱️ Duración: ${RECORDING_SCHEDULE.duration} minutos (FIJA)`);

    // Construir comando ffmpeg con duración FIJA
    const ffmpegArgs = [
      '-f', 'alsa',
      '-i', config.device,
      '-ac', '2',
      '-af', FFMPEG_CONFIG.audioFilters,
      ...FFMPEG_CONFIG.outputOptions,
      '-t', durationSeconds.toString(),  // Duración FIJA en segundos
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
          console.log(`   ⏱️ Duración real: ${Math.floor(duration / 60)}:${(duration % 60).toString().padStart(2, '0')}\n`);
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

    // Agregar un temporizador de seguridad para detener la grabación
    // si continúa más allá de la duración especificada (30 minutos + 1 minuto de margen)
    const safetyTimeout = (RECORDING_SCHEDULE.duration + 1) * 60 * 1000; // 31 minutos en milisegundos
    setTimeout(() => {
      if (this.activeRecordings.has(recordingKey)) {
        console.log(`⚠️ Temporizador de seguridad activado para ${radioName}`);
        this.stopRecording(city, radioName).catch(console.error);
      }
    }, safetyTimeout);

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
    console.log('🛑 Deteniendo todas las grabaciones activas...');
    
    const promises = [];
    for (const [key, recording] of this.activeRecordings.entries()) {
      console.log(`   Deteniendo ${recording.city}/${recording.radioName}`);
      promises.push(this.stopRecording(recording.city, recording.radioName).catch(err => {
        console.error(`   Error al detener ${recording.radioName}: ${err.message}`);
      }));
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
      // Si estamos antes del minuto 30, la próxima es a los 30
      nextRun.setMinutes(30, 0, 0);
    } else {
      // Si estamos después del minuto 30, la próxima es a las 00 de la siguiente hora
      nextRun.setHours(now.getHours() + 1, 0, 0, 0);
    }
    
    return nextRun;
  }

  getRecordingHistory() {
    return this.recordingHistory.slice(-20);
  }

  async forceStartRecording() {
    console.log('\n🚀 Forzando inicio de grabaciones...');
    
    // Detener grabaciones existentes primero
    await this.stopAllRecordings();
    
    // Iniciar nuevas grabaciones
    await this.startScheduledRecordings();
    return true;
  }
}