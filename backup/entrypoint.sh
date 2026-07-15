#!/bin/sh
set -eu

# Registra o job de cron a partir da env BACKUP_CRON e mantém o container vivo.
CRON_EXPR="${BACKUP_CRON:-0 3 * * *}"

# Exporta as variáveis de ambiente para o cron enxergar (PGHOST, PGPASSWORD, etc).
printenv | grep -E '^(PG|RCLONE_REMOTE|BACKUP_RETENTION_DAYS)' | sed 's/^/export /' > /etc/backup.env

echo "${CRON_EXPR} . /etc/backup.env; /usr/local/bin/backup.sh >> /backups/backup.log 2>&1" > /etc/crontabs/root

echo "[$(date)] Backup agendado: ${CRON_EXPR}"
echo "[$(date)] Para backup imediato: docker exec cp_varejo_backup /usr/local/bin/backup.sh"

exec crond -f -l 8
