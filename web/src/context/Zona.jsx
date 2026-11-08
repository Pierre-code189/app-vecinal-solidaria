import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useAuth } from "./Auth";

const Ctx = createContext(null);

export function ZonaProvider({ children }) {
  const { usuario } = useAuth();
  const [zonas, setZonas] = useState([]);
  const [zona, setZonaState] = useState(() => localStorage.getItem("vecinal-zona") || "Piura Centro");
  const [gps, setGps] = useState(() => {
    const lat = parseFloat(localStorage.getItem("vecinal-lat") || "");
    const lng = parseFloat(localStorage.getItem("vecinal-lng") || "");
    return lat && lng ? { lat, lng } : null;
  });

  // el sector de la cuenta manda, salvo que la persona lo haya cambiado a mano
  useEffect(() => {
    if (usuario?.zona && !localStorage.getItem("vecinal-zona-manual")) {
      setZonaState(usuario.zona);
      localStorage.setItem("vecinal-zona", usuario.zona);
    }
  }, [usuario?.zona]);

  const setZona = (z, manual = true) => {
    setZonaState(z);
    localStorage.setItem("vecinal-zona", z);
    if (manual) localStorage.setItem("vecinal-zona-manual", "1");
    setGps(null);
    localStorage.removeItem("vecinal-lat");
    localStorage.removeItem("vecinal-lng");
  };

  const usarGPS = () =>
    new Promise((resolve, reject) => {
      if (!navigator.geolocation) return reject(new Error("Este navegador no tiene GPS"));
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setGps(p);
          localStorage.setItem("vecinal-lat", String(p.lat));
          localStorage.setItem("vecinal-lng", String(p.lng));
          let mejor = null, mejorD = Infinity;
          zonas.forEach((z) => {
            const d = Math.hypot(z.lat - p.lat, z.lng - p.lng);
            if (d < mejorD) { mejorD = d; mejor = z; }
          });
          if (mejor) { setZonaState(mejor.nombre); localStorage.setItem("vecinal-zona", mejor.nombre); }
          resolve(mejor ? mejor.nombre : null);
        },
        () => reject(new Error("No pudimos ubicarte. Elige tu sector a mano.")),
        { timeout: 8000, maximumAge: 600000 },
      );
    });

  const ref = useMemo(() => {
    if (gps) return [gps.lat, gps.lng];
    const z = zonas.find((x) => x.nombre === zona);
    return z ? [z.lat, z.lng] : [null, null];
  }, [gps, zonas, zona]);

  const valor = useMemo(
    () => ({ zonas, setZonas, zona, setZona, gps, usarGPS, ref }),
    [zonas, zona, gps],
  );
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

export const useZona = () => useContext(Ctx);
