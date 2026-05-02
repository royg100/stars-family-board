#!/usr/bin/env bash
set -e
cd "$(dirname "$0")/backend"
exec python -m app.main
