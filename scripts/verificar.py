#!/usr/bin/env python3
"""Verificación funcional de la App Vecinal Solidaria · Piura.

Uso:  python3 scripts/verificar.py [http://127.0.0.1:8020]
Recorre los requisitos del Documento Técnico y las seis fases de mejora,
y reporta PASÓ / FALLÓ por caso. Sin dependencias externas.
"""
import json
import sys
import time
import urllib.error
import urllib.request

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8020"
ZONA = "Urb. Santa Isabel"
OK, FAIL = [], []


def call(path, method="GET", body=None, token=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(BASE + path, data=data, method=method)
    req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", "Bearer " + token)
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            raw = r.read().decode()
            return r.status, (json.loads(raw) if raw else {})
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try:
            return e.code, json.loads(raw)
        except json.JSONDecodeError:
            return e.code, {"raw": raw}


def check(nombre, cond, detalle=""):  # noqa: ANN
    if cond:
        OK.append(nombre)
        print(f"  ✅ {nombre}")
    else:
        FAIL.append(f"{nombre} {detalle}")
        print(f"  ❌ {nombre} {detalle}")


print("== Salud y sectores ==")
s, d = call("/api/salud")
check("salud responde 200 con versión", s == 200 and d.get("ok"), d)
s, d = call("/health")
check("health responde 200", s == 200)
s, d = call("/api/zonas")
check("ocho sectores de Piura", s == 200 and len(d) == 8, len(d) if isinstance(d, list) else d)
check("sectores con coordenadas de Piura",
      isinstance(d, list) and all(-6 < z["lat"] < -4.5 and -81.5 < z["lng"] < -79.5 for z in d))

print("\n== Cuenta y sesión ==")
suffix = str(int(time.time()))[-6:]
telefono = ("9" + suffix + "23")[:9]
email = f"verifica{suffix}@test.local"
s, d = call("/api/registro", "POST", {
    "nombre": "Vecina de Prueba", "zona": ZONA, "telefono": telefono,
    "email": email, "password": "clave123", "yape": telefono, "plin": telefono,
    "acepta_privacidad": True})
check("registro válido crea cuenta", s == 200 and d.get("ok"), d)
s, d = call("/api/registro", "POST", {
    "nombre": "Vecina de Prueba", "zona": ZONA, "telefono": telefono,
    "email": email, "password": "clave123"})
check("registro duplicado rechazado (400)", s == 400, d)
s, d = call("/api/registro", "POST", {"nombre": "Vecino X", "zona": ZONA,
                                      "telefono": "123", "email": "mal", "password": "1"})
check("registro inválido rechazado (422)", s == 422, d)
s, d = call("/api/registro", "POST", {"nombre": "Vecino X", "zona": "Zona Norte",
                                      "telefono": "999888777", "email": f"z{suffix}@test.local",
                                      "password": "clave123", "acepta_privacidad": True})
check("zona inventada rechazada (400)", s == 400, d)
s, d = call("/api/registro", "POST", {"nombre": "Vecino X", "zona": ZONA,
                                      "telefono": "999888778", "email": f"p{suffix}@test.local",
                                      "password": "clave123", "acepta_privacidad": False})
check("registro sin aceptar privacidad rechazado (400)", s == 400, d)

# Sesión de un segundo vecino (autor de p1) para probar privacidad entre cuentas
s, d2g = call("/api/login", "POST", {"email": "juan@app.local", "password": "gas123"})
tok_gas = d2g.get("token")

s, d = call("/api/login", "POST", {"email": email, "password": "clave123"})
check("login correcto devuelve token", s == 200 and d.get("token"), d)
token = d.get("token")
if not token:
    print("No se obtuvo token; se detiene la verificación.")
    sys.exit(1)
s, d = call("/api/perfil", token=token)
check("perfil devuelve Plin guardado", s == 200 and d.get("plin") == telefono, d.get("plin"))
s2, d2 = call("/api/login", "POST", {"email": email, "password": "incorrecta"})
check("login incorrecto rechazado (401)", s2 == 401, d2)
s2, d2 = call("/api/perfil")
check("perfil sin token rechazado (401)", s2 == 401)
s2, d2 = call("/api/perfil", "PUT", {"descripcion": "Hola vecinos"}, token)
check("editar perfil funciona", s2 == 200 and d2.get("descripcion") == "Hola vecinos", d2)
s2, d2 = call("/api/perfil", "PUT", {"mostrar_contacto": False}, token)
check("perfil guarda preferencia de contacto", s2 == 200 and d2.get("mostrar_contacto") is False, d2)
call("/api/perfil", "PUT", {"mostrar_contacto": True}, token)

print("\n== Privacidad y consentimiento ==")
s, d = call("/api/publicaciones?limit=5")
primera = d["items"][0]
check("lista sin sesión no expone teléfono", "telefono" not in primera, primera.keys())
check("lista sin sesión no expone latitud exacta", "lat" not in primera)
check("lista trae ubicación aproximada", primera.get("lat_publica") is not None, primera)
check("lista sin sesión trae distancia en null (no inventa)", primera.get("distancia_km") is None)
s_con, d_con = call("/api/publicaciones?limit=5", token=token)
con_tel = [i for i in d_con["items"] if i.get("telefono")]
check("lista con sesión sí trae teléfono cuando el autor lo permite", bool(con_tel),
      [i.get("contacto_visible") for i in d_con["items"][:3]])
s, d = call("/api/publicaciones?limit=5&lat=-5.19449&lng=-80.63282")
dists = [i.get("distancia_km") for i in d["items"] if i.get("distancia_km") is not None]
check("distancia anónima calculada y ordenada", bool(dists) and dists == sorted(dists), dists[:4])
s_det, d_det = call(f"/api/publicaciones/{primera['id']}")
check("detalle sin sesión oculta teléfono", "telefono" not in d_det)

print("\n== Economía Local ==")
s, d = call("/api/publicaciones?tipo=servicio&limit=20")
check("filtra por tipo servicio", s == 200 and all(i["tipo"] == "servicio" for i in d["items"]))
s, d = call("/api/publicaciones?categoria=alimentos")
check("filtra por categoría alimentos", all(i["categoria"] == "alimentos" for i in d["items"]))
s, d = call("/api/publicaciones?q=gasfitero")
check("busca por texto", d["total"] >= 1)
s, d = call("/api/publicaciones?limit=3&offset=0")
s2, d2 = call("/api/publicaciones?limit=3&offset=3")
check("paginación devuelve páginas distintas",
      set(i["id"] for i in d["items"]).isdisjoint(set(i["id"] for i in d2["items"])))
s, d = call("/api/publicaciones?limit=abc")
check("paginación inválida rechazada (422)", s == 422)
s, d = call("/api/publicaciones?limit=50&solo_favores=true")
check("filtro de favores devuelve solo favores",
      s == 200 and all(i["tipo"].startswith("favor") for i in d["items"]) and d["items"], len(d["items"]))

pub = {
    "tipo": "servicio", "categoria": "cerrajería",
    "titulo": "Cerrajero de prueba", "descripcion": "Apertura de puertas sin daño.",
    "precio": "S/ 40", "medios_pago": "yape,efectivo", "zona": ZONA,
    "client_id": f"verif-{suffix}",
}
s, d = call("/api/publicaciones", "POST", pub, token)
check("publicar servicio funciona", s == 200 and d.get("ok"), d)
nueva_id = d.get("id")
s, d = call("/api/publicaciones", "POST", pub, token)
check("idempotencia: mismo client_id no duplica", s == 200 and d.get("duplicado"), d)
s, d = call("/api/publicaciones", "POST", {**pub, "client_id": f"otro-{suffix}"}, None)
check("publicar sin sesión rechazado (401)", s == 401, d)
s, d = call("/api/publicaciones", "POST", {**pub, "tipo": "inventado",
                                          "client_id": f"x-{suffix}"}, token)
check("tipo inválido rechazado (400)", s == 400, d)

print("\n== Pagos y fotos ==")
s, d = call(f"/api/publicaciones/{nueva_id}", token=token)
check("mi publicación muestra mi Yape", d.get("yape_autor") == telefono, d.get("yape_autor"))
check("mi publicación muestra mi Plin", d.get("plin_autor") == telefono, d.get("plin_autor"))
# publicación con el contacto oculto
oculta = {**pub, "titulo": "Cerrajero reservado", "client_id": f"oc-{suffix}",
          "mostrar_contacto": False}
s, d = call("/api/publicaciones", "POST", oculta, token)
oc_id = d.get("id")
s, d = call(f"/api/publicaciones/{oc_id}", token=tok_gas)
check("consentimiento: contacto oculto respetado para otro vecino con sesión",
      d.get("contacto_visible") is False and d.get("yape_autor") is None, d.get("contacto_visible"))
PNG = ("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJ"
       "AAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==")
s, d = call("/api/fotos", "POST", {"data": PNG}, token)
check("subir foto funciona", s == 200 and d.get("url", "").startswith("/fotos/"), d)
foto_url = d.get("url", "")
if foto_url:
    try:
        with urllib.request.urlopen(BASE + foto_url, timeout=10) as r:
            check("foto servida en /fotos", r.status == 200)
    except Exception as e:  # noqa: BLE001
        check("foto servida en /fotos", False, str(e))
s, d = call("/api/fotos", "POST", {"data": "no-es-imagen"}, token)
check("foto con formato inválido rechazada (400)", s == 400, d)

print("\n== Movilidad y menores ==")
s, d = call("/api/publicaciones", "POST", {
    "tipo": "favor_ofrecido", "categoria": "movilidad", "subtipo_favor": "movilidad",
    "titulo": "Llevo niños al colegio San José", "descripcion": "Salgo a las 7 al colegio San José.",
    "zona": ZONA, "franja_horaria": "7:00 a 8:00", "punto_encuentro": "parque",
    "checklist_ok": True, "client_id": f"mov-{suffix}"}, token)
check("movilidad con nombre de colegio rechazada (400)", s == 400, d)
s, d = call("/api/publicaciones", "POST", {
    "tipo": "favor_ofrecido", "categoria": "movilidad", "subtipo_favor": "movilidad",
    "titulo": "Comparto auto por la zona", "descripcion": "Salgo a las 7 hacia la zona norte.",
    "zona": ZONA, "franja_horaria": "7:00 a 8:00", "punto_encuentro": "parque principal",
    "checklist_ok": True, "client_id": f"mov2-{suffix}"}, token)
check("movilidad sin datos del menor aceptada", s == 200, d)
s, d = call("/api/publicaciones", "POST", {
    "tipo": "favor_ofrecido", "categoria": "movilidad", "subtipo_favor": "movilidad",
    "titulo": "Comparto auto", "descripcion": "Salgo temprano", "zona": ZONA,
    "client_id": f"mov3-{suffix}"}, token)
check("movilidad sin checklist rechazada (400)", s == 400, d)

print("\n== Ciclo cerrado: trato y visto bueno ==")
pub_ajena = "p1"  # Gasfitero de Juan (u-gas)
s, d = call("/api/vistos", "POST", {"publicacion_id": nueva_id}, token)
check("no puedes recomendar tu propia publicación (400)", s == 400, d)
s, d = call("/api/vistos", "POST", {"publicacion_id": pub_ajena, "comentario": "Buen trabajo"}, token)
check("visto bueno sin trato cerrado rechazado (400)", s == 400, d)
s, d = call("/api/tratos", "POST", {"publicacion_id": pub_ajena, "monto": "S/ 50"}, token)
check("crear trato funciona", s == 200 and d.get("estado") == "acordado", d)
tid = d.get("id")
s, d = call(f"/api/tratos/{tid}/estado", "POST", {"estado": "cerrado"}, token)
check("primera marca no cierra el trato", s == 200, d)
s, d = call("/api/tratos", token=token)
check("trato sigue acordado con una sola marca",
      any(t["id"] == tid and t["estado"] == "acordado" for t in d), [t["estado"] for t in d])
s, d = call(f"/api/tratos/{tid}/estado", "POST", {"estado": "cerrado"}, tok_gas)
check("segunda marca cierra el trato", s == 200, d)
s, d = call("/api/tratos", token=token)
check("trato queda cerrado", any(t["id"] == tid and t["estado"] == "cerrado" for t in d),
      [t["estado"] for t in d])
s, d = call("/api/vistos", "POST", {"publicacion_id": pub_ajena, "comentario": "Buen trabajo"}, token)
check("visto bueno permitido tras trato cerrado", s == 200 and d.get("vistos", 0) >= 1, d)
s, d = call("/api/vistos", "POST", {"publicacion_id": pub_ajena}, token)
check("segundo visto bueno rechazado (400)", s == 400, d)
s, d = call("/api/vistos", "POST", {"publicacion_id": pub_ajena}, None)
check("visto bueno sin sesión rechazado (401)", s == 401, d)
s, d = call("/api/vistos/" + pub_ajena)
check("lista de recomendaciones con comentario", any(v["comentario"] for v in d), d)

print("\n== Avisos ==")
s, d = call("/api/notificaciones", token=tok_gas)
check("el vendedor recibe aviso del trato", s == 200 and d.get("sin_leer", 0) >= 1, d.get("sin_leer"))
s, d = call("/api/notificaciones/leer", "POST", {}, tok_gas)
check("marcar avisos como leídos", s == 200, d)
s, d = call("/api/notificaciones", token=tok_gas)
check("contador queda en cero", d.get("sin_leer") == 0, d.get("sin_leer"))
s, d = call("/api/notificaciones")
check("avisos sin sesión rechazados (401)", s == 401)

print("\n== Registro de accesos ==")
s, d = call(f"/api/publicaciones/{pub_ajena}", token=token)
s, d = call("/api/mis-accesos", token=tok_gas)
check("el autor ve quién consultó su contacto", s == 200 and d.get("total", 0) >= 1, d.get("total"))

print("\n== Recuperar contraseña ==")
s, d = call("/api/password/solicitar", "POST", {"identificador": email})
check("solicitar código responde con mensaje", s == 200 and d.get("ok"), d)
codigo = d.get("codigo_demo")
s, d = call("/api/password/confirmar", "POST",
            {"identificador": email, "codigo": "000000" if codigo != "000000" else "111111",
             "password": "otra123"})
check("código incorrecto rechazado (400)", s == 400, d)
s, d = call("/api/password/confirmar", "POST",
            {"identificador": email, "codigo": codigo, "password": "nueva123"})
check("código correcto cambia la contraseña", s == 200, d)
s, d = call("/api/login", "POST", {"email": email, "password": "nueva123"})
check("login con la contraseña nueva", s == 200 and d.get("token"), d)
token = d.get("token") or token
s, d = call("/api/password/solicitar", "POST", {"identificador": "nadie@existe.local"})
check("cuenta inexistente no revela nada", s == 200 and "codigo_demo" not in d, d)

print("\n== Reportes y moderación ==")
s, d = call("/api/reportes", "POST", {"publicacion_id": "no-existe", "motivo": "prueba"}, token)
check("reporte de publicación inexistente (404)", s == 404, d)
s, d = call("/api/reportes", "POST", {"publicacion_id": nueva_id, "motivo": "prueba"}, token)
check("no puedes reportar tu propia publicación (400)", s == 400, d)
s, d = call("/api/reportes", "POST", {"publicacion_id": pub_ajena, "motivo": "Spam de prueba"}, token)
check("reportar publicación ajena funciona", s == 200, d)
s, d = call("/api/reportes", "POST", {"publicacion_id": pub_ajena, "motivo": "otra vez"}, token)
check("reporte duplicado rechazado (400)", s == 400, d)
s, d = call("/api/moderacion/reportes", token=token)
check("panel de moderación cerrado a vecinos (403)", s == 403, d)

s, d = call("/api/login", "POST", {"email": "mod@app.local", "password": "mod123"})
mod = d.get("token")
check("login de moderador", s == 200 and d.get("usuario", {}).get("rol") == "moderador", d)
s, d = call("/api/login", "POST", {"email": "mod2@app.local", "password": "mod2-123"})
check("moderador suplente puede entrar", s == 200 and d.get("usuario", {}).get("rol") == "moderador", d)
s, d = call("/api/moderacion/reportes", token=mod)
check("moderador ve reportes pendientes", s == 200 and len(d) >= 1, len(d) if isinstance(d, list) else d)
if d:
    rep_id = d[0]["id"]
    s, d2 = call("/api/moderacion/reportes", "POST", {"reporte_id": rep_id, "accion": "ninguna"}, mod)
    check("moderador resuelve reporte", s == 200, d2)
s, d = call("/api/moderacion/metricas", token=mod)
check("métricas de liquidez disponibles", s == 200 and "fill_rate_cotizaciones" in d, d)
check("métricas incluyen tratos cerrados", "tratos_cerrados" in d and d["tratos_cerrados"] >= 1, d)

print("\n== Emergencia ==")
s, d = call("/api/emergencia")
check("tablero trae aviso de no oficial", "NO oficial" in d.get("aviso", ""), d.get("aviso"))
check("tablero trae números de emergencia", "105" in d.get("aviso", ""))
check("taxonomía de 72 horas presente", len(d.get("necesidades_72h", [])) >= 10)
s, d = call("/api/emergencia/activar", "POST", {"activa": True}, token)
check("vecino no puede activar emergencia (403)", s == 403, d)
s, d = call("/api/emergencia/activar", "POST", {"activa": True, "motivo": "Simulacro"}, mod)
check("moderador activa emergencia", s == 200, d)
s, d = call("/api/emergencia")
check("emergencia queda activa", d.get("activa") is True, d)
s, d = call("/api/emergencia/directorio")
check("directorio de apoyo con organizaciones", len(d.get("directorio", [])) >= 1, d)
s, d = call("/api/emergencia/activar", "POST", {"activa": False}, mod)
check("moderador desactiva emergencia", s == 200 and call("/api/emergencia")[1]["activa"] is False)

print("\n== Cotizaciones == ")
s, d = call("/api/cotizaciones", "POST",
            {"publicacion_id": pub_ajena, "descripcion": "Necesito arreglar una fuga"}, token)
check("pedir cotización funciona", s == 200, d)
check("el vendedor recibe aviso de la cotización",
      call("/api/notificaciones", token=tok_gas)[1].get("sin_leer", 0) >= 1)
s, d = call("/api/cotizaciones", "POST",
            {"publicacion_id": nueva_id, "descripcion": "propia"}, token)
check("no puedes cotizar tu propia publicación (400)", s == 400, d)
s, d = call("/api/cotizaciones", token=token)
check("mis cotizaciones listadas", s == 200 and len(d) >= 1, d)
s, d = call("/api/cotizaciones/" + d[0]["id"] + "/responder", "POST", {"respuesta": "puedo"}, token)
check("solo el vendedor responde la cotización (403)", s == 403, d)

print("\n== Intercambios ==")
s, d = call("/api/publicaciones?tipo=favor_solicitado")
fav = d["items"][0]["id"] if d["items"] else None
if fav:
    detalle_fav = call("/api/publicaciones/" + fav)[1]
    extra = {}
    if detalle_fav.get("subtipo_favor") == "prestamo":
        extra = {"garante_nombre": "Vecino Garante", "fecha_devolucion": "viernes"}
    s, d = call("/api/intercambios", "POST", {"peticion_id": fav, **extra}, token)
    check("solicitar un favor funciona", s == 200, d)
    iid = d.get("id")
    s, d = call("/api/intercambios", token=token)
    check("mis intercambios listados", s == 200 and len(d) >= 1, d)
    s, d = call("/api/intercambios/" + iid + "/estado", "POST", {"estado": "resuelta"}, token)
    check("no se puede saltar de solicitada a resuelta (400)", s == 400, d)

print("\n== Avaladores ==")
s, d = call("/api/avaladores")
check("lista de avaladores visibles", s == 200 and len(d) >= 1, d)
s, d = call("/api/avaladores", "POST", {"nombre": "Bodega X", "tipo": "bodega", "zona": ZONA}, token)
check("solo moderador crea avaladores (403)", s == 403, d)
s, d = call("/api/avaladores", "POST", {"nombre": "Bodega Nueva", "tipo": "bodega", "zona": ZONA}, mod)
check("moderador crea avalador", s == 200, d)

print("\n== Borrado y edición ==")
s, d = call(f"/api/publicaciones/{nueva_id}", "PATCH", {"titulo": "Cerrajero actualizado"}, token)
check("autor edita su publicación", s == 200, d)
s, d = call("/api/publicaciones/p1", "PATCH", {"titulo": "hackeado"}, token)
check("no puedes editar publicación ajena (403)", s == 403, d)
s, d = call(f"/api/publicaciones/{nueva_id}", "DELETE", token=token)
check("autor elimina su publicación (borrado suave)", s == 200, d)
s, d = call(f"/api/publicaciones/{nueva_id}")
check("publicación eliminada ya no se ve (404)", s == 404, d)

print("\n== Bloqueo por intentos ==")
tmp_email = f"bloqueo{suffix}@test.local"
call("/api/registro", "POST", {"nombre": "Bloqueo", "zona": ZONA, "telefono": "999000" + suffix[:3],
                               "email": tmp_email, "password": "clave123", "acepta_privacidad": True})
for _ in range(5):
    call("/api/login", "POST", {"email": tmp_email, "password": "mala"})
s, d = call("/api/login", "POST", {"email": tmp_email, "password": "clave123"})
check("cuenta bloqueada tras 5 fallos (429)", s == 429, d)

print("\n== Estáticos y PWA ==")
for ruta in ("/", "/app.js", "/style.css", "/manifest.json", "/sw.js", "/icon-192.svg"):
    try:
        with urllib.request.urlopen(BASE + ruta, timeout=10) as r:
            check(f"{ruta} responde 200", r.status == 200)
    except Exception as e:  # noqa: BLE001
        check(f"{ruta} responde 200", False, str(e))

print("\n" + "=" * 60)
print(f"PASARON: {len(OK)}   FALLARON: {len(FAIL)}")
if FAIL:
    print("\nFallos:")
    for f in FAIL:
        print(" -", f)
    sys.exit(1)
print("Todo en verde.")
