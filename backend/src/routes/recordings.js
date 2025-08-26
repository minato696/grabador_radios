import express from 'express';
import { FileManager } from '../services/fileManager.js';

const router = express.Router();
const fileManager = new FileManager();

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