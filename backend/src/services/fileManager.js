import fs from 'fs-extra';
import path from 'path';
import { RADIO_CONFIG } from '../config/radioConfig.js';

export class FileManager {
  constructor() {
    this.baseDir = '/home/GRARADIOS';
  }

  async createDirectories() {
    console.log('📁 Creando estructura de directorios...');
    
    // Crear directorio base
    await fs.ensureDir(this.baseDir);
    
    // Crear directorios para cada ciudad y radio
    for (const [city, radios] of Object.entries(RADIO_CONFIG)) {
      for (const [radioName, config] of Object.entries(radios)) {
        await fs.ensureDir(config.outputPath);
        console.log(`✅ Directorio creado: ${config.outputPath}`);
      }
    }
  }

  async ensureDirectory(dirPath) {
    await fs.ensureDir(dirPath);
  }

  async getRecordings(city, radioName) {
    const config = RADIO_CONFIG[city]?.[radioName];
    if (!config) {
      throw new Error(`Configuración no encontrada para ${city}/${radioName}`);
    }

    try {
      // Asegurar que el directorio existe
      await this.ensureDirectory(config.outputPath);
      
      const files = await fs.readdir(config.outputPath);
      const recordings = [];

      for (const file of files) {
        if (file.endsWith('.mp3')) {
          try {
            const filePath = path.join(config.outputPath, file);
            const stats = await fs.stat(filePath);
            
            // Crear URL con formato correcto
            const cleanRadioName = radioName.replace(/\s+/g, '');
            const url = `/audio/${city}/${cleanRadioName}/${file}`;
            
            recordings.push({
              id: `${city}-${radioName}-${file}`,
              fileName: file,
              city,
              radioName,
              timestamp: stats.birthtime.toISOString(),
              modifiedAt: stats.mtime.toISOString(),
              duration: '30:00', // Duración estándar
              fileSize: this.formatFileSize(stats.size),
              url: url
            });
          } catch (fileError) {
            console.error(`Error al procesar archivo ${file}:`, fileError);
            // Continuar con el siguiente archivo
          }
        }
      }

      // Ordenar por fecha de creación (más reciente primero)
      return recordings.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      
    } catch (error) {
      console.error(`Error al leer grabaciones de ${city}/${radioName}:`, error);
      return [];
    }
  }

  async getAllRecordings() {
    const allRecordings = [];
    
    try {
      for (const [city, radios] of Object.entries(RADIO_CONFIG)) {
        for (const [radioName] of Object.entries(radios)) {
          const recordings = await this.getRecordings(city, radioName);
          allRecordings.push(...recordings);
        }
      }
    } catch (error) {
      console.error('Error al obtener todas las grabaciones:', error);
    }

    return allRecordings.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }

  async deleteRecording(city, radioName, fileName) {
    const config = RADIO_CONFIG[city]?.[radioName];
    if (!config) {
      throw new Error(`Configuración no encontrada para ${city}/${radioName}`);
    }

    const filePath = path.join(config.outputPath, fileName);
    
    try {
      // Verificar que el archivo existe
      const exists = await this.fileExists(filePath);
      if (!exists) {
        throw new Error(`Archivo no encontrado: ${fileName}`);
      }
      
      await fs.unlink(filePath);
      console.log(`🗑️ Archivo eliminado: ${filePath}`);
      return { success: true, message: 'Archivo eliminado correctamente' };
    } catch (error) {
      console.error(`Error al eliminar archivo ${filePath}:`, error);
      throw new Error('Error al eliminar el archivo: ' + error.message);
    }
  }

  formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  async getStorageStats() {
    const stats = {
      totalFiles: 0,
      totalSize: 0,
      byCity: {},
      byRadio: {}
    };

    try {
      for (const [city, radios] of Object.entries(RADIO_CONFIG)) {
        stats.byCity[city] = { files: 0, size: 0 };
        
        for (const [radioName, config] of Object.entries(radios)) {
          if (!stats.byRadio[radioName]) {
            stats.byRadio[radioName] = { files: 0, size: 0 };
          }

          try {
            // Verificar que el directorio existe antes de leer
            const dirExists = await this.fileExists(config.outputPath);
            if (!dirExists) {
              console.log(`Directorio no encontrado, creando: ${config.outputPath}`);
              await fs.ensureDir(config.outputPath);
              continue;
            }
            
            const files = await fs.readdir(config.outputPath);
            
            for (const file of files) {
              if (file.endsWith('.mp3')) {
                try {
                  const filePath = path.join(config.outputPath, file);
                  const fileStats = await fs.stat(filePath);
                  
                  stats.totalFiles++;
                  stats.totalSize += fileStats.size;
                  stats.byCity[city].files++;
                  stats.byCity[city].size += fileStats.size;
                  stats.byRadio[radioName].files++;
                  stats.byRadio[radioName].size += fileStats.size;
                } catch (fileError) {
                  console.error(`Error al procesar archivo ${file}:`, fileError);
                  // Continuar con el siguiente archivo
                }
              }
            }
          } catch (dirError) {
            console.error(`Error al procesar directorio ${config.outputPath}:`, dirError);
            // Continuar con el siguiente directorio
          }
        }
      }

      // Formatear tamaños para cada ciudad y radio
      for (const city in stats.byCity) {
        stats.byCity[city].sizeFormatted = this.formatFileSize(stats.byCity[city].size);
      }
      
      for (const radio in stats.byRadio) {
        stats.byRadio[radio].sizeFormatted = this.formatFileSize(stats.byRadio[radio].size);
      }

      return {
        ...stats,
        totalSizeFormatted: this.formatFileSize(stats.totalSize)
      };
    } catch (error) {
      console.error('Error general en getStorageStats:', error);
      // Retornar estadísticas vacías en caso de error
      return {
        totalFiles: 0,
        totalSize: 0,
        totalSizeFormatted: '0 B',
        byCity: {},
        byRadio: {}
      };
    }
  }

  // Método auxiliar para verificar si un archivo o directorio existe
  async fileExists(filePath) {
    try {
      await fs.access(filePath, fs.constants.F_OK);
      return true;
    } catch (error) {
      return false;
    }
  }

  // Método para crear archivos de prueba si no existen grabaciones
  async createTestRecordingsIfNeeded() {
    for (const [city, radios] of Object.entries(RADIO_CONFIG)) {
      for (const [radioName, config] of Object.entries(radios)) {
        try {
          await this.ensureDirectory(config.outputPath);
          const files = await fs.readdir(config.outputPath);
          const mp3Files = files.filter(file => file.endsWith('.mp3'));
          
          if (mp3Files.length === 0) {
            console.log(`No hay grabaciones para ${city}/${radioName}, creando archivo de prueba...`);
            // Aquí podrías ejecutar un comando para crear un archivo MP3 de prueba
            // Por ejemplo, usando child_process para ejecutar ffmpeg
          }
        } catch (error) {
          console.error(`Error al verificar/crear grabaciones de prueba para ${city}/${radioName}:`, error);
        }
      }
    }
  }
}