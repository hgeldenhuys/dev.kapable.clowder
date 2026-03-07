#!/bin/bash
set -e
cd /app

# Source .env explicitly
if [ -f .env ]; then
  set -a
  source .env
  set +a
  echo "Loaded .env (PORT=$PORT)"
fi

# Log startup attempt
echo "Starting Clowder server at $(date)" | tee /tmp/clowder-start.log
echo "PORT=$PORT CWD=$(pwd)" | tee -a /tmp/clowder-start.log
echo "Bun version: $(bun --version 2>&1)" | tee -a /tmp/clowder-start.log
echo "Build dir:" | tee -a /tmp/clowder-start.log
ls -la build/server/ 2>&1 | tee -a /tmp/clowder-start.log

# Start with error capture
exec bun run server.ts 2>&1 | tee -a /tmp/clowder-start.log
