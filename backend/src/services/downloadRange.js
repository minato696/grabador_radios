// backend/src/services/downloadRange.js

import archiver from 'archiver';
import fs from 'fs-extra';
import path from 'path';
import { RADIO_CONFIG } from '../config/radioConfig.js';

export class DownloadRangeService {
  constructor() {
    this.tempDir = '/tmp/radio-downloads';
  }

  async ensureTempDir() {
    await fs.ensureDir(this.tempDir);
  }

  /**
   * Descarga grabaciones por rango de fecha y hora
   */
  async downloadRange(params) {
    const { city, radio, startDate, endDate, startTime, endTime } = params;
    
    // Validar parámetros
    if (!city || !radio || !startDate || !endDate || !startTime || !endTime) {
      throw new Error('Faltan parámetros requeridos');
    }

    // Obtener configuración de la radio
    const radioConfig = RADIO_CONFIG[city]?.[radio];
    if (!radioConfig) {
      throw new Error(`Configuración no encontrada para ${city}/${radio}`);
    }

    // Crear fechas con horas
    const startDateTime = new Date(`${startDate}T${startTime}:00`);
    const endDateTime = new Date(`${endDate}T${endTime}:59`);

    if (startDateTime >= endDateTime) {
      throw new Error('La fecha/hora de inicio debe ser anterior a la fecha/hora de fin');
    }

    console.log(`📦 Preparando descarga por rango:`);
    console.log(`   Ciudad: ${city}`);
    console.log(`   Radio: ${radio}`);
    console.log(`   Desde: ${startDateTime.toLocaleString('es-PE')}`);
    console.log(`   Hasta: ${endDateTime.toLocaleString('es-PE')}`);

    // Obtener archivos que coinciden con el rango
    const matchingFiles = await this.getFilesInRange(
      radioConfig.outputPath,
      radio,
      startDateTime,
      endDateTime
    );

    if (matchingFiles.length === 0) {
      throw new Error('No se encontraron grabaciones en el rango especificado');
    }

    console.log(`✅ Se encontraron ${matchingFiles.length} archivos`);

    // Crear nombre del archivo ZIP
    const zipFileName = `${radio}_${startDate}_${endDate}_${startTime.replace(':', '')}-${endTime.replace(':', '')}.zip`;
    
    return {
      files: matchingFiles,
      zipFileName
    };
  }

  /**
   * Obtiene archivos dentro del rango de fecha/hora
   */
  async getFilesInRange(dirPath, radioName, startDateTime, endDateTime) {
    const matchingFiles = [];

    try {
      // Verificar que el directorio existe
      const dirExists = await fs.pathExists(dirPath);
      if (!dirExists) {
        console.log(`⚠️ Directorio no existe: ${dirPath}`);
        return matchingFiles;
      }

      const files = await fs.readdir(dirPath);
      
      for (const file of files) {
        if (!file.endsWith('.mp3')) continue;

        // Parsear fecha y hora del nombre del archivo
        const fileDateTime = this.parseFileDateTime(file, radioName);
        
        if (fileDateTime) {
          // Verificar si está dentro del rango
          if (fileDateTime >= startDateTime && fileDateTime <= endDateTime) {
            const filePath = path.join(dirPath, file);
            const stats = await fs.stat(filePath);
            
            matchingFiles.push({
              fileName: file,
              filePath: filePath,
              size: stats.size,
              timestamp: fileDateTime
            });
          }
        }
      }

      // Ordenar por fecha
      matchingFiles.sort((a, b) => a.timestamp - b.timestamp);
      
    } catch (error) {
      console.error(`Error al leer directorio ${dirPath}:`, error);
    }

    return matchingFiles;
  }

  /**
   * Parsea la fecha y hora del nombre del archivo
   * Formato esperado: RADIONAME_DD-MM-YYYY_HH-MM-SS.mp3
   */
  parseFileDateTime(fileName, radioName) {
    try {
      // Remover la extensión .mp3
      const nameWithoutExt = fileName.replace('.mp3', '');
      
      // Buscar el patrón de fecha y hora
      // Ejemplos: EXITOSA_25-08-2025_19-42-16 o KARIBEÑA_25-08-2025_19-00-00
      const pattern = new RegExp(`${radioName}_?(\\d{2})-(\\d{2})-(\\d{4})_(\\d{2})-(\\d{2})-(\\d{2})`);
      const match = nameWithoutExt.match(pattern);
      
      if (match) {
        const [, day, month, year, hours, minutes, seconds] = match;
        
        // Crear fecha (mes es 0-indexado en JavaScript)
        const date = new Date(
          parseInt(year),
          parseInt(month) - 1,
          parseInt(day),
          parseInt(hours),
          parseInt(minutes),
          parseInt(seconds)
        );
        
        return date;
      }

      // Intentar con formato alternativo si el primero falla
      const altPattern = /(\d{2})-(\d{2})-(\d{4})_(\d{2})-(\d{2})-(\d{2})/;
      const altMatch = fileName.match(altPattern);
      
      if (altMatch) {
        const [, day, month, year, hours, minutes, seconds] = altMatch;
        
        const date = new Date(
          parseInt(year),
          parseInt(month) - 1,
          parseInt(day),
          parseInt(hours),
          parseInt(minutes),
          parseInt(seconds)
        );
        
        return date;
      }
      
    } catch (error) {
      console.error(`Error parseando fecha de ${fileName}:`, error);
    }
    
    return null;
  }

  /**
   * Crea un archivo ZIP con los archivos especificados
   */
  createZipStream(files) {
    const archive = archiver('zip', {
      zlib: { level: 6 } // Nivel de compresión medio
    });

    // Manejar errores
    archive.on('error', (err) => {
      console.error('Error en archiver:', err);
      throw err;
    });

    // Log de progreso
    archive.on('progress', (progress) => {
      const percent = ((progress.entries.processed / progress.entries.total) * 100).toFixed(1);
      console.log(`📦 Progreso: ${percent}% (${progress.entries.processed}/${progress.entries.total} archivos)`);
    });

    // Agregar archivos al ZIP
    for (const file of files) {
      if (fs.existsSync(file.filePath)) {
        archive.file(file.filePath, { name: file.fileName });
      }
    }

    // Finalizar el archivo
    archive.finalize();

    return archive;
  }

  /**
   * Obtiene estadísticas del rango seleccionado
   */
  calculateStats(files) {
    const totalSize = files.reduce((sum, file) => sum + file.size, 0);
    const totalDuration = files.length * 30; // Asumiendo 30 minutos por archivo
    
    return {
      fileCount: files.length,
      totalSize: this.formatFileSize(totalSize),
      totalSizeBytes: totalSize,
      estimatedDuration: `${Math.floor(totalDuration / 60)}h ${totalDuration % 60}min`,
      firstFile: files[0]?.fileName,
      lastFile: files[files.length - 1]?.fileName
    };
  }

  formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  /**
   * Limpia archivos temporales
   */
  async cleanup() {
    try {
      await fs.remove(this.tempDir);
    } catch (error) {
      console.error('Error limpiando archivos temporales:', error);
    }
  }
}

export default DownloadRangeService;