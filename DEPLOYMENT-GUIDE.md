# 🚀 Real-World Kubernetes Deployment Guide

## Microservices Production Deployment Simulation with K3d

This guide documents our complete journey to simulate real-world enterprise Kubernetes deployment locally using K3d, following industry best practices.

---

## 🎯 **Project Overview**

**Goal:** Deploy REST API Microservices application using real-world enterprise patterns:

- **Stateless services** in Kubernetes (like AWS EKS)
- **Stateful services** as external managed services (like AWS RDS, ElastiCache)
- **Multi-environment setup** (Dev, Staging, Production)
- **Rolling updates** and zero-downtime deployments
- **Real-world networking** and service discovery

---

## 📋 **Phase 1: Infrastructure Setup**

### **Step 1: Install K3d & kubectl**

```bash
# Install K3d (Lightweight Kubernetes)
curl -s https://raw.githubusercontent.com/k3d-io/k3d/main/install.sh | bash

# Install kubectl
curl -LO "https://dl.k8s.io/release/v1.28.0/bin/windows/amd64/kubectl.exe"
move kubectl.exe C:\Windows\System32\

# Verify installations
k3d version
kubectl version --client
```

### **Step 2: Create K3d Cluster (3-Node Setup)**

```bash
# Create cluster with 1 control-plane + 2 workers (simulating real EKS)
# Traefik disabled to use NGINX Ingress instead
k3d cluster create chatapp-dev --servers 1 --agents 2 --port "8888:80@loadbalancer" --api-port 6550 --k3s-arg "--disable=traefik@server:0"
```

**✅ Verification:**

```bash
# Check cluster nodes
kubectl get nodes

# Expected output:
NAME                   STATUS   ROLES                  AGE   VERSION
k3d-chatapp-agent-0    Ready    <none>                 40s   v1.31.5+k3s1
k3d-chatapp-agent-1    Ready    <none>                 39s   v1.31.5+k3s1
k3d-chatapp-server-0   Ready    control-plane,master   46s   v1.31.5+k3s1

# Check cluster info
kubectl cluster-info

# Expected output:
Kubernetes control plane is running at https://host.docker.internal:6776
CoreDNS is running at https://host.docker.internal:6776/api/v1/namespaces/kube-system/services/kube-dns:dns/proxy
Metrics-server is running at https://host.docker.internal:6776/api/v1/namespaces/kube-system/services/https:metrics-server:https/proxy
```

### **Step 3: Create Environment Namespaces**

```bash
# Create environment namespaces (simulating AWS accounts)
kubectl create namespace dev
kubectl create namespace staging
kubectl create namespace prod

# Verify namespaces
kubectl get namespaces
```

**✅ Verification:**

```bash
# Check namespaces
kubectl get namespaces

# Expected output:
NAME              STATUS   AGE
default           Active   3m50s
dev               Active   22s
kube-node-lease   Active   3m50s
kube-public       Active   3m50s
kube-system       Active   3m50s
prod              Active   12s
staging           Active   16s
```

---

## 🗄️ **Phase 2: External Services Setup (Simulating AWS Managed Services)**

### **Architecture Decision:**

- **Kubernetes:** Only for stateless microservices
- **Docker:** For stateful services (simulating AWS RDS, ElastiCache, Amazon MQ)

### **Step 4: Setup External Services for All Environments**

```bash
# Create external services network
docker network create microservices-external

# DEV Environment Services (ports 33xx)
docker run -d --name dev-mysql --network microservices-external -p 3301:3306 \
  -e MYSQL_ROOT_PASSWORD=dev_pass -e MYSQL_DATABASE=auth_service \
  -e MYSQL_USER=auth_user -e MYSQL_PASSWORD=auth_pass mysql:8.0

docker run -d --name dev-postgres --network microservices-external -p 5431:5432 \
  -e POSTGRES_DB=user_service -e POSTGRES_USER=user_user \
  -e POSTGRES_PASSWORD=user_pass postgres:16

docker run -d --name dev-mongo --network microservices-external -p 27016:27017 \
  -e MONGO_INITDB_ROOT_USERNAME=root -e MONGO_INITDB_ROOT_PASSWORD=dev_pass mongo:7

docker run -d --name dev-redis --network microservices-external -p 6378:6379 redis:7

docker run -d --name dev-rabbitmq --network microservices-external \
  -p 5671:5672 -p 15671:15672 rabbitmq:3-management

# STAGING Environment Services (ports 34xx)
docker run -d --name staging-mysql --network microservices-external -p 3302:3306 \
  -e MYSQL_ROOT_PASSWORD=staging_pass -e MYSQL_DATABASE=auth_service \
  -e MYSQL_USER=auth_user -e MYSQL_PASSWORD=auth_pass mysql:8.0

docker run -d --name staging-postgres --network microservices-external -p 5432:5432 \
  -e POSTGRES_DB=user_service -e POSTGRES_USER=user_user \
  -e POSTGRES_PASSWORD=user_pass postgres:16

docker run -d --name staging-mongo --network microservices-external -p 27017:27017 \
  -e MONGO_INITDB_ROOT_USERNAME=root -e MONGO_INITDB_ROOT_PASSWORD=staging_pass mongo:7

docker run -d --name staging-redis --network microservices-external -p 6379:6379 redis:7

docker run -d --name staging-rabbitmq --network microservices-external \
  -p 5672:5672 -p 15672:15672 rabbitmq:3-management

# PROD Environment Services (ports 35xx)
docker run -d --name prod-mysql --network microservices-external -p 3303:3306 \
  -e MYSQL_ROOT_PASSWORD=prod_pass -e MYSQL_DATABASE=auth_service \
  -e MYSQL_USER=auth_user -e MYSQL_PASSWORD=auth_pass mysql:8.0

docker run -d --name prod-postgres --network microservices-external -p 5433:5432 \
  -e POSTGRES_DB=user_service -e POSTGRES_USER=user_user \
  -e POSTGRES_PASSWORD=user_pass postgres:16

docker run -d --name prod-mongo --network microservices-external -p 27018:27017 \
  -e MONGO_INITDB_ROOT_USERNAME=root -e MONGO_INITDB_ROOT_PASSWORD=prod_pass mongo:7

docker run -d --name prod-redis --network microservices-external -p 6380:6379 redis:7

docker run -d --name prod-rabbitmq --network microservices-external \
  -p 5673:5672 -p 15673:15672 rabbitmq:3-management
```

### **Environment Port Mapping:**

| Service     | Dev Port | Staging Port | Prod Port | Simulates          |
| ----------- | -------- | ------------ | --------- | ------------------ |
| MySQL       | 3301     | 3302         | 3303      | AWS RDS MySQL      |
| PostgreSQL  | 5431     | 5432         | 5433      | AWS RDS PostgreSQL |
| MongoDB     | 27016    | 27017        | 27018     | AWS DocumentDB     |
| Redis       | 6378     | 6379         | 6380      | AWS ElastiCache    |
| RabbitMQ    | 5671     | 5672         | 5673      | AWS Amazon MQ      |
| RabbitMQ UI | 15671    | 15672        | 15673     | Management Console |

---

## 🏗️ **Phase 3: Docker Images & Kubernetes Manifests**

### **Step 5: Build Docker Images**

**⚠️ Critical Fix Required:** The Dockerfiles need workspace linking fixes for pnpm monorepos.

```bash
# Build all service images for dev environment
docker build -f services/auth-service/Dockerfile -t microservices/auth:dev .
docker build -f services/user-service/Dockerfile -t microservices/user:dev .
docker build -f services/chat-service/Dockerfile -t microservices/chat:dev .
docker build -f services/gateway-service/Dockerfile -t microservices/gateway:dev .

# Import images into k3d cluster
k3d image import microservices/auth:dev microservices/user:dev microservices/chat:dev microservices/gateway:dev -c chatapp

# Verify images
docker images | grep microservices
```

**✅ Expected Output:**
```bash
microservices/gateway   dev    abc123   2 minutes ago   150MB
microservices/auth      dev    def456   3 minutes ago   145MB
microservices/user      dev    ghi789   4 minutes ago   140MB
microservices/chat      dev    jkl012   5 minutes ago   155MB
```

**🔧 Docker Build Issues & Solutions:**

**Problem 1: pnpm workspace dependencies not found**
```bash
# Error: Cannot find module 'zod' or its corresponding type declarations
```

**Solution:** Copy ALL workspace package.json files before `pnpm install`:
```dockerfile
# ❌ Wrong - Only copying some packages
COPY packages/common/package.json ./packages/common/
COPY services/auth-service/package.json ./services/auth-service/

# ✅ Correct - Copy ALL workspace packages
COPY packages/common/package.json ./packages/common/
COPY services/auth-service/package.json ./services/auth-service/
COPY services/user-service/package.json ./services/user-service/
COPY services/chat-service/package.json ./services/chat-service/
COPY services/gateway-service/package.json ./services/gateway-service/
```

**Problem 2: Workspace linking broken after copying source**
```bash
# Error: Dependencies missing during build
```

**Solution:** Re-run `pnpm install` after copying source code:
```dockerfile
FROM deps AS builder
# Copy source code
COPY packages/common ./packages/common
COPY services/auth-service ./services/auth-service

# ✅ Critical: Reinstall to ensure proper workspace linking
RUN pnpm install --frozen-lockfile

# Now build will work
RUN cd /app && pnpm --filter @rest-api/common build
RUN cd /app && pnpm --filter @rest-api/auth-service build
```

### **Step 6: Create Environment-Specific ConfigMaps**

```bash
# Create k8s directory structure
mkdir -p k8s/dev k8s/staging k8s/prod

# Create ConfigMap YAML files in k8s/dev/, k8s/staging/, k8s/prod/
# See k8s/dev/configmap.yaml for reference
```

### **Step 7: Create Secrets**

```bash
# Create Secrets YAML files in k8s/dev/, k8s/staging/, k8s/prod/
# See k8s/dev/secrets.yaml for reference
# Note: Use k3d gateway IP (172.19.0.1) for database URLs, not host.docker.internal
```

**🔒 Security Note:**
- **ConfigMaps:** Non-sensitive configuration only
- **Secrets:** ALL sensitive data (passwords, tokens, connection URLs)
- **YAML Files:** Version controlled, reviewable, GitOps compatible

### **Step 8: Apply Configuration**

```bash
# Apply dev environment configuration
kubectl apply -f k8s/dev/configmap.yaml
kubectl apply -f k8s/dev/secrets.yaml

# Apply staging environment configuration
kubectl apply -f k8s/staging/configmap.yaml
kubectl apply -f k8s/staging/secrets.yaml

# Apply prod environment configuration
kubectl apply -f k8s/prod/configmap.yaml
kubectl apply -f k8s/prod/secrets.yaml

# Verify configuration
kubectl get configmaps -n dev
kubectl get secrets -n dev
```

### **Step 9: Create Kubernetes Deployment Manifests**

```bash
# Create deployment YAML files in k8s/dev/
# See k8s/dev/auth-deployment.yaml for reference
```

**🏭 Enterprise Patterns Used:**
- **YAML Manifests:** Version controlled, reviewable
- **Resource Limits:** Prevent resource starvation
- **Health Probes:** Automatic restart and traffic routing
- **Labels:** Proper service identification
- **Separate ConfigMaps/Secrets:** Security best practices

---

## 🚀 **Phase 4: Deploy to Dev Environment**

### **Step 10: Apply Configuration & Deploy Services**

```bash
# Apply dev environment configuration
kubectl apply -f k8s/dev/configmap.yaml -f k8s/dev/secrets.yaml

# Deploy all services
kubectl apply -f k8s/dev/auth-deployment.yaml -f k8s/dev/auth-service.yaml
kubectl apply -f k8s/dev/user-deployment.yaml -f k8s/dev/user-service.yaml
kubectl apply -f k8s/dev/chat-deployment.yaml -f k8s/dev/chat-service.yaml
kubectl apply -f k8s/dev/gateway-deployment.yaml -f k8s/dev/gateway-service.yaml

# Install NGINX Ingress Controller
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.8.1/deploy/static/provider/cloud/deploy.yaml

# Wait for Ingress Controller
kubectl wait --namespace ingress-nginx --for=condition=ready pod --selector=app.kubernetes.io/component=controller --timeout=120s

# Apply Ingress resource
kubectl apply -f k8s/dev/ingress.yaml
```

### **⚠️ Critical Kubernetes Deployment Fix**

**Problem:** Deployments using wrong image pattern
```yaml
# ❌ Wrong - Building code inside container (anti-pattern)
containers:
- name: auth-service
  image: node:22-alpine
  command: ["sh", "-c", "npm install -g pnpm && cd /app && pnpm install..."]
```

**Solution:** Use pre-built Docker images
```yaml
# ✅ Correct - Use immutable pre-built images
containers:
- name: auth-service
  image: microservices/auth:dev
  imagePullPolicy: IfNotPresent
  ports:
  - containerPort: 4003
```

### **Step 11: Monitor Deployment Status**

```bash
# Check all pods status
kubectl get pods -n dev

# Check Ingress status
kubectl get ingress -n dev

# Expected healthy state:
# NAME                              READY   STATUS    RESTARTS   AGE
# auth-service-xxx                  1/1     Running   0          2m
# user-service-xxx                  1/1     Running   0          2m
# gateway-service-xxx               1/1     Running   0          2m
# chat-service-xxx                  1/1     Running   0          2m
```

### **🔍 Troubleshooting Common Issues**

**Issue 1: CrashLoopBackOff - Database Connection**
```bash
# Check logs for connection errors
kubectl logs -n dev deploy/auth-service --tail=10

# Common error: ECONNREFUSED to database
# Solution: Ensure external services are running
docker ps --filter name=dev-mysql --filter name=dev-postgres
```

**Issue 2: MongoDB Authentication Failed**
```bash
# Error in logs: "Authentication failed", code: 18
# Root cause: MongoDB container missing root user

# Fix: Recreate MongoDB with proper initialization
docker stop dev-mongo && docker rm dev-mongo
docker run -d --name dev-mongo --network microservices-external -p 27016:27017 \
  -e MONGO_INITDB_ROOT_USERNAME=root -e MONGO_INITDB_ROOT_PASSWORD=dev_pass mongo:7

# Restart chat service
kubectl delete pod -n dev -l app=chat-service
```

**Issue 3: ImagePullBackOff**
```bash
# Error: Failed to pull image
# Solution: Import images into k3d cluster
k3d image import microservices/auth:dev -c chatapp
```

---

## 🧪 **Phase 5: Testing & Validation**

### **Step 12: Configure Local DNS**

```bash
# Add to hosts file (Windows: C:\Windows\System32\drivers\etc\hosts)
127.0.0.1 api.local
```

### **Step 13: Test Dev Environment**

```bash
# Check all pods are running
kubectl get pods -n dev

# Test API endpoints via Ingress
curl http://api.local:8888/health
curl -X POST http://api.local:8888/auth/register -H "Content-Type: application/json" -d '{"email":"test@dev.com","displayName":"Dev User","password":"DevPass123!"}'

# Check logs
kubectl logs -n dev -l app=gateway-service
kubectl logs -n dev -l app=auth-service
```

### **Step 14: Monitor Resources**

```bash
# Check resource usage
kubectl top pods -n dev
kubectl describe hpa -n dev

# Check service endpoints
kubectl get endpoints -n dev
```

---

## 🔄 **Phase 6: Rolling Updates & Operations**

### **Step 15: Simulate Rolling Update**

```bash
# Update image version
kubectl set image deployment/auth-service -n dev auth-service=microservices/auth:v1.1

# Watch rolling update
kubectl rollout status deployment/auth-service -n dev

# Check rollout history
kubectl rollout history deployment/auth-service -n dev
```

### **Step 16: Rollback Simulation**

```bash
# Rollback to previous version
kubectl rollout undo deployment/auth-service -n dev

# Verify rollback
kubectl rollout status deployment/auth-service -n dev
```

### **Step 17: Scale Services**

```bash
# Manual scaling
kubectl scale deployment auth-service --replicas=3 -n dev

# Check HPA scaling
kubectl get hpa -n dev --watch
```

---

## 🌍 **Phase 7: Multi-Environment Deployment**

### **Step 18: Deploy to Staging**

```bash
# Build staging images
docker build -f services/gateway-service/Dockerfile -t microservices/gateway:staging .

# Deploy to staging namespace
kubectl apply -f k8s/staging/ -n staging

# Test staging environment
curl http://localhost:8081/health
```

### **Step 19: Deploy to Production**

```bash
# Build production images
docker build -f services/gateway-service/Dockerfile -t microservices/gateway:prod .

# Deploy to production namespace
kubectl apply -f k8s/prod/ -n prod

# Test production environment
curl http://localhost:8082/health
```

---

## 📊 **Phase 8: Monitoring & Observability**

### **Step 20: Setup Monitoring**

```bash
# Install Prometheus & Grafana (optional)
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm install prometheus prometheus-community/kube-prometheus-stack -n monitoring --create-namespace

# Access Grafana dashboard
kubectl port-forward -n monitoring svc/prometheus-grafana 3000:80
```

### **Step 21: Log Aggregation**

```bash
# View aggregated logs
kubectl logs -n dev -l tier=backend --tail=100

# Stream logs from all services
kubectl logs -n dev -f -l app=gateway-service
```

---

## 📊 **Current Status**

### **✅ Completed:**

- [x] K3d cluster setup (3 nodes, Traefik disabled)
- [x] Environment namespaces (dev, staging, prod)
- [x] External services deployment (MySQL, PostgreSQL, MongoDB, Redis, RabbitMQ)
- [x] Docker images built with pnpm workspace fixes
- [x] Kubernetes manifests created with proper image references
- [x] NGINX Ingress Controller installed
- [x] Dev environment deployed successfully
- [x] Production-grade troubleshooting completed

### **🏆 Deployment Results:**

```bash
# Final pod status in dev namespace:
NAME                              READY   STATUS    RESTARTS   AGE
auth-service-xxx                  1/1     Running   0          15m
user-service-xxx                  1/1     Running   0          12m
gateway-service-xxx               1/1     Running   0          12m
chat-service-xxx                  1/1     Running   0          2m
```

**✅ Success Metrics:**
- **4/4 services** running successfully
- **Gateway accessible** via Ingress at http://api.local:8888
- **Database connections** established
- **Zero-downtime deployment** achieved
- **Production-ready patterns** implemented

### **🔧 Key Issues Resolved:**

1. **pnpm workspace dependencies** - Fixed by copying all package.json files
2. **Docker build failures** - Fixed by re-linking workspace after source copy
3. **Kubernetes anti-patterns** - Fixed by using pre-built images instead of runtime builds
4. **MongoDB authentication** - Fixed by proper container initialization
5. **Image availability** - Fixed by importing images into k3d cluster
6. **Traefik port conflict** - Fixed by disabling Traefik and using NGINX Ingress
7. **External access** - Fixed by implementing API Gateway pattern with Ingress

### **📚 Lessons Learned:**

- **Kubernetes only runs immutable images** - Never build code at runtime
- **pnpm workspaces require all package.json files** for proper dependency resolution
- **External services need proper initialization** - Especially authentication setup
- **Production debugging requires systematic log analysis** - Not guesswork
- **Real-world deployments rarely work perfectly first time** - Troubleshooting is key
- **Traefik must be disabled in k3s** - To use NGINX Ingress Controller
- **API Gateway pattern is essential** - Single entry point for all traffic
- **Ingress provides production-grade routing** - Path-based, rate limiting, SSL/TLS

---

## 🎯 **Real-World Simulation Benefits**

This setup perfectly simulates:

- **AWS EKS** (K3d cluster)
- **AWS RDS** (External MySQL/PostgreSQL)
- **AWS DocumentDB** (External MongoDB)
- **AWS ElastiCache** (External Redis)
- **AWS Amazon MQ** (External RabbitMQ)
- **Multi-Account Strategy** (Separate namespaces)
- **Enterprise DevOps Practices** (Environment promotion)

---

## 📚 **Learning Outcomes**

By completing this guide, you'll understand:

- Real-world Kubernetes deployment patterns
- Stateless vs Stateful service architecture
- Environment separation and promotion
- Service discovery and networking
- Rolling updates and zero-downtime deployments
- Production-ready configuration management

---

**Next:** Continue with Phase 2 - External Services Deployment! 🚀
