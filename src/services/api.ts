const API_BASE_URL = 'http://192.168.10.49:3001/api';

export interface Recording {
  id: string;
  fileName: string;
  city: string;
  radioName: string;
  timestamp: string;
  fileSize: string;
  duration: string;
  url: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

class ApiService {
  private async fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
        ...options,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result: ApiResponse<T> = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'API request failed');
      }

      return result.data as T;
    } catch (error) {
      console.error('API Error:', error);
      throw error;
    }
  }

  async getAllRecordings(): Promise<Recording[]> {
    return this.fetchApi<Recording[]>('/recordings');
  }

  async getRecordingsByCity(city: string, radio: string): Promise<Recording[]> {
    return this.fetchApi<Recording[]>(`/recordings/${city}/${radio}`);
  }

  async getSystemStatus() {
    return this.fetchApi('/status');
  }

  async startRecording(city: string, radio: string) {
    return this.fetchApi('/recording/start', {
      method: 'POST',
      body: JSON.stringify({ city, radio }),
    });
  }

  async stopRecording(city: string, radio: string) {
    return this.fetchApi('/recording/stop', {
      method: 'POST',
      body: JSON.stringify({ city, radio }),
    });
  }

  async getStorageStats() {
    return this.fetchApi('/recordings/stats/storage');
  }

  getAudioUrl(city: string, radio: string, fileName: string): string {
    const radioPath = radio === 'KARIBEÑA' ? 'KARIBENA' : radio === 'LA KALLE' ? 'LAKALLE' : radio;
    return `${API_BASE_URL.replace('/api', '')}/audio/${city}/${radioPath}/${fileName}`;
  }

  getDownloadUrl(city: string, radio: string, fileName: string): string {
    return `${API_BASE_URL.replace('/api', '')}/download/${city}/${radio}/${fileName}`;
  }
}

export const apiService = new ApiService();