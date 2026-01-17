# Port Configuration Guide

## Overview
This document outlines the custom port configuration for the microservices chat application to avoid conflicts with existing applications and prepare for future scaling.

## Port Range Strategy
- **Selected Range**: 18000-18999 (1000 ports available)
- **Reasoning**: High enough to avoid system ports, rarely used by common applications
- **Scalability**: Large range allows for multiple instances and additional services

## Port Allocation

### Infrastructure Services (18000-18099)
| Service | Original Port | New Port | Purpose |
|---------|---------------|----------|---------|
| RabbitMQ AMQP | 5672 | 18001 | Message broker communication |
| RabbitMQ Management | 15672 | 18002 | Web management interface |
| Redis | 6379 | 18003 | Caching service |
| MongoDB | 27018 | 18004 | Chat service database |
| PostgreSQL | 5433 | 18005 | User service database |
| MySQL | 3307 | 18006 | Auth service database |

### Application Services (18100-18199)
| Service | Original Port | New Port | Purpose |
|---------|---------------|----------|---------|
| Gateway Service | 4000 | 18100 | API Gateway (main entry point) |
| User Service | 4001 | 18101 | User profile management |
| Chat Service | 4002 | 18102 | Messaging and conversations |
| Auth Service | 4003 | 18103 | Authentication and authorization |

### Reserved for Future Scaling (18200-18999)
- Load balancers
- Additional service instances
- Monitoring tools (Prometheus, Grafana)
- Development/testing environments
- Service mesh components

## Access URLs

### Infrastructure Services
- **RabbitMQ Management UI**: http://localhost:18002 (guest/guest)
- **Redis**: localhost:18003
- **MongoDB**: localhost:18004
- **PostgreSQL**: localhost:18005
- **MySQL**: localhost:18006

### Application Services
- **API Gateway**: http://localhost:18100 (main entry point)
- **User Service**: http://localhost:18101 (internal)
- **Chat Service**: http://localhost:18102 (internal)
- **Auth Service**: http://localhost:18103 (internal)

## Database Connection Strings
```bash
# Auth Service (MySQL)
AUTH_DB_URL=mysql://chatapp_auth_user:chatapp_auth_password@localhost:18006/chatapp_auth_service

# User Service (PostgreSQL)
USER_DB_URL=postgres://chatapp_user:chatapp_password@localhost:18005/chatapp_user_service

# Chat Service (MongoDB)
MONGO_URL=mongodb://root:password@localhost:18004/chatapp_chat_service?authSource=admin

# Redis
REDIS_URL=redis://localhost:18003

# RabbitMQ
RABBITMQ_URL=amqp://guest:guest@localhost:18001
```

## Inter-Service Communication URLs

### For Local Development (pnpm dev) and Individual Containers
```bash
USER_SERVICE_URL=http://localhost:18101
AUTH_SERVICE_URL=http://localhost:18103
CHAT_SERVICE_URL=http://localhost:18102
```

### For Docker Compose
```bash
USER_SERVICE_URL=http://user-service:4001
AUTH_SERVICE_URL=http://auth-service:4003
CHAT_SERVICE_URL=http://chat-service:4002
```

**Note:** Docker Compose uses service names and internal ports for inter-service communication.

## Files Modified
1. **`.env`** - Updated all port configurations
2. **`docker-compose.yml`** - Updated port mappings for all services

## Testing Checklist
- [ ] Infrastructure services start without port conflicts
- [ ] Each microservice connects to its database
- [ ] RabbitMQ message broker is accessible
- [ ] Redis caching is working
- [ ] Inter-service communication works
- [ ] API Gateway routes requests correctly

## Troubleshooting
If you encounter port conflicts:
1. Check what's running on the conflicting port: `netstat -ano | findstr :PORT_NUMBER`
2. Either stop the conflicting service or choose a different port
3. Update both `.env` and `docker-compose.yml` files
4. Restart the affected services

## Future Scaling Considerations
When scaling horizontally:
- Use ports 18200+ for additional instances
- Consider using Docker Swarm or Kubernetes for orchestration
- Implement load balancers on ports 18200-18299
- Reserve 18300+ for monitoring and observability tools