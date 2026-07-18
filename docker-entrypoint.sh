#!/bin/sh

echo "Running Prisma..."

npx prisma db push --accept-data-loss

echo "Starting Server..."

exec node server.js