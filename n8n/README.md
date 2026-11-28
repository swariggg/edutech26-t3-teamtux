# n8n · Contratos de integración

La app y n8n se comunican por webhooks JSON. Los flujos exportados están en `n8n/workflows/`.

## Entrante (n8n → app)

`POST {APP_URL}/api/webhooks/n8n`

- Cabecera obligatoria: `x-webhook-secret: <N8N_WEBHOOK_SECRET>`
- Sin `N8N_WEBHOOK_SECRET` configurado el webhook responde 401 en **todos** los entornos. Para desarrollo define uno en `.env.local` (p. ej. `openssl rand -hex 24`).
- `payment.registered` es idempotente por `reference`: repetir el mismo comprobante responde `{"ok":true,"applied":false}` sin sumar de nuevo.
- Cada evento queda en la bitácora con actor `n8n`.

| Evento | Cuerpo |
|---|---|
| Cambio de estado de solicitud | `{"type":"application.status_update","trackingCode":"ADM-2026-0001","status":"documentos_pendientes","note":"Falta partida"}` (o `applicationId` en vez de `trackingCode`) |
| Pago registrado | `{"type":"payment.registered","installmentId":"…","amount":220,"method":"transferencia","reference":"REF-123"}` |
| Recordatorio enviado | `{"type":"reminder.sent","installmentId":"…","channel":"whatsapp","sentAt":"2026-11-27T13:00:00Z"}` |

Respuestas: `200 {"ok":true}` · `400` datos inválidos · `401` secreto incorrecto o no configurado · `404` registro no encontrado · `409` cuota anulada o ya pagada · `429` demasiadas solicitudes.

## Saliente (app → n8n, opcional)

Si `N8N_OUTBOUND_WEBHOOK_URL` está definido, la app hace `POST` (con `x-webhook-secret` si existe) con:

```json
{ "event": "application.created | application.status_changed | payment.received | tracking_code.notify", "occurredAt": "ISO-8601", "data": { } }
```

`tracking_code.notify` se emite al enviar una solicitud (`reason: "created"`) y cuando la familia usa «¿Olvidaste tu código?» en `/estado` (`reason: "resend"`):

```json
{ "event": "tracking_code.notify", "data": {
  "reason": "created",
  "guardian": { "name": "…", "email": "…", "phone": "0990000000" },
  "applications": [{ "trackingCode": "ADM-2026-K7P2QX", "studentFirstName": "…", "grade": "8.º EGB", "status": "Enviada", "academicYear": "2026-2027" }],
  "institution": { "name": "Eight Academy", "email": "…", "phone": "…" },
  "statusUrl": "https://<app>/estado?codigo=ADM-2026-K7P2QX"
} }
```

## Flujos previstos

1. **Admisión:** al cambiar el estado, la IA redacta el aviso y n8n lo envía a la familia.
2. **Recordatorios de pago (diario):** cuotas que vencen en 3 días o ya vencidas → la IA redacta → email/WhatsApp → `reminder.sent` de vuelta a la app.
3. **Resumen del auditor (semanal):** llama a `/api/admin/auditor` (requerirá un token de servicio cuando exista Supabase Auth).

## Flujo implementado: código de seguimiento (`workflows/codigo-seguimiento.json`)

Envía el código de seguimiento al representante para que no dependa de anotarlo, y reenvía sus códigos cuando los olvida.

```
Webhook (POST /webhook/eight-academy-eventos, Header Auth x-webhook-secret)
  → ¿event = tracking_code.notify?
  → Armar mensaje (Code: HTML escapado + texto de WhatsApp; el enlace viene en statusUrl)
  → Enviar correo (Gmail, 3 reintentos)   [alternativa: SMTP, desactivado]
  → ¿Tiene teléfono? → Enviar WhatsApp (Cloud API; desactivado por defecto)
```

**Cómo activarlo:**
1. En n8n: *Import from file* → `n8n/workflows/codigo-seguimiento.json`.
2. Crea las credenciales:
   - **Header Auth** (nodo «Evento de la app»): Name `x-webhook-secret`, Value = el mismo valor que `N8N_WEBHOOK_SECRET` de la app.
   - **Gmail OAuth2** (nodo «Enviar correo (Gmail)»): «Sign in with Google» con la cuenta que enviará los correos. Si prefieres SMTP, activa el nodo SMTP y desactiva el de Gmail.
   - Opcional: **Bearer** de WhatsApp Cloud API; reemplaza `TU_PHONE_NUMBER_ID` en la URL y activa el nodo.
3. Publica el flujo (botón *Publish*; en versiones anteriores, interruptor *Active*). **Copia la URL desde el nodo «Evento de la app» → Production URL**: al importar, n8n puede asignar otra ruta (p. ej. `/webhook/<uuid>`) en vez de `eight-academy-eventos`.
4. En la app define `N8N_OUTBOUND_WEBHOOK_URL` con esa URL y, en producción, `APP_URL` con la URL pública (para el enlace del correo; sin ella se usa el origen de la petición).

Nota n8n Cloud: los nodos no pueden leer variables de entorno (`$env`), por eso la app envía el enlace completo en `statusUrl`.

**Seguridad:**
- El código nunca se muestra en pantalla al pedir el reenvío: solo lo recibe quien controla el correo registrado.
- `/api/applications/recover` responde siempre el mismo mensaje, exista o no la cédula, así que no revela si una familia postuló.
- Límites de reenvío:
  - Por IP: 5 pedidos cada 10 minutos.
  - Por cédula: 3 reenvíos por hora. Si se supera, responde igual pero no envía nada, para que nadie use el formulario para llenar de correos a una familia.
- La bitácora guarda el envío con el correo enmascarado (`t***@ejemplo.com`), nunca el correo completo.

**Límites y comportamiento ante fallos:**
- **Sin `N8N_OUTBOUND_WEBHOOK_URL`:** no se envía nada. La confirmación lo indica y la bitácora registra `delivery: sin_n8n (no enviado)`. Para la demo, el código sigue visible en la pantalla de confirmación.
- **n8n caído o lento:** la app espera como máximo 5 s, registra el error en consola y **la solicitud se guarda igual**. El envío es de mejor esfuerzo y no hay cola de reintentos en la app.
- **SMTP falla:** n8n reintenta 3 veces cada 5 s. Si sigue fallando, la ejecución queda como fallida en n8n y la familia puede usar «¿Olvidaste tu código?».
- **WhatsApp:** necesita una cuenta aprobada de WhatsApp Business. Por eso el nodo viene desactivado. Los números de Ecuador `09…` se convierten a `5939…`.
- **Probado:** el payload real que emite la app se pasó por el nodo «Armar mensaje», incluida la prueba de escape de HTML. Falta probar la importación en una instancia de n8n.
