// backend/src/routes/trimming.js

import express from 'express';
import fs from 'fs-extra';
import { AudioTrimmerService } from '../services/audioTrimmer.js';

const router = express.Router();

// Inicializar servicio y crear directorio temporal
const trimmerService = new AudioTrimmerService();
trimmerService.ensureTempDir().catch(console.error);

// Endpoint para recortar audio
router.post('/trim', async (req, res) => {
  try {
    const { city, radio, fileName, startTime, endTime } = req.body;
    
    // Validar parámetros
    if (!city || !radio || !fileName || startTime === undefined || endTime === undefined) {
      return res.status(400).json({ 
        success: false, 
        error: 'Faltan parámetros requeridos' 
      });
    }
    
    console.log(`✂️ Solicitud de recorte: ${fileName}`);
    console.log(`   De ${startTime}s a ${endTime}s`);
    
    // Ejecutar recorte
    const result = await trimmerService.trimAudio({
      city,
      radio,
      fileName,
      startTime,
      endTime
    });
    
    // Enviar archivo como respuesta
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Disposition', `attachment; filename="${result.fileName}"`);
    
    // Crear stream del archivo y enviarlo
    const fileStream = fs.createReadStream(result.filePath);
    fileStream.pipe(res);
    
    // Programar limpieza de archivos temporales
    setTimeout(() => {
      trimmerService.cleanup().catch(console.error);
    }, 60000); // Ejecutar limpieza después de 1 minuto
    
  } catch (error) {
    console.error('Error al recortar audio:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Error al procesar el recorte de audio' 
    });
  }
});

// Agregar ruta para obtener información sobre el recorte (útil para preview)
router.post('/trim-info', async (req, res) => {
  try {
    const { city, radio, fileName, startTime, endTime } = req.body;
    
    // Validar parámetros
    if (!city || !radio || !fileName || startTime === undefined || endTime === undefined) {
      return res.status(400).json({ 
        success: false, 
        error: 'Faltan parámetros requeridos' 
      });
    }
    
    // Calcular tamaño estimado
    const duration = endTime - startTime;
    const estimatedSize = Math.round(duration * 7 / 60); // ~7KB por segundo aprox.
    
    // Crear nombre para el archivo recortado
    const originalName = fileName.replace('.mp3', '');
    const startFormatted = trimmerService.formatTime(startTime);
    const endFormatted = trimmerService.formatTime(endTime);
    const trimmedFileName = `${originalName}_RECORTE_${startFormatted}-${endFormatted}.mp3`;
    
    res.json({
      success: true,
      data: {
        fileName: trimmedFileName,
        duration,
        estimatedSize: `${estimatedSize} KB`,
        startTime,
        endTime
      }
    });
    
  } catch (error) {
    console.error('Error al obtener información de recorte:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Error al procesar la información de recorte' 
    });
  }
});

export { router as trimmingRoutes };