# Docker Compose Usage Guide

## Environment Files

This project uses environment files for different deployment scenarios:

### `.env.local` - For Local Development with pnpm
Use when running services with `pnpm dev`:
- Database URLs use `localhost` with external ports (18xxx)
- Service URLs use `localhost`
- Copy to `.env` before running: `cp .env.local .env`

### `.env.docker-compose` - For Docker Compose
Use when running with docker-compose:
- Database URLs use container names with internal ports
- Service URLs use service names (e.g., `http://auth-service:4003`)
- Copy to `.env` before running: `cp .env.docker-compose .env`

### `.env.containers` - For Individual Docker Containers
Use when running each service in separate Docker containers:
- Database URLs use `host.docker.internal` with external ports
- Service URLs use `host.docker.internal`
- Copy to `.env` before running: `cp .env.containers .env`

## Running with Docker Compose

### Start All Services
```bash
# 1. Copy docker-compose environment
cp .env.docker-compose .env

# 2. Start all services
docker compose up -d
```

### View Logs
```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f gateway-service
docker compose logs -f auth-service
```

### Stop All Services
```bash
docker compose down
```

### Stop and Remove Volumes (Clean Start)
```bash
docker compose down -v
```

### Rebuild Services After Code Changes
```bash
docker compose up -d --build
```

### Check Service Status
```bash
docker compose ps
```

## Key Differences

| Aspect | .env.local | .env.docker-compose | .env.containers |
|--------|------------|---------------------|-----------------|
| **NODE_ENV** | development | development | production |
| **Database Host** | localhost:18006 | chatapp-auth-db:3306 | host.docker.internal:18006 |
| **Service URLs** | localhost:18xxx | service-name:4xxx | host.docker.internal:18xxx |
| **Service Ports** | 18xxx (external) | 4xxx (internal) | 4xxx (internal) |
| **Use Case** | pnpm dev | docker compose | individual containers |

## Access Points

When running with docker-compose, access services at:
- **API Gateway**: http://localhost:18100
- **RabbitMQ Management**: http://localhost:18002 (guest/guest)
- **Direct Service Access** (for debugging):
  - Auth: http://localhost:18103
  - User: http://localhost:18101
  - Chat: http://localhost:18102

## How Docker Compose Networking Works

Docker Compose creates an internal bridge network where:
- Services communicate using **service names** (e.g., `auth-service`, `user-service`)
- Internal ports are used (4000, 4001, 4002, 4003)
- External access uses port mappings (18100:4000, 18101:4001, etc.)
- No `localhost` or `host.docker.internal` needed

## Troubleshooting

### Services can't connect to databases
- Verify you copied `.env.docker-compose` to `.env`
- Check: `docker compose config` to verify configuration
- Ensure container names match in environment variables

### Port conflicts
- Check if ports 18xxx are already in use
- Stop conflicting services or change ports in `.env.docker-compose`

### Services not starting
- Check logs: `docker compose logs <service-name>`
- Verify health checks: `docker compose ps`
- Services may retry RabbitMQ connection a few times before becoming healthy
