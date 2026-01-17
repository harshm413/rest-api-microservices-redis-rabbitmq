# Environment Configuration Guide

This project uses multiple environment files for different scenarios. **The active configuration is always in `.env` file.**

## Available Environment Files

### `.env.local`
**Use Case:** Local development with `pnpm dev`
- Services run directly on your machine (not in Docker)
- Databases run in Docker containers
- Uses `localhost` for all database connections
- Ports: 18xxx range (external ports)

**When to use:**
```bash
# Copy .env.local to .env
cp .env.local .env

# Start infrastructure only
docker compose up -d rabbitmq redis mongo user-db auth-db

# Run services with pnpm
pnpm dev
```

### `.env.docker-compose`
**Use Case:** Full Docker Compose deployment
- All services run in Docker containers
- Uses container names for database connections (e.g., `chatapp-auth-db:3306`)
- Uses service names for inter-service communication (e.g., `http://auth-service:4003`)
- Internal ports: 4000, 4001, 4002, 4003
- NODE_ENV: development

**When to use:**
```bash
# Copy .env.docker-compose to .env
cp .env.docker-compose .env

# Start all services
docker compose up -d
```

### `.env.containers`
**Use Case:** Running individual Docker containers (not docker-compose)
- Each service runs in a separate Docker container
- Uses `host.docker.internal` to reach host services
- Internal ports: 4000, 4001, 4002, 4003
- NODE_ENV: production

**When to use:**
```bash
# Copy .env.containers to .env
cp .env.containers .env

# Run individual containers with --env-file .env
docker run -d --name gateway-service -p 18100:4000 --env-file .env gateway-service:latest
```

### `.env.production`
**Use Case:** Production deployment
- For deploying to cloud/production servers
- Contains production-specific configurations

### `.env.example`
**Use Case:** Template for new developers
- Shows all required environment variables
- No sensitive values
- Copy this to create your own `.env` file

## Quick Start

### For Local Development (pnpm dev)
```bash
# 1. Copy local environment
cp .env.local .env

# 2. Start infrastructure
docker compose up -d rabbitmq redis mongo user-db auth-db

# 3. Run services
pnpm dev
```

### For Docker Compose
```bash
# 1. Copy docker-compose environment
cp .env.docker-compose .env

# 2. Start all services
docker compose up -d
```

### For Individual Docker Containers
```bash
# 1. Copy containers environment
cp .env.containers .env

# 2. Build images
docker build -t gateway-service -f services/gateway-service/Dockerfile .

# 3. Run containers
docker run -d --name gateway-service -p 18100:4000 --env-file .env gateway-service:latest
```

## Important Notes

1. **Never commit `.env` file** - It's in .gitignore
2. **Always copy from scenario-specific files** - Don't manually edit `.env`
3. **To switch scenarios** - Copy the appropriate `.env.{scenario}` to `.env`
4. **Docker Compose reads `.env` automatically** - No need to specify `--env-file`

## Port Configuration

All ports are in the 18xxx range to avoid conflicts:

**Infrastructure:**
- RabbitMQ: 18001 (AMQP), 18002 (Management UI)
- Redis: 18003
- MongoDB: 18004
- PostgreSQL (User DB): 18005
- MySQL (Auth DB): 18006

**Services (External Access):**
- Gateway: 18100
- User Service: 18101
- Chat Service: 18102
- Auth Service: 18103

**Services (Internal - Docker only):**
- Gateway: 4000
- User Service: 4001
- Chat Service: 4002
- Auth Service: 4003

See `PORT-CONFIGURATION.md` for detailed port information.
