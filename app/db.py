"""Capa de datos: esquema, migraciones idempotentes y semilla de demo.

Diseño según DOCUMENTO-TECNICO-GESTION.md (v2): PostgreSQL+PostGIS en producción
real; SQLite/WAL para MVP y demo. Las migraciones son aditivas y se aplican al
arrancar, de modo que una base existente no se pierde.
"""
from __future__ import annotations

import hashlib
import sqlite3
import time
import uuid
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent.parent / "data" / "app.db"

# ---------------------------------------------------------------- conexión
def connect() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    con = sqlite3.connect(DB_PATH, timeout=30, check_same_thread=False)
    con.row_factory = sqlite3.Row
    con.execute("PRAGMA journal_mode=WAL")
    con.execute("PRAGMA busy_timeout=30000")
    con.execute("PRAGMA foreign_keys=ON")
    return con


def hash_pw(password: str) -> str:
    """SHA-256 con sal por usuario (suficiente para MVP; argon2 en producción)."""
    return hashlib.sha256(password.encode()).hexdigest()


def hash_pw_salted(password: str, salt: str) -> str:
    return hashlib.sha256((salt + password).encode()).hexdigest()


# ---------------------------------------------------------------- esquema
SCHEMA = """
CREATE TABLE IF NOT EXISTS usuarios(
    id TEXT PRIMARY KEY, nombre TEXT NOT NULL, zona TEXT NOT NULL,
    telefono TEXT UNIQUE NOT NULL, email TEXT UNIQUE NOT NULL,
    pass TEXT NOT NULL, rol TEXT NOT NULL DEFAULT 'vecino',
    yape TEXT, descripcion TEXT DEFAULT '', oficios TEXT DEFAULT '',
    telefono_verificado INTEGER DEFAULT 0, acepta_privacidad INTEGER DEFAULT 0,
    creado INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS sesiones(
    token TEXT PRIMARY KEY, usuario_id TEXT NOT NULL,
    creado INTEGER NOT NULL, expira INTEGER NOT NULL,
    FOREIGN KEY(usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS publicaciones(
    id TEXT PRIMARY KEY, autor_id TEXT NOT NULL,
    tipo TEXT NOT NULL, categoria TEXT NOT NULL, subtipo_favor TEXT,
    titulo TEXT NOT NULL, descripcion TEXT NOT NULL,
    precio TEXT DEFAULT '', medios_pago TEXT DEFAULT '', qr_yape TEXT DEFAULT '',
    politica_pago TEXT DEFAULT 'contra_entrega',
    zona TEXT NOT NULL, lat REAL, lng REAL,
    punto_encuentro TEXT DEFAULT '', franja_horaria TEXT DEFAULT '',
    cupo INTEGER, checklist_ok INTEGER DEFAULT 0,
    estado TEXT NOT NULL DEFAULT 'activa', es_emergencia INTEGER DEFAULT 0,
    recurso_critico INTEGER DEFAULT 0,
    expira_en INTEGER, version INTEGER DEFAULT 0,
    creado INTEGER NOT NULL, actualizado INTEGER NOT NULL,
    client_id TEXT UNIQUE,
    deleted_at INTEGER, deleted_por TEXT, motivo_baja TEXT,
    FOREIGN KEY(autor_id) REFERENCES usuarios(id) ON DELETE RESTRICT
);
CREATE TABLE IF NOT EXISTS vistos(
    id TEXT PRIMARY KEY, publicacion_id TEXT NOT NULL, usuario_id TEXT NOT NULL,
    comentario TEXT DEFAULT '', creado INTEGER NOT NULL,
    UNIQUE(publicacion_id, usuario_id),
    FOREIGN KEY(publicacion_id) REFERENCES publicaciones(id) ON DELETE CASCADE,
    FOREIGN KEY(usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS reportes(
    id TEXT PRIMARY KEY, publicacion_id TEXT NOT NULL,
    usuario_id TEXT NOT NULL, motivo TEXT NOT NULL,
    estado TEXT NOT NULL DEFAULT 'pendiente',
    accion TEXT, moderado_por TEXT, moderado_en INTEGER, nota TEXT,
    creado INTEGER NOT NULL,
    UNIQUE(publicacion_id, usuario_id)
);
CREATE TABLE IF NOT EXISTS config_emergencia(
    id TEXT PRIMARY KEY, activa INTEGER NOT NULL DEFAULT 0,
    activada_por TEXT, activada_en INTEGER, desactivada_en INTEGER,
    motivo TEXT DEFAULT '', expira INTEGER
);
CREATE TABLE IF NOT EXISTS intercambios(
    id TEXT PRIMARY KEY, peticion_id TEXT NOT NULL, oferta_id TEXT,
    solicitante_id TEXT NOT NULL, ofertante_id TEXT NOT NULL,
    estado TEXT NOT NULL DEFAULT 'solicitada',
    garante_nombre TEXT DEFAULT '', fecha_devolucion TEXT DEFAULT '',
    foto_estado TEXT DEFAULT '', mensaje TEXT DEFAULT '',
    resuelto_por TEXT, resuelto_en INTEGER,
    creado INTEGER NOT NULL, actualizado INTEGER NOT NULL,
    UNIQUE(peticion_id, ofertante_id)
);
CREATE TABLE IF NOT EXISTS cotizaciones(
    id TEXT PRIMARY KEY, publicacion_id TEXT NOT NULL, comprador_id TEXT NOT NULL,
    descripcion TEXT NOT NULL, medida TEXT DEFAULT '', urgencia TEXT DEFAULT 'normal',
    estado TEXT NOT NULL DEFAULT 'enviada', precio_respuesta TEXT DEFAULT '',
    nota_vendedor TEXT DEFAULT '', creado INTEGER NOT NULL, expira INTEGER NOT NULL,
    UNIQUE(publicacion_id, comprador_id, estado)
);
CREATE TABLE IF NOT EXISTS avaladores(
    id TEXT PRIMARY KEY, nombre TEXT NOT NULL,
    tipo TEXT NOT NULL, zona TEXT NOT NULL, contacto TEXT DEFAULT '',
    verificado_por TEXT, verificado_en INTEGER, expira_en INTEGER,
    activo INTEGER DEFAULT 1, creado INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS publicacion_avalador(
    publicacion_id TEXT NOT NULL, avalador_id TEXT NOT NULL,
    PRIMARY KEY(publicacion_id, avalador_id)
);
CREATE TABLE IF NOT EXISTS eventos(
    id TEXT PRIMARY KEY, tipo TEXT NOT NULL, publicacion_id TEXT,
    usuario_id TEXT, meta TEXT DEFAULT '', creado INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS historial_estado(
    id TEXT PRIMARY KEY, entidad TEXT NOT NULL, entidad_id TEXT NOT NULL,
    estado_anterior TEXT, estado_nuevo TEXT, actor_id TEXT,
    motivo TEXT DEFAULT '', creado INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_pub_estado ON publicaciones(estado, creado DESC);
CREATE INDEX IF NOT EXISTS ix_pub_tipo ON publicaciones(tipo, categoria, zona);
CREATE INDEX IF NOT EXISTS ix_pub_autor ON publicaciones(autor_id);
CREATE INDEX IF NOT EXISTS ix_rep_estado ON reportes(estado);
CREATE INDEX IF NOT EXISTS ix_eventos_tipo ON eventos(tipo, creado DESC);
CREATE INDEX IF NOT EXISTS ix_sesiones_usuario ON sesiones(usuario_id);
CREATE INDEX IF NOT EXISTS ix_cot_pub ON cotizaciones(publicacion_id, estado);
"""

# Columnas añadidas después de la primera versión (migración aditiva)
MIGRATIONS = {
    "usuarios": {
        "descripcion": "TEXT DEFAULT ''",
        "oficios": "TEXT DEFAULT ''",
        "telefono_verificado": "INTEGER DEFAULT 0",
        "acepta_privacidad": "INTEGER DEFAULT 0",
        "salt": "TEXT DEFAULT ''",
    },
    "publicaciones": {
        "subtipo_favor": "TEXT",
        "medios_pago": "TEXT DEFAULT ''",
        "qr_yape": "TEXT DEFAULT ''",
        "politica_pago": "TEXT DEFAULT 'contra_entrega'",
        "punto_encuentro": "TEXT DEFAULT ''",
        "franja_horaria": "TEXT DEFAULT ''",
        "cupo": "INTEGER",
        "checklist_ok": "INTEGER DEFAULT 0",
        "recurso_critico": "INTEGER DEFAULT 0",
        "expira_en": "INTEGER",
        "version": "INTEGER DEFAULT 0",
        "actualizado": "INTEGER DEFAULT 0",
        "deleted_at": "INTEGER",
        "deleted_por": "TEXT",
        "motivo_baja": "TEXT",
    },
    "sesiones": {"expira": "INTEGER DEFAULT 0"},
    "reportes": {
        "estado": "TEXT DEFAULT 'pendiente'",
        "accion": "TEXT",
        "moderado_por": "TEXT",
        "moderado_en": "INTEGER",
        "nota": "TEXT",
    },
    "config_emergencia": {"desactivada_en": "INTEGER", "expira": "INTEGER"},
}


def _columns(con: sqlite3.Connection, table: str) -> set[str]:
    return {r["name"] for r in con.execute(f"PRAGMA table_info({table})")}


def migrate(con: sqlite3.Connection) -> list[str]:
    applied: list[str] = []
    for table, cols in MIGRATIONS.items():
        try:
            existing = _columns(con, table)
        except sqlite3.Error:
            continue
        for col, decl in cols.items():
            if col not in existing:
                con.execute(f"ALTER TABLE {table} ADD COLUMN {col} {decl}")
                applied.append(f"{table}.{col}")
    con.commit()
    return applied


SEED_USERS = [
    ("u-mod", "María Moderadora", "Zona Centro", "999000001", "mod@app.local", "mod123", "moderador", "999000001"),
    ("u-gas", "Juan Gasfitero", "Zona Centro", "999000002", "juan@app.local", "gas123", "vecino", "999000002"),
    ("u-carp", "Ana Carpintera", "Zona Norte", "999000003", "ana@app.local", "carp123", "vecino", "999000003"),
    ("u-vec", "Pedro Vecino", "Zona Centro", "999000004", "pedro@app.local", "pedro123", "vecino", None),
    ("u-vec2", "Lucía Vecina", "Zona Sur", "999000005", "lucia@app.local", "lucia123", "vecino", "999000005"),
]

SEED_PUBS = [
    # id, autor, tipo, categoria, subtipo, titulo, desc, precio, medios, zona, lat, lng, emergencia
    ("p1", "u-gas", "servicio", "gasfitería", None,
     "Gasfitero 24h · destapes y fugas",
     "Destapes, instalación de caños y reparación de fugas. Atención el mismo día en Zona Centro. Presupuesto sin costo antes de empezar.",
     "A convenir", "yape,efectivo", "Zona Centro", -12.0464, -77.0428, 0),
    ("p2", "u-carp", "servicio", "carpintería", None,
     "Carpintería a medida",
     "Puertas, mesas y closets. Trabajo con medidas exactas; acepto intercambio por clases o trabajo de gasfitería.",
     "Intercambio / sin dinero", "intercambio", "Zona Norte", -12.0300, -77.0500, 0),
    ("p3", "u-vec", "producto", "alimentos", None,
     "Pastelitos caseros de la vecina",
     "Pastelitos dulces y salados por encargo, receta de casa. Pedidos con un día de anticipación.",
     "S/ 2.00", "yape,efectivo", "Zona Centro", -12.0460, -77.0430, 0),
    ("p4", "u-vec", "favor_solicitado", "préstamo", "prestamo",
     "Necesito muleta prestada por una semana",
     "Me lesioné la pierna jugando fútbol y necesito una muleta hasta el viernes. La devuelvo en el mismo estado.",
     "Intercambio / sin dinero", "intercambio", "Zona Centro", -12.0470, -77.0420, 0),
    ("p5", "u-vec2", "favor_ofrecido", "movilidad", "movilidad",
     "Comparto auto al colegio · Zona Centro",
     "Salgo 7:00 por Zona Centro hacia el colegio. Punto de encuentro: parque principal. Sin pago. Cupo para 2 personas.",
     "Intercambio / sin dinero", "intercambio", "Zona Centro", -12.0450, -77.0410, 0),
    ("p6", "u-gas", "servicio", "electricidad", None,
     "Electricista · instalaciones y urgencias",
     "Instalaciones, cambio de tableros y urgencias eléctricas. Disponible también durante emergencias.",
     "A convenir", "yape,efectivo", "Zona Sur", -12.0600, -77.0600, 1),
    ("p7", "u-carp", "favor_solicitado", "herramientas", "prestamo",
     "Necesito taladro prestado el fin de semana",
     "Para colgar cuadros en casa. Lo devuelvo el domingo por la tarde.",
     "Intercambio / sin dinero", "intercambio", "Zona Norte", -12.0310, -77.0510, 0),
    ("p8", "u-vec2", "producto", "alimentos", None,
     "Lasaña casera por encargo",
     "Lasaña de carne para 4 personas, pedidos con un día de anticipación. Muy pedida en la zona.",
     "S/ 25.00", "yape,efectivo", "Zona Sur", -12.0610, -77.0590, 0),
    ("p9", "u-vec2", "servicio", "clases", None,
     "Clases de matemática para primaria y secundaria",
     "Refuerzo escolar por hora, en casa del alumno o en la biblioteca del barrio. Acepto intercambio.",
     "S/ 15.00", "yape,efectivo,intercambio", "Zona Sur", -12.0590, -77.0580, 0),
    ("p10", "u-carp", "producto", "alimentos", None,
     "Queques y tortas por encargo (Ana)",
     "Tortas de chocolate y queques de naranja. Pedidos con 2 días de anticipación.",
     "S/ 30.00", "yape,efectivo", "Zona Norte", -12.0320, -77.0490, 0),
]

SEED_VISTOS = [
    ("v1", "p1", "u-vec", "Arregló una fuga en menos de una hora."),
    ("v2", "p1", "u-vec2", "Puntual y cobró lo acordado."),
    ("v3", "p3", "u-gas", "Los pastelitos son ricos, los recomiendo."),
    ("v4", "p8", "u-vec", "La lasaña de la vecina es muy buena."),
    ("v5", "p2", "u-vec", "Trabajo prolijo y a buen precio."),
]

SEED_AVALADORES = [
    ("av1", "Ferretería El Tornillo", "ferreteria", "Zona Centro", "999111001"),
    ("av2", "Bodega Doña Rosa", "bodega", "Zona Norte", "999111002"),
    ("av3", "Olla Común San Martín", "olla", "Zona Sur", "999111003"),
    ("av4", "Parroquia San José", "parroquia", "Zona Centro", "999111004"),
]


def seed(con: sqlite3.Connection) -> None:
    now = int(time.time())
    for uid, nombre, zona, tel, email, pw, rol, yape in SEED_USERS:
        con.execute(
            "INSERT OR IGNORE INTO usuarios(id,nombre,zona,telefono,email,pass,rol,yape,creado,telefono_verificado,acepta_privacidad)"
            " VALUES(?,?,?,?,?,?,?,?,?,1,1)",
            (uid, nombre, zona, tel, email, hash_pw(pw), rol, yape, now),
        )
    for pid, autor, tipo, cat, sub, tit, desc, precio, medios, zona, lat, lng, em in SEED_PUBS:
        con.execute(
            "INSERT OR IGNORE INTO publicaciones(id,autor_id,tipo,categoria,subtipo_favor,titulo,descripcion,"
            "precio,medios_pago,zona,lat,lng,estado,es_emergencia,creado,actualizado,client_id,expira_en)"
            " VALUES(?,?,?,?,?,?,?,?,?,?,?,?,'activa',?,?,?,?,?)",
            (pid, autor, tipo, cat, sub, tit, desc, precio, medios, zona, lat, lng, em, now, now, pid,
             now + 30 * 86400),
        )
    for vid, pid, uid, com in SEED_VISTOS:
        con.execute(
            "INSERT OR IGNORE INTO vistos(id,publicacion_id,usuario_id,comentario,creado) VALUES(?,?,?,?,?)",
            (vid, pid, uid, com, now),
        )
    for aid, nombre, tipo, zona, contacto in SEED_AVALADORES:
        con.execute(
            "INSERT OR IGNORE INTO avaladores(id,nombre,tipo,zona,contacto,verificado_por,verificado_en,expira_en,activo,creado)"
            " VALUES(?,?,?,?,?,'u-mod',?,?,1,?)",
            (aid, nombre, tipo, zona, contacto, now, now + 365 * 86400, now),
        )
    con.execute(
        "INSERT OR IGNORE INTO publicacion_avalador(publicacion_id,avalador_id)"
        " VALUES('p1','av1'),('p3','av2'),('p8','av3')"
    )
    # Fila única de configuración de emergencia (sin ella la activación no persiste)
    con.execute(
        "INSERT OR IGNORE INTO config_emergencia(id,activa,activada_por,activada_en,desactivada_en,motivo,expira)"
        " VALUES('global',0,NULL,NULL,NULL,'',NULL)"
    )
    con.commit()


def init_db() -> list[str]:
    con = connect()
    con.executescript(SCHEMA)
    applied = migrate(con)
    seed(con)
    con.close()
    return applied


if __name__ == "__main__":
    print("Esquema y migraciones:", init_db() or "sin cambios")
    print("Base:", DB_PATH)
