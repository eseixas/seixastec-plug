#!/bin/sh
set -eu

# Dump comprimido do banco, cópia local e upload para a nuvem via rclone.
STAMP=$(date +%Y%m%d-%H%M%S)
FILE="/backups/cpvarejo-${STAMP}.sql.gz"

echo "[$(date)] Iniciando backup -> ${FILE}"
pg_dump | gzip > "${FILE}"
echo "[$(date)] Dump local gerado."

# Envia para a nuvem se houver um rclone.conf válido com o remote configurado.
if rclone --config /config/rclone/rclone.conf listremotes 2>/dev/null | grep -q .; then
  rclone --config /config/rclone/rclone.conf copy "${FILE}" "${RCLONE_REMOTE}" && \
    echo "[$(date)] Dump enviado para ${RCLONE_REMOTE}."
  # Sincroniza as imagens dos produtos (se o volume estiver montado).
  if [ -d /uploads ]; then
    rclone --config /config/rclone/rclone.conf sync /uploads "${RCLONE_REMOTE}/uploads" && \
      echo "[$(date)] Imagens sincronizadas."
  fi
else
  echo "[$(date)] rclone não configurado; mantendo apenas cópia local."
fi

# Retenção: remove dumps locais mais antigos que BACKUP_RETENTION_DAYS.
find /backups -name 'cpvarejo-*.sql.gz' -type f -mtime "+${BACKUP_RETENTION_DAYS:-14}" -delete || true
echo "[$(date)] Backup finalizado."
