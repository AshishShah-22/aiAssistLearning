#!/bin/sh
echo "=== Running prisma db push ==="
npx prisma db push --accept-data-loss --schema ./prisma/schema.prisma 2>&1 || echo "Prisma had issues, continuing..."
echo "=== Starting server ==="
exec node server.js