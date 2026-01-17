# Real-World Kubernetes Deployment Setup Guide

## Prerequisites Installation

### 1. Install k3d (Lightweight Kubernetes)

**Option A: Using PowerShell (Recommended)**
```powershell
# Download k3d for Windows
Invoke-WebRequest -Uri "https://github.com/k3d-io/k3d/releases/download/v5.6.0/k3d-windows-amd64.exe" -OutFile "k3d.exe"

# Move to a directory in PATH
Move-Item k3d.exe C:\Windows\System32\k3d.exe

# Verify installation
k3d version
```

**Option B: Manual Download**
1. Go to: https://github.com/k3d-io/k3d/releases/latest
2. Download `k3d-windows-amd64.exe`
3. Rename to `k3d.exe`
4. Move to `C:\Windows\System32\`

### 2. Install kubectl (Kubernetes CLI)

```powershell
# Download kubectl
Invoke-WebRequest -Uri "https://dl.k8s.io/release/v1.28.0/bin/windows/amd64/kubectl.exe" -OutFile "kubectl.exe"

# Move to PATH
Move-Item kubectl.exe C:\Windows\System32\kubectl.exe

# Verify installation
kubectl version --client
```

### 3. Verify Docker is Running

```powershell
docker version
docker ps
```

## Phase 1: Create K3d Cluster

### Create Development Cluster

```powershell
# Create k3d cluster with 1 control-plane + 2 worker nodes
# Port 8888 for Ingress access (HTTP)
# Traefik disabled to use NGINX Ingress instead
k3d cluster create chatapp-dev `
  --servers 1 `
  --agents 2 `
  --port "8888:80@loadbalancer" `
  --api-port 6550 `
  --k3s-arg "--disable=traefik@server:0"

# Verify cluster
kubectl cluster-info
kubectl get nodes
```

**Expected Output:**
```
NAME                       STATUS   ROLES                  AGE   VERSION
k3d-chatapp-dev-agent-0    Ready    <none>                 1m    v1.27.x
k3d-chatapp-dev-agent-1    Ready    <none>                 1m    v1.27.x
k3d-chatapp-dev-server-0   Ready    control-plane,master   1m    v1.27.x
```

### Create Namespaces

```powershell
# Create environment namespaces
kubectl create namespace dev
kubectl create namespace staging
kubectl create namespace prod

# Verify
kubectl get namespaces
```

## Phase 2: Deploy External Infrastructure

### Deploy DEV Infrastructure (Ports 18xxx - Safe Range)

**Note:** Using 18xxx port range to avoid conflicts with existing services on your laptop.

```powershell
# Create external network for infrastructure
docker network create microservices-external

# MySQL (Auth Service DB) - Port 18006
docker run -d --name k8s-dev-mysql `
  --network microservices-external `
  -p 18006:3306 `
  -e MYSQL_ROOT_PASSWORD=root_password `
  -e MYSQL_DATABASE=chatapp_auth_service `
  -e MYSQL_USER=chatapp_auth_user `
  -e MYSQL_PASSWORD=chatapp_auth_password `
  mysql:8.0

# PostgreSQL (User Service DB) - Port 18005
docker run -d --name k8s-dev-postgres `
  --network microservices-external `
  -p 18005:5432 `
  -e POSTGRES_DB=chatapp_user_service `
  -e POSTGRES_USER=chatapp_user `
  -e POSTGRES_PASSWORD=chatapp_password `
  postgres:16

# MongoDB (Chat Service DB) - Port 18004
docker run -d --name k8s-dev-mongo `
  --network microservices-external `
  -p 18004:27017 `
  -e MONGO_INITDB_ROOT_USERNAME=root `
  -e MONGO_INITDB_ROOT_PASSWORD=password `
  mongo:7

# Redis (Caching) - Port 18003
docker run -d --name k8s-dev-redis `
  --network microservices-external `
  -p 18003:6379 `
  redis:7

# RabbitMQ (Message Broker) - Ports 18001, 18002
docker run -d --name k8s-dev-rabbitmq `
  --network microservices-external `
  -p 18001:5672 `
  -p 18002:15672 `
  -e RABBITMQ_DEFAULT_USER=guest `
  -e RABBITMQ_DEFAULT_PASS=guest `
  rabbitmq:3-management

# IMPORTANT: Connect infrastructure containers to k3d network
# This allows K8s pods to reach infrastructure using the k3d gateway IP
docker network connect k3d-chatapp-dev k8s-dev-mysql
docker network connect k3d-chatapp-dev k8s-dev-postgres
docker network connect k3d-chatapp-dev k8s-dev-mongo
docker network connect k3d-chatapp-dev k8s-dev-redis
docker network connect k3d-chatapp-dev k8s-dev-rabbitmq
```

**Port Summary for DEV:**
- MySQL: 18001
- PostgreSQL: 18002
- MongoDB: 18003
- Redis: 18004
- RabbitMQ AMQP: 18005
- RabbitMQ Management UI: 18006
- Gateway (via Ingress): 8888 (http://api.local:8888)

### Verify Infrastructure

```powershell
# Check all containers are running
docker ps --filter name=k8s-dev- --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# Test connections
docker exec k8s-dev-mysql mysql -uroot -proot_password -e "SELECT 1"
docker exec k8s-dev-postgres psql -U chatapp_user -d chatapp_user_service -c "SELECT 1"
docker exec k8s-dev-mongo mongosh --eval "db.adminCommand('ping')" -u root -p password --authenticationDatabase admin
docker exec k8s-dev-redis redis-cli ping
```

**Expected Output:** All containers running, all tests return success.

## Phase 3: Build and Deploy Services

### Build Docker Images

```powershell
# Build all service images
docker build -t microservices/gateway:dev -f services/gateway-service/Dockerfile .
docker build -t microservices/auth:dev -f services/auth-service/Dockerfile .
docker build -t microservices/user:dev -f services/user-service/Dockerfile .
docker build -t microservices/chat:dev -f services/chat-service/Dockerfile .

# Import images into k3d cluster
k3d image import microservices/gateway:dev microservices/auth:dev microservices/user:dev microservices/chat:dev -c chatapp-dev

# Verify images
docker images | findstr microservices
```

### Deploy to Kubernetes

```powershell
# Create dev namespace
kubectl create namespace dev

# Apply ConfigMaps and Secrets
kubectl apply -f k8s/dev/configmap.yaml
kubectl apply -f k8s/dev/secrets.yaml

# Deploy Services
kubectl apply -f k8s/dev/auth-deployment.yaml -f k8s/dev/auth-service.yaml
kubectl apply -f k8s/dev/user-deployment.yaml -f k8s/dev/user-service.yaml
kubectl apply -f k8s/dev/chat-deployment.yaml -f k8s/dev/chat-service.yaml
kubectl apply -f k8s/dev/gateway-deployment.yaml -f k8s/dev/gateway-service.yaml

# Install NGINX Ingress Controller
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.8.1/deploy/static/provider/cloud/deploy.yaml

# Wait for Ingress Controller to be ready
kubectl wait --namespace ingress-nginx --for=condition=ready pod --selector=app.kubernetes.io/component=controller --timeout=120s

# Apply Ingress resource
kubectl apply -f k8s/dev/ingress.yaml

# Watch deployment progress
kubectl get pods -n dev --watch
```

### Verify Deployment

```powershell
# Check pod status (all should be Running)
kubectl get pods -n dev

# Check services
kubectl get svc -n dev

# Check resource usage
kubectl top pods -n dev

# Check logs
kubectl logs -n dev -l app=gateway-service --tail=20
kubectl logs -n dev -l app=auth-service --tail=20
```

**Expected Output:**
```
NAME                              READY   STATUS    RESTARTS   AGE
auth-service-7556dccbf5-h7bbd     1/1     Running   0          2m
user-service-b96b875b4-x7xkh      1/1     Running   0          2m
chat-service-67c795c9b8-6dvk9     1/1     Running   0          2m
gateway-service-5b9d7c6964-m7l5j  1/1     Running   0          2m
```

## Phase 4: Test the Deployment

### Access the Application

Gateway is accessible at `http://api.local:8888` (via NGINX Ingress Controller)

**Note:** Add `127.0.0.1 api.local` to your hosts file (`C:\Windows\System32\drivers\etc\hosts`)

```powershell
# Test health endpoint
Invoke-RestMethod -Uri http://api.local:8888/health

# Test registration
Invoke-RestMethod -Uri http://api.local:8888/auth/register -Method POST -Headers @{"Content-Type"="application/json"} -Body '{"email":"k8s@test.com","password":"Password123!","displayName":"K8s User"}'

# Test login
$response = Invoke-RestMethod -Uri http://api.local:8888/auth/login -Method POST -Headers @{"Content-Type"="application/json"} -Body '{"email":"k8s@test.com","password":"Password123!"}'
$token = $response.accessToken

# Test user search
Invoke-RestMethod -Uri "http://api.local:8888/users/search?query=k8s" -Method GET -Headers @{"Authorization"="Bearer $token"}
```

**Expected Output:** All endpoints return successful responses with proper JSON data.

## Troubleshooting

### Check Pod Logs
```powershell
kubectl logs -n dev <pod-name>
kubectl logs -n dev <pod-name> --previous  # Previous container logs
```

### Describe Pod
```powershell
kubectl describe pod -n dev <pod-name>
```

### Check Events
```powershell
kubectl get events -n dev --sort-by='.lastTimestamp'
```

### Restart Deployment
```powershell
kubectl rollout restart deployment/<deployment-name> -n dev
```

### Delete and Recreate
```powershell
kubectl delete -f k8s/dev/
kubectl apply -f k8s/dev/
```

## Cleanup

### Stop and Remove Everything

```powershell
# Delete Kubernetes resources
kubectl delete namespace dev

# Delete k3d cluster
k3d cluster delete chatapp-dev

# Stop and remove infrastructure containers
docker stop k8s-dev-mysql k8s-dev-postgres k8s-dev-mongo k8s-dev-redis k8s-dev-rabbitmq
docker rm k8s-dev-mysql k8s-dev-postgres k8s-dev-mongo k8s-dev-redis k8s-dev-rabbitmq

# Remove networks
docker network rm microservices-external
```

## Architecture Summary

**What We Built:**
- **3-node Kubernetes cluster** (k3d) simulating AWS EKS
- **5 infrastructure services** as Docker containers simulating AWS managed services
- **4 microservices** deployed in Kubernetes with proper networking
- **Production-grade patterns**: ConfigMaps, Secrets, health probes, resource limits, NodePort service

**Networking:**
- Infrastructure containers connected to k3d network via gateway IP (172.19.0.1)
- K8s pods communicate via ClusterIP services (auth-service, user-service, chat-service)
- External access via NGINX Ingress (api.local:8888 → Gateway → Services)
- Database URLs use k3d gateway IP + exposed ports (18001-18006)
- Ingress routes all traffic through gateway (API Gateway pattern)

**Key Learnings:**
- Traefik (k3s default) must be disabled to use NGINX Ingress
- Infrastructure containers need network connectivity to k3d cluster
- K8s services provide DNS resolution for pod-to-pod communication
- Ingress provides single entry point with path-based routing
- API Gateway pattern: Ingress → Gateway → Backend Services

## Next Steps

1. Set up CI/CD pipeline
2. Implement GitOps workflow
3. Add monitoring (Prometheus/Grafana)
4. Set up logging (ELK/Loki)
5. Deploy to staging and prod environments
