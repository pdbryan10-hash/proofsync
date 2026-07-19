# Single-node MongoDB replica set for the in-VPC demo.
#
# Prisma's MongoDB connector requires a replica set. A single-node RS satisfies
# that and keeps the whole demo self-contained (no external Atlas). Data persists
# on the mounted EFS volume at /data/db.
FROM mongo:7

COPY entrypoint.sh /usr/local/bin/rs-entrypoint.sh
RUN chmod +x /usr/local/bin/rs-entrypoint.sh

ENTRYPOINT ["/usr/local/bin/rs-entrypoint.sh"]
