FROM alpine:3.20

# postgresql-client para pg_dump, rclone para upload em nuvem, tzdata p/ cron correto.
RUN apk add --no-cache postgresql16-client rclone tzdata

COPY backup.sh /usr/local/bin/backup.sh
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/backup.sh /usr/local/bin/entrypoint.sh

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
