// backend/src/services/audioTrimmer.js

import fs from 'fs-extra';
import path from 'path';
import { spawn } from 'child_process';
import { RADIO_CONFIG } from '../config/radioConfig.js';

export class AudioTrimmerService {
  constructor() {
    this.tempDir = '/tmp/radio-trims';
  }

  async ensureTempDir() {
    try {
      const tempDir = this.tempDir;
      console.log(`Asegurando que existe el directorio temporal: ${tempDir}`);
      await fs.ensureDir(tempDir);
      console.log(`✅ Directorio temporal listo: ${tempDir}`);
      
      // Verificar permisos
      await fs.access(tempDir, fs.constants.W_OK);
      console.log('✅ Permisos de escritura verificados');
      
      return true;
    } catch (error) {
      console.error(`❌ Error al crear directorio temporal: ${error.message}`);
      // Intentar crear en un directorio alternativo
      try {
        this.tempDir = '/tmp';
        await fs.ensureDir(this.tempDir);
        console.log(`✅ Usando directorio alternativo: ${this.tempDir}`);
        return true;
      } catch (fallbackError) {
        console.error(`❌ Error al crear directorio alternativo: ${fallbackError.message}`);
        throw new Error(`No se pudo crear el directorio temporal: ${error.message}`);
      }
    }
  }

  /**
   * Recorta un archivo de audio
   * @param {Object} params Parámetros de recorte
   * @param {string} params.city Ciudad
   * @param {string} params.radio Nombre de la radio
   * @param {string} params.fileName Nombre del archivo
   * @param {number} params.startTime Tiempo de inicio en segundos
   * @param {number} params.endTime Tiempo final en segundos
   * @returns {Promise<{filePath: string, fileName: string}>} Ruta del archivo recortado
   */
  async trimAudio(params) {
    const { city, radio, fileName, startTime, endTime } = params;
    
    // Validar parámetros
    if (!city || !radio || !fileName || startTime === undefined || endTime === undefined) {
      throw new Error('Faltan parámetros requeridos para recortar');
    }

    // Validar tiempos
    if (startTime >= endTime) {
      throw new Error('El tiempo de inicio debe ser menor que el tiempo final');
    }

    // Obtener configuración de la radio
    const radioConfig = RADIO_CONFIG[city]?.[radio];
    if (!radioConfig) {
      throw new Error(`Configuración no encontrada para ${city}/${radio}`);
    }

    // Mapeo para nombres de directorios
    const radioDirectoryMap = {
      'EXITOSA': 'EXITOSA',
      'KARIBEÑA': 'KARIBEÑA',
      'LA KALLE': 'LAKALLE',
      'LAKALLE': 'LAKALLE'
    };
    
    const radioFolder = radioDirectoryMap[radio] || radio;
    
    // Construir rutas
    const inputFilePath = path.join('/home/GRARADIOS', city, radioFolder, fileName);
    
    // Verificar que el archivo existe
    if (!await fs.pathExists(inputFilePath)) {
      throw new Error(`Archivo no encontrado: ${inputFilePath}`);
    }

    // Crear nombre para el archivo recortado
    const originalName = fileName.replace('.mp3', '');
    const startFormatted = this.formatTime(startTime);
    const endFormatted = this.formatTime(endTime);
    const trimmedFileName = `${originalName}_RECORTE_${startFormatted}-${endFormatted}.mp3`;
    
    // Asegurar que el directorio temporal existe
    await this.ensureTempDir();
    
    // Ruta del archivo de salida
    const outputFilePath = path.join(this.tempDir, trimmedFileName);
    
    console.log(`🔪 Recortando audio: ${inputFilePath}`);
    console.log(`   Desde: ${startTime}s hasta ${endTime}s`);
    console.log(`   Salida: ${outputFilePath}`);
    
    // Usar ffmpeg para recortar el archivo
    await this.executeFFmpegTrim(inputFilePath, outputFilePath, startTime, endTime);
    
    return {
      filePath: outputFilePath,
      fileName: trimmedFileName
    };
  }

  /**
   * Ejecuta el comando ffmpeg para recortar
   */
  executeFFmpegTrim(inputPath, outputPath, startTime, endTime) {
    return new Promise((resolve, reject) => {
      // Verificar que existe ffmpeg
      const ffmpegCheck = spawn('ffmpeg', ['-version']);
      let ffmpegVersionOutput = '';
      
      ffmpegCheck.stdout.on('data', (data) => {
        ffmpegVersionOutput += data.toString();
      });
      
      ffmpegCheck.on('error', (err) => {
        console.error('❌ Error: ffmpeg no está instalado o no está en el PATH');
        reject(new Error('ffmpeg no está instalado o no está en el PATH. Por favor instale ffmpeg.'));
        return;
      });
      
      ffmpegCheck.on('close', (code) => {
        if (code !== 0) {
          console.error('❌ Error al verificar ffmpeg');
          reject(new Error('No se pudo verificar la instalación de ffmpeg.'));
          return;
        }
        
        console.log(`✅ ffmpeg instalado: ${ffmpegVersionOutput.split('\n')[0]}`);
        
        // Verificar que el archivo de entrada existe
        fs.access(inputPath, fs.constants.R_OK)
          .then(() => {
            // Calcular duración
            const duration = endTime - startTime;
            
            // Construir comando ffmpeg
            const ffmpegArgs = [
              '-ss', startTime.toString(),
              '-i', inputPath,
              '-t', duration.toString(),
              '-c:a', 'copy',  // Copiar codec de audio sin recodificar para mayor velocidad
              '-y',            // Sobrescribir archivo si existe
              outputPath
            ];
            
            console.log(`🔄 Ejecutando ffmpeg con argumentos:`, ffmpegArgs);
            
            // Ejecutar ffmpeg
            const ffmpeg = spawn('ffmpeg', ffmpegArgs);
            
            let errorOutput = '';
            ffmpeg.stderr.on('data', (data) => {
              const message = data.toString();
              errorOutput += message;
              // Opcional: Log de progreso
              if (message.includes('time=')) {
                console.log(`   Progreso: ${message.split('time=')[1]?.split(' ')[0]}`);
              }
            });
            
            ffmpeg.on('close', (code) => {
              if (code === 0) {
                console.log('✅ Recorte completado con éxito');
                
                // Verificar que el archivo de salida existe y tiene tamaño
                fs.stat(outputPath)
                  .then(stats => {
                    if (stats.size > 0) {
                      console.log(`✅ Archivo generado correctamente: ${outputPath} (${stats.size} bytes)`);
                      resolve(outputPath);
                    } else {
                      console.error('❌ El archivo de salida tiene tamaño cero');
                      reject(new Error('El archivo de salida tiene tamaño cero.'));
                    }
                  })
                  .catch(err => {
                    console.error(`❌ Error al verificar archivo de salida: ${err.message}`);
                    reject(new Error(`Error al verificar archivo de salida: ${err.message}`));
                  });
              } else {
                console.error(`❌ Error al recortar (código ${code}): ${errorOutput}`);
                reject(new Error(`Error de ffmpeg (código ${code}): ${errorOutput}`));
              }
            });
            
            ffmpeg.on('error', (err) => {
              console.error('❌ Error al iniciar ffmpeg:', err);
              reject(err);
            });
          })
          .catch(err => {
            console.error(`❌ Error: El archivo de entrada no existe o no es accesible: ${inputPath}`);
            reject(new Error(`El archivo de entrada no existe o no es accesible: ${err.message}`));
          });
      });
    });
  }

  /**
   * Formatea el tiempo en formato mm_ss
   */
  formatTime(timeInSeconds) {
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    return `${minutes.toString().padStart(2, '0')}_${seconds.toString().padStart(2, '0')}`;
  }

  /**
   * Limpia archivos temporales
   */
  async cleanup() {
    try {
      // Borrar archivos más antiguos de 1 hora
      const files = await fs.readdir(this.tempDir);
      const now = Date.now();
      
      for (const file of files) {
        const filePath = path.join(this.tempDir, file);
        const stats = await fs.stat(filePath);
        
        // Si el archivo tiene más de 1 hora, borrarlo
        if (now - stats.mtimeMs > 3600000) {
          await fs.unlink(filePath);
        }
      }
    } catch (error) {
      console.error('Error limpiando archivos temporales:', error);
    }
  }
}

export default AudioTrimmerService;