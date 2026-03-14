FROM atendai/evolution-api:latest

# Expose the port Evolution API listens on
EXPOSE 8080

# All configuration is injected via Railway environment variables.
# Set these in the Railway dashboard → Service → Variables:
#
#   DATABASE_URL              → auto-filled by Railway Postgres plugin
#   AUTHENTICATION_API_KEY    → your secret key (same as EVOLUTION_API_KEY in Vercel)
#   WEBHOOK_GLOBAL_URL        → set AFTER first deploy, e.g.:
#                               https://<your-vercel-domain>/api/webhooks/evolution
#   CONFIG_SESSION_PHONE_CLIENT → gestionale-ribelle
#   STORE_MESSAGES            → false
#   STORE_MESSAGE_UP          → false
#   STORE_CONTACTS            → false
#   DEL_INSTANCE              → false
#   PORT                      → 8080

CMD ["node", "dist/main.js"]
