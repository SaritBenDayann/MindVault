import axios from "axios";

export const CRYPTO_CONFIG = {
  STATIC_SALT: null,
  ITERATIONS: 100000,
  IV_LENGTH: 12,
  KEY_LENGTH: 256
};

function updateCryptoConfig(serverConfig) {
  if (serverConfig.staticSalt) {
    CRYPTO_CONFIG.STATIC_SALT = serverConfig.staticSalt;
  }
  if (serverConfig.iterations) {
    CRYPTO_CONFIG.ITERATIONS = serverConfig.iterations;
  }
}

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

const API = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

let configLoaded = false;
let configPromise = null;

async function loadCryptoConfig() {
  if (configLoaded) {
    return;
  }

  if (configPromise) {
    return configPromise;
  }

  configPromise = (async () => {
    try {
      const response = await API.get('/auth/crypto-config');
      const serverConfig = response.data;
      updateCryptoConfig(serverConfig);
      
      configLoaded = true;
    } catch (error) {
      throw new Error('Cannot initialize crypto without server configuration');
    }
  })();

  return configPromise;
}

loadCryptoConfig();

export async function ensureCryptoConfigLoaded() {
  await loadCryptoConfig();
}

API.interceptors.request.use((config) => {
  const token = sessionStorage.getItem("authToken");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default API;

export const loginUser = async (email, password) => {
  const response = await API.post("/auth/login", { email, password });
  return response.data;
};

export const registerUser = async (email, password) => {
  const response = await API.post("/auth/register", { email, password });
  return response.data;
};

export const logoutUser = async () => {
    await API.post("/auth/logout");
    sessionStorage.removeItem("authToken");
    sessionStorage.removeItem("masterKey");
  };

export const updatePassword = async (site, username, encryptedPassword) => {
  const response = await API.put("/vault/update", {
    site,
    username,
    password: encryptedPassword
  });
  return response.data;
};
  export const searchVault = async (query) => {
    try {
        const response = await API.get(`/vault/search?q=${encodeURIComponent(query)}`);
        return response.data.results || [];
      } catch (error) {
        console.error("Search error:", error);
        return [];
      }
  };

  export const generateAIPassword = async (prompt, site, username, history = []) => {
    try {
      const response = await API.post("/api/ai/generate-password", { 
        prompt, 
        site, 
        username, 
        history 
      });
      return response.data.response;
    } catch (error) {
      console.error("AI Generation error:", error);
      throw new Error("Failed to generate password. Please try again.");
    }
  };