#!/usr/bin/env python3
"""
Genera supabase/seed/demo_solicitudes.sql: datos FICTICIOS para que el panel de administración muestre
solicitudes completas. Es determinista (semilla fija): volver a generarlo produce el mismo archivo.

1. Completa a los 204 representantes del dataset (nombre, cédula válida, teléfono, parentesco, dirección y un
   correo «@familias.invalid») y a los 240 estudiantes (cédula válida y fecha de nacimiento dentro de su año).
2. Crea una solicitud histórica APROBADA (año 2025-2026) por estudiante, con su historial, y la enlaza a su matrícula.
3. Crea ~40 postulaciones NUEVAS para 2026-2027 en todos los estados; las aprobadas se matriculan con
   public.enroll_application (matrícula + 10 pensiones), igual que al aprobar desde el panel.

«.invalid» es un dominio reservado (RFC 2606): la app nunca envía correos a esas direcciones.
Uso:  python3 scripts/generar_solicitudes_demo.py [cedulas_existentes.txt]
Aplicar: psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/seed/demo_solicitudes.sql
"""
import csv, json, random, sys, unicodedata, uuid
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "supabase" / "seed" / "demo_solicitudes.sql"
rng = random.Random(20260131)

GRADE = {"8vo EGB": "octavo_egb", "9no EGB": "noveno_egb", "10mo EGB": "decimo_egb", "1ro BGU": "primero_bgu", "2do BGU": "segundo_bgu", "3ro BGU": "tercero_bgu"}
# Año de nacimiento típico para entrar a cada curso en 2026-2027.
BIRTH_NEW = {"octavo_egb": 2014, "noveno_egb": 2013, "decimo_egb": 2012, "primero_bgu": 2011, "segundo_bgu": 2010, "tercero_bgu": 2009}
KINDS = ["cedula_estudiante", "cedula_representante", "partida_nacimiento", "certificado_notas", "foto", "certificado_medico", "estado_cuenta"]
F = ["María", "Ana", "Lucía", "Gabriela", "Paola", "Verónica", "Carolina", "Daniela", "Andrea", "Fernanda", "Patricia", "Sofía", "Valeria",
     "Mónica", "Silvia", "Lorena", "Diana", "Cristina", "Elena", "Rosa", "Isabel", "Natalia", "Karina", "Tatiana", "Jimena", "Camila"]
M = ["Juan", "Carlos", "Luis", "Jorge", "Andrés", "Diego", "Fernando", "Ricardo", "Pablo", "Miguel", "José", "Santiago", "Esteban", "Roberto",
     "Marco", "Javier", "Daniel", "Héctor", "Raúl", "Patricio", "Fabián", "Iván", "Mauricio", "Sebastián", "Mateo", "Martín"]
OTHER_SURNAMES = ["Andrade", "Benítez", "Cárdenas", "Espinoza", "Ortega", "Salazar", "Vásconez", "Zambrano", "Paredes", "Mora"]
STREETS = ["Av. de los Ocho Saberes", "Calle Los Cedros", "Av. Aurora Boreal", "Calle Las Orquídeas", "Pasaje El Mirador", "Av. del Río Claro",
           "Calle Los Arrayanes", "Av. Central", "Calle Las Acacias", "Pasaje Los Alisos"]
SCHOOLS = ["Escuela Los Pinos", "Unidad Educativa Valle Verde", "Escuela Fiscal Río Claro", "Colegio Monte Alto", "Escuela Santa Clara de Aurora",
           "Unidad Educativa El Mirador", "Escuela Mixta Las Acacias", "Colegio Nueva Aurora"]
ALPHA = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
UTC = timezone.utc
CUTOFF = date(2026, 1, 30)  # todo ocurre antes del corte de la demo (31 ene 2026)

used_docs = set()
if len(sys.argv) > 1 and Path(sys.argv[1]).exists():
    used_docs |= {l.strip() for l in Path(sys.argv[1]).read_text().splitlines() if l.strip()}
used_codes, used_emails = set(), set()


def q(v):
    """Literal SQL."""
    if v is None:
        return "null"
    if isinstance(v, (int, float)):
        return str(v)
    return "'" + str(v).replace("'", "''") + "'"


def cedula():
    """Cédula ecuatoriana ficticia con dígito verificador válido (módulo 10)."""
    while True:
        prov = rng.choice([1, 7, 9, 11, 17, 18])
        digits = [prov // 10, prov % 10, rng.randint(0, 5)] + [rng.randint(0, 9) for _ in range(6)]
        s = 0
        for i, x in enumerate(digits):
            p = x * (2 if i % 2 == 0 else 1)
            s += p - 9 if p > 9 else p
        doc = "".join(map(str, digits)) + str((10 - s % 10) % 10)
        if doc not in used_docs:
            used_docs.add(doc)
            return doc


def tracking(year):
    while True:
        c = f"ADM-{year}-" + "".join(rng.choice(ALPHA) for _ in range(6))
        if c not in used_codes:
            used_codes.add(c)
            return c


def slug(s):
    return "".join(c for c in unicodedata.normalize("NFD", s.lower()) if unicodedata.category(c) != "Mn" and c.isalnum())


def email(first, last):
    base = f"{slug(first)}.{slug(last)}"
    e, n = f"{base}@familias.invalid", 2
    while e in used_emails:
        e, n = f"{base}{n}@familias.invalid", n + 1
    used_emails.add(e)
    return e


def phone():
    return "09" + "".join(str(rng.randint(0, 9)) for _ in range(8))


def address():
    return f"{rng.choice(STREETS)} {rng.randint(100, 999)}, Ciudad Aurora"


def ts(d: date, hour_local=None):
    """Fecha local (UTC-5) en horario de oficina → ISO UTC."""
    h = hour_local if hour_local is not None else rng.randint(8, 15)
    return datetime(d.year, d.month, d.day, h + 5, rng.randint(0, 59), tzinfo=UTC).isoformat()


def uid():
    return str(uuid.UUID(int=rng.getrandbits(128), version=4))


def docs(missing=()):
    return json.dumps([{"kind": k, "received": k not in missing} for k in KINDS], ensure_ascii=False)


sql = [
    "-- GENERADO por scripts/generar_solicitudes_demo.py — datos FICTICIOS de demostración. No editar a mano.",
    "-- Correos «@familias.invalid»: dominio reservado, la app nunca les envía correos.",
    "begin;",
    "do $$ begin if exists (select 1 from public.applications where tracking_code like 'ADM-2025-%') then",
    "  raise exception 'Las solicitudes de demostración ya están cargadas'; end if; end $$;",
]

# ---------- 1) Estudiantes y representantes del dataset ----------
students = list(csv.DictReader(open(ROOT / "dataset-ficticio-colegio" / "estudiantes.csv", encoding="utf-8-sig")))
families = {}
for s in students:
    families.setdefault(s["representante_codigo"], []).append(s)

for rep, kids in sorted(families.items()):
    surnames = kids[0]["nombre_ficticio"].split()[1:]
    paternal, maternal = (surnames + ["Andrade", "Benítez"])[:2]
    other = rng.choice(OTHER_SURNAMES)
    rel = rng.choices(["madre", "padre", "tutor"], [55, 35, 10])[0]
    if rel == "madre":
        first, last = rng.choice(F), f"{maternal} {other}"
    elif rel == "padre":
        first, last = rng.choice(M), f"{paternal} {other}"
    else:
        first, last = rng.choice(F + M), f"{rng.choice([paternal, maternal])} {other}"
    sql.append(
        f"update public.guardians set full_name = {q(first + ' ' + last)}, document_id = {q(cedula())}, email = {q(email(first, last.split()[0]))}, "
        f"phone = {q(phone())}, relationship = {q(rel)}, address = {q(address())} where code = {q(rep)};"
    )

for s in students:
    bd = date(int(s["anio_nacimiento"]), 1, 1) + timedelta(days=rng.randint(0, 364))
    sql.append(f"update public.students set document_id = {q(cedula())}, birth_date = {q(bd.isoformat())} where code = {q(s['codigo'])};")

# ---------- 2) Solicitudes históricas aprobadas (2025-2026) ----------
sql.append("-- Solicitudes históricas: una por estudiante actual, aprobada y enlazada a su matrícula.")
for s in students:
    app_id = uid()
    admission = date.fromisoformat(s["fecha_ingreso"] or "2025-09-01")
    sent = admission - timedelta(days=rng.randint(55, 100))
    rev = sent + timedelta(days=rng.randint(1, 4))
    itv = rev + timedelta(days=rng.randint(4, 10))
    ok = itv + timedelta(days=rng.randint(4, 9))
    sql.append(
        "insert into public.applications (id, tracking_code, student_id, guardian_id, grade_applied, academic_year, status, documents, interview_at, submitted_at, created_at, updated_at) "
        f"select {q(app_id)}, {q(tracking(2025))}, st.id, st.guardian_id, {q(GRADE[s['curso']])}, '2025-2026', 'aprobada', {q(docs())}::jsonb, "
        f"{q(ts(itv + timedelta(days=3), 10))}, {q(ts(sent))}, {q(ts(sent))}, {q(ts(ok))} from public.students st where st.code = {q(s['codigo'])};"
    )
    for status, d, note in [("enviada", sent, None), ("en_revision", rev, None), ("entrevista_agendada", itv, None), ("aprobada", ok, "Cupo confirmado")]:
        sql.append(f"insert into public.application_status_events (application_id, status, actor, note, at) values ({q(app_id)}, {q(status)}, {q('sistema' if status == 'enviada' else 'secretaria')}, {q(note)}, {q(ts(d))});")
    sql.append(f"update public.enrollments set application_id = {q(app_id)} where academic_year = '2025-2026' and student_id = (select id from public.students where code = {q(s['codigo'])});")

# ---------- 3) Postulaciones nuevas 2026-2027 ----------
sql.append("-- Postulaciones nuevas para 2026-2027 en todos los estados del proceso.")
plan_statuses = (["enviada"] * 9 + ["en_revision"] * 8 + ["documentos_pendientes"] * 6 + ["entrevista_agendada"] * 6
                 + ["lista_espera"] * 4 + ["rechazada"] * 3 + ["aprobada"] * 4)
grades = ["octavo_egb"] * 14 + ["noveno_egb"] * 6 + ["decimo_egb"] * 6 + ["primero_bgu"] * 6 + ["segundo_bgu"] * 4 + ["tercero_bgu"] * 4
rng.shuffle(grades)
rng.shuffle(plan_statuses)
# 4 hermanos de estudiantes actuales (mismo representante del dataset) y hasta 3 pares de hermanos entre familias nuevas.
sibling_reps = rng.sample(sorted(families), 4)
pending_pairs = 3
last_new_guardian = None
DEPTH = {"enviada": 0, "en_revision": 1, "documentos_pendientes": 2, "entrevista_agendada": 2, "lista_espera": 3, "rechazada": 3, "aprobada": 3}
END_NOTE = {"lista_espera": "Sin cupo disponible en el curso por ahora", "rechazada": "No cumple los requisitos de ingreso para el curso solicitado", "aprobada": "Cupo confirmado"}

for i, (status, grade) in enumerate(zip(plan_statuses, grades)):
    gender = rng.choice(["F", "M"])
    kid_first = rng.choice(F if gender == "F" else M)
    if i < len(sibling_reps):
        rep = sibling_reps[i]
        surname = " ".join(families[rep][0]["nombre_ficticio"].split()[1:3])
        guardian_sql = f"(select id from public.guardians where code = {q(rep)})"
    elif last_new_guardian and pending_pairs > 0 and rng.random() < 0.5:
        g_id, surname = last_new_guardian
        guardian_sql = q(g_id)
        pending_pairs -= 1
        last_new_guardian = None
    else:
        rel = rng.choices(["madre", "padre", "tutor"], [55, 35, 10])[0]
        p1 = rng.choice(["Guerrero", "Torres", "Mendoza", "Castillo", "Vega", "Ruiz", "Navarro", "Molina", "Herrera", "Rojas"])
        p2 = rng.choice(["Delgado", "Flores", "Romero", "Suárez", "Aguirre", "Cevallos", "Jaramillo", "Proaño", "Montalvo", "Villacís"])
        o = rng.choice(OTHER_SURNAMES)
        surname = f"{p1} {p2}"
        gfirst = rng.choice(F if rel == "madre" else M if rel == "padre" else F + M)
        glast = f"{p2 if rel == 'madre' else p1} {o}"
        g_id = uid()
        sql.append(
            "insert into public.guardians (id, full_name, document_id, email, phone, relationship, address) values "
            f"({q(g_id)}, {q(gfirst + ' ' + glast)}, {q(cedula())}, {q(email(gfirst, glast.split()[0]))}, {q(phone())}, {q(rel)}, {q(address())});"
        )
        guardian_sql = q(g_id)
        last_new_guardian = (g_id, surname)
    st_id = uid()
    bd = date(BIRTH_NEW[grade], 1, 1) + timedelta(days=rng.randint(0, 364))
    nee = rng.choice(["TDAH", "Dislexia", "Discapacidad auditiva leve"]) if rng.random() < 0.08 else None
    sql.append(
        "insert into public.students (id, full_name, document_id, birth_date, gender, guardian_id, previous_school, special_needs) "
        f"values ({q(st_id)}, {q(kid_first + ' ' + surname)}, {q(cedula())}, {q(bd.isoformat())}, {q(gender)}, {guardian_sql}, {q(rng.choice(SCHOOLS))}, {q(nee)});"
    )
    # Las más avanzadas en el proceso se enviaron antes; algunas «enviadas» quedan estancadas (el auditor las detecta).
    depth = DEPTH[status]
    sent = CUTOFF - timedelta(days=rng.randint(2 + depth * 9, 14 + depth * 14))
    if status == "enviada" and rng.random() < 0.3:
        sent = CUTOFF - timedelta(days=rng.randint(20, 40))
    events, day, missing, interview = [("enviada", sent, None)], sent, (), None
    if status == "enviada" and rng.random() < 0.5:
        missing = ("certificado_medico",)
    if depth >= 1:
        day += timedelta(days=rng.randint(1, 4))
        events.append(("en_revision", day, None))
    if status == "documentos_pendientes":
        missing = tuple(rng.sample(["certificado_notas", "estado_cuenta", "partida_nacimiento", "foto"], rng.randint(1, 2)))
        day += timedelta(days=rng.randint(1, 3))
        events.append(("documentos_pendientes", day, "Faltan: " + ", ".join(m.replace("_", " ") for m in missing)))
    if status in ("entrevista_agendada", "lista_espera", "rechazada", "aprobada"):
        day += timedelta(days=rng.randint(2, 6))
        events.append(("entrevista_agendada", day, None))
        interview = date(2026, 2, rng.randint(3, 13)) if status == "entrevista_agendada" else day + timedelta(days=rng.randint(3, 6))
    if status in END_NOTE:
        day = min(CUTOFF, interview + timedelta(days=rng.randint(1, 4)))
        events.append((status, day, END_NOTE[status]))
    day = min(day, CUTOFF)
    app_id = uid()
    sql.append(
        "insert into public.applications (id, tracking_code, student_id, guardian_id, grade_applied, academic_year, status, documents, interview_at, submitted_at, created_at, updated_at) "
        f"values ({q(app_id)}, {q(tracking(2026))}, {q(st_id)}, {guardian_sql}, {q(grade)}, '2026-2027', {q(status)}, {q(docs(missing))}::jsonb, "
        f"{q(ts(interview, 10) if interview else None)}, {q(ts(sent))}, {q(ts(sent))}, {q(ts(day, 15))});"
    )
    for st, d, note in events:
        sql.append(f"insert into public.application_status_events (application_id, status, actor, note, at) values ({q(app_id)}, {q(st)}, {q('sistema' if st == 'enviada' else 'secretaria')}, {q(note)}, {q(ts(min(d, CUTOFF)))});")
    if status == "aprobada":
        approved = datetime.fromisoformat(ts(day, 15))
        plan = [{"concept": "matricula", "period": approved.strftime("%Y-%m"), "description": "Matrícula 2026-2027", "amount": 150,
                 "due_date": (approved + timedelta(days=15)).date().isoformat()}]
        for k in range(10):
            m = 8 + k
            period = f"{2026 + m // 12}-{(m % 12) + 1:02d}"
            plan.append({"concept": "pension", "period": period, "description": f"Pensión {period}", "amount": 185, "due_date": f"{period}-10"})
        sql.append(f"select * from public.enroll_application({q(app_id)}, {q(json.dumps(plan, ensure_ascii=False))}::jsonb, 'secretaria', {q(approved.isoformat())});")

sql.append("commit;")
OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text("\n".join(sql) + "\n", encoding="utf-8")
print(f"OK: {OUT.relative_to(ROOT)} · {len(families)} representantes, {len(students)} estudiantes, {len(students)} solicitudes históricas, {len(plan_statuses)} postulaciones nuevas")
