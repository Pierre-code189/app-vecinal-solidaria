import { Alert } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import { api } from "./api";

/* Elige una foto y la deja lista para subir (máx. 900 px, JPEG 62%). */
export async function elegirFoto() {
  const elegir = () =>
    new Promise((resolve) => {
      Alert.alert("Agregar foto", "¿De dónde la tomamos?", [
        {
          text: "Cámara",
          onPress: async () => {
            const p = await ImagePicker.requestCameraPermissionsAsync();
            if (!p.granted) return resolve(null);
            const r = await ImagePicker.launchCameraAsync({ quality: 1, allowsEditing: false });
            resolve(r.canceled ? null : r.assets[0]);
          },
        },
        {
          text: "Galería",
          onPress: async () => {
            const p = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (!p.granted) return resolve(null);
            const r = await ImagePicker.launchImageLibraryAsync({ quality: 1, allowsEditing: false, mediaTypes: ["images"] });
            resolve(r.canceled ? null : r.assets[0]);
          },
        },
        { text: "Cancelar", style: "cancel", onPress: () => resolve(null) },
      ]);
    });
  return elegir();
}

export async function comprimir(uri, ancho = 900, calidad = 0.62) {
  const r = await manipulateAsync(uri, [{ resize: { width: ancho } }], {
    compress: calidad,
    format: SaveFormat.JPEG,
    base64: true,
  });
  return `data:image/jpeg;base64,${r.base64}`;
}

/* Sube la foto al backend (que devuelve /fotos/archivo.jpg). */
export async function subirFoto(uri) {
  const data = await comprimir(uri);
  const r = await api.post("/api/fotos", { data }, { queue: false });
  return r.url;
}

export async function adjuntarComprobante(tratoId, onOk, onError) {
  try {
    const asset = await elegirFoto();
    if (!asset) return;
    const data = await comprimir(asset.uri);
    await api.post(`/api/tratos/${tratoId}/comprobante`, { data }, { queue: false });
    onOk?.();
  } catch (e) {
    onError?.(e.message || "No pudimos subir el comprobante");
  }
}
