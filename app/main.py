"""App Vecinal Solidaria — API v2.

Implementa el Documento Técnico y de Gestión:
  · Economía Local: directorio con visto bueno, cotización, avaladores y medios de pago
  · Economía Solidaria: muro de favores + intercambios con estados y acuerdo de préstamo
  · Emergencias: tablero, activación solo por moderador, taxonomía de 72 horas
  · Moderación con panel, métricas de liquidez y privacidad por diseño

Convenciones: JSON en /api/*, sesiones Bearer con expiración, borrado suave,
idempotencia por client_id y redacción de datos personales sin sesión.
"""
from __future__ import annotations

import base64
import json
import math
import re
import secrets
import time
import uuid
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from .db import connect, hash_pw, hash_pw_salted, init_db

APP_VERSION = "4.7.0"
SESSION_TTL = 60 * 60 * 24 * 7  # 7 días

TIPOS = {"producto", "servicio", "favor_solicitado", "favor_ofrecido"}
SUBTIPOS_FAVOR = {"prestamo", "ayuda_temporal", "donacion", "intercambio_habilidades", "movilidad"}
CATEGORIAS = {
    "gasfitería", "carpintería", "electricidad", "cerrajería", "clases",
    "alimentos", "paseo de mascotas", "herramientas", "movilidad",
    "préstamo", "otros",
}
MEDIOS_PAGO = {"yape", "plin", "efectivo", "transferencia", "intercambio"}
POLITICAS_PAGO = {"contra_entrega", "mitad_mitad", "al_terminar"}
TIPOS_AVALADOR = {"ferreteria", "bodega", "olla", "parroquia", "comite", "junta"}
NECESIDADES_72H = {
    "agua_potable", "alimentos", "abrigo", "techo", "higiene", "salud",
    "balde_bidon", "herramientas", "movilidad", "alojamiento", "energia", "otro",
}
ESTADOS_PUB = {"borrador", "activa", "pausada", "resuelta", "cerrada", "vencida"}
# Sectores reales de Piura. Las coordenadas son el centro de cada sector y se
# usan cuando el vecino no comparte su GPS (RF-013a del documento).
ZONA_CENTRO = {
    "Piura Centro": (-5.19449, -80.63282),
    "Urb. Miraflores (Castilla)": (-5.18520, -80.62140),
    "Urb. Santa Isabel": (-5.18680, -80.63650),
    "Urb. Ignacio Merino": (-5.17850, -80.64210),
    "Veintiséis de Octubre": (-5.19830, -80.66120),
    "Urb. Los Ejidos": (-5.16240, -80.63190),
    "Urb. El Chipe": (-5.17420, -80.62580),
    "Catacaos Centro": (-5.26670, -80.68330),
}
ZONAS = set(ZONA_CENTRO)


# ----------------------------------------------------------------- utilidades
def clean_txt(value: Optional[str], limit: int = 2000) -> str:
    """Quita etiquetas HTML y espacios sobrantes (defensa en profundidad)."""
    if not value:
        return ""
    txt = re.sub(r"<[^>]*>", "", str(value))
    txt = re.sub(r"[<>]", "", txt)
    return txt.strip()[:limit]


def haversine_km(lat1, lng1, lat2, lng2):
    """Distancia en km, o None si falta alguna coordenada (nunca un número inventado)."""
    if None in (lat1, lng1, lat2, lng2):
        return None
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return round(2 * r * math.asin(math.sqrt(a)), 1)


def jitter(lat: Optional[float], lng: Optional[float], pub_id: str):
    """Desplaza la ubicación pública 300-500 m de forma estable por publicación."""
    if lat is None or lng is None:
        return None, None
    angle = abs(hash(pub_id)) % 360
    rad = math.radians(angle)
    d = 0.0035  # ~0.39 km
    return round(lat + d * math.cos(rad), 4), round(lng + d * math.sin(rad), 4)


app = FastAPI(
    title="App Vecinal Solidaria",
    version=APP_VERSION,
    description="Directorio vecinal, favores solidarios y tablero de emergencia.",
)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

MIGRATIONS_APPLIED = init_db()


@app.middleware("http")
async def security_headers(request: Request, call_next):
    started = time.time()
    response = await call_next(request)
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; "
        "img-src 'self' data: blob: https://*.tile.openstreetmap.fr https://server.arcgisonline.com; "
        "connect-src 'self' https://*.tile.openstreetmap.fr; object-src 'none'; base-uri 'self'"
    )
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["Permissions-Policy"] = "geolocation=(self), microphone=()"
    response.headers["X-Response-Time-ms"] = str(int((time.time() - started) * 1000))
    return response


# ----------------------------------------------------------------- límite de peticiones
_RL: dict[str, list[float]] = {}
RL_RULES = {  # ruta: (máximo, ventana en segundos)
    "/api/login": (30, 60), "/api/registro": (12, 300),
    "/api/publicaciones": (30, 60), "/api/cotizaciones": (20, 60),
    "/api/vistos": (40, 60), "/api/reportes": (10, 300),
    "/api/telefono/solicitar": (8, 300), "/api/login_pin": (30, 60),
    "/api/registro_pin": (12, 300), "/api/pin/confirmar": (15, 300),
}


def rate_limit(request: Request, path: str) -> None:
    rule = RL_RULES.get(path)
    if not rule:
        return
    limit, window = rule
    ip = request.client.host if request.client else "?"
    key = f"{path}:{ip}"
    now = time.time()
    hits = [t for t in _RL.get(key, []) if now - t < window]
    if len(hits) >= limit:
        raise HTTPException(429, "Demasiadas solicitudes. Espera un momento.")
    hits.append(now)
    _RL[key] = hits


# ----------------------------------------------------------------- modelos
class RegistroIn(BaseModel):
    nombre: str = Field(min_length=2, max_length=80)
    zona: str = Field(min_length=2, max_length=60)
    telefono: str = Field(pattern=r"^[0-9]{9}$")
    email: str = Field(min_length=6, max_length=120)
    password: str = Field(min_length=6, max_length=72)
    yape: Optional[str] = None
    plin: Optional[str] = None
    acepta_privacidad: bool = True


class LoginIn(BaseModel):
    email: str = Field(min_length=3)
    password: str = Field(min_length=1)


# --- acceso por teléfono con código y PIN de 6 dígitos (v4.3) ---
class TelefonoIn(BaseModel):
    telefono: str
    proposito: str = "registro"  # registro | acceso | pin


class RegistroPinIn(BaseModel):
    telefono: str
    codigo: str
    pin: str
    nombre: str = Field(min_length=2, max_length=80)
    zona: str
    lat: Optional[float] = None
    lng: Optional[float] = None
    yape: Optional[str] = ""
    plin: Optional[str] = ""
    acepta_privacidad: bool = True


class LoginPinIn(BaseModel):
    telefono: str
    pin: str


class ResetPinIn(BaseModel):
    telefono: str
    codigo: str
    pin: str


class PinPerfilIn(BaseModel):
    pin_actual: str
    pin_nuevo: str


class MensajeIn(BaseModel):
    contexto: str  # cotizacion | trato
    ref_id: str
    texto: str = Field(min_length=1, max_length=600)


class AceptarCotizacionIn(BaseModel):
    monto: Optional[str] = ""
    nota: Optional[str] = ""
    politica: Optional[str] = "contra_entrega"


class PagoIn(BaseModel):
    medio: Optional[str] = ""


class RolIn(BaseModel):
    telefono: str
    rol: str  # vecino | moderador | admin


class PerfilIn(BaseModel):
    nombre: Optional[str] = None
    zona: Optional[str] = None
    descripcion: Optional[str] = None
    oficios: Optional[str] = None
    yape: Optional[str] = None
    plin: Optional[str] = None
    mostrar_contacto: Optional[bool] = None


class PublicacionIn(BaseModel):
    tipo: str
    categoria: str
    subtipo_favor: Optional[str] = None
    titulo: str = Field(min_length=3, max_length=120)
    descripcion: str = Field(min_length=5, max_length=2000)
    precio: Optional[str] = ""
    medios_pago: Optional[str] = ""
    qr_yape: Optional[str] = ""
    politica_pago: Optional[str] = "contra_entrega"
    zona: str = Field(min_length=2, max_length=60)
    lat: Optional[float] = None
    lng: Optional[float] = None
    punto_encuentro: Optional[str] = ""
    franja_horaria: Optional[str] = ""
    cupo: Optional[int] = None
    checklist_ok: bool = False
    es_emergencia: bool = False
    recurso_critico: bool = False
    necesidad: Optional[str] = None
    mostrar_contacto: bool = True
    fotos: Optional[list[str]] = None
    client_id: Optional[str] = None


class PublicacionEditIn(BaseModel):
    titulo: Optional[str] = None
    descripcion: Optional[str] = None
    precio: Optional[str] = None
    medios_pago: Optional[str] = None
    estado: Optional[str] = None
    version: Optional[int] = None


class VistoIn(BaseModel):
    publicacion_id: str
    comentario: Optional[str] = ""


class ReporteIn(BaseModel):
    publicacion_id: str
    motivo: str = Field(min_length=3, max_length=300)


class ModeracionIn(BaseModel):
    reporte_id: str
    accion: str  # ninguna | ocultar | eliminar
    nota: Optional[str] = ""


class CotizacionIn(BaseModel):
    publicacion_id: str
    descripcion: str = Field(min_length=5, max_length=500)
    medida: Optional[str] = ""
    urgencia: Optional[str] = "normal"


class CotizacionRespIn(BaseModel):
    respuesta: str  # puedo | no_puedo | precio
    precio_respuesta: Optional[str] = ""
    nota: Optional[str] = ""


class IntercambioIn(BaseModel):
    peticion_id: str
    mensaje: Optional[str] = ""
    garante_nombre: Optional[str] = ""
    fecha_devolucion: Optional[str] = ""
    foto_estado: Optional[str] = ""


class IntercambioEstadoIn(BaseModel):
    estado: str  # aceptada | rechazada | en_curso | resuelta | cancelada


class TratoIn(BaseModel):
    publicacion_id: str
    monto: Optional[str] = ""
    nota: Optional[str] = ""


class TratoEstadoIn(BaseModel):
    estado: str  # cerrado | cancelado


class ResetIn(BaseModel):
    identificador: str


class ResetConfirmIn(BaseModel):
    identificador: str
    codigo: str
    password: str = Field(min_length=6, max_length=72)


class EmergenciaIn(BaseModel):
    activa: bool = False
    motivo: Optional[str] = ""


class AvaladorIn(BaseModel):
    nombre: str = Field(min_length=3, max_length=80)
    tipo: str
    zona: str
    contacto: Optional[str] = ""


# ----------------------------------------------------------------- sesión
def _bearer(request: Request) -> str:
    auth = request.headers.get("authorization", "")
    return auth[7:].strip() if auth.startswith("Bearer ") else ""


def current_user(request: Request) -> Optional[dict]:
    token = _bearer(request)
    if not token:
        return None
    con = connect()
    row = con.execute(
        "SELECT u.*, s.expira FROM sesiones s JOIN usuarios u ON u.id=s.usuario_id WHERE s.token=?",
        (token,),
    ).fetchone()
    if row and row["expira"] and row["expira"] < time.time():
        con.execute("DELETE FROM sesiones WHERE token=?", (token,))
        con.commit()
        row = None
    con.close()
    return dict(row) if row else None


def require_user(request: Request) -> dict:
    user = current_user(request)
    if not user:
        raise HTTPException(401, "Inicia sesión para continuar")
    return user


def require_moderador(request: Request) -> dict:
    user = require_user(request)
    if user["rol"] not in {"moderador", "admin"}:
        raise HTTPException(403, "Solo el moderador puede hacer esto")
    return user


def require_admin(request: Request) -> dict:
    user = require_user(request)
    if user["rol"] != "admin":
        raise HTTPException(403, "Solo el administrador puede hacer esto")
    return user


def verificar_password(user, password: str) -> bool:
    """Acepta el hash nuevo (con sal) y migra el viejo al primer login correcto."""
    try:
        sal = user["salt"] or ""
    except (IndexError, KeyError):
        sal = ""
    if sal:
        return user["pass"] == hash_pw_salted(password, sal)
    return user["pass"] == hash_pw(password)


def public_user(u: dict) -> dict:
    return {
        "id": u["id"], "nombre": u["nombre"], "zona": u["zona"],
        "email": u["email"], "rol": u["rol"], "yape": u["yape"],
        "telefono": u["telefono"], "descripcion": u.get("descripcion") or "",
        "oficios": u.get("oficios") or "",
        "telefono_verificado": bool(u.get("telefono_verificado")),
        "plin": u.get("plin") or "",
        "mostrar_contacto": bool(u.get("mostrar_contacto", 1)),
    }


def log_evento(con, tipo: str, publicacion_id=None, usuario_id=None, meta: str = "") -> None:
    con.execute(
        "INSERT INTO eventos(id,tipo,publicacion_id,usuario_id,meta,creado) VALUES(?,?,?,?,?,?)",
        (str(uuid.uuid4()), tipo, publicacion_id, usuario_id, meta, int(time.time())),
    )


def notificar(con, usuario_id: str, tipo: str, titulo: str, cuerpo: str = "", enlace: str = "") -> None:
    """Aviso interno: campana de la aplicación."""
    if not usuario_id:
        return
    con.execute(
        "INSERT INTO notificaciones(id,usuario_id,tipo,titulo,cuerpo,enlace,leida,creado)"
        " VALUES(?,?,?,?,?,?,0,?)",
        (str(uuid.uuid4()), usuario_id, tipo, titulo[:120], cuerpo[:300], enlace[:200], int(time.time())),
    )


def historial(con, entidad: str, entidad_id: str, antes, despues, actor, motivo="") -> None:
    con.execute(
        "INSERT INTO historial_estado(id,entidad,entidad_id,estado_anterior,estado_nuevo,actor_id,motivo,creado)"
        " VALUES(?,?,?,?,?,?,?,?)",
        (str(uuid.uuid4()), entidad, entidad_id, antes, despues, actor, motivo, int(time.time())),
    )


def serializar_publicacion(p: dict, viewer: Optional[dict], con) -> dict:
    """Aplica privacidad: contacto y ubicación exacta solo con sesión iniciada."""
    autor = con.execute(
        "SELECT nombre, telefono, yape, plin FROM usuarios WHERE id=?", (p["autor_id"],)
    ).fetchone()
    p["autor"] = autor["nombre"] if autor else "Vecino"
    if not p.get("nombre"):
        p["nombre"] = p["autor"]
    p["vistos"] = con.execute(
        "SELECT COUNT(*) c FROM vistos WHERE publicacion_id=?", (p["id"],)
    ).fetchone()["c"]
    avales = con.execute(
        "SELECT a.nombre, a.tipo FROM publicacion_avalador pa"
        " JOIN avaladores a ON a.id=pa.avalador_id WHERE pa.publicacion_id=? AND a.activo=1",
        (p["id"],),
    ).fetchall()
    p["avaladores"] = [{"nombre": a["nombre"], "tipo": a["tipo"]} for a in avales]
    p["lat_publica"], p["lng_publica"] = jitter(p.get("lat"), p.get("lng"), p["id"])
    # ¿La ubicación es el centro del sector (sin GPS propio)? Entonces la distancia
    # exacta sería falsa precisión: se muestra «en tu sector».
    centro = ZONA_CENTRO.get(p.get("zona") or "", (None, None))
    p["ubicacion_aproximada"] = bool(
        centro[0] is not None and p.get("lat") is not None
        and abs(p["lat"] - centro[0]) < 0.0015 and abs(p["lng"] - centro[1]) < 0.0015
    )
    # Las fotos viajan como lista, no como texto JSON (un string rompe la vista).
    fotos = p.get("fotos")
    if isinstance(fotos, str):
        try:
            p["fotos"] = json.loads(fotos) if fotos.strip() else []
        except json.JSONDecodeError:
            p["fotos"] = []
    p["fotos"] = [f for f in (p.get("fotos") or []) if isinstance(f, str) and f.startswith("/fotos/")]
    permite = bool(p.get("mostrar_contacto", 1))
    if viewer:
        ref_lat, ref_lng = viewer.get("lat_ref"), viewer.get("lng_ref")
        p["distancia_km"] = haversine_km(ref_lat, ref_lng, p.get("lat"), p.get("lng"))
        p["es_mio"] = viewer["id"] == p["autor_id"]
        if permite or p["es_mio"]:
            p["telefono"] = autor["telefono"] if autor else None
            p["yape_autor"] = (p.get("yape_snapshot") or (autor["yape"] if autor else None))
            p["plin_autor"] = (p.get("plin_snapshot") or (autor["plin"] if autor else None))
        else:
            p["telefono"] = None
            p["yape_autor"] = None
            p["plin_autor"] = None
        p["contacto_visible"] = bool(permite or p["es_mio"])
        p["ya_recomende"] = bool(con.execute(
            "SELECT 1 FROM vistos WHERE publicacion_id=? AND usuario_id=?",
            (p["id"], viewer["id"]),
        ).fetchone())
    else:
        p["distancia_km"] = None
        p["es_mio"] = False
        p["ya_recomende"] = False
        p["contacto_visible"] = False
    p.pop("lat", None)
    p.pop("lng", None)
    return p


def filtros_lista(con, *, tipo=None, categoria=None, q=None, zona=None,
                  emergencia=False, solo_recomendadas=False, tipo_favor=None):
    sql = ("SELECT p.* FROM publicaciones p WHERE p.estado='activa' AND p.deleted_at IS NULL"
           " AND (p.expira_en IS NULL OR p.expira_en > ?)")
    args: list = [int(time.time())]
    if emergencia:
        sql += " AND p.es_emergencia=1"
    elif tipo:
        sql += " AND p.tipo=?"
        args.append(tipo)
    if tipo_favor:
        sql += " AND p.tipo LIKE 'favor%' AND p.subtipo_favor=?"
        args.append(tipo_favor)
    if categoria:
        sql += " AND p.categoria=?"
        args.append(categoria)
    if zona:
        sql += " AND p.zona=?"
        args.append(zona)
    if q:
        sql += " AND (p.titulo LIKE ? OR p.descripcion LIKE ? OR p.categoria LIKE ?)"
        like = f"%{q}%"
        args += [like, like, like]
    sql += " ORDER BY p.creado DESC LIMIT 300"
    rows = [dict(r) for r in con.execute(sql, args).fetchall()]
    if solo_recomendadas:
        rows = [r for r in rows if con.execute(
            "SELECT COUNT(*) c FROM vistos WHERE publicacion_id=?", (r["id"],)).fetchone()["c"] > 0]
    return rows


# ----------------------------------------------------------------- salud
@app.get("/api/zonas")
def zonas():
    """Sectores disponibles: el cliente pinta los selectores desde aquí."""
    return [{"nombre": k, "lat": v[0], "lng": v[1]} for k, v in ZONA_CENTRO.items()]


@app.get("/api/salud")
def salud():
    con = connect()
    pubs = con.execute(
        "SELECT COUNT(*) c FROM publicaciones WHERE deleted_at IS NULL AND estado='activa'"
    ).fetchone()["c"]
    users = con.execute("SELECT COUNT(*) c FROM usuarios").fetchone()["c"]
    emerg = con.execute("SELECT activa FROM config_emergencia WHERE id='global'").fetchone()
    con.close()
    return {
        "ok": True, "app": "App Vecinal Solidaria", "version": APP_VERSION,
        "publicaciones_activas": pubs, "usuarios": users,
        "emergencia_activa": bool(emerg and emerg["activa"]),
        "migraciones": MIGRATIONS_APPLIED, "docs": "/docs",
    }


@app.get("/health")
def health():
    return {"ok": True}


# ----------------------------------------------------------------- cuenta
@app.post("/api/registro")
def registro(body: RegistroIn, request: Request):
    rate_limit(request, "/api/registro")
    email = body.email.strip().lower()
    if not re.match(r"^[^@\s]+@[^@\s]+\.[a-zA-Z]{2,}$", email):
        raise HTTPException(400, "El correo no tiene un formato válido")
    if body.zona not in ZONAS:
        raise HTTPException(400, "Elige una zona de la lista")
    if not body.acepta_privacidad:
        raise HTTPException(400, "Debes aceptar el aviso de privacidad")
    yape = (body.yape or "").strip() or None
    plin = (body.plin or "").strip() or None
    for numero, nombre in ((yape, "Yape"), (plin, "Plin")):
        if numero and not re.match(r"^[0-9]{9}$", numero):
            raise HTTPException(400, f"El número de {nombre} debe tener 9 dígitos")
    con = connect()
    if con.execute("SELECT 1 FROM usuarios WHERE email=? OR telefono=?",
                   (email, body.telefono)).fetchone():
        con.close()
        raise HTTPException(400, "Ese correo o teléfono ya está registrado")
    uid = str(uuid.uuid4())
    sal = uuid.uuid4().hex[:16]
    con.execute(
        "INSERT INTO usuarios(id,nombre,zona,telefono,email,pass,rol,yape,plin,creado,"
        "telefono_verificado,acepta_privacidad,salt) VALUES(?,?,?,?,?,?,'vecino',?,?,?,1,1,?)",
        (uid, clean_txt(body.nombre, 80), body.zona, body.telefono, email,
         hash_pw_salted(body.password, sal), yape, plin, int(time.time()), sal),
    )
    con.commit()
    con.close()
    return {"ok": True, "id": uid, "mensaje": "Cuenta creada. Ya puedes iniciar sesión."}


@app.post("/api/login")
def login(body: LoginIn, request: Request):
    rate_limit(request, "/api/login")
    con = connect()
    row = con.execute("SELECT * FROM usuarios WHERE email=?",
                      (body.email.strip().lower(),)).fetchone()
    if row and row["bloqueado_hasta"] and row["bloqueado_hasta"] > time.time():
        restante = int((row["bloqueado_hasta"] - time.time()) / 60) + 1
        con.close()
        raise HTTPException(429, f"Demasiados intentos. Prueba de nuevo en {restante} minutos "
                                "o recupera tu contraseña.")
    if not row or not verificar_password(row, body.password):
        if row:
            fallos = (row["intentos_fallidos"] or 0) + 1
            bloqueo = int(time.time()) + 15 * 60 if fallos >= 5 else None
            con.execute("UPDATE usuarios SET intentos_fallidos=?, bloqueado_hasta=? WHERE id=?",
                        (fallos, bloqueo, row["id"]))
            con.commit()
        con.close()
        raise HTTPException(401, "Correo o contraseña incorrectos")
    # Login correcto: limpiar contadores y, si el hash era viejo, actualizarlo con sal
    sal = row["salt"] or uuid.uuid4().hex[:16]
    con.execute("UPDATE usuarios SET intentos_fallidos=0, bloqueado_hasta=NULL, salt=?, pass=? WHERE id=?",
                (sal, hash_pw_salted(body.password, sal), row["id"]))
    token = uuid.uuid4().hex
    now = int(time.time())
    con.execute("INSERT INTO sesiones(token,usuario_id,creado,expira) VALUES(?,?,?,?)",
                (token, row["id"], now, now + SESSION_TTL))
    con.commit()
    con.close()
    return {"token": token, "usuario": public_user(dict(row))}



# ------------------------------------------- acceso por teléfono, código y PIN
def _tel_ok(t: str) -> bool:
    return bool(re.fullmatch(r"9\d{8}", (t or "").strip()))


def _pin_ok(p: str) -> bool:
    return bool(re.fullmatch(r"\d{6}", (p or "").strip()))


def _crear_sesion(con, uid: str) -> str:
    token = uuid.uuid4().hex
    now = int(time.time())
    con.execute("INSERT INTO sesiones(token,usuario_id,creado,expira) VALUES(?,?,?,?)",
                (token, uid, now, now + SESSION_TTL))
    con.commit()
    return token


def _pedir_codigo(con, telefono: str, proposito: str) -> str:
    """Genera un código de 6 dígitos aleatorio, válido 10 minutos y único entre los activos."""
    ahora = int(time.time())
    codigo = ""
    for _ in range(40):
        candidato = f"{secrets.randbelow(1000000):06d}"
        # Un código no puede repetirse mientras siga vigente en otro teléfono.
        ocupado = con.execute(
            "SELECT 1 FROM codigos_telefono WHERE codigo=? AND telefono!=? AND expira>?",
            (candidato, telefono, ahora)).fetchone()
        if not ocupado:
            codigo = candidato
            break
    if not codigo:
        raise HTTPException(503, "No pudimos generar un código. Intenta de nuevo.")
    con.execute(
        "INSERT INTO codigos_telefono(telefono,codigo,proposito,expira,intentos,creado)"
        " VALUES(?,?,?,?,0,?) ON CONFLICT(telefono) DO UPDATE SET codigo=excluded.codigo,"
        " proposito=excluded.proposito, expira=excluded.expira, intentos=0, creado=excluded.creado",
        (telefono, codigo, proposito, ahora + 600, ahora))
    con.commit()
    return codigo


def _verificar_codigo(con, telefono: str, codigo: str, proposito: str) -> None:
    row = con.execute("SELECT * FROM codigos_telefono WHERE telefono=?", (telefono,)).fetchone()
    if not row or row["proposito"] != proposito:
        raise HTTPException(400, "Pide un código nuevo.")
    if row["expira"] < time.time():
        raise HTTPException(400, "El código venció. Pide otro.")
    if row["intentos"] >= 5:
        raise HTTPException(429, "Demasiados intentos con este código. Pide otro.")
    if row["codigo"] != (codigo or "").strip():
        con.execute("UPDATE codigos_telefono SET intentos=intentos+1 WHERE telefono=?", (telefono,))
        con.commit()
        raise HTTPException(400, "El código no es correcto.")
    con.execute("DELETE FROM codigos_telefono WHERE telefono=?", (telefono,))
    con.commit()


@app.post("/api/telefono/solicitar")
def solicitar_codigo(body: TelefonoIn, request: Request):
    """Manda (en la demo, muestra) un código de 6 dígitos al teléfono."""
    rate_limit(request, "/api/telefono/solicitar")
    tel = (body.telefono or "").strip()
    if not _tel_ok(tel):
        raise HTTPException(400, "El teléfono debe tener 9 dígitos y empezar por 9.")
    proposito = body.proposito if body.proposito in {"registro", "acceso", "pin"} else "registro"
    con = connect()
    existe = con.execute("SELECT id FROM usuarios WHERE telefono=?", (tel,)).fetchone()
    if proposito == "registro" and existe:
        con.close()
        raise HTTPException(400, "Ese número ya tiene cuenta. Entra con tu PIN.")
    if proposito in {"acceso", "pin"} and not existe:
        # No revelamos si el número está registrado.
        con.close()
        return {"ok": True, "mensaje": "Si el número tiene cuenta, el código llegará en un momento."}
    codigo = _pedir_codigo(con, tel, proposito)
    con.close()
    # Sin proveedor de SMS el código vuelve en la respuesta. Con Twilio/Meta se envía y no se muestra.
    return {"ok": True, "codigo_demo": codigo, "expira_segundos": 600,
            "mensaje": "Código válido 10 minutos. En la demo se muestra aquí; en producción llega por SMS."}


@app.post("/api/registro_pin")
def registro_pin(body: RegistroPinIn, request: Request):
    """Crea la cuenta con teléfono verificado y PIN de 6 dígitos. Sin correo."""
    rate_limit(request, "/api/registro")
    tel = (body.telefono or "").strip()
    if not _tel_ok(tel):
        raise HTTPException(400, "El teléfono debe tener 9 dígitos y empezar por 9.")
    if not _pin_ok(body.pin):
        raise HTTPException(400, "El PIN debe tener exactamente 6 dígitos.")
    zona_nueva = (body.zona or "").strip()[:60]
    if len(zona_nueva) < 2:
        raise HTTPException(400, "Elige un sector o escribe el tuyo")
    if zona_nueva not in ZONAS and (body.lat is None or body.lng is None):
        raise HTTPException(400, "Si tu zona no está en la lista, comparte tu ubicación (GPS)")
    if not body.acepta_privacidad:
        raise HTTPException(400, "Debes aceptar el aviso de privacidad")
    for numero, nombre in ((body.yape, "Yape"), (body.plin, "Plin")):
        if (numero or "").strip() and not re.fullmatch(r"\d{9}", numero.strip()):
            raise HTTPException(400, f"El número de {nombre} debe tener 9 dígitos")
    con = connect()
    if con.execute("SELECT 1 FROM usuarios WHERE telefono=?", (tel,)).fetchone():
        con.close()
        raise HTTPException(400, "Ese número ya tiene cuenta. Entra con tu PIN.")
    _verificar_codigo(con, tel, body.codigo, "registro")
    uid = str(uuid.uuid4())
    sal = uuid.uuid4().hex[:16]
    pin_sal = uuid.uuid4().hex[:16]
    # El correo queda como marcador interno (la columna es obligatoria) pero no se usa ni se muestra.
    email_interno = f"{tel}@tel.vecinal"
    con.execute(
        "INSERT INTO usuarios(id,nombre,zona,telefono,email,pass,rol,yape,plin,creado,"
        "telefono_verificado,acepta_privacidad,salt,pin_hash,pin_salt,zona_lat,zona_lng)"
        " VALUES(?,?,?,?,?,?,'vecino',?,?,?,1,1,?,?,?,?,?)",
        (uid, clean_txt(body.nombre, 80), zona_nueva, tel, email_interno,
         hash_pw_salted(uuid.uuid4().hex, sal), (body.yape or "").strip() or None,
         (body.plin or "").strip() or None, int(time.time()), sal,
         hash_pw_salted(body.pin, pin_sal), pin_sal, body.lat, body.lng))
    con.commit()
    token = _crear_sesion(con, uid)
    fila = con.execute("SELECT * FROM usuarios WHERE id=?", (uid,)).fetchone()
    con.close()
    return {"ok": True, "token": token, "usuario": public_user(dict(fila))}


@app.post("/api/login_pin")
def login_pin(body: LoginPinIn, request: Request):
    """Entra con teléfono y PIN de 6 dígitos."""
    rate_limit(request, "/api/login")
    tel = (body.telefono or "").strip()
    if not _tel_ok(tel) or not _pin_ok(body.pin):
        raise HTTPException(400, "Revisa el teléfono y el PIN de 6 dígitos.")
    con = connect()
    row = con.execute("SELECT * FROM usuarios WHERE telefono=?", (tel,)).fetchone()
    if row and row["bloqueado_hasta"] and row["bloqueado_hasta"] > time.time():
        restante = int((row["bloqueado_hasta"] - time.time()) / 60) + 1
        con.close()
        raise HTTPException(429, f"Demasiados intentos. Prueba en {restante} minutos.")
    sal = row["pin_salt"] if row and row["pin_salt"] else ""
    ok = bool(row and sal and row["pin_hash"] == hash_pw_salted(body.pin, sal))
    if not ok:
        if row:
            fallos = (row["intentos_fallidos"] or 0) + 1
            bloqueo = int(time.time()) + 15 * 60 if fallos >= 5 else None
            con.execute("UPDATE usuarios SET intentos_fallidos=?, bloqueado_hasta=? WHERE id=?",
                        (fallos, bloqueo, row["id"]))
            con.commit()
        con.close()
        raise HTTPException(401, "Teléfono o PIN incorrectos.")
    con.execute("UPDATE usuarios SET intentos_fallidos=0, bloqueado_hasta=NULL WHERE id=?", (row["id"],))
    token = _crear_sesion(con, row["id"])
    con.close()
    return {"token": token, "usuario": public_user(dict(row))}


@app.post("/api/pin/confirmar")
def confirmar_pin(body: ResetPinIn, request: Request):
    """Cambia el PIN con un código de 6 dígitos enviado al teléfono."""
    rate_limit(request, "/api/login")
    tel = (body.telefono or "").strip()
    if not _tel_ok(tel) or not _pin_ok(body.pin):
        raise HTTPException(400, "Revisa el teléfono y el PIN de 6 dígitos.")
    con = connect()
    row = con.execute("SELECT * FROM usuarios WHERE telefono=?", (tel,)).fetchone()
    if not row:
        con.close()
        raise HTTPException(400, "No pudimos cambiar el PIN.")
    _verificar_codigo(con, tel, body.codigo, "pin")
    pin_sal = uuid.uuid4().hex[:16]
    con.execute("UPDATE usuarios SET pin_hash=?, pin_salt=?, intentos_fallidos=0, bloqueado_hasta=NULL"
                " WHERE id=?", (hash_pw_salted(body.pin, pin_sal), pin_sal, row["id"]))
    con.commit()
    con.close()
    return {"ok": True, "mensaje": "PIN actualizado. Entra con el nuevo."}


@app.post("/api/logout")
def logout(request: Request):
    token = _bearer(request)
    if token:
        con = connect()
        con.execute("DELETE FROM sesiones WHERE token=?", (token,))
        con.commit()
        con.close()
    return {"ok": True}


@app.get("/api/perfil")
def perfil(request: Request):
    return public_user(require_user(request))


@app.put("/api/perfil")
def editar_perfil(body: PerfilIn, request: Request):
    user = require_user(request)
    campos, valores = [], []
    if body.nombre:
        campos.append("nombre=?")
        valores.append(clean_txt(body.nombre, 80))
    if body.zona:
        z = (body.zona or "").strip()[:60]
        if len(z) < 2:
            raise HTTPException(400, "Zona inválida")
        campos.append("zona=?")
        valores.append(z)
    if body.descripcion is not None:
        campos.append("descripcion=?")
        valores.append(clean_txt(body.descripcion, 500))
    if body.oficios is not None:
        campos.append("oficios=?")
        valores.append(clean_txt(body.oficios, 300))
    if body.yape is not None:
        y = body.yape.strip()
        if y and not re.match(r"^[0-9]{9}$", y):
            raise HTTPException(400, "El número de Yape debe tener 9 dígitos")
        campos.append("yape=?")
        valores.append(y or None)
    if body.plin is not None:
        pl = body.plin.strip()
        if pl and not re.match(r"^[0-9]{9}$", pl):
            raise HTTPException(400, "El número de Plin debe tener 9 dígitos")
        campos.append("plin=?")
        valores.append(pl or None)
    if body.mostrar_contacto is not None:
        campos.append("mostrar_contacto=?")
        valores.append(1 if body.mostrar_contacto else 0)
    if not campos:
        raise HTTPException(400, "Nada que actualizar")
    valores.append(user["id"])
    con = connect()
    con.execute(f"UPDATE usuarios SET {', '.join(campos)} WHERE id=?", valores)
    # Si cambia su Yape o Plin, se actualizan las publicaciones activas:
    # nadie debe pagar a un número viejo por un dato desactualizado.
    tocados = 0
    if body.yape is not None or body.plin is not None:
        nuevo = con.execute("SELECT yape, plin FROM usuarios WHERE id=?", (user["id"],)).fetchone()
        tocados = con.execute(
            "UPDATE publicaciones SET yape_snapshot=?, plin_snapshot=? "
            "WHERE autor_id=? AND deleted_at IS NULL AND estado='activa'",
            (nuevo["yape"] or "", nuevo["plin"] or "", user["id"])).rowcount
    con.commit()
    row = con.execute("SELECT * FROM usuarios WHERE id=?", (user["id"],)).fetchone()
    con.close()
    salida = public_user(dict(row))
    salida["publicaciones_actualizadas"] = tocados
    return salida


@app.post("/api/perfil/pin")
def cambiar_pin_perfil(body: PinPerfilIn, request: Request):
    """Cambiar el PIN desde la cuenta: exige el PIN actual."""
    rate_limit(request, "/api/login")
    user = require_user(request)
    if not _pin_ok(body.pin_nuevo):
        raise HTTPException(400, "El PIN nuevo debe tener 6 dígitos")
    con = connect()
    row = con.execute("SELECT * FROM usuarios WHERE id=?", (user["id"],)).fetchone()
    sal = row["pin_salt"] or ""
    if not sal or row["pin_hash"] != hash_pw_salted(body.pin_actual, sal):
        con.close()
        raise HTTPException(401, "El PIN actual no coincide")
    nueva_sal = uuid.uuid4().hex[:16]
    con.execute("UPDATE usuarios SET pin_hash=?, pin_salt=? WHERE id=?",
                (hash_pw_salted(body.pin_nuevo, nueva_sal), nueva_sal, row["id"]))
    con.commit()
    con.close()
    return {"ok": True, "mensaje": "PIN actualizado"}


@app.get("/api/mis-publicaciones")
def mis_publicaciones(request: Request):
    user = require_user(request)
    con = connect()
    rows = con.execute(
        "SELECT p.*, (SELECT COUNT(*) FROM vistos v WHERE v.publicacion_id=p.id) vistos,"
        " (SELECT COUNT(*) FROM cotizaciones c WHERE c.publicacion_id=p.id) cotizaciones"
        " FROM publicaciones p WHERE p.autor_id=? AND p.deleted_at IS NULL ORDER BY p.creado DESC",
        (user["id"],),
    ).fetchall()
    out = [serializar_publicacion(dict(r), user, con) for r in rows]
    con.close()
    return out


# ----------------------------------------------------------------- publicaciones
@app.get("/api/publicaciones")
def listar(request: Request, tipo: Optional[str] = None, categoria: Optional[str] = None,
           q: Optional[str] = None, zona: Optional[str] = None, emergencia: bool = False,
           tipo_favor: Optional[str] = None, solo_recomendadas: bool = False,
           solo_favores: bool = False, orden: str = "cercania",
           medios: Optional[str] = None, precio_max: Optional[float] = None,
           necesidad: Optional[str] = None,
           lat: Optional[float] = None, lng: Optional[float] = None,
           limit: int = Query(20, ge=1, le=50), offset: int = Query(0, ge=0)):
    viewer = current_user(request)
    ref_lat, ref_lng = lat, lng
    if (ref_lat is None or ref_lng is None) and viewer:
        # Sin GPS usamos el centro del sector del vecino: distancia útil, no exacta.
        centro = ZONA_CENTRO.get(viewer.get("zona") or "", (None, None))
        if centro[0] is not None:
            ref_lat, ref_lng = centro
    if viewer:
        viewer = {**viewer, "lat_ref": ref_lat, "lng_ref": ref_lng}
    con = connect()
    ahora = int(time.time())
    vencidas = con.execute(
        "SELECT id, autor_id FROM publicaciones WHERE estado='activa' AND expira_en IS NOT NULL"
        " AND expira_en < ? AND deleted_at IS NULL", (ahora,)).fetchall()
    for v in vencidas:
        con.execute("UPDATE publicaciones SET estado='vencida' WHERE id=?", (v["id"],))
        notificar(con, v["autor_id"], "vencida", "Tu publicación venció",
                  "Pasaron 30 días. Puedes volver a publicarla cuando quieras.", "/?v=mias")
    if vencidas:
        con.commit()
    rows = filtros_lista(con, tipo=tipo, categoria=categoria, q=q, zona=zona,
                         emergencia=emergencia, solo_recomendadas=solo_recomendadas,
                         tipo_favor=tipo_favor)
    if solo_favores:
        rows = [r for r in rows if str(r.get("tipo", "")).startswith("favor")]
    if medios:
        rows = [r for r in rows if medios.lower() in str(r.get("medios_pago") or "").lower()]
    if precio_max is not None:
        def _num(txt):
            m = re.search(r"(\d+(?:[.,]\d+)?)", txt or "")
            return float(m.group(1).replace(",", ".")) if m else None
        rows = [r for r in rows if (_num(r.get("precio")) is not None and _num(r["precio"]) <= precio_max)]
    if necesidad:
        rows = [r for r in rows if r.get("necesidad") == necesidad]
    total = len(rows)
    if orden == "reciente":
        rows.sort(key=lambda r: r.get("creado") or 0, reverse=True)
    elif orden == "vistos":
        conteo = dict(con.execute("SELECT publicacion_id, COUNT(*) c FROM vistos GROUP BY publicacion_id"))
        rows.sort(key=lambda r: conteo.get(r["id"], 0), reverse=True)
    if orden == "cercania" and ref_lat is not None and ref_lng is not None:
        for r in rows:
            r["_d"] = haversine_km(ref_lat, ref_lng, r.get("lat"), r.get("lng"))
        rows.sort(key=lambda r: (r["_d"] is None, r["_d"] or 0))
    page = rows[offset: offset + limit]
    out = [serializar_publicacion(r, viewer, con) for r in page]
    # La distancia se muestra también sin sesión: sirve para decidir, no es un dato personal.
    for item, r in zip(out, page):
        if r.get("_d") is not None:
            item["distancia_km"] = round(r["_d"], 3)
    con.close()
    return {"items": out, "total": total, "limit": limit, "offset": offset,
            "has_more": offset + limit < total}


@app.get("/api/publicaciones/{pid}")
def detalle(pid: str, request: Request, lat: Optional[float] = None, lng: Optional[float] = None):
    viewer = current_user(request)
    ref_lat, ref_lng = lat, lng
    if (ref_lat is None or ref_lng is None):
        origen = (viewer.get("zona") if viewer else None) or None
        centro = ZONA_CENTRO.get(origen or "", (None, None)) if origen else (None, None)
        if centro[0] is not None:
            ref_lat, ref_lng = centro
    if viewer:
        viewer = {**viewer, "lat_ref": ref_lat, "lng_ref": ref_lng}
    con = connect()
    row = con.execute("SELECT * FROM publicaciones WHERE id=? AND deleted_at IS NULL",
                      (pid,)).fetchone()
    if not row:
        con.close()
        raise HTTPException(404, "Publicación no encontrada")
    pub = serializar_publicacion(dict(row), viewer, con)
    pub["historial"] = [dict(r) for r in con.execute(
        "SELECT estado_anterior, estado_nuevo, motivo, creado FROM historial_estado"
        " WHERE entidad='publicacion' AND entidad_id=? ORDER BY creado DESC LIMIT 10",
        (pid,)).fetchall()]
    if viewer and viewer["id"] != row["autor_id"] and pub.get("contacto_visible"):
        con.execute(
            "INSERT INTO accesos_contacto(id,publicacion_id,usuario_id,creado) VALUES(?,?,?,?)",
            (str(uuid.uuid4()), pid, viewer["id"], int(time.time())),
        )
        con.commit()
    # estado del trato entre quien mira y el autor (para saber qué botón mostrar)
    pub["mi_trato"] = None
    pub["mi_cotizacion"] = None
    if viewer and viewer["id"] != row["autor_id"]:
        tr = con.execute(
            "SELECT * FROM tratos WHERE publicacion_id=? AND comprador_id=? "
            "ORDER BY creado DESC LIMIT 1", (pid, viewer["id"])).fetchone()
        if tr:
            pub["mi_trato"] = dict(tr)
        cot = con.execute(
            "SELECT * FROM cotizaciones WHERE publicacion_id=? AND comprador_id=? "
            "ORDER BY creado DESC LIMIT 1", (pid, viewer["id"])).fetchone()
        if cot:
            pub["mi_cotizacion"] = dict(cot)
    pub["vistos_detalle"] = [dict(r) for r in con.execute(
        "SELECT v.comentario, v.creado, u.nombre, u.zona FROM vistos v"
        " JOIN usuarios u ON u.id=v.usuario_id WHERE v.publicacion_id=?"
        " ORDER BY v.creado DESC LIMIT 20", (pid,)).fetchall()]
    con.close()
    return pub


@app.post("/api/publicaciones")
def crear_publicacion(body: PublicacionIn, request: Request):
    rate_limit(request, "/api/publicaciones")
    user = require_user(request)
    if body.tipo not in TIPOS:
        raise HTTPException(400, "Tipo inválido: elige producto, servicio o favor")
    cat = clean_txt(body.categoria, 40).lower()
    if cat not in CATEGORIAS:
        raise HTTPException(400, "Categoría inválida")
    if body.tipo in {"favor_solicitado", "favor_ofrecido"}:
        if not body.subtipo_favor or body.subtipo_favor not in SUBTIPOS_FAVOR:
            raise HTTPException(400, "Elige un tipo de favor válido")
    titulo = clean_txt(body.titulo, 120)
    desc = clean_txt(body.descripcion, 2000)
    if len(titulo) < 3 or len(desc) < 5:
        raise HTTPException(400, "El título y la descripción son obligatorios")
    medios = [m.strip() for m in (body.medios_pago or "").split(",") if m.strip()]
    if any(m not in MEDIOS_PAGO for m in medios):
        raise HTTPException(400, "Medio de pago inválido")
    if body.politica_pago not in POLITICAS_PAGO:
        raise HTTPException(400, "Política de pago inválida")
    if body.qr_yape and not body.qr_yape.startswith("data:image/"):
        raise HTTPException(400, "El código QR debe ser una imagen")
    # Movilidad: nunca datos del menor ni direcciones exactas
    if body.subtipo_favor == "movilidad":
        texto = f"{titulo} {desc} {body.punto_encuentro or ''}".lower()
        if any(p in texto for p in ("colegio ", "escuela ", "dni", "mi hijo se llama")):
            raise HTTPException(
                400, "En movilidad no se puede publicar el nombre del colegio, la dirección "
                     "ni datos del menor. Usa solo zona, franja horaria y punto de encuentro público.")
        if not body.franja_horaria:
            raise HTTPException(400, "Indica la franja horaria (por ejemplo 7:00 a 8:00)")
        if not body.punto_encuentro:
            raise HTTPException(400, "Indica un punto de encuentro público")
        if not body.checklist_ok:
            raise HTTPException(400, "Confirma la lista de seguridad de movilidad")
    if body.es_emergencia and body.necesidad and body.necesidad not in NECESIDADES_72H:
        raise HTTPException(400, "Tipo de necesidad inválido")

    zona = (body.zona or "").strip()[:60] or user["zona"]
    lat, lng = body.lat, body.lng
    if lat is None or lng is None:
        if zona in ZONA_CENTRO:
            lat, lng = ZONA_CENTRO[zona]
        elif user["zona"] == zona and user["zona_lat"] is not None:
            lat, lng = user["zona_lat"], user["zona_lng"]
        else:
            raise HTTPException(400, "Si tu zona no está en la lista, comparte tu ubicación (GPS)")
    # El número de pago se copia a la publicación al crearla: si el vecino
    # cambia su Yape después, el historial no se reescribe.
    yape_pub = body.yape_snapshot if False else (user.get("yape") or "")
    plin_pub = user.get("plin") or ""
    fotos_json = json.dumps([f for f in (body.fotos or []) if str(f).startswith("/fotos/")][:3]) if body.fotos else "[]"
    necesidad = body.necesidad if (body.es_emergencia and body.necesidad in NECESIDADES_72H) else ""
    con = connect()
    cid = body.client_id or str(uuid.uuid4())
    existente = con.execute("SELECT id, autor_id FROM publicaciones WHERE client_id=?",
                            (cid,)).fetchone()
    if existente:
        con.close()
        if existente["autor_id"] == user["id"]:
            return {"ok": True, "id": existente["id"], "duplicado": True}
        raise HTTPException(409, "Ese identificador ya está en uso")

    pid = str(uuid.uuid4())
    now = int(time.time())
    con.execute(
        "INSERT INTO publicaciones(id,autor_id,tipo,categoria,subtipo_favor,titulo,descripcion,"
        "precio,medios_pago,qr_yape,politica_pago,zona,lat,lng,punto_encuentro,franja_horaria,cupo,"
        "checklist_ok,estado,es_emergencia,recurso_critico,expira_en,creado,actualizado,client_id,"
        "yape_snapshot,plin_snapshot,mostrar_contacto,fotos,necesidad)"
        " VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'activa',?,?,?,?,?,?,?,?,?,?,?)",
        (pid, user["id"], body.tipo, cat, body.subtipo_favor, titulo, desc,
         clean_txt(body.precio, 40), ",".join(medios), body.qr_yape or "",
         body.politica_pago, zona, lat, lng,
         clean_txt(body.punto_encuentro, 120), clean_txt(body.franja_horaria, 60),
         body.cupo, 1 if body.checklist_ok else 0,
         1 if body.es_emergencia else 0,
         1 if (body.recurso_critico and body.es_emergencia) else 0,
         now + 30 * 86400, now, now, cid,
         yape_pub, plin_pub, 1 if body.mostrar_contacto else 0, fotos_json, necesidad),
    )
    historial(con, "publicacion", pid, None, "activa", user["id"], "creación")
    log_evento(con, "publicacion_creada", pid, user["id"], body.tipo)
    con.commit()
    con.close()
    return {"ok": True, "id": pid}


@app.patch("/api/publicaciones/{pid}")
def editar_publicacion(pid: str, body: PublicacionEditIn, request: Request):
    user = require_user(request)
    con = connect()
    row = con.execute("SELECT * FROM publicaciones WHERE id=? AND deleted_at IS NULL",
                      (pid,)).fetchone()
    if not row:
        con.close()
        raise HTTPException(404, "Publicación no encontrada")
    if row["autor_id"] != user["id"] and user["rol"] != "moderador":
        con.close()
        raise HTTPException(403, "Solo el autor puede editar esta publicación")
    if body.version is not None and body.version != row["version"]:
        con.close()
        raise HTTPException(409, "Otro cambio se guardó antes. Recarga para ver la versión actual.")
    if row["estado"] in {"resuelta", "cerrada", "vencida"} and not body.estado:
        con.close()
        raise HTTPException(400, "Esta publicación ya está cerrada")
    campos, valores = [], []
    if body.titulo:
        campos.append("titulo=?")
        valores.append(clean_txt(body.titulo, 120))
    if body.descripcion:
        campos.append("descripcion=?")
        valores.append(clean_txt(body.descripcion, 2000))
    if body.precio is not None:
        campos.append("precio=?")
        valores.append(clean_txt(body.precio, 40))
    if body.medios_pago is not None:
        medios = [m.strip() for m in body.medios_pago.split(",") if m.strip()]
        if any(m not in MEDIOS_PAGO for m in medios):
            con.close()
            raise HTTPException(400, "Medio de pago inválido")
        campos.append("medios_pago=?")
        valores.append(",".join(medios))
    if body.estado:
        if body.estado not in ESTADOS_PUB:
            con.close()
            raise HTTPException(400, "Estado inválido")
        campos.append("estado=?")
        valores.append(body.estado)
    if not campos:
        con.close()
        raise HTTPException(400, "Nada que actualizar")
    campos += ["version=version+1", "actualizado=?"]
    valores += [int(time.time()), pid]
    con.execute(f"UPDATE publicaciones SET {', '.join(campos)} WHERE id=?", valores)
    if body.estado:
        historial(con, "publicacion", pid, row["estado"], body.estado, user["id"], "edición")
    con.commit()
    con.close()
    return {"ok": True}


@app.delete("/api/publicaciones/{pid}")
def borrar_publicacion(pid: str, request: Request, motivo: str = ""):
    user = require_user(request)
    con = connect()
    row = con.execute("SELECT * FROM publicaciones WHERE id=? AND deleted_at IS NULL",
                      (pid,)).fetchone()
    if not row:
        con.close()
        raise HTTPException(404, "Publicación no encontrada")
    if row["autor_id"] != user["id"] and user["rol"] != "moderador":
        con.close()
        raise HTTPException(403, "Solo el autor puede eliminar esta publicación")
    activos = con.execute(
        "SELECT COUNT(*) c FROM intercambios WHERE (peticion_id=? OR oferta_id=?)"
        " AND estado IN ('aceptada','en_curso')", (pid, pid)).fetchone()["c"]
    if activos and user["rol"] != "moderador":
        con.close()
        raise HTTPException(400, "No puedes eliminar: tienes un intercambio en curso")
    now = int(time.time())
    con.execute(
        "UPDATE publicaciones SET deleted_at=?, deleted_por=?, motivo_baja=?, estado='cerrada' WHERE id=?",
        (now, user["id"], clean_txt(motivo, 200), pid),
    )
    historial(con, "publicacion", pid, row["estado"], "eliminada", user["id"], clean_txt(motivo, 200))
    con.commit()
    con.close()
    return {"ok": True}


# ----------------------------------------------------------------- visto bueno
@app.post("/api/vistos")
def dar_visto(body: VistoIn, request: Request):
    rate_limit(request, "/api/vistos")
    user = require_user(request)
    con = connect()
    pub = con.execute("SELECT * FROM publicaciones WHERE id=? AND deleted_at IS NULL",
                      (body.publicacion_id,)).fetchone()
    if not pub:
        con.close()
        raise HTTPException(404, "Publicación no encontrada")
    if pub["autor_id"] == user["id"]:
        con.close()
        raise HTTPException(400, "No puedes recomendar tu propia publicación")
    if pub["estado"] not in {"activa", "resuelta"}:
        con.close()
        raise HTTPException(400, "Solo se puede recomendar publicaciones activas o cerradas")
    trato = con.execute(
        "SELECT 1 FROM tratos WHERE publicacion_id=? AND comprador_id=? AND estado='cerrado'",
        (body.publicacion_id, user["id"]),
    ).fetchone()
    intercambio = con.execute(
        "SELECT 1 FROM intercambios i JOIN publicaciones p ON p.id=i.peticion_id"
        " WHERE i.peticion_id=? AND i.estado='resuelta' AND i.ofertante_id=?",
        (body.publicacion_id, user["id"]),
    ).fetchone()
    if not trato and not intercambio:
        con.close()
        raise HTTPException(
            400, "Solo puedes recomendar un servicio que hayas cerrado con la otra persona. "
                 "Marca primero \"cerramos el trato\".")
    # Freno al "visto bueno en manada": máximo 5 al día por persona.
    hoy = con.execute("SELECT COUNT(*) c FROM vistos WHERE usuario_id=? AND creado>?",
                      (user["id"], int(time.time()) - 86400)).fetchone()["c"]
    if hoy >= 5:
        con.close()
        raise HTTPException(429, "Diste 5 vistos buenos hoy. Mañana podrás dar más.")
    trato_id = ""
    if trato:
        fila = con.execute(
            "SELECT id FROM tratos WHERE publicacion_id=? AND comprador_id=? AND estado='cerrado'"
            " ORDER BY cerrado_en DESC LIMIT 1", (body.publicacion_id, user["id"])).fetchone()
        trato_id = fila["id"] if fila else ""
    try:
        con.execute(
            "INSERT INTO vistos(id,publicacion_id,usuario_id,comentario,creado,trato_id) VALUES(?,?,?,?,?,?)",
            (str(uuid.uuid4()), body.publicacion_id, user["id"],
             clean_txt(body.comentario, 300), int(time.time()), trato_id),
        )
        con.commit()
    except Exception:
        con.close()
        raise HTTPException(400, "Ya recomendaste esta publicación")
    log_evento(con, "visto_bueno", body.publicacion_id, user["id"])
    con.commit()
    n = con.execute("SELECT COUNT(*) c FROM vistos WHERE publicacion_id=?",
                    (body.publicacion_id,)).fetchone()["c"]
    con.close()
    return {"ok": True, "vistos": n}


@app.delete("/api/vistos/{publicacion_id}")
def quitar_visto(publicacion_id: str, request: Request):
    user = require_user(request)
    con = connect()
    con.execute("DELETE FROM vistos WHERE publicacion_id=? AND usuario_id=?",
                (publicacion_id, user["id"]))
    con.commit()
    con.close()
    return {"ok": True}


@app.get("/api/vistos/{publicacion_id}")
def lista_vistos(publicacion_id: str):
    con = connect()
    rows = con.execute(
        "SELECT v.comentario, v.creado, u.nombre, u.zona FROM vistos v"
        " JOIN usuarios u ON u.id=v.usuario_id WHERE v.publicacion_id=?"
        " ORDER BY v.creado DESC", (publicacion_id,)).fetchall()
    con.close()
    return [dict(r) for r in rows]


# ----------------------------------------------------------------- reportes y moderación
@app.post("/api/reportes")
def reportar(body: ReporteIn, request: Request):
    rate_limit(request, "/api/reportes")
    user = require_user(request)
    con = connect()
    pub = con.execute("SELECT autor_id FROM publicaciones WHERE id=? AND deleted_at IS NULL",
                      (body.publicacion_id,)).fetchone()
    if not pub:
        con.close()
        raise HTTPException(404, "Publicación no encontrada")
    if pub["autor_id"] == user["id"]:
        con.close()
        raise HTTPException(400, "No puedes reportar tu propia publicación")
    if con.execute("SELECT 1 FROM reportes WHERE publicacion_id=? AND usuario_id=?",
                   (body.publicacion_id, user["id"])).fetchone():
        con.close()
        raise HTTPException(400, "Ya reportaste esta publicación")
    con.execute("INSERT INTO reportes(id,publicacion_id,usuario_id,motivo,creado) VALUES(?,?,?,?,?)",
                (str(uuid.uuid4()), body.publicacion_id, user["id"],
                 clean_txt(body.motivo, 300), int(time.time())))
    con.commit()
    con.close()
    return {"ok": True, "mensaje": "Reporte enviado. El moderador lo revisará en menos de 24 horas."}


@app.get("/api/moderacion/reportes")
def reportes_pendientes(request: Request):
    require_moderador(request)
    con = connect()
    rows = con.execute(
        "SELECT r.*, p.titulo, p.autor_id, u.nombre AS reportante FROM reportes r"
        " JOIN publicaciones p ON p.id=r.publicacion_id"
        " JOIN usuarios u ON u.id=r.usuario_id"
        " WHERE r.estado='pendiente' ORDER BY r.creado DESC").fetchall()
    con.close()
    return [dict(r) for r in rows]


@app.post("/api/moderacion/reportes")
def resolver_reporte(body: ModeracionIn, request: Request):
    mod = require_moderador(request)
    if body.accion not in {"ninguna", "ocultar", "eliminar"}:
        raise HTTPException(400, "Acción inválida")
    con = connect()
    rep = con.execute("SELECT * FROM reportes WHERE id=?", (body.reporte_id,)).fetchone()
    if not rep:
        con.close()
        raise HTTPException(404, "Reporte no encontrado")
    if rep["usuario_id"] == mod["id"]:
        con.close()
        raise HTTPException(403, "No puedes resolver tu propio reporte")
    now = int(time.time())
    con.execute(
        "UPDATE reportes SET estado='revisado', accion=?, moderado_por=?, moderado_en=?, nota=? WHERE id=?",
        (body.accion, mod["id"], now, clean_txt(body.nota, 300), body.reporte_id),
    )
    if body.accion in {"ocultar", "eliminar"}:
        pub = con.execute("SELECT estado FROM publicaciones WHERE id=?",
                          (rep["publicacion_id"],)).fetchone()
        con.execute(
            "UPDATE publicaciones SET estado='cerrada', deleted_at=?, deleted_por=?, motivo_baja=? WHERE id=?",
            (now, mod["id"], f"moderación: {clean_txt(body.nota, 200) or body.accion}",
             rep["publicacion_id"]),
        )
        historial(con, "publicacion", rep["publicacion_id"],
                  pub["estado"] if pub else None, "eliminada_por_moderacion",
                  mod["id"], clean_txt(body.nota, 200) or body.accion)
        log_evento(con, "moderacion_baja", rep["publicacion_id"], mod["id"], body.accion)
    con.commit()
    con.close()
    return {"ok": True}


@app.get("/api/moderacion/metricas")
def metricas(request: Request):
    """Indicadores de liquidez: sin esto el criterio de éxito no es medible."""
    require_moderador(request)
    con = connect()
    now = int(time.time())

    def one(sql, *args):
        return con.execute(sql, args).fetchone()["c"]

    activas = one("SELECT COUNT(*) c FROM publicaciones WHERE estado='activa' AND deleted_at IS NULL")
    total_pub = one("SELECT COUNT(*) c FROM publicaciones WHERE deleted_at IS NULL")
    contactos = one("SELECT COUNT(*) c FROM eventos WHERE tipo='contacto_iniciado'")
    cotiz = one("SELECT COUNT(*) c FROM cotizaciones")
    cotiz_resp = one("SELECT COUNT(*) c FROM cotizaciones WHERE estado!='enviada'")
    inter = one("SELECT COUNT(*) c FROM intercambios")
    inter_res = one("SELECT COUNT(*) c FROM intercambios WHERE estado='resuelta'")
    usuarios = one("SELECT COUNT(*) c FROM usuarios")
    reportes = one("SELECT COUNT(*) c FROM reportes WHERE estado='pendiente'")
    vistos = one("SELECT COUNT(*) c FROM vistos")
    tratos = one("SELECT COUNT(*) c FROM tratos")
    tratos_cerrados = one("SELECT COUNT(*) c FROM tratos WHERE estado='cerrado'")
    ult7 = one("SELECT COUNT(*) c FROM eventos WHERE tipo='publicacion_creada' AND creado>?",
               now - 7 * 86400)
    con.close()
    return {
        "ofertas_activas": activas, "publicaciones_totales": total_pub,
        "usuarios": usuarios, "vistos_buenos": vistos,
        "contactos_iniciados": contactos,
        "cotizaciones": cotiz, "cotizaciones_respondidas": cotiz_resp,
        "fill_rate_cotizaciones": round(cotiz_resp / cotiz * 100, 1) if cotiz else 0,
        "intercambios": inter, "intercambios_resueltos": inter_res,
        "tratos": tratos, "tratos_cerrados": tratos_cerrados,
        "publicaciones_ultimos_7_dias": ult7,
        "reportes_pendientes": reportes,
        "densidad": "ok" if activas >= 20 else "baja",
        "criterio": "Con menos de 20 ofertas activas el directorio se considera vacío.",
    }


# ----------------------------------------------------------------- cotizaciones
@app.post("/api/cotizaciones")
def crear_cotizacion(body: CotizacionIn, request: Request):
    rate_limit(request, "/api/cotizaciones")
    user = require_user(request)
    con = connect()
    pub = con.execute("SELECT * FROM publicaciones WHERE id=? AND deleted_at IS NULL",
                      (body.publicacion_id,)).fetchone()
    if not pub:
        con.close()
        raise HTTPException(404, "Publicación no encontrada")
    if pub["autor_id"] == user["id"]:
        con.close()
        raise HTTPException(400, "No puedes cotizar tu propia publicación")
    repetida = con.execute(
        "SELECT 1 FROM cotizaciones WHERE publicacion_id=? AND comprador_id=? AND estado='enviada'",
        (body.publicacion_id, user["id"])).fetchone()
    if repetida:
        con.close()
        raise HTTPException(400, "Ya tienes una cotización esperando respuesta en esta publicación. "
                                "El vecino te avisará cuando la responda.")
    abiertas = con.execute(
        "SELECT COUNT(*) c FROM cotizaciones WHERE comprador_id=? AND estado='enviada'",
        (user["id"],)).fetchone()["c"]
    if abiertas >= 3:
        con.close()
        raise HTTPException(
            400, "Tienes 3 cotizaciones abiertas. Espera la respuesta antes de enviar otra.")
    cid = str(uuid.uuid4())
    now = int(time.time())
    con.execute(
        "INSERT OR IGNORE INTO cotizaciones(id,publicacion_id,comprador_id,descripcion,medida,urgencia,creado,expira)"
        " VALUES(?,?,?,?,?,?,?,?)",
        (cid, body.publicacion_id, user["id"], clean_txt(body.descripcion, 500),
         clean_txt(body.medida, 100), body.urgencia or "normal", now, now + 7 * 86400),
    )
    con.execute("INSERT INTO mensajes(id,contexto,ref_id,de_id,texto,creado) VALUES(?,?,?,?,?,?)",
                (str(uuid.uuid4()), "cotizacion", cid, user["id"],
                 f"{clean_txt(body.descripcion, 500)}"
                 + (f" · {clean_txt(body.medida, 100)}" if body.medida else ""), now))
    log_evento(con, "cotizacion_enviada", body.publicacion_id, user["id"])
    pub_autor = con.execute("SELECT autor_id, titulo FROM publicaciones WHERE id=?",
                            (body.publicacion_id,)).fetchone()
    if pub_autor:
        notificar(con, pub_autor["autor_id"], "cotizacion",
                  "Te pidieron una cotización",
                  f"{user['nombre']} pregunta por: {pub_autor['titulo']}",
                  "/?v=mias")
    con.commit()
    con.close()
    return {"ok": True, "id": cid, "expira_en_dias": 7}


@app.get("/api/cotizaciones")
def mis_cotizaciones(request: Request):
    user = require_user(request)
    con = connect()
    ahora = int(time.time())
    con.execute("UPDATE cotizaciones SET estado='expirada' WHERE estado='enviada' AND expira < ?", (ahora,))
    con.commit()
    rows = con.execute(
        "SELECT c.*, p.titulo, p.autor_id, u.nombre AS vendedor FROM cotizaciones c"
        " JOIN publicaciones p ON p.id=c.publicacion_id"
        " JOIN usuarios u ON u.id=p.autor_id"
        " WHERE c.comprador_id=? OR p.autor_id=? ORDER BY c.creado DESC",
        (user["id"], user["id"])).fetchall()
    con.close()
    return [dict(r) for r in rows]


@app.post("/api/cotizaciones/{cid}/responder")
def responder_cotizacion(cid: str, body: CotizacionRespIn, request: Request):
    user = require_user(request)
    if body.respuesta not in {"puedo", "no_puedo", "precio"}:
        raise HTTPException(400, "Respuesta inválida")
    con = connect()
    cot = con.execute(
        "SELECT c.*, p.autor_id FROM cotizaciones c JOIN publicaciones p ON p.id=c.publicacion_id"
        " WHERE c.id=?", (cid,)).fetchone()
    if not cot:
        con.close()
        raise HTTPException(404, "Cotización no encontrada")
    if cot["autor_id"] != user["id"]:
        con.close()
        raise HTTPException(403, "Solo el vendedor responde la cotización")
    if cot["estado"] != "enviada":
        con.close()
        raise HTTPException(400, "Esta cotización ya fue respondida")
    con.execute(
        "UPDATE cotizaciones SET estado='respondida', respuesta=?, precio_respuesta=?, nota_vendedor=?"
        " WHERE id=?",
        (body.respuesta, clean_txt(body.precio_respuesta, 40), clean_txt(body.nota, 300), cid))
    log_evento(con, "cotizacion_respondida", cot["publicacion_id"], user["id"], body.respuesta)
    titulo_pub = con.execute("SELECT titulo FROM publicaciones WHERE id=?",
                             (cot["publicacion_id"],)).fetchone()
    notificar(con, cot["comprador_id"], "cotizacion_respuesta",
              "Respondieron tu cotización",
              f"{user['nombre']}: {body.respuesta.replace('_', ' ')}"
              + (f" ({body.precio_respuesta})" if body.precio_respuesta else ""),
              "/?v=mias")
    con.commit()
    con.close()
    return {"ok": True}



# ------------------------------------------- conversación y cierre del trato
def _participantes(con, contexto: str, ref_id: str):
    """Devuelve (publicacion_id, comprador_id, vendedor_id) o None."""
    if contexto == "cotizacion":
        r = con.execute(
            "SELECT c.publicacion_id, c.comprador_id, p.autor_id FROM cotizaciones c"
            " JOIN publicaciones p ON p.id=c.publicacion_id WHERE c.id=?", (ref_id,)).fetchone()
        return (r["publicacion_id"], r["comprador_id"], r["autor_id"]) if r else None
    if contexto == "trato":
        r = con.execute(
            "SELECT publicacion_id, comprador_id, vendedor_id FROM tratos WHERE id=?", (ref_id,)).fetchone()
        return (r["publicacion_id"], r["comprador_id"], r["vendedor_id"]) if r else None
    return None


@app.get("/api/mensajes")
def leer_mensajes(contexto: str, ref: str, request: Request):
    """Conversación de una cotización o de un trato. Solo sus dos participantes."""
    user = require_user(request)
    con = connect()
    partes = _participantes(con, contexto, ref)
    if not partes:
        con.close()
        raise HTTPException(404, "Conversación no encontrada")
    if user["id"] not in (partes[1], partes[2]):
        con.close()
        raise HTTPException(403, "No participas en esta conversación")
    filas = con.execute(
        "SELECT m.*, u.nombre AS de_nombre FROM mensajes m JOIN usuarios u ON u.id=m.de_id"
        " WHERE m.contexto=? AND m.ref_id=? ORDER BY m.creado ASC", (contexto, ref)).fetchall()
    con.execute("UPDATE mensajes SET leido=1 WHERE contexto=? AND ref_id=? AND de_id!=?",
                (contexto, ref, user["id"]))
    con.commit()
    con.close()
    return {"items": [dict(f) for f in filas], "yo": user["id"]}


@app.post("/api/mensajes")
def enviar_mensaje(body: MensajeIn, request: Request):
    rate_limit(request, "/api/cotizaciones")
    user = require_user(request)
    if body.contexto not in {"cotizacion", "trato"}:
        raise HTTPException(400, "Contexto inválido")
    texto = clean_txt(body.texto, 600)
    if len(texto) < 1:
        raise HTTPException(400, "Escribe un mensaje")
    con = connect()
    partes = _participantes(con, body.contexto, body.ref_id)
    if not partes:
        con.close()
        raise HTTPException(404, "Conversación no encontrada")
    if user["id"] not in (partes[1], partes[2]):
        con.close()
        raise HTTPException(403, "No participas en esta conversación")
    con.execute("INSERT INTO mensajes(id,contexto,ref_id,de_id,texto,creado) VALUES(?,?,?,?,?,?)",
                (str(uuid.uuid4()), body.contexto, body.ref_id, user["id"], texto, int(time.time())))
    otro = partes[2] if user["id"] == partes[1] else partes[1]
    notificar(con, otro, "mensaje", "Nuevo mensaje", f"{user['nombre']}: {texto[:90]}",
              "/?v=mias&tab=cotiz")
    con.commit()
    con.close()
    return {"ok": True}


@app.post("/api/cotizaciones/{cid}/aceptar")
def aceptar_cotizacion(cid: str, body: AceptarCotizacionIn, request: Request):
    """Quien pidió la cotización acepta el precio y abre el trato."""
    user = require_user(request)
    if body.politica not in POLITICAS_PAGO:
        raise HTTPException(400, "Acuerdo de pago inválido")
    con = connect()
    cot = con.execute(
        "SELECT c.*, p.autor_id, p.titulo FROM cotizaciones c"
        " JOIN publicaciones p ON p.id=c.publicacion_id WHERE c.id=?", (cid,)).fetchone()
    if not cot:
        con.close()
        raise HTTPException(404, "Cotización no encontrada")
    if cot["comprador_id"] != user["id"]:
        con.close()
        raise HTTPException(403, "Solo quien pidió la cotización puede aceptarla")
    if cot["estado"] not in {"respondida", "puedo", "precio", "no_puedo"}:
        con.close()
        raise HTTPException(400, "La cotización todavía no tiene respuesta")
    if (cot["respuesta"] or cot["estado"]) == "no_puedo":
        con.close()
        raise HTTPException(400, "El vecino indicó que no puede. Busca otra opción.")
    if cot["trato_id"]:
        con.close()
        raise HTTPException(400, "Esta cotización ya tiene un trato")
    tid = str(uuid.uuid4())
    ahora = int(time.time())
    con.execute(
        "INSERT INTO tratos(id,publicacion_id,comprador_id,vendedor_id,estado,monto,nota,"
        "creado,actualizado,cotizacion_id) VALUES(?,?,?,?,'pendiente',?,?,?,?,?)",
        (tid, cot["publicacion_id"], user["id"], cot["autor_id"],
         clean_txt(body.monto, 40), clean_txt(body.nota, 200), ahora, ahora, cid))
    con.execute("UPDATE cotizaciones SET estado='aceptada', trato_id=? WHERE id=?", (tid, cid))
    notificar(con, cot["autor_id"], "trato", "Aceptaron tu cotización",
              f"{user['nombre']} acepta y abre el trato de «{cot['titulo']}». Confírmalo tú.",
              "/?v=mias&tab=tratos")
    con.commit()
    con.close()
    return {"ok": True, "trato_id": tid}


@app.post("/api/tratos/{tid}/confirmar")
def confirmar_trato(tid: str, request: Request):
    """El vendedor confirma que acepta el trato y el monto."""
    user = require_user(request)
    con = connect()
    tr = con.execute("SELECT * FROM tratos WHERE id=?", (tid,)).fetchone()
    if not tr:
        con.close()
        raise HTTPException(404, "Trato no encontrado")
    if user["id"] != tr["vendedor_id"]:
        con.close()
        raise HTTPException(403, "Solo quien ofrece el servicio confirma el trato")
    if tr["estado"] != "pendiente":
        con.close()
        raise HTTPException(400, "Este trato ya fue confirmado")
    con.execute("UPDATE tratos SET estado='acordado', confirmado=1, actualizado=? WHERE id=?",
                (int(time.time()), tid))
    notificar(con, tr["comprador_id"], "trato", "Trato confirmado",
              f"{user['nombre']} confirmó el trato. Coordinen el pago y el servicio.",
              "/?v=mias&tab=tratos")
    con.commit()
    con.close()
    return {"ok": True}


@app.post("/api/tratos/{tid}/pago")
def marcar_pago(tid: str, body: PagoIn, request: Request):
    """Cada parte marca que pagó o recibió el pago. Al coincidir queda pagado."""
    user = require_user(request)
    con = connect()
    tr = con.execute("SELECT * FROM tratos WHERE id=?", (tid,)).fetchone()
    if not tr:
        con.close()
        raise HTTPException(404, "Trato no encontrado")
    if user["id"] not in (tr["comprador_id"], tr["vendedor_id"]):
        con.close()
        raise HTTPException(403, "No participas en este trato")
    if tr["estado"] not in {"acordado", "pagado"}:
        con.close()
        raise HTTPException(400, "Primero hay que confirmar el trato")
    campo = "pago_comprador" if user["id"] == tr["comprador_id"] else "pago_vendedor"
    con.execute(f"UPDATE tratos SET {campo}=1, actualizado=? WHERE id=?", (int(time.time()), tid))
    nuevo = con.execute("SELECT * FROM tratos WHERE id=?", (tid,)).fetchone()
    if nuevo["pago_comprador"] and nuevo["pago_vendedor"]:
        con.execute("UPDATE tratos SET estado='pagado' WHERE id=?", (tid,))
        for quien in (tr["comprador_id"], tr["vendedor_id"]):
            notificar(con, quien, "trato", "Pago confirmado por ambos",
                      "Ya pueden marcar el servicio como cumplido.", "/?v=mias&tab=tratos")
    else:
        otro = tr["vendedor_id"] if user["id"] == tr["comprador_id"] else tr["comprador_id"]
        notificar(con, otro, "trato", "Pago marcado",
                  f"{user['nombre']} marcó el pago. Confírmalo tú también.",
                  "/?v=mias&tab=tratos")
    con.commit()
    con.close()
    return {"ok": True}


@app.post("/api/tratos/{tid}/cerrar")
def cerrar_trato(tid: str, request: Request):
    """Cada parte marca que el servicio se cumplió. Al coincidir queda cerrado."""
    user = require_user(request)
    con = connect()
    tr = con.execute("SELECT * FROM tratos WHERE id=?", (tid,)).fetchone()
    if not tr:
        con.close()
        raise HTTPException(404, "Trato no encontrado")
    if user["id"] not in (tr["comprador_id"], tr["vendedor_id"]):
        con.close()
        raise HTTPException(403, "No participas en este trato")
    if tr["estado"] not in {"pagado", "acordado"}:
        con.close()
        raise HTTPException(400, "El trato ya está cerrado o cancelado")
    campo = "marca_comprador" if user["id"] == tr["comprador_id"] else "marca_vendedor"
    con.execute(f"UPDATE tratos SET {campo}=1, actualizado=? WHERE id=?", (int(time.time()), tid))
    nuevo = con.execute("SELECT * FROM tratos WHERE id=?", (tid,)).fetchone()
    if nuevo["marca_comprador"] and nuevo["marca_vendedor"]:
        con.execute("UPDATE tratos SET estado='cerrado', cerrado_en=? WHERE id=?",
                    (int(time.time()), tid))
        for quien in (tr["comprador_id"], tr["vendedor_id"]):
            notificar(con, quien, "trato_cerrado", "Trato cerrado",
                      "Ya pueden dejar su visto bueno.", "/?v=mias&tab=tratos")
    else:
        otro = tr["vendedor_id"] if user["id"] == tr["comprador_id"] else tr["comprador_id"]
        notificar(con, otro, "trato", "Falta tu confirmación",
                  f"{user['nombre']} marcó el servicio como cumplido. Confírmalo tú.",
                  "/?v=mias&tab=tratos")
    con.commit()
    con.close()
    return {"ok": True}


# ----------------------------------------------------------------- intercambios
@app.post("/api/intercambios")
def crear_intercambio(body: IntercambioIn, request: Request):
    user = require_user(request)
    con = connect()
    pet = con.execute("SELECT * FROM publicaciones WHERE id=? AND deleted_at IS NULL",
                      (body.peticion_id,)).fetchone()
    if not pet:
        con.close()
        raise HTTPException(404, "Publicación no encontrada")
    if pet["tipo"] not in {"favor_solicitado", "favor_ofrecido"}:
        con.close()
        raise HTTPException(400, "Solo se puede intercambiar en el muro de favores")
    if pet["autor_id"] == user["id"]:
        con.close()
        raise HTTPException(400, "No puedes aceptar tu propia publicación")
    if con.execute("SELECT 1 FROM intercambios WHERE peticion_id=? AND ofertante_id=?",
                   (body.peticion_id, user["id"])).fetchone():
        con.close()
        raise HTTPException(400, "Ya enviaste una solicitud para este favor")
    if pet["subtipo_favor"] == "prestamo" and not (
            body.garante_nombre and body.fecha_devolucion):
        con.close()
        raise HTTPException(400, "Para un préstamo indica garante y fecha de devolución")
    iid = str(uuid.uuid4())
    now = int(time.time())
    con.execute(
        "INSERT INTO intercambios(id,peticion_id,solicitante_id,ofertante_id,estado,garante_nombre,"
        "fecha_devolucion,foto_estado,mensaje,creado,actualizado)"
        " VALUES(?,?,?,?,'solicitada',?,?,?,?,?,?)",
        (iid, body.peticion_id, pet["autor_id"], user["id"],
         clean_txt(body.garante_nombre, 80), clean_txt(body.fecha_devolucion, 40),
         clean_txt(body.foto_estado, 200), clean_txt(body.mensaje, 500), now, now),
    )
    historial(con, "intercambio", iid, None, "solicitada", user["id"], "solicitud")
    log_evento(con, "intercambio_solicitado", body.peticion_id, user["id"])
    notificar(con, pet["autor_id"], "favor_solicitado", "Alguien quiere ayudarte",
              f"{user['nombre']} respondió a tu favor. Entra para aceptar.", "/?v=mias")
    con.commit()
    con.close()
    return {"ok": True, "id": iid}


@app.get("/api/intercambios")
def mis_intercambios(request: Request):
    user = require_user(request)
    con = connect()
    rows = con.execute(
        "SELECT i.*, p.titulo, p.subtipo_favor, p.zona, u.nombre AS ofertante_nombre,"
        " s.nombre AS solicitante_nombre FROM intercambios i"
        " JOIN publicaciones p ON p.id=i.peticion_id"
        " JOIN usuarios u ON u.id=i.ofertante_id"
        " JOIN usuarios s ON s.id=i.solicitante_id"
        " WHERE i.solicitante_id=? OR i.ofertante_id=? ORDER BY i.creado DESC",
        (user["id"], user["id"])).fetchall()
    con.close()
    return [dict(r) for r in rows]


@app.post("/api/intercambios/{iid}/estado")
def cambiar_estado_intercambio(iid: str, body: IntercambioEstadoIn, request: Request):
    user = require_user(request)
    con = connect()
    it = con.execute("SELECT * FROM intercambios WHERE id=?", (iid,)).fetchone()
    if not it:
        con.close()
        raise HTTPException(404, "Intercambio no encontrado")
    if user["id"] not in (it["solicitante_id"], it["ofertante_id"]):
        con.close()
        raise HTTPException(403, "No participas en este intercambio")
    reglas = {
        "aceptada": ({"solicitada"}, it["solicitante_id"]),
        "rechazada": ({"solicitada"}, it["solicitante_id"]),
        "en_curso": ({"aceptada"}, it["ofertante_id"]),
        "resuelta": ({"en_curso", "aceptada"}, it["solicitante_id"]),
        "cancelada": ({"solicitada", "aceptada"}, None),
    }
    if body.estado not in reglas:
        con.close()
        raise HTTPException(400, "Estado inválido")
    permitidos, quien = reglas[body.estado]
    if it["estado"] not in permitidos:
        con.close()
        raise HTTPException(400, f"No se puede pasar de {it['estado']} a {body.estado}")
    if quien and user["id"] != quien:
        con.close()
        raise HTTPException(403, "Solo la otra parte puede hacer esta acción")
    now = int(time.time())
    con.execute(
        "UPDATE intercambios SET estado=?, actualizado=?, resuelto_por=?, resuelto_en=? WHERE id=?",
        (body.estado, now, user["id"],
         now if body.estado in {"resuelta", "cancelada", "rechazada"} else None, iid),
    )
    historial(con, "intercambio", iid, it["estado"], body.estado, user["id"], "")
    if body.estado == "resuelta":
        log_evento(con, "intercambio_resuelto", it["peticion_id"], user["id"])
        otro = it["ofertante_id"] if user["id"] == it["solicitante_id"] else it["solicitante_id"]
        notificar(con, otro, "favor_resuelto", "Se cerró el favor",
                  "Ya puedes dejar tu visto bueno a quien te ayudó.", "/?v=mias")
    if body.estado == "aceptada":
        notificar(con, it["ofertante_id"], "favor_aceptado", "Aceptaron tu ayuda",
                  "El vecino aceptó. Coordinen la entrega por WhatsApp.", "/?v=mias")
    con.commit()
    con.close()
    return {"ok": True, "estado": body.estado}


# ----------------------------------------------------------------- emergencia
@app.get("/api/emergencia")
def estado_emergencia(request: Request):
    viewer = current_user(request)
    con = connect()
    cfg = con.execute("SELECT * FROM config_emergencia WHERE id='global'").fetchone()
    activa = bool(cfg and cfg["activa"])
    if activa and cfg["expira"] and cfg["expira"] < time.time():
        con.execute("UPDATE config_emergencia SET activa=0, desactivada_en=? WHERE id='global'",
                    (int(time.time()),))
        con.commit()
        activa = False
    rows = filtros_lista(con, emergencia=True)
    reportes = []
    for r in rows:
        item = serializar_publicacion(r, viewer, con)
        item["necesidad"] = r.get("categoria")
        reportes.append(item)
    con.close()
    return {
        "activa": activa,
        "activada_por": cfg["activada_por"] if cfg else None,
        "activada_en": cfg["activada_en"] if cfg else None,
        "motivo": cfg["motivo"] if cfg else "",
        "reportes": reportes,
        "aviso": ("Reporte vecinal NO oficial. Ante riesgo vital llama "
                  "105 Policía · 116 Bomberos · 115 Defensa Civil · 106 SAMU"),
        "necesidades_72h": sorted(NECESIDADES_72H),
    }


@app.post("/api/emergencia/activar")
def activar_emergencia(body: EmergenciaIn, request: Request):
    mod = require_moderador(request)
    con = connect()
    now = int(time.time())
    if body.activa:
        antes = con.execute("SELECT activa FROM config_emergencia WHERE id='global'").fetchone()
        if antes is None:
            con.execute("INSERT INTO config_emergencia(id,activa) VALUES('global',0)")
        con.execute(
            "UPDATE config_emergencia SET activa=1, activada_por=?, activada_en=?, expira=?, motivo=?"
            " WHERE id='global'",
            (mod["id"], now, now + 72 * 3600, clean_txt(body.motivo, 300)))
        historial(con, "emergencia", "global",
                  str(bool(antes and antes["activa"])), "activa", mod["id"],
                  clean_txt(body.motivo, 300))
        log_evento(con, "emergencia_activada", None, mod["id"], clean_txt(body.motivo, 300))
    else:
        if con.execute("SELECT 1 FROM config_emergencia WHERE id='global'").fetchone() is None:
            con.execute("INSERT INTO config_emergencia(id,activa) VALUES('global',0)")
        con.execute("UPDATE config_emergencia SET activa=0, desactivada_en=?, motivo='' WHERE id='global'",
                    (now,))
        historial(con, "emergencia", "global", "activa", "inactiva", mod["id"], "cierre")
    con.commit()
    con.close()
    return {"ok": True, "activa": body.activa}


@app.get("/api/emergencia/directorio")
def directorio_apoyo():
    con = connect()
    rows = con.execute(
        "SELECT nombre, tipo, zona, contacto FROM avaladores WHERE activo=1"
        " AND tipo IN ('olla','parroquia','comite','junta')").fetchall()
    con.close()
    return {
        "directorio": [dict(r) for r in rows],
        "puntos": [
            "Parque principal de cada zona",
            "Bodega Doña Rosa (Zona Norte)",
            "Olla Común San Martín (Zona Sur)",
            "Parroquia San José (Zona Centro)",
        ],
    }


# ----------------------------------------------------------------- avaladores
@app.get("/api/avaladores")
def listar_avaladores(zona: Optional[str] = None):
    con = connect()
    sql = "SELECT * FROM avaladores WHERE activo=1 AND (expira_en IS NULL OR expira_en>?)"
    args: list = [int(time.time())]
    if zona:
        sql += " AND zona=?"
        args.append(zona)
    rows = con.execute(sql, args).fetchall()
    con.close()
    return [dict(r) for r in rows]


@app.post("/api/avaladores")
def crear_avalador(body: AvaladorIn, request: Request):
    mod = require_moderador(request)
    if body.tipo not in TIPOS_AVALADOR:
        raise HTTPException(400, "Tipo de avalador inválido")
    if body.zona not in ZONAS:
        raise HTTPException(400, "Zona inválida")
    aid = str(uuid.uuid4())
    now = int(time.time())
    con = connect()
    con.execute(
        "INSERT INTO avaladores(id,nombre,tipo,zona,contacto,verificado_por,verificado_en,"
        "expira_en,activo,creado) VALUES(?,?,?,?,?,?,?,?,1,?)",
        (aid, clean_txt(body.nombre, 80), body.tipo, body.zona,
         clean_txt(body.contacto, 40), mod["id"], now, now + 365 * 86400, now))
    con.commit()
    con.close()
    return {"ok": True, "id": aid}


@app.post("/api/publicaciones/{pid}/avalador/{aid}")
def vincular_avalador(pid: str, aid: str, request: Request):
    user = require_user(request)
    con = connect()
    pub = con.execute("SELECT autor_id FROM publicaciones WHERE id=?", (pid,)).fetchone()
    if not pub:
        con.close()
        raise HTTPException(404, "Publicación no encontrada")
    if pub["autor_id"] != user["id"] and user["rol"] != "moderador":
        con.close()
        raise HTTPException(403, "Solo el autor o el moderador pueden vincular un aval")
    if not con.execute("SELECT 1 FROM avaladores WHERE id=? AND activo=1", (aid,)).fetchone():
        con.close()
        raise HTTPException(404, "Avalador no encontrado")
    con.execute("INSERT OR IGNORE INTO publicacion_avalador(publicacion_id,avalador_id) VALUES(?,?)",
                (pid, aid))
    con.commit()
    con.close()
    return {"ok": True}


# ----------------------------------------------------------------- eventos
@app.post("/api/eventos/contacto")
def evento_contacto(publicacion_id: str, request: Request):
    user = current_user(request)
    con = connect()
    log_evento(con, "contacto_iniciado", publicacion_id, user["id"] if user else None)
    con.commit()
    con.close()
    return {"ok": True}



# ----------------------------------------------------------------- tratos (cierre del ciclo)
@app.post("/api/tratos")
def crear_trato(body: TratoIn, request: Request):
    """El comprador declara que cerró el trato con el vendedor."""
    user = require_user(request)
    con = connect()
    pub = con.execute("SELECT * FROM publicaciones WHERE id=? AND deleted_at IS NULL",
                      (body.publicacion_id,)).fetchone()
    if not pub:
        con.close()
        raise HTTPException(404, "Publicación no encontrada")
    if pub["autor_id"] == user["id"]:
        con.close()
        raise HTTPException(400, "No puedes cerrar un trato contigo mismo")
    if pub["tipo"].startswith("favor"):
        con.close()
        raise HTTPException(400, "En favores se usa el botón de intercambio, no el trato comercial")
    existente = con.execute(
        "SELECT * FROM tratos WHERE publicacion_id=? AND comprador_id=? AND estado!='cancelado'",
        (body.publicacion_id, user["id"])).fetchone()
    if existente:
        con.close()
        return {"ok": True, "id": existente["id"], "estado": existente["estado"]}
    tid = str(uuid.uuid4())
    now = int(time.time())
    con.execute(
        "INSERT INTO tratos(id,publicacion_id,comprador_id,vendedor_id,estado,monto,nota,"
        "creado,actualizado) VALUES(?,?,?,?,'acordado',?,?,?,?)",
        (tid, body.publicacion_id, user["id"], pub["autor_id"],
         clean_txt(body.monto, 40), clean_txt(body.nota, 300), now, now))
    notificar(con, pub["autor_id"], "trato", "Cerraste un trato",
              f"{user['nombre']} registró un trato por: {pub['titulo']}. Confírmalo en Mis publicaciones.",
              "/?v=mias")
    con.commit()
    con.close()
    return {"ok": True, "id": tid, "estado": "acordado"}


@app.get("/api/tratos")
def mis_tratos(request: Request):
    user = require_user(request)
    con = connect()
    con.execute("UPDATE tratos SET estado='cerrado', cerrado_en=? "
                "WHERE marca_comprador=1 AND marca_vendedor=1 AND estado!='cerrado'",
                (int(time.time()),))
    con.commit()
    rows = con.execute(
        "SELECT t.*, p.titulo, p.zona, cu.nombre AS comprador_nombre, vu.nombre AS vendedor_nombre"
        " FROM tratos t JOIN publicaciones p ON p.id=t.publicacion_id"
        " JOIN usuarios cu ON cu.id=t.comprador_id JOIN usuarios vu ON vu.id=t.vendedor_id"
        " WHERE t.comprador_id=? OR t.vendedor_id=? ORDER BY t.creado DESC",
        (user["id"], user["id"])).fetchall()
    con.close()
    return [dict(r) for r in rows]


@app.post("/api/tratos/{tid}/estado")
def marcar_trato(tid: str, body: TratoEstadoIn, request: Request):
    """Doble marca: comprador y vendedor confirman; al coincidir queda cerrado."""
    user = require_user(request)
    if body.estado not in {"cerrado", "cancelado"}:
        raise HTTPException(400, "Estado inválido")
    con = connect()
    tr = con.execute("SELECT * FROM tratos WHERE id=?", (tid,)).fetchone()
    if not tr:
        con.close()
        raise HTTPException(404, "Trato no encontrado")
    if user["id"] not in (tr["comprador_id"], tr["vendedor_id"]):
        con.close()
        raise HTTPException(403, "No participas en este trato")
    now = int(time.time())
    if body.estado == "cancelado":
        con.execute("UPDATE tratos SET estado='cancelado', actualizado=? WHERE id=?", (now, tid))
    else:
        campo = "marca_comprador" if user["id"] == tr["comprador_id"] else "marca_vendedor"
        con.execute(f"UPDATE tratos SET {campo}=1, actualizado=? WHERE id=?", (now, tid))
        nuevo = con.execute("SELECT * FROM tratos WHERE id=?", (tid,)).fetchone()
        if nuevo["marca_comprador"] and nuevo["marca_vendedor"]:
            con.execute("UPDATE tratos SET estado='cerrado', cerrado_en=? WHERE id=?", (now, tid))
            notificar(con, tr["comprador_id"], "trato_cerrado", "Trato cerrado",
                      "Ya puedes dejar tu visto bueno a quien te atendió.", "/?v=mias")
        else:
            otro = tr["vendedor_id"] if user["id"] == tr["comprador_id"] else tr["comprador_id"]
            notificar(con, otro, "trato", "Confirmación pendiente",
                      f"{user['nombre']} marcó el trato como cumplido. Confírmalo tú también.", "/?v=mias")
    con.commit()
    con.close()
    return {"ok": True}



# ------------------------------------------------------------ equipo y abuso
@app.get("/api/admin/equipo")
def equipo(request: Request):
    require_admin(request)
    con = connect()
    filas = con.execute(
        "SELECT id, nombre, telefono, rol, zona FROM usuarios WHERE rol!='vecino' ORDER BY rol, nombre"
    ).fetchall()
    con.close()
    return {"items": [dict(f) for f in filas]}


@app.post("/api/admin/rol")
def cambiar_rol(body: RolIn, request: Request):
    """Solo el administrador reparte roles. Queda registrado quién lo hizo."""
    admin = require_admin(request)
    if body.rol not in {"vecino", "moderador", "admin"}:
        raise HTTPException(400, "Rol inválido")
    con = connect()
    u = con.execute("SELECT id, nombre, rol FROM usuarios WHERE telefono=?", (body.telefono,)).fetchone()
    if not u:
        con.close()
        raise HTTPException(404, "No hay cuenta con ese teléfono")
    if u["id"] == admin["id"] and body.rol != "admin":
        con.close()
        raise HTTPException(400, "No puedes quitarte el rol a ti mismo")
    con.execute("UPDATE usuarios SET rol=? WHERE id=?", (body.rol, u["id"]))
    log_evento(con, "cambio_rol", None, admin["id"], f"{u['nombre']} → {body.rol}")
    notificar(con, u["id"], "rol", "Cambió tu rol",
              f"Ahora eres {body.rol}. Cierra sesión y vuelve a entrar para verlo.", "/")
    con.commit()
    con.close()
    return {"ok": True}


@app.get("/api/admin/colusion")
def colusion(request: Request):
    """Señales de círculos cerrados: mismos pares repitiéndose y vistos concentrados."""
    require_moderador(request)
    con = connect()
    pares = con.execute(
        "SELECT t.comprador_id a, t.vendedor_id b, COUNT(*) n FROM tratos t"
        " WHERE t.estado='cerrado' GROUP BY a,b HAVING n>=3 ORDER BY n DESC LIMIT 20"
    ).fetchall()
    nombres = {}
    salida = []
    for p in pares:
        for uid in (p["a"], p["b"]):
            if uid not in nombres:
                r = con.execute("SELECT nombre FROM usuarios WHERE id=?", (uid,)).fetchone()
                nombres[uid] = r["nombre"] if r else "—"
        salida.append({"tipo": "tratos_repetidos", "a": nombres[p["a"]], "b": nombres[p["b"]],
                       "veces": p["n"]})
    concentrados = con.execute(
        "SELECT v.usuario_id u, p.autor_id a, COUNT(*) n FROM vistos v"
        " JOIN publicaciones p ON p.id=v.publicacion_id GROUP BY u,a HAVING n>=2 ORDER BY n DESC LIMIT 20"
    ).fetchall()
    for c in concentrados:
        for uid in (c["u"], c["a"]):
            if uid not in nombres:
                r = con.execute("SELECT nombre FROM usuarios WHERE id=?", (uid,)).fetchone()
                nombres[uid] = r["nombre"] if r else "—"
        salida.append({"tipo": "vistos_concentrados", "a": nombres[c["u"]], "b": nombres[c["a"]],
                       "veces": c["n"]})
    con.close()
    return {"items": salida, "nota": "Señales para revisar, no pruebas. Un moderador decide."}

# ----------------------------------------------------------------- notificaciones
@app.get("/api/notificaciones")
def mis_notificaciones(request: Request):
    user = require_user(request)
    con = connect()
    rows = con.execute(
        "SELECT * FROM notificaciones WHERE usuario_id=? ORDER BY creado DESC LIMIT 40",
        (user["id"],)).fetchall()
    pendientes = con.execute(
        "SELECT COUNT(*) c FROM notificaciones WHERE usuario_id=? AND leida=0",
        (user["id"],)).fetchone()["c"]
    con.close()
    return {"items": [dict(r) for r in rows], "sin_leer": pendientes}


@app.post("/api/notificaciones/leer")
def leer_notificaciones(request: Request):
    user = require_user(request)
    con = connect()
    con.execute("UPDATE notificaciones SET leida=1 WHERE usuario_id=?", (user["id"],))
    con.commit()
    con.close()
    return {"ok": True}


# ----------------------------------------------------------------- recuperar contraseña
@app.post("/api/password/solicitar")
def solicitar_reset(body: ResetIn, request: Request):
    rate_limit(request, "/api/login")
    ident = body.identificador.strip()
    con = connect()
    u = con.execute("SELECT id, telefono, email FROM usuarios WHERE email=? OR telefono=?",
                    (ident.lower(), ident)).fetchone()
    if not u:
        con.close()
        # No revelamos si existe la cuenta
        return {"ok": True, "mensaje": "Si la cuenta existe, enviamos un código al teléfono registrado."}
    codigo = f"{uuid.uuid4().int % 1000000:06d}"
    con.execute("UPDATE usuarios SET reset_code=?, reset_expira=? WHERE id=?",
                (codigo, int(time.time()) + 900, u["id"]))
    con.commit()
    con.close()
    # En la demo el código vuelve en la respuesta; con proveedor de SMS/WhatsApp
    # se envía al teléfono y no se muestra.
    return {"ok": True, "codigo_demo": codigo,
            "mensaje": "Código válido por 15 minutos. En la demo se muestra aquí; con WhatsApp llegaría a tu teléfono."}


@app.post("/api/password/confirmar")
def confirmar_reset(body: ResetConfirmIn):
    ident = body.identificador.strip()
    con = connect()
    u = con.execute("SELECT * FROM usuarios WHERE email=? OR telefono=?", (ident.lower(), ident)).fetchone()
    if not u or not u["reset_code"] or u["reset_code"] != body.codigo.strip():
        con.close()
        raise HTTPException(400, "Código incorrecto")
    if not u["reset_expira"] or u["reset_expira"] < time.time():
        con.close()
        raise HTTPException(400, "El código venció. Pide otro.")
    sal = uuid.uuid4().hex[:16]
    con.execute("UPDATE usuarios SET pass=?, salt=?, reset_code='', reset_expira=NULL WHERE id=?",
                (hash_pw_salted(body.password, sal), sal, u["id"]))
    con.execute("DELETE FROM sesiones WHERE usuario_id=?", (u["id"],))
    con.commit()
    con.close()
    return {"ok": True, "mensaje": "Contraseña actualizada. Inicia sesión con la nueva."}


# ----------------------------------------------------------------- registro de accesos
@app.get("/api/mis-accesos")
def mis_accesos(request: Request):
    """El vecino ve cuántas veces se consultó su contacto."""
    user = require_user(request)
    con = connect()
    rows = con.execute(
        "SELECT a.creado, p.titulo, u.nombre AS quien FROM accesos_contacto a"
        " JOIN publicaciones p ON p.id=a.publicacion_id"
        " JOIN usuarios u ON u.id=a.usuario_id"
        " WHERE p.autor_id=? ORDER BY a.creado DESC LIMIT 30", (user["id"],)).fetchall()
    total = con.execute(
        "SELECT COUNT(*) c FROM accesos_contacto a JOIN publicaciones p ON p.id=a.publicacion_id"
        " WHERE p.autor_id=?", (user["id"],)).fetchone()["c"]
    con.close()
    return {"total": total, "items": [dict(r) for r in rows]}


# ----------------------------------------------------------------- fotos
@app.post("/api/fotos")
def subir_foto(request: Request, payload: dict):
    """Recibe la imagen ya comprimida en el teléfono (data URL) y la guarda."""
    user = require_user(request)
    data = (payload or {}).get("data", "")
    if not data.startswith("data:image/"):
        raise HTTPException(400, "Formato de imagen no válido")
    try:
        cabecera, b64 = data.split(",", 1)
        binario = base64.b64decode(b64)
    except Exception:
        raise HTTPException(400, "No pudimos leer la imagen")
    if len(binario) > 700_000:
        raise HTTPException(400, "La imagen es muy grande: máximo 700 KB")
    ext = "png" if "png" in cabecera else "jpg"
    nombre = f"{uuid.uuid4().hex}.{ext}"
    destino = FOTOS_DIR / nombre
    destino.write_bytes(binario)
    con = connect()
    log_evento(con, "foto_subida", None, user["id"], nombre)
    con.commit()
    con.close()
    return {"ok": True, "url": f"/fotos/{nombre}"}


# ----------------------------------------------------------------- estáticos
STATIC = Path(__file__).resolve().parent / "static"
FOTOS_DIR = Path(__file__).resolve().parent.parent / "data" / "fotos"
FOTOS_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/fotos", StaticFiles(directory=str(FOTOS_DIR)), name="fotos")
app.mount("/", StaticFiles(directory=str(STATIC), html=True), name="static")
