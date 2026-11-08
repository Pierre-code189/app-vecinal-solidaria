import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import * as Location from "expo-location";
import { api } from "../lib/api";
import { kv } from "../lib/storage";
import { useAuth } from "./auth";

const Ctx = createContext(null);

export function ZonaProvider({ children }) {
  const { usuario } = useAuth();
  const [zonas, setZonas] = useState([]);
  const [zona, setZonaState] = useState("Piura Centro");
  const [gps, setGps] = useState(null);
  const [listo, setListo] = useState(false);

  useEffect(() => {
    (async () => {
      const [z, manual, lat, lng] = await Promise.all([
        kv.get("vecinal-zona"),
        kv.get("vecinal-zona-manual"),
        kv.get("vecinal-lat"),
        kv.get("vecinal-lng"),
      ]);
      if (z) setZonaState(z);
      if (!manual && lat && lng) {
        const la = parseFloat(lat);
        const ln = parseFloat(lng);
        if (!isNaN(la) && !isNaN(ln)) setGps({ lat: la, lng: ln });
      }
      setListo(true);
    })();
    api
      .get("/api/zonas")
      .then((z) => Array.isArray(z) && setZonas(z))
      .catch(() => {});
  }, []);

  useEffect(() => {
    (async () => {
      if (!usuario?.zona) return;
      const manual = await kv.get("vecinal-zona-manual");
      if (!manual) {
        setZonaState(usuario.zona);
        kv.set("vecinal-zona", usuario.zona);
      }
    })();
  }, [usuario?.zona]);

  const setZona = async (z, manual = true) => {
    setZonaState(z);
    await kv.set("vecinal-zona", z);
    if (manual) await kv.set("vecinal-zona-manual", "1");
    setGps(null);
    await kv.del("vecinal-lat");
    await kv.del("vecinal-lng");
  };

  const usarGPS = async () => {
    let lista = zonas;
    if (!lista.length) {
      try {
        lista = await api.get("/api/zonas");
        setZonas(lista);
      } catch {
        lista = [];
      }
    }
    const permiso = await Location.requestForegroundPermissionsAsync();
    if (permiso.status !== "granted") {
      throw new Error("No diste permiso de ubicación. Elige tu sector a mano.");
    }
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
    setGps(p);
    await kv.set("vecinal-lat", String(p.lat));
    await kv.set("vecinal-lng", String(p.lng));
    let mejor = null;
    let mejorD = Infinity;
    lista.forEach((z) => {
      const d = Math.hypot(z.lat - p.lat, z.lng - p.lng);
      if (d < mejorD) {
        mejorD = d;
        mejor = z;
      }
    });
    if (mejor) {
      setZonaState(mejor.nombre);
      await kv.set("vecinal-zona", mejor.nombre);
    }
    return mejor ? mejor.nombre : null;
  };

  const ref = useMemo(() => {
    if (gps) return [gps.lat, gps.lng];
    const z = zonas.find((x) => x.nombre === zona);
    return z ? [z.lat, z.lng] : [null, null];
  }, [gps, zonas, zona]);

  const valor = useMemo(
    () => ({ zonas, setZonas, zona, setZona, gps, usarGPS, ref, listo }),
    [zonas, zona, gps, listo],
  );

  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

export const useZona = () => useContext(Ctx);
