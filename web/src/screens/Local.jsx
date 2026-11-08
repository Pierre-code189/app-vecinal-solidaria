import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useZona } from "../context/Zona";
import { useAuth } from "../context/Auth";
import { Icon } from "../lib/icons";
import { Btn, Segmented, Select, Tarjeta, Empty, useToast } from "../components/ui";
import DetallePub from "../components/DetallePub";
import PublicarNuevo from "../components/PublicarNuevo";

const CATS = ["", "gasfitería", "carpintería", "electricidad", "cerrajería", "clases", "alimentos",
  "paseo de mascotas", "herramientas", "movilidad", "préstamo", "otros"];

const ORDENES = [
  { value: "cercania", label: "Más cercano" },
  { value: "reciente", label: "Más reciente" },
  { value: "vistos", label: "Mejor valorado" },
];

const RADIOS = [
  { value: "0", label: "Todo" },
  { value: "1", label: "1 km" },
  { value: "2", label: "2 km" },
  { value: "5", label: "5 km" },
];

export default function Local() {
  const { zona, ref } = useZona();
  const { usuario } = useAuth();
  const toast = useToast();
  const [tipo, setTipo] = useState("servicio");
  const [cat, setCat] = useState("");
  const [orden, setOrden] = useState("cercania");
  const [radio, setRadio] = useState("0");
  const [q, setQ] = useState("");
  const [detalle, setDetalle] = useState(null);
  const [publicar, setPublicar] = useState(false);
  const [escuchando, setEscuchando] = useState(false);
  const [rapidos, setRapidos] = useState({ yape: false, barato: false, emerg: false });

  const params = new URLSearchParams({ limit: "30", orden });
  if (tipo) params.set("tipo", tipo);
  if (cat) params.set("categoria", cat);
  if (q) params.set("q", q);
  if (rapidos.yape) params.set("medios", "yape");
  if (rapidos.barato) params.set("precio_max", "20");
  if (rapidos.emerg) params.set("emergencia", "true");
  if (ref[0]) { params.set("lat", ref[0]); params.set("lng", ref[1]); }

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["lista", tipo, cat, orden, q, ref[0], ref[1], rapidos.yape, rapidos.barato, rapidos.emerg],
    queryFn: () => api.get(`/api/publicaciones?${params}`),
  });

  const items = useMemo(() => {
    let lista = data?.items || [];
    if (radio !== "0") {
      lista = lista.filter((p) => p.distancia_km != null && p.distancia_km <= Number(radio));
    }
    return lista;
  }, [data, radio]);

  const dictar = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { toast("Tu navegador no tiene dictado. Escribe la búsqueda.", "warn"); return; }
    const r = new SR();
    r.lang = "es-PE";
    r.interimResults = false;
    r.onresult = (e) => {
      const texto = e.results[0][0].transcript;
      setQ(texto);
      toast(`Buscando: ${texto}`);
    };
    r.onerror = () => toast("No pudimos escuchar. Intenta de nuevo.", "warn");
    r.onend = () => setEscuchando(false);
    setEscuchando(true);
    r.start();
  };

  const etiqueta = { servicio: "servicios", producto: "productos", "": "publicaciones" }[tipo] || "publicaciones";

  return (
    <section className="view on">
      <h1>Economía Local
        <span className="sub">Servicios y productos de tus vecinos en <b>{zona}</b>, del más cercano al más lejano</span>
      </h1>

      <Segmented value={tipo} onChange={setTipo} options={[
        { value: "", label: "Todo" },
        { value: "servicio", label: "Servicios" },
        { value: "producto", label: "Productos" },
      ]} />

      <div className="toolbar">
        <div className="buscador" data-tour="buscar">
          <input type="search" placeholder="Buscar en tu sector…" value={q}
            onChange={(e) => setQ(e.target.value)} aria-label="Buscar" />
          <button type="button" className={`mic ${escuchando ? "on" : ""}`} aria-label="Buscar por voz" onClick={dictar}>
            <Icon name="mic" />
          </button>
        </div>
        <Select ariaLabel="Categoría" value={cat} onChange={setCat} className="sel-toolbar"
          options={CATS.map((c) => ({ value: c, label: c || "Todas" }))} />
        <Btn variant="primary" icon="plus" onClick={() => setPublicar(true)} className="btn-publicar" data-tour="publicar">Publicar</Btn>
      </div>

      <div className="chips-filtro">
        <button type="button" className={`chip ${rapidos.yape ? "on" : ""}`}
          onClick={() => setRapidos({ ...rapidos, yape: !rapidos.yape })}>
          <Icon name="wallet" /> Acepta Yape
        </button>
        <button type="button" className={`chip ${rapidos.barato ? "on" : ""}`}
          onClick={() => setRapidos({ ...rapidos, barato: !rapidos.barato })}>
          Hasta S/ 20
        </button>
        <button type="button" className={`chip ${rapidos.emerg ? "on" : ""}`}
          onClick={() => setRapidos({ ...rapidos, emerg: !rapidos.emerg })}>
          <Icon name="alert" /> Para emergencias
        </button>
        {(rapidos.yape || rapidos.barato || rapidos.emerg) && (
          <button type="button" className="chip limpiar"
            onClick={() => setRapidos({ yape: false, barato: false, emerg: false })}>
            Limpiar
          </button>
        )}
      </div>

      <div className="orden">
        <span className="hint">{items.length} {etiqueta} en {zona}</span>
        <div className="orden-ctl">
          <label className="orden-lbl" htmlFor="orden">Ordenar por</label>
          <Select id="orden" ariaLabel="Ordenar por" value={orden} onChange={setOrden} options={ORDENES} />
          <Select ariaLabel="Distancia" value={radio} onChange={setRadio} options={RADIOS} />
        </div>
      </div>

      {isLoading && <div className="grid"><div className="skeleton" /><div className="skeleton" /></div>}

      {!isLoading && items.length === 0 && (
        <Empty icon="search" titulo={`No hay ${etiqueta} con ese filtro`}
          texto="Prueba con otra categoría o publica tú el primero."
          accion={<Btn variant="primary" icon="plus" onClick={() => setPublicar(true)}>Publicar</Btn>} />
      )}

      <div className="grid">
        {items.map((p, i) => (
          <Tarjeta key={p.id} p={p} zona={zona} dataTour={i === 0 ? "tarjeta" : undefined} onOpen={() => setDetalle(p.id)} />
        ))}
      </div>

      {detalle && <DetallePub id={detalle} onClose={() => setDetalle(null)} />}
      <PublicarNuevo open={publicar} inicial="servicio" onClose={() => setPublicar(false)} onPublicado={refetch} />

      {usuario && <button type="button" className="fab" aria-label="Publicar" onClick={() => setPublicar(true)}><Icon name="plus" size="1.6em" /></button>}
    </section>
  );
}
