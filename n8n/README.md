# n8n · Contratos de integración

La app y n8n se comunican por webhooks JSON. Los flujos exportados irán en `n8n/workflows/`.

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
{ "event": "application.created | application.status_changed | payment.received", "occurredAt": "ISO-8601", "data": { } }
```

## Flujos previstos

1. **Admisión:** al cambiar el estado, la IA redacta el aviso y n8n lo envía a la familia.
2. **Recordatorios de pago (diario):** cuotas que vencen en 3 días o ya vencidas → la IA redacta → email/WhatsApp → `reminder.sent` de vuelta a la app.
3. **Resumen del auditor (semanal):** llama a `/api/admin/auditor` (requerirá un token de servicio cuando exista Supabase Auth).
