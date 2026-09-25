#!/bin/sh
set -eu

: "${DB_HOST:?DB_HOST is required}"
: "${DB_PASS:?DB_PASS is required}"
: "${REDIS_PASSWORD:?REDIS_PASSWORD is required}"
: "${JWT_SECRET:?JWT_SECRET is required}"

export DATABASE_LINK="postgresql://${DB_USER}:${DB_PASS}@${DB_HOST}:${DB_PORT:-5432}/${DB_NAME}?schema=public"
export REDIS_URI="redis://:${REDIS_PASSWORD}@${REDIS_HOST:-gads-redis}:${REDIS_PORT:-6379}/2"

exec "$@"
