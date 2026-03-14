# Deploy Evolution API su Railway

## Panoramica

Evolution API viene ospitata su Railway (piano Hobby ~$5/mese).
Ogni salone usa un'istanza separata identificata dal proprio `user_id`.

---

## 1. Crea account Railway

1. Vai su [https://railway.app](https://railway.app) e registrati (puoi usare GitHub).
2. Verifica l'email se richiesto.

---

## 2. Crea un nuovo progetto

1. Dashboard Railway → **New Project**.
2. Seleziona **Deploy from GitHub repo** se hai il repo collegato,
   oppure **Empty Project** per deploy manuale.

---

## 3. Aggiungi PostgreSQL come plugin

1. Nel progetto, clicca **+ New** → **Database** → **Add PostgreSQL**.
2. Railway crea automaticamente la variabile `DATABASE_URL` raggiungibile
   dai servizi dello stesso progetto.

---

## 4. Configura il servizio Evolution API

1. Clicca **+ New** → **GitHub Repo** (o **Empty Service** per deploy tramite CLI).
2. Seleziona questo repository come sorgente.
3. Railway rileverà `railway/Dockerfile` automaticamente.
   Se non lo fa, vai in **Settings → Build** e imposta:
   - Builder: **Dockerfile**
   - Dockerfile path: `railway/Dockerfile`

---

## 5. Imposta le variabili d'ambiente

Nel servizio Evolution API → tab **Variables**, aggiungi:

| Variabile                    | Valore                                                              |
| ---------------------------- | -------------------------------------------------------------------- |
| `DATABASE_URL`               | `${{Postgres.DATABASE_URL}}` (reference automatica di Railway)      |
| `AUTHENTICATION_API_KEY`     | Una stringa segreta a tua scelta (es. `mySecretKey123!`)             |
| `WEBHOOK_GLOBAL_URL`         | Lascia vuoto per ora — aggiornalo dopo il deploy (vedi punto 7b)    |
| `CONFIG_SESSION_PHONE_CLIENT`| `gestionale-ribelle`                                                 |
| `STORE_MESSAGES`             | `false`                                                              |
| `STORE_MESSAGE_UP`           | `false`                                                              |
| `STORE_CONTACTS`             | `false`                                                              |
| `DEL_INSTANCE`               | `false`                                                              |
| `PORT`                       | `8080`                                                               |

> **Nota**: `AUTHENTICATION_API_KEY` deve essere identica alla variabile
> `EVOLUTION_API_KEY` nel file `.env.local` / Vercel del gestionale.

---

## 6. Deploy

1. Fai push del codice o clicca **Deploy** manualmente.
2. Aspetta che il build finisca (~2-3 minuti).
3. Railway assegna automaticamente un URL pubblico tipo:
   `https://evolution-api-production-xxxx.up.railway.app`

---

## 7. Copia l'URL pubblico e chiudi il loop

### 7a — Configura il gestionale (Vercel)

1. Vai su Vercel → progetto → **Settings → Environment Variables**.
2. Aggiungi (o aggiorna) queste variabili:

| Variabile              | Valore                                                            |
| ---------------------- | ----------------------------------------------------------------- |
| `EVOLUTION_API_URL`    | `https://evolution-api-production-xxxx.up.railway.app`           |
| `EVOLUTION_API_KEY`    | la stessa chiave impostata su Railway come `AUTHENTICATION_API_KEY` |
| `EVOLUTION_WEBHOOK_SECRET` | una stringa segreta a tua scelta                              |

3. Fai **Redeploy** su Vercel per rendere attive le variabili.

### 7b — Aggiorna `WEBHOOK_GLOBAL_URL` su Railway

Ora che hai l'URL di Vercel, torna su Railway → servizio Evolution API →
**Variables** e imposta:

```
WEBHOOK_GLOBAL_URL = https://<il-tuo-dominio-vercel>/api/webhooks/evolution
```

Salva — Railway fa il redeploy automatico.

> **Sequenza di bootstrap riassunta**
> 1. Deploy Railway → ottieni URL Railway
> 2. Imposta `EVOLUTION_API_URL` su Vercel → redeploy Vercel
> 3. Imposta `WEBHOOK_GLOBAL_URL` su Railway con l'URL Vercel → redeploy Railway

---

## 8. Verifica

Apri nel browser:
```
https://<tuo-url-railway>/
```
Dovresti vedere la risposta JSON di Evolution API con la versione installata.

---

## Limiti piano Hobby Railway

- RAM: **512 MB** (sufficiente per Evolution API + PostgreSQL)
- CPU: condivisa
- Sleep: il servizio può andare in sleep dopo inattività — considera il piano Pro
  ($20/mese) se noti ritardi nel primo messaggio del giorno.

---

## Troubleshooting

| Problema                     | Soluzione                                                          |
| ---------------------------- | ------------------------------------------------------------------ |
| Build fallisce               | Verifica che `railway/Dockerfile` esista nel repo                  |
| `401 Unauthorized`           | `AUTHENTICATION_API_KEY` non corrisponde a `EVOLUTION_API_KEY`     |
| QR code non appare           | Controlla i log Railway per errori DB                              |
| Webhook non ricevuto         | Verifica che `WEBHOOK_GLOBAL_URL` punti al dominio Vercel corretto |
