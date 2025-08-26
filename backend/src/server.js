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
    
    // Construir la ruta del archivo
    const radioFolder = decodedRadio.replace(/\s+/g, '');
    const filePath = path.join('/home/GRARADIOS', decodedCity, radioFolder, decodedFileName);
    
    console.log(`Intentando servir archivo: ${filePath}`);
    
    // Verificar si el archivo existe
    if (fs.existsSync(filePath)) {
      // Configurar cabeceras para audio
      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Content-Disposition', `attachment; filename="${decodedFileName}"`);
      
      // Enviar archivo
      res.sendFile(filePath);
    } else {
      console.error(`Archivo no encontrado: ${filePath}`);
      res.status(404).json({ success: false, error: 'Archivo no encontrado' });
    }
  } catch (error) {
    console.error('Error al servir archivo de audio:', error);
    res.status(500).json({ success: false, error: 'Error al servir archivo de audio' });
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
    nextScheduledRecording: scheduler.getNextScheduledTime()
  });
});

// Ruta para iniciar/detener grabaciones manualmente
app.post('/api/recording/start', async (req, res) => {
  const { city, radio } = req.body;
  
  try {
    const result = await scheduler.startRecording(city, radio);
    res.json({ success: true, message: 'Grabación iniciada', data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/recording/stop', async (req, res) => {
  const { city, radio } = req.body;
  
  try {
    const result = await scheduler.stopRecording(city, radio);
    res.json({ success: true, message: 'Grabación detenida', data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Inicializar el sistema
async function initializeSystem() {
  try {
    console.log('🚀 Inicializando Radio Cloud System Backend...');
    
    // Crear directorios necesarios
    await fileManager.createDirectories();
    console.log('✅ Directorios creados correctamente');
    
    // Inicializar el programador de grabaciones
    await scheduler.initialize();
    console.log('✅ Programador de grabaciones inicializado');
    
    console.log('🎵 Sistema listo para grabar');
    
  } catch (error) {
    console.error('❌ Error al inicializar el sistema:', error);
    process.exit(1);
  }
}

// Manejo de cierre graceful
process.on('SIGINT', async () => {
  console.log('\n🛑 Cerrando sistema...');
  await scheduler.stopAllRecordings();
  console.log('✅ Todas las grabaciones detenidas');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Cerrando sistema...');
  await scheduler.stopAllRecordings();
  console.log('✅ Todas las grabaciones detenidas');
  process.exit(0);
});

// Iniciar servidor
app.listen(PORT, async () => {
  console.log(`🌐 Servidor ejecutándose en http://localhost:${PORT}`);
  await initializeSystem();
});

export default app;