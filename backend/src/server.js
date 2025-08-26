import express from 'express';
import cors from 'cors';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { recordingRoutes } from './routes/recordings.js';
import { RecordingScheduler } from './services/recordingScheduler.js';
import { FileManager } from './services/fileManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware con configuración de CORS mejorada
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

// Ruta para servir archivos de audio con mejor manejo de codificación
app.get('/audio/:city/:radio/:fileName', (req, res) => {
  try {
    const { city, radio, fileName } = req.params;
    
    // Decodificar los parámetros de URL
    const decodedCity = decodeURIComponent(city);
    const decodedRadio = decodeURIComponent(radio);
    const decodedFileName = decodeURIComponent(fileName);
    
    console.log('Parámetros recibidos:', { decodedCity, decodedRadio, decodedFileName });
    
    // Mapeo de nombres de radio a directorios reales
    const radioDirectoryMap = {
      'EXITOSA': 'EXITOSA',
      'KARIBEÑA': 'KARIBEÑA',  // Usar el directorio con Ñ
      'LA KALLE': 'LAKALLE',
      'LAKALLE': 'LAKALLE'
    };
    
    // Obtener el nombre real del directorio
    const radioFolder = radioDirectoryMap[decodedRadio] || decodedRadio;
    const filePath = path.join('/home/GRARADIOS', decodedCity, radioFolder, decodedFileName);
    
    console.log(`Intentando servir archivo: ${filePath}`);
    
    // Verificar si el archivo existe
    if (fs.existsSync(filePath)) {
      // Obtener estadísticas del archivo
      const stats = fs.statSync(filePath);
      const fileSize = stats.size;
      
      // Configurar cabeceras para audio con soporte de range requests
      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Content-Length', fileSize);
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Cache-Control', 'no-cache');
      
      // Manejar range requests para reproducción de audio
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
        // Enviar archivo completo
        const stream = fs.createReadStream(filePath);
        stream.pipe(res);
      }
    } else {
      console.error(`Archivo no encontrado: ${filePath}`);
      
      // Intentar con el directorio alternativo (por si acaso)
      const altRadioFolder = decodedRadio === 'KARIBEÑA' ? 'KARIBENA' : radioFolder;
      const altFilePath = path.join('/home/GRARADIOS', decodedCity, altRadioFolder, decodedFileName);
      
      if (fs.existsSync(altFilePath)) {
        console.log(`Encontrado en ruta alternativa: ${altFilePath}`);
        const stream = fs.createReadStream(altFilePath);
        res.setHeader('Content-Type', 'audio/mpeg');
        stream.pipe(res);
      } else {
        res.status(404).json({ success: false, error: 'Archivo no encontrado' });
      }
    }
  } catch (error) {
    console.error('Error al servir archivo de audio:', error);
    res.status(500).json({ success: false, error: 'Error al servir archivo de audio' });
  }
});

// Ruta para descargas (similar pero con header de descarga)
app.get('/download/:city/:radio/:fileName', (req, res) => {
  try {
    const { city, radio, fileName } = req.params;
    
    // Decodificar los parámetros de URL
    const decodedCity = decodeURIComponent(city);
    const decodedRadio = decodeURIComponent(radio);
    const decodedFileName = decodeURIComponent(fileName);
    
    // Mapeo de nombres de radio a directorios reales
    const radioDirectoryMap = {
      'EXITOSA': 'EXITOSA',
      'KARIBEÑA': 'KARIBEÑA',
      'LA KALLE': 'LAKALLE',
      'LAKALLE': 'LAKALLE'
    };
    
    const radioFolder = radioDirectoryMap[decodedRadio] || decodedRadio;
    const filePath = path.join('/home/GRARADIOS', decodedCity, radioFolder, decodedFileName);
    
    console.log(`Descargando archivo: ${filePath}`);
    
    if (fs.existsSync(filePath)) {
      // Configurar cabeceras para descarga
      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Content-Disposition', `attachment; filename="${decodedFileName}"`);
      
      // Enviar archivo
      res.sendFile(filePath);
    } else {
      // Intentar ruta alternativa
      const altRadioFolder = decodedRadio === 'KARIBEÑA' ? 'KARIBENA' : radioFolder;
      const altFilePath = path.join('/home/GRARADIOS', decodedCity, altRadioFolder, decodedFileName);
      
      if (fs.existsSync(altFilePath)) {
        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('Content-Disposition', `attachment; filename="${decodedFileName}"`);
        res.sendFile(altFilePath);
      } else {
        console.error(`Archivo no encontrado para descarga: ${filePath}`);
        res.status(404).json({ success: false, error: 'Archivo no encontrado' });
      }
    }
  } catch (error) {
    console.error('Error al descargar archivo:', error);
    res.status(500).json({ success: false, error: 'Error al descargar archivo' });
  }
});

// Mantener también la ruta estática para acceso directo
app.use('/audio', express.static('/home/GRARADIOS'));

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

// Ruta para iniciar grabación manual
app.post('/api/recording/start', async (req, res) => {
  const { city, radio } = req.body;
  
  if (!city || !radio) {
    return res.status(400).json({ 
      success: false, 
      error: 'Se requiere ciudad y radio' 
    });
  }
  
  try {
    const result = await scheduler.startRecording(city, radio);
    res.json({ success: true, message: 'Grabación iniciada', data: result });
  } catch (error) {
    console.error('Error al iniciar grabación:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Ruta para detener grabación
app.post('/api/recording/stop', async (req, res) => {
  const { city, radio } = req.body;
  
  if (!city || !radio) {
    return res.status(400).json({ 
      success: false, 
      error: 'Se requiere ciudad y radio' 
    });
  }
  
  try {
    const result = await scheduler.stopRecording(city, radio);
    res.json({ success: true, message: 'Grabación detenida', data: result });
  } catch (error) {
    console.error('Error al detener grabación:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Ruta de salud/health check
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

// Ruta para obtener configuración actual
app.get('/api/config', (req, res) => {
  res.json({
    success: true,
    data: {
      cities: ['LIMA', 'AREQUIPA', 'CHICLAYO', 'TRUJILLO'],
      radios: {
        LIMA: ['EXITOSA', 'KARIBEÑA', 'LA KALLE'],
        AREQUIPA: ['EXITOSA', 'KARIBEÑA', 'LA KALLE'],
        CHICLAYO: ['EXITOSA', 'KARIBEÑA', 'LA KALLE'],
        TRUJILLO: ['EXITOSA', 'KARIBEÑA', 'LA KALLE']
      },
      recordingSchedule: {
        interval: 30,
        duration: 30
      }
    }
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

// Manejador de errores global
app.use((err, req, res, next) => {
  console.error('Error no manejado:', err);
  res.status(500).json({
    success: false,
    error: 'Error interno del servidor',
    message: err.message
  });
});

// Inicializar el sistema
async function initializeSystem() {
  try {
    console.log('🚀 Inicializando Radio Cloud System Backend...');
    console.log('📅 Fecha y hora del sistema:', new Date().toLocaleString('es-PE'));
    
    // Crear directorios necesarios
    await fileManager.createDirectories();
    console.log('✅ Directorios creados correctamente');
    
    // Verificar directorios específicos
    const dirs = [
      '/home/GRARADIOS/LIMA/EXITOSA',
      '/home/GRARADIOS/LIMA/KARIBEÑA',
      '/home/GRARADIOS/LIMA/LAKALLE'
    ];
    
    for (const dir of dirs) {
      if (fs.existsSync(dir)) {
        const files = fs.readdirSync(dir).filter(f => f.endsWith('.mp3'));
        console.log(`📁 ${dir}: ${files.length} archivos MP3`);
      } else {
        console.log(`⚠️  ${dir}: No existe`);
      }
    }
    
    // Inicializar el programador de grabaciones
    await scheduler.initialize();
    console.log('✅ Programador de grabaciones inicializado');
    
    console.log('🎵 Sistema listo para grabar');
    console.log('📡 API disponible en http://localhost:' + PORT);
    console.log('🌐 Dashboard disponible en http://192.168.10.49:5173');
    
  } catch (error) {
    console.error('❌ Error al inicializar el sistema:', error);
    process.exit(1);
  }
}

// Manejo de cierre graceful
process.on('SIGINT', async () => {
  console.log('\n🛑 Señal SIGINT recibida. Cerrando sistema...');
  await scheduler.stopAllRecordings();
  console.log('✅ Todas las grabaciones detenidas');
  console.log('👋 Adiós!');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Señal SIGTERM recibida. Cerrando sistema...');
  await scheduler.stopAllRecordings();
  console.log('✅ Todas las grabaciones detenidas');
  process.exit(0);
});

// Manejo de errores no capturados
process.on('uncaughtException', (error) => {
  console.error('❌ Error no capturado:', error);
  // No salir inmediatamente, intentar cerrar gracefully
  scheduler.stopAllRecordings().then(() => {
    process.exit(1);
  });
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Promesa rechazada no manejada:', reason);
  // Log pero no salir, a menos que sea crítico
});

// Iniciar servidor
app.listen(PORT, '0.0.0.0', async () => {
  console.log('═══════════════════════════════════════════════════');
  console.log('    📻 RADIO CLOUD SYSTEM - BACKEND v2.4.0 📻');
  console.log('═══════════════════════════════════════════════════');
  console.log(`🌐 Servidor ejecutándose en http://localhost:${PORT}`);
  console.log(`📡 Accesible en la red en http://192.168.10.49:${PORT}`);
  console.log('═══════════════════════════════════════════════════');
  await initializeSystem();
});

export default app;