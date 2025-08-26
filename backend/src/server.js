// backend/src/server.js

import express from 'express';
import cors from 'cors';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import { recordingRoutes } from './routes/recordings.js';
import { RecordingScheduler } from './services/recordingScheduler.js';
import { FileManager } from './services/fileManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: ['http://localhost:5173', 'http://192.168.10.49:5173'],
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.static('public'));

// Inicializar servicios
const fileManager = new FileManager();
const scheduler = new RecordingScheduler(fileManager);

// Rutas
app.use('/api/recordings', recordingRoutes);

// Ruta para servir archivos de audio
app.get('/audio/:city/:radio/:fileName', (req, res) => {
  try {
    const { city, radio, fileName } = req.params;
    
    const decodedCity = decodeURIComponent(city);
    const decodedRadio = decodeURIComponent(radio);
    const decodedFileName = decodeURIComponent(fileName);
    
    const radioDirectoryMap = {
      'EXITOSA': 'EXITOSA',
      'KARIBEÑA': 'KARIBEÑA',
      'LA KALLE': 'LAKALLE',
      'LAKALLE': 'LAKALLE'
    };
    
    const radioFolder = radioDirectoryMap[decodedRadio] || decodedRadio;
    const filePath = path.join('/home/GRARADIOS', decodedCity, radioFolder, decodedFileName);
    
    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      const fileSize = stats.size;
      
      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Content-Length', fileSize);
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Cache-Control', 'no-cache');
      
      const range = req.headers.range;
      if (range) {
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunksize = (end - start) + 1;
        
        const stream = fs.createReadStream(filePath, { start, end });
        res.status(206);
        res.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`);
        res.setHeader('Content-Length', chunksize);
        stream.pipe(res);
      } else {
        const stream = fs.createReadStream(filePath);
        stream.pipe(res);
      }
    } else {
      res.status(404).json({ success: false, error: 'Archivo no encontrado' });
    }
  } catch (error) {
    console.error('Error al servir archivo de audio:', error);
    res.status(500).json({ success: false, error: 'Error al servir archivo de audio' });
  }
});

// Ruta para descargas
app.get('/download/:city/:radio/:fileName', (req, res) => {
  try {
    const { city, radio, fileName } = req.params;
    
    const decodedCity = decodeURIComponent(city);
    const decodedRadio = decodeURIComponent(radio);
    const decodedFileName = decodeURIComponent(fileName);
    
    const radioDirectoryMap = {
      'EXITOSA': 'EXITOSA',
      'KARIBEÑA': 'KARIBEÑA',
      'LA KALLE': 'LAKALLE',
      'LAKALLE': 'LAKALLE'
    };
    
    const radioFolder = radioDirectoryMap[decodedRadio] || decodedRadio;
    const filePath = path.join('/home/GRARADIOS', decodedCity, radioFolder, decodedFileName);
    
    if (fs.existsSync(filePath)) {
      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Content-Disposition', `attachment; filename="${decodedFileName}"`);
      res.sendFile(filePath);
    } else {
      res.status(404).json({ success: false, error: 'Archivo no encontrado' });
    }
  } catch (error) {
    console.error('Error al descargar archivo:', error);
    res.status(500).json({ success: false, error: 'Error al descargar archivo' });
  }
});

// Ruta de estado del sistema
app.get('/api/status', (req, res) => {
  res.json({
    status: 'running',
    timestamp: new Date().toISOString(),
    activeRecordings: scheduler.getActiveRecordings(),
    nextScheduledRecording: scheduler.getNextScheduledTime(),
    version: '2.4.0',
    uptime: process.uptime()
  });
});

// Ruta para forzar inicio de grabación
app.post('/api/recording/force-start', async (req, res) => {
  try {
    await scheduler.forceStartRecording();
    res.json({ 
      success: true, 
      message: 'Grabaciones iniciadas manualmente',
      activeRecordings: scheduler.getActiveRecordings()
    });
  } catch (error) {
    console.error('Error al forzar inicio:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Ruta de salud
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

// Manejador de errores 404
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Ruta no encontrada',
    path: req.path
  });
});

// FUNCIÓN DE INICIALIZACIÓN AUTOMÁTICA
async function initializeSystem() {
  console.clear();
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║     📻 RADIO CLOUD SYSTEM - INICIANDO AUTOMÁTICAMENTE 📻     ║');
  console.log('║                      SOLO RADIOS DE LIMA                     ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');
  
  try {
    // 1. Verificar y crear directorios automáticamente
    console.log('📁 Creando directorios para LIMA...');
    await fs.ensureDir('/home/GRARADIOS/LIMA/EXITOSA');
    await fs.ensureDir('/home/GRARADIOS/LIMA/KARIBEÑA');
    await fs.ensureDir('/home/GRARADIOS/LIMA/LAKALLE');
    console.log('✅ Directorios listos\n');
    
    // 2. Verificar ffmpeg
    const ffmpegInstalled = await checkFfmpeg();
    if (!ffmpegInstalled) {
      console.log('⚠️  Instalando ffmpeg automáticamente...');
      await installFfmpeg();
    }
    
    // 3. Inicializar el programador de grabaciones
    console.log('🎯 Inicializando sistema de grabación...\n');
    await scheduler.initialize();
    
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║           ✅ SISTEMA INICIADO CORRECTAMENTE ✅              ║');
    console.log('║                                                             ║');
    console.log('║  Las grabaciones han comenzado automáticamente para:       ║');
    console.log('║    • Radio Exitosa Lima                                    ║');
    console.log('║    • Radio Karibeña Lima                                   ║');
    console.log('║    • Radio La Kalle Lima                                   ║');
    console.log('║                                                             ║');
    console.log('║  Duración: 30 minutos por grabación                        ║');
    console.log('║  Reinicio automático: Sí                                   ║');
    console.log('║                                                             ║');
    console.log('║  API disponible en: http://localhost:3001                  ║');
    console.log('║  Dashboard en: http://192.168.10.49:5173                   ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    
  } catch (error) {
    console.error('❌ Error al inicializar el sistema:', error);
    console.error('Intentando continuar de todos modos...');
  }
}

// Función para verificar ffmpeg
function checkFfmpeg() {
  return new Promise((resolve) => {
    const ffmpeg = spawn('ffmpeg', ['-version']);
    ffmpeg.on('error', () => resolve(false));
    ffmpeg.on('close', (code) => resolve(code === 0));
  });
}

// Función para instalar ffmpeg (requiere permisos)
function installFfmpeg() {
  return new Promise((resolve, reject) => {
    console.log('Nota: Si falla, instala manualmente con: sudo apt install ffmpeg');
    const install = spawn('sudo', ['apt', 'install', '-y', 'ffmpeg']);
    install.on('close', (code) => {
      if (code === 0) {
        console.log('✅ ffmpeg instalado correctamente');
        resolve();
      } else {
        console.log('⚠️  No se pudo instalar ffmpeg automáticamente');
        console.log('   Instálalo manualmente con: sudo apt install ffmpeg');
        resolve(); // Continuar de todos modos
      }
    });
    install.on('error', () => {
      console.log('⚠️  No se pudo instalar ffmpeg automáticamente');
      resolve(); // Continuar de todos modos
    });
  });
}

// Manejo de cierre graceful
process.on('SIGINT', async () => {
  console.log('\n\n🛑 Deteniendo sistema...');
  await scheduler.stopAllRecordings();
  console.log('✅ Grabaciones detenidas');
  console.log('👋 Adiós!\n');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await scheduler.stopAllRecordings();
  process.exit(0);
});

// Manejo de errores no capturados
process.on('uncaughtException', (error) => {
  console.error('❌ Error crítico:', error);
  scheduler.stopAllRecordings().then(() => {
    process.exit(1);
  });
});

// INICIAR SERVIDOR Y SISTEMA AUTOMÁTICAMENTE
app.listen(PORT, '0.0.0.0', async () => {
  await initializeSystem();
});

export default app;