# Radio Cloud System - Backend

Sistema de grabación automática para Radio Exitosa con soporte para múltiples filiales y radios.

## 🚀 Características

- **Grabación automática**: Cada 30 minutos, 24/7
- **Múltiples radios**: EXITOSA, KARIBEÑA, LA KALLE
- **Múltiples ciudades**: Lima, Arequipa, Chiclayo, Trujillo
- **Calidad profesional**: Filtros de audio optimizados con ffmpeg
- **API REST**: Para gestión y consulta de grabaciones
- **Programación inteligente**: Sistema de cron jobs para automatización

## 📋 Requisitos

- Node.js 18+
- ffmpeg instalado en el sistema
- Dispositivos de audio configurados (ALSA)
- Permisos de escritura en `/home/GRARADIOS/`

## 🛠️ Instalación

1. **Instalar dependencias:**
   ```bash
   cd backend
   npm install
   ```

2. **Configurar el sistema:**
   ```bash
   npm run setup
   ```

3. **Iniciar el servidor:**
   ```bash
   npm start
   ```

## 📁 Estructura de Directorios

El sistema crea automáticamente la siguiente estructura:

```
/home/GRARADIOS/
├── LIMA/
│   ├── EXITOSA/
│   ├── KARIBENA/
│   └── LAKALLE/
├── AREQUIPA/
│   ├── EXITOSA/
│   ├── KARIBENA/
│   └── LAKALLE/
├── CHICLAYO/
│   ├── EXITOSA/
│   ├── KARIBENA/
│   └── LAKALLE/
└── TRUJILLO/
    ├── EXITOSA/
    ├── KARIBENA/
    └── LAKALLE/
```

## 🎵 Configuración de Audio

### Dispositivos por Radio:
- **EXITOSA**: `plughw:USB,0`
- **KARIBEÑA**: `plughw:Pro,0`
- **LA KALLE**: `plughw:USB_1,0`

### Filtros de Audio:
- Conversión a mono
- Normalización de volumen (3.5x)
- Loudness normalization (-16 LUFS)
- Filtro pasa-altos (80Hz)
- Filtro pasa-bajos (16kHz)
- Ecualizador (2.5kHz +6dB)

### Formato de Salida:
- **Codec**: MP3 (libmp3lame)
- **Bitrate**: 56 kbps
- **Sample Rate**: 44.1 kHz
- **Canales**: Mono

## 📝 Formato de Archivos

Los archivos se guardan con el siguiente formato:
```
EXITOSA_[FECHA_18-08-2025]_[HORA_02-30-00_a.m.].mp3
```

## 🌐 API Endpoints

### Grabaciones
- `GET /api/recordings` - Obtener todas las grabaciones
- `GET /api/recordings/:city/:radio` - Grabaciones por ciudad/radio
- `DELETE /api/recordings/:city/:radio/:fileName` - Eliminar grabación

### Control del Sistema
- `GET /api/status` - Estado del sistema
- `POST /api/recording/start` - Iniciar grabación manual
- `POST /api/recording/stop` - Detener grabación

### Estadísticas
- `GET /api/recordings/stats/storage` - Estadísticas de almacenamiento

## ⏰ Programación

- **Frecuencia**: Cada 30 minutos
- **Horario**: 24 horas (00:00, 00:30, 01:00, 01:30, ...)
- **Duración**: 30 minutos por grabación
- **Solapamiento**: Las grabaciones se superponen para no perder contenido

## 🔧 Comandos Disponibles

```bash
npm start      # Iniciar servidor de producción
npm run dev    # Iniciar servidor de desarrollo (con watch)
npm run setup  # Configurar directorios del sistema
```

## 📊 Monitoreo

El sistema proporciona:
- Estado de grabaciones activas
- Próxima grabación programada
- Estadísticas de almacenamiento
- Logs detallados de operaciones

## 🛡️ Manejo de Errores

- Reintentos automáticos en caso de fallo
- Logs detallados para debugging
- Cierre graceful del sistema
- Limpieza de procesos huérfanos

## 🚨 Solución de Problemas

### Error de dispositivo de audio:
```bash
# Verificar dispositivos disponibles
arecord -l

# Probar grabación manual
arecord -D plughw:USB,0 -f cd test.wav
```

### Error de permisos:
```bash
# Crear directorio con permisos
sudo mkdir -p /home/GRARADIOS
sudo chown -R $USER:$USER /home/GRARADIOS
```

### Error de ffmpeg:
```bash
# Verificar instalación
ffmpeg -version

# Instalar si es necesario
sudo apt update && sudo apt install ffmpeg
```