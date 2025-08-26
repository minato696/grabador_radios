import { FileManager } from './services/fileManager.js';
import { RADIO_CONFIG } from './config/radioConfig.js';

async function setupSystem() {
  console.log('🚀 Configurando Radio Cloud System...');
  
  try {
    const fileManager = new FileManager();
    
    // Crear estructura de directorios
    await fileManager.createDirectories();
    
    console.log('✅ Sistema configurado correctamente');
    console.log('\n📁 Estructura de directorios creada:');
    
    for (const [city, radios] of Object.entries(RADIO_CONFIG)) {
      console.log(`\n🏙️ ${city}:`);
      for (const [radioName, config] of Object.entries(radios)) {
        console.log(`  📻 ${radioName}: ${config.outputPath}`);
      }
    }
    
    console.log('\n🎵 Para iniciar el sistema ejecuta: npm start');
    
  } catch (error) {
    console.error('❌ Error al configurar el sistema:', error);
    process.exit(1);
  }
}

setupSystem();