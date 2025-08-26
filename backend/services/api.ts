const API_URL = 'http://localhost:3001/api';

export const fetchRecordings = async (city: string, radio: string) => {
  try {
    const response = await fetch(`${API_URL}/recordings/${city}/${radio}`);
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'Error al obtener grabaciones');
    }
    
    return data.data;
  } catch (error) {
    console.error('Error al cargar grabaciones:', error);
    throw error;
  }
};

export const deleteRecording = async (city: string, radio: string, fileName: string) => {
  try {
    const response = await fetch(`${API_URL}/recordings/${city}/${radio}/${fileName}`, {
      method: 'DELETE',
    });
    
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'Error al eliminar grabación');
    }
    
    return data;
  } catch (error) {
    console.error('Error al eliminar grabación:', error);
    throw error;
  }
};

export const getStorageStats = async () => {
  try {
    const response = await fetch(`${API_URL}/recordings/stats/storage`);
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'Error al obtener estadísticas');
    }
    
    return data.data;
  } catch (error) {
    console.error('Error al cargar estadísticas:', error);
    throw error;
  }
};

export const getSystemStatus = async () => {
  try {
    const response = await fetch(`${API_URL}/status`);
    return await response.json();
  } catch (error) {
    console.error('Error al obtener estado del sistema:', error);
    throw error;
  }
};