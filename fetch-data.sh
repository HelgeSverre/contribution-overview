#!/bin/sh
set -eu

exec bun scripts/fetch-data.ts "$@"
