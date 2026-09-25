#!/bin/sh
set -eu

: "${DB_HOST:?DB_HOST is required}"
: "${DB_PASS:?DB_PASS is required}"
: "${JWT_SECRET:?JWT_SECRET is required}"
: "${JWT_REFRESH_SECRET:?JWT_REFRESH_SECRET is required}"
: "${REDIS_PASSWORD:?REDIS_PASSWORD is required}"
: "${REDIS_SECRET_KEY:?REDIS_SECRET_KEY is required}"

export REDIS_URI="redis://:${REDIS_PASSWORD}@${REDIS_HOST:-gads-redis}:${REDIS_PORT:-6379}/0"
export REDIS_URI_ACK="redis://:${REDIS_PASSWORD}@${REDIS_HOST:-gads-redis}:${REDIS_PORT:-6379}/1"
export REDIS_URI_MSG_CONN="$REDIS_URI_ACK"

exec "$@"
