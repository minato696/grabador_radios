// backend/src/services/multipleDownload.js

import archiver from 'archiver';
import fs from 'fs-extra';
import path from 'path';

export class MultipleDownloadService {
  constructor() {
    this.tempDir = '/tmp/radio-downloads-multiple';
  }

  /**
   * Descarga múltiples archivos seleccionados
   * @param {Array} files - Array de objetos con {city, radio, fileName}
   * @returns {Stream} - Stream del archivo ZIP
   */
  async downloadMultiple(files) {
    if (!files || files.length === 0) {
      throw new Error('No se proporcionaron archivos para descargar');
    }

    console.log(`📦 Preparando descarga de ${files.length} archivos`);

    // Crear archivo ZIP
    const archive = archiver('zip', {
      zlib: { level: 6 } // Nivel de compresión medio
    });

    // Manejar errores
    archive.on('error', (err) => {
      console.error('Error en archiver:', err);
      throw err;
    });

    // Log de progreso
    let processedFiles = 0;
    archive.on('entry', (entry) => {
      processedFiles++;
      console.log(`📄 Agregado: ${entry.name} (${processedFiles}/${files.length})`);
    });

    // Agregar cada archivo al ZIP
    for (const file of files) {
      const filePath = this.buildFilePath(file.city, file.radio, file.fileName);
      
      if (await fs.pathExists(filePath)) {
        console.log(`✅ Agregando: ${file.fileName}`);
        archive.file(filePath, { 
          name: file.fileName,
          prefix: `${file.city}_${file.radio}/` // Organizar en carpetas
        });
      } else {
        console.warn(`⚠️ Archivo no encontrado: ${filePath}`);
      }
    }

    // Finalizar el archivo
    archive.finalize();

    return archive;
  }

  /**
   * Construye la ruta completa del archivo
   */
  buildFilePath(city, radio, fileName) {
    // Mapeo de nombres de radio a directorios
    const radioMap = {
      'EXITOSA': 'EXITOSA',
      'KARIBEÑA': 'KARIBEÑA',
      'KARIBENA': 'KARIBEÑA', // Compatibilidad
      'LA KALLE': 'LAKALLE',
      'LAKALLE': 'LAKALLE'
    };

    const radioDir = radioMap[radio] || radio;
    return path.join('/home/GRARADIOS', city, radioDir, fileName);
  }

  /**
   * Valida que los archivos existan y retorna información
   */
  async validateFiles(files) {
    const validFiles = [];
    const invalidFiles = [];
    let totalSize = 0;

    for (const file of files) {
      const filePath = this.buildFilePath(file.city, file.radio, file.fileName);
      
      try {
        if (await fs.pathExists(filePath)) {
          const stats = await fs.stat(filePath);
          validFiles.push({
            ...file,
            path: filePath,
            size: stats.size
          });
          totalSize += stats.size;
        } else {
          invalidFiles.push({
            ...file,
            reason: 'Archivo no encontrado'
          });
        }
      } catch (error) {
        invalidFiles.push({
          ...file,
          reason: error.message
        });
      }
    }

    return {
      validFiles,
      invalidFiles,
      totalSize,
      totalSizeFormatted: this.formatFileSize(totalSize)
    };
  }

  formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }
}

export default MultipleDownloadService;