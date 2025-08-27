import express from 'express';
import { FileManager } from '../services/fileManager.js';
import { DownloadRangeService } from '../services/downloadRange.js';

const router = express.Router();
const fileManager = new FileManager();
const downloadService = new DownloadRangeService();

// IMPORTANTE: La ruta de estadísticas debe ir ANTES de las rutas parametrizadas
// Obtener estadísticas de almacenamiento
router.get('/stats/storage', async (req, res) => {
  try {
    const stats = await fileManager.getStorageStats();
    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('Error al obtener estadísticas de almacenamiento:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error al obtener estadísticas de almacenamiento',
      details: error.message
    });
  }
});

// NUEVA RUTA: Descarga por rango de fecha y hora
router.get('/download-range', async (req, res) => {
  try {
    const { city, radio, startDate, endDate, startTime, endTime } = req.query;
    
    console.log('📥 Solicitud de descarga por rango:', req.query);
    
    // Obtener archivos en el rango
    const result = await downloadService.downloadRange({
      city: city.toUpperCase(),
      radio: radio.toUpperCase(),
      startDate,
      endDate,
      startTime,
      endTime
    });
    
    if (result.files.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'No se encontraron grabaciones en el rango especificado' 
      });
    }
    
    // Obtener estadísticas
    const stats = downloadService.calculateStats(result.files);
    console.log('📊 Estadísticas de descarga:', stats);
    
    // Configurar headers para descarga
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${result.zipFileName}"`);
    
    // Crear y enviar el archivo ZIP
    const archive = downloadService.createZipStream(result.files);
    
    // Pipe el archivo al response
    archive.pipe(res);
    
    // Log cuando termine
    archive.on('end', () => {
      console.log('✅ Descarga completada:', result.zipFileName);
    });
    
    archive.on('error', (err) => {
      console.error('❌ Error creando ZIP:', err);
      if (!res.headersSent) {
        res.status(500).json({ 
          success: false, 
          error: 'Error al crear archivo ZIP' 
        });
      }
    });
    
  } catch (error) {
    console.error('Error en descarga por rango:', error);
    if (!res.headersSent) {
      res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  }
});

// NUEVA RUTA: Obtener información de archivos en un rango (preview)
router.post('/preview-range', async (req, res) => {
  try {
    const { city, radio, startDate, endDate, startTime, endTime } = req.body;
    
    // Obtener archivos en el rango
    const result = await downloadService.downloadRange({
      city: city.toUpperCase(),
      radio: radio.toUpperCase(),
      startDate,
      endDate,
      startTime,
      endTime
    });
    
    // Calcular estadísticas
    const stats = downloadService.calculateStats(result.files);
    
    res.json({
      success: true,
      data: {
        files: result.files.map(f => ({
          fileName: f.fileName,
          size: downloadService.formatFileSize(f.size),
          timestamp: f.timestamp.toISOString()
        })),
        stats,
        zipFileName: result.zipFileName
      }
    });
    
  } catch (error) {
    console.error('Error en preview de rango:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Obtener todas las grabaciones
router.get('/', async (req, res) => {
  try {
    const recordings = await fileManager.getAllRecordings();
    res.json({ success: true, data: recordings });
  } catch (error) {
    console.error('Error al obtener todas las grabaciones:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Obtener grabaciones por ciudad y radio
router.get('/:city/:radio', async (req, res) => {
  try {
    const { city, radio } = req.params;
    const recordings = await fileManager.getRecordings(city.toUpperCase(), radio.toUpperCase());
    res.json({ success: true, data: recordings });
  } catch (error) {
    console.error(`Error al obtener grabaciones para ${req.params.city}/${req.params.radio}:`, error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// NUEVA RUTA: Descargar múltiples archivos seleccionados
router.post('/download-multiple', async (req, res) => {
  try {
    const { files } = req.body;
    
    if (!files || !Array.isArray(files) || files.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'No se proporcionaron archivos para descargar' 
      });
    }
    
    console.log(`📦 Preparando descarga de ${files.length} archivos seleccionados`);
    
    // Importar servicio
    const { MultipleDownloadService } = await import('../services/multipleDownload.js');
    const downloadService = new MultipleDownloadService();
    
    // Validar que los archivos existan
    const validationResult = await downloadService.validateFiles(files);
    
    if (validationResult.invalidFiles.length > 0) {
      console.warn(`⚠️ ${validationResult.invalidFiles.length} archivos no encontrados`);
    }
    
    if (validationResult.validFiles.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Ninguno de los archivos seleccionados fue encontrado' 
      });
    }
    
    // Configurar headers para descarga
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="seleccion_${new Date().toISOString().split('T')[0]}.zip"`);
    
    // Crear y enviar el archivo ZIP
    const archive = await downloadService.downloadMultiple(validationResult.validFiles);
    
    // Pipe el archivo al response
    archive.pipe(res);
    
    // Log cuando termine
    archive.on('end', () => {
      console.log(`✅ Descarga múltiple completada: ${validationResult.validFiles.length} archivos`);
    });
    
    archive.on('error', (err) => {
      console.error('❌ Error creando ZIP:', err);
      if (!res.headersSent) {
        res.status(500).json({ 
          success: false, 
          error: 'Error al crear archivo ZIP' 
        });
      }
    });
    
  } catch (error) {
    console.error('Error en descarga múltiple:', error);
    if (!res.headersSent) {
      res.status(500).json({ 
        success: false, 
        error: error.message || 'Error al procesar la descarga múltiple'
      });
    }
  }
});


// Eliminar grabación
router.delete('/:city/:radio/:fileName', async (req, res) => {
  try {
    const { city, radio, fileName } = req.params;
    const result = await fileManager.deleteRecording(city.toUpperCase(), radio.toUpperCase(), fileName);
    res.json({ success: true, message: 'Grabación eliminada correctamente' });
  } catch (error) {
    console.error(`Error al eliminar grabación ${req.params.fileName}:`, error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export { router as recordingRoutes };