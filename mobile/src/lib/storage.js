import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";

/* Preferencias y cola: AsyncStorage (funciona igual en web y en nativo). */
export const kv = {
  get: (k) => AsyncStorage.getItem(k),
  set: (k, v) => AsyncStorage.setItem(k, v),
  del: (k) => AsyncStorage.removeItem(k),
  getJSON: async (k, def = null) => {
    try {
      const s = await AsyncStorage.getItem(k);
      return s ? JSON.parse(s) : def;
    } catch {
      return def;
    }
  },
  setJSON: (k, v) => AsyncStorage.setItem(k, JSON.stringify(v)),
};

/* El token va en SecureStore en el teléfono; en web no existe, así que cae a AsyncStorage. */
const TOKEN_KEY = "vecinal-token";
const nativo = Platform.OS !== "web";
let tokenMemoria = "";

export async function cargarToken() {
  try {
    tokenMemoria = (nativo ? await SecureStore.getItemAsync(TOKEN_KEY) : await AsyncStorage.getItem(TOKEN_KEY)) || "";
  } catch {
    tokenMemoria = "";
  }
  return tokenMemoria;
}

export const getToken = () => tokenMemoria;

export async function setToken(t) {
  tokenMemoria = t || "";
  try {
    if (nativo) {
      if (t) await SecureStore.setItemAsync(TOKEN_KEY, t);
      else await SecureStore.deleteItemAsync(TOKEN_KEY);
    } else {
      if (t) await AsyncStorage.setItem(TOKEN_KEY, t);
      else await AsyncStorage.removeItem(TOKEN_KEY);
    }
  } catch {
    /* si el llavero falla, la sesión dura lo que dure la app */
  }
}
