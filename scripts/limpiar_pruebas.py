#!/usr/bin/env python3
"""Limpia los datos que dejan las corridas de verificación.

Uso: python3 scripts/limpiar_pruebas.py [ruta_db]
Oculta (borrado suave) las publicaciones de las cuentas de prueba y elimina
esas cuentas. No toca vecinos reales ni la semilla.
"""
import sqlite3
import sys
import time
from pathlib import Path

db = Path(sys.argv[1] if len(sys.argv) > 1 else "data/app.db")
if not db.exists():
    sys.exit(f"No existe {db}")

con = sqlite3.connect(db)
con.row_factory = sqlite3.Row
patrones = ("verifica%@test.local", "bloqueo%@test.local", "pruebas@app.local")

ids = []
for patron in patrones:
    ids += [r["id"] for r in con.execute("SELECT id FROM usuarios WHERE email LIKE ?", (patron,))]

if not ids:
    print("Nada que limpiar: no hay cuentas de prueba.")
    sys.exit(0)

marcas = ",".join("?" * len(ids))
ahora = int(time.time())
publicaciones = con.execute(
    f"SELECT id FROM publicaciones WHERE autor_id IN ({marcas}) AND deleted_at IS NULL", ids
).fetchall()
for p in publicaciones:
    con.execute(
        "UPDATE publicaciones SET deleted_at=?, deleted_por='limpieza', motivo_baja='prueba' WHERE id=?",
        (ahora, p["id"]),
    )
con.execute(f"DELETE FROM sesiones WHERE usuario_id IN ({marcas})", ids)
con.execute(f"DELETE FROM usuarios WHERE id IN ({marcas})", ids)
con.commit()

activas = con.execute(
    "SELECT COUNT(*) c FROM publicaciones WHERE deleted_at IS NULL AND estado='activa'"
).fetchone()["c"]
usuarios = con.execute("SELECT COUNT(*) c FROM usuarios").fetchone()["c"]
con.close()
print(f"Cuentas de prueba eliminadas: {len(ids)} · publicaciones ocultas: {len(publicaciones)}")
print(f"Quedan: {activas} publicaciones activas, {usuarios} usuarios.")
