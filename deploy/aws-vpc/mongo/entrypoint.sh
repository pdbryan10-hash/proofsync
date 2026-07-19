#!/bin/bash
# Start mongod as a single-node replica set and initiate it once. The replica-set
# member is advertised under its Cloud Map DNS name so the app resolves it.
set -euo pipefail

RS_NAME="${RS_NAME:-rs0}"
ADVERTISED_HOST="${MONGO_ADVERTISED_HOST:-mongo.proofsync.local}"

mongod --replSet "${RS_NAME}" --bind_ip_all --dbpath /data/db &
MONGOD_PID=$!

echo "[rs-init] waiting for mongod to accept connections..."
until mongosh --quiet --eval 'db.runCommand({ ping: 1 })' >/dev/null 2>&1; do
  sleep 1
done

# Initiate only if this node isn't already in a replica set.
if ! mongosh --quiet --eval 'rs.status().ok' >/dev/null 2>&1; then
  echo "[rs-init] initiating replica set ${RS_NAME} with host ${ADVERTISED_HOST}:27017"
  mongosh --quiet --eval "rs.initiate({_id: '${RS_NAME}', members: [{ _id: 0, host: '${ADVERTISED_HOST}:27017' }]})"
else
  echo "[rs-init] replica set already initiated"
fi

wait "${MONGOD_PID}"
