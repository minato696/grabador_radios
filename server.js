// server.js
import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5173;

// Servir archivos estáticos desde la carpeta dist
app.use(express.static(join(__dirname, 'dist')));

// Para cualquier ruta, servir index.html (necesario para SPA con enrutamiento del lado del cliente)
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, 'dist', 'index.html'));
});

// Iniciar el servidor
app.listen(PORT, '0.0.0.0', () => {
  console.log(`📡 Frontend en producción ejecutándose en http://0.0.0.0:${PORT}`);
  console.log(`📂 Sirviendo archivos desde: ${join(__dirname, 'dist')}`);
});