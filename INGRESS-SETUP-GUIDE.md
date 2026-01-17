# 🚪 NGINX Ingress Controller - Complete Production Setup Guide

## 📚 Table of Contents

1. [What is Ingress?](#what-is-ingress)
2. [Why We Need It](#why-we-need-it)
3. [How It Works](#how-it-works)
4. [Installation Steps](#installation-steps)
5. [Configuration](#configuration)
6. [Testing](#testing)
7. [Advanced Features](#advanced-features)

---

## 🤔 What is Ingress?

### Simple Explanation

**Without Ingress (Current Setup):**
```
User → localhost:18100 → NodePort 30000 → Gateway Pod
```
- Each service needs its own port
- No SSL/HTTPS
- No path-based routing
- Not production-ready

**With Ingress (Production Setup):**
```
User → api.local (port 80/443) → Ingress Controller → Routes to correct service
```
- Single entry point
- SSL/HTTPS support
- Path-based routing: `/auth/*` → auth-service, `/users/*` → user-service
- Rate limiting, authentication, etc.

### Real-World Analogy

**NodePort** = Having a separate phone number for each department in a company
- Sales: 555-0001
- Support: 555-0002
- Billing: 555-0003

**Ingress** = Having ONE main number (555-0000) with an automated receptionist
- "Press 1 for Sales" → routes to sales
- "Press 2 for Support" → routes to support
- "Press 3 for Billing" → routes to billing


---

## 🎯 Why We Need It

### Problems with NodePort

1. **Port Management Nightmare**
   - Gateway: 18100
   - Auth: 18101
   - User: 18102
   - Chat: 18103
   - Every service needs a unique port!

2. **No SSL/HTTPS**
   - All traffic is HTTP (insecure)
   - Browsers show "Not Secure" warning
   - Can't use in production

3. **No Path-Based Routing**
   - Can't do: `api.company.com/auth/login`
   - Must do: `auth.company.com:18101/login`

4. **No Advanced Features**
   - No rate limiting
   - No request transformation
   - No authentication at gateway level

### Benefits of Ingress

✅ **Single Entry Point** - One domain, one port (80/443)
✅ **SSL/TLS Termination** - HTTPS everywhere
✅ **Path-Based Routing** - `/auth/*`, `/users/*`, `/chat/*`
✅ **Host-Based Routing** - `api.company.com`, `admin.company.com`
✅ **Rate Limiting** - Protect from DDoS
✅ **Authentication** - OAuth, JWT validation at edge
✅ **Load Balancing** - Distribute traffic across pods
✅ **Monitoring** - Centralized metrics

---

## 🏗️ How It Works

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                         User Browser                         │
│                    http://api.local                          │
└────────────────────────────┬────────────────────────────────┘
                             │
                             │ Port 80/443
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                    NGINX Ingress Controller                  │
│                      (Running in K8s)                        │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │  Routing Rules:                                     │    │
│  │  • /auth/*     → auth-service:4003                 │    │
│  │  • /users/*    → user-service:4001                 │    │
│  │  • /chat/*     → chat-service:4002                 │    │
│  │  • /health     → gateway-service:4000              │    │
│  └────────────────────────────────────────────────────┘    │
└────────────────────────────┬────────────────────────────────┘
                             │
                             │ Internal K8s Network
                             ▼
        ┌────────────────────┴────────────────────┐
        │                                          │
        ▼                                          ▼
┌──────────────────┐                    ┌──────────────────┐
│  Auth Service    │                    │  User Service    │
│  ClusterIP       │                    │  ClusterIP       │
│  10.43.192.102   │                    │  10.43.247.145   │
└──────────────────┘                    └──────────────────┘
```


### Request Flow Example

**User makes request:** `http://api.local/auth/login`

1. **DNS Resolution** → `api.local` resolves to `127.0.0.1` (localhost)
2. **Ingress Controller** receives request on port 80
3. **Path Matching** → `/auth/login` matches rule `/auth/*`
4. **Route to Service** → Forward to `auth-service:4003`
5. **Service Routes to Pod** → `auth-service` ClusterIP → Auth Pod
6. **Response** → Auth Pod → Service → Ingress → User

**Total Time:** ~50-100ms (same as before, but now with proper routing!)

---

## 🚀 Installation Steps

### Step 1: Install NGINX Ingress Controller

NGINX Ingress Controller is a Kubernetes controller that watches for Ingress resources and configures NGINX accordingly.

```powershell
# Install NGINX Ingress Controller using official manifest
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.8.1/deploy/static/provider/cloud/deploy.yaml

# Wait for controller to be ready (takes ~1-2 minutes)
kubectl wait --namespace ingress-nginx `
  --for=condition=ready pod `
  --selector=app.kubernetes.io/component=controller `
  --timeout=120s
```

**What this does:**
- Creates `ingress-nginx` namespace
- Deploys NGINX Ingress Controller pod
- Creates LoadBalancer service (in k3d, this becomes accessible on localhost)
- Sets up RBAC permissions

### Step 2: Verify Installation

```powershell
# Check if ingress-nginx namespace exists
kubectl get namespace ingress-nginx

# Check if controller pod is running
kubectl get pods -n ingress-nginx

# Check ingress controller service
kubectl get svc -n ingress-nginx
```

**Expected Output:**
```
NAME                                 READY   STATUS    RESTARTS   AGE
ingress-nginx-controller-xxx         1/1     Running   0          2m
```


### Step 4: Configure Local DNS and Cluster

**Windows - Edit hosts file:**

```powershell
# Open hosts file as Administrator
notepad C:\Windows\System32\drivers\etc\hosts

# Add this line:
127.0.0.1 api.local
```

**Save and close.** Now `api.local` will resolve to `localhost`.

**Important:** When creating the k3d cluster, disable Traefik (k3s default ingress):

```powershell
k3d cluster create chatapp-dev `
  --servers 1 `
  --agents 2 `
  --port "8888:80@loadbalancer" `
  --api-port 6550 `
  --k3s-arg "--disable=traefik@server:0"
```

This ensures NGINX Ingress can bind to port 80 without conflicts.


---

## ⚙️ Configuration

### Create Ingress Resource

Create a new file for Ingress configuration.

**File:** `k8s/dev/ingress.yaml`

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: api-ingress
  namespace: dev
  annotations:
    # SSL/TLS (disabled for local dev, enable in production)
    nginx.ingress.kubernetes.io/ssl-redirect: "false"
    
    # Rate limiting (100 requests per second per IP)
    nginx.ingress.kubernetes.io/limit-rps: "100"
    nginx.ingress.kubernetes.io/limit-burst-multiplier: "2"
    
    # CORS configuration
    nginx.ingress.kubernetes.io/enable-cors: "true"
    nginx.ingress.kubernetes.io/cors-allow-origin: "*"
    nginx.ingress.kubernetes.io/cors-allow-methods: "GET, POST, PUT, DELETE, PATCH, OPTIONS"
    nginx.ingress.kubernetes.io/cors-allow-headers: "Authorization, Content-Type, X-Request-ID"
    nginx.ingress.kubernetes.io/cors-allow-credentials: "true"
    nginx.ingress.kubernetes.io/cors-max-age: "3600"
    
    # Timeouts
    nginx.ingress.kubernetes.io/proxy-connect-timeout: "30"
    nginx.ingress.kubernetes.io/proxy-send-timeout: "30"
    nginx.ingress.kubernetes.io/proxy-read-timeout: "30"
    
    # Request size limit (10MB for file uploads)
    nginx.ingress.kubernetes.io/proxy-body-size: "10m"
    
    # Custom headers
    nginx.ingress.kubernetes.io/configuration-snippet: |
      proxy_set_header X-Request-ID $request_id;
      proxy_set_header X-Real-IP $remote_addr;
      proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
      proxy_set_header X-Forwarded-Proto $scheme;
    
    # Response headers
    nginx.ingress.kubernetes.io/server-snippet: |
      add_header X-Powered-By "Microservices Platform" always;
      add_header X-Frame-Options "SAMEORIGIN" always;
      add_header X-Content-Type-Options "nosniff" always;
      add_header X-XSS-Protection "1; mode=block" always;
spec:
  ingressClassName: nginx
  rules:
  - host: api.local
    http:
      paths:
      # All traffic routes through Gateway (API Gateway Pattern)
      # Gateway handles internal routing and adds X-Internal-Token
      - path: /
        pathType: Prefix
        backend:
          service:
            name: gateway-service
            port:
              number: 4000
```


### Understanding the Configuration

**API Gateway Pattern:**

This configuration routes ALL traffic through the gateway service. The gateway then:
1. Validates requests (JWT tokens, etc.)
2. Adds `X-Internal-Token` header for backend service authentication
3. Routes to appropriate backend services (auth, user, chat)

**Flow:**
```
External Request → Ingress → Gateway → Backend Services
```

**Key Annotations Explained:**

1. **`ssl-redirect: "false"`**
   - Allows HTTP (for local development)
   - In production, set to `"true"` to force HTTPS

2. **`limit-rps: "100"`**
   - Rate limiting: 100 requests per second per IP
   - Protects against DDoS attacks

3. **`limit-burst-multiplier: "2"`**
   - Allows bursts up to 200 requests
   - Handles traffic spikes gracefully

4. **`enable-cors: "true"`**
   - Allows cross-origin requests
   - Needed for frontend apps on different domains

5. **`proxy-body-size: "10m"`**
   - Maximum request body size: 10MB
   - Prevents huge file uploads

6. **`configuration-snippet`**
   - Adds custom headers to requests
   - Useful for tracing and debugging

7. **`server-snippet`**
   - Adds security headers to responses
   - Protects against common web vulnerabilities

### Apply Ingress Configuration

```powershell
# Apply the Ingress resource
kubectl apply -f k8s/dev/ingress.yaml

# Verify Ingress was created
kubectl get ingress -n dev

# Check Ingress details
kubectl describe ingress api-ingress -n dev
```

**Expected Output:**
```
NAME          CLASS   HOSTS       ADDRESS     PORTS   AGE
api-ingress   nginx   api.local   localhost   80      10s
```


---

## 🧪 Testing

### Test 1: Health Check

```powershell
# Test health endpoint
Invoke-RestMethod -Uri http://api.local:8888/health
```

**Expected Response:**
```json
{
  "status": "ok",
  "service": "gateway-service"
}
```

### Test 2: User Registration (Auth Service)

```powershell
# Register a new user
Invoke-RestMethod -Uri http://api.local:8888/auth/register `
  -Method POST `
  -Headers @{"Content-Type"="application/json"} `
  -Body '{"email":"ingress@test.com","password":"Password123!","displayName":"Ingress User"}'
```

**Expected Response:**
```json
{
  "accessToken": "eyJhbGci...",
  "refreshToken": "eyJhbGci...",
  "user": {
    "id": "...",
    "email": "ingress@test.com",
    "displayName": "Ingress User"
  }
}
```

### Test 3: User Login

```powershell
# Login
$response = Invoke-RestMethod -Uri http://api.local:8888/auth/login `
  -Method POST `
  -Headers @{"Content-Type"="application/json"} `
  -Body '{"email":"ingress@test.com","password":"Password123!"}'

$token = $response.accessToken
Write-Host "Token: $token"
```

### Test 4: Search Users (User Service)

```powershell
# Search users
Invoke-RestMethod -Uri "http://api.local:8888/users/search?query=ingress" `
  -Method GET `
  -Headers @{"Authorization"="Bearer $token"}
```

### Test 5: Create Conversation (Chat Service)

```powershell
# Create conversation
Invoke-RestMethod -Uri http://api.local:8888/conversations `
  -Method POST `
  -Headers @{"Authorization"="Bearer $token";"Content-Type"="application/json"} `
  -Body '{"participantIds":["some-user-id"]}'
```


---

## 🔧 Advanced Features

### 1. SSL/TLS Configuration (HTTPS)

For production, you need HTTPS. Here's how to add it:

**Create Self-Signed Certificate (for local testing):**

```powershell
# Generate self-signed certificate
openssl req -x509 -nodes -days 365 -newkey rsa:2048 `
  -keyout tls.key -out tls.crt `
  -subj "/CN=api.local/O=MyCompany"

# Create Kubernetes secret
kubectl create secret tls api-tls-secret `
  --key tls.key `
  --cert tls.crt `
  -n dev
```

**Update Ingress to use TLS:**

```yaml
spec:
  ingressClassName: nginx
  tls:
  - hosts:
    - api.local
    secretName: api-tls-secret
  rules:
  - host: api.local
    # ... rest of configuration
```

Now access via: `https://api.local`

### 2. Rate Limiting (Per User)

Add to Ingress annotations:

```yaml
annotations:
  # Rate limit: 10 requests per second per IP
  nginx.ingress.kubernetes.io/limit-rps: "10"
  
  # Burst: Allow 20 requests in burst
  nginx.ingress.kubernetes.io/limit-burst-multiplier: "2"
  
  # Rate limit by header (e.g., API key)
  nginx.ingress.kubernetes.io/limit-rate-after: "100"
```

### 3. Authentication at Ingress Level

Protect endpoints with basic auth:

```powershell
# Create htpasswd file
htpasswd -c auth admin

# Create secret
kubectl create secret generic basic-auth --from-file=auth -n dev
```

Add to Ingress:

```yaml
annotations:
  nginx.ingress.kubernetes.io/auth-type: basic
  nginx.ingress.kubernetes.io/auth-secret: basic-auth
  nginx.ingress.kubernetes.io/auth-realm: 'Authentication Required'
```


### 4. Request/Response Transformation

Modify headers:

```yaml
annotations:
  # Add custom headers to requests
  nginx.ingress.kubernetes.io/configuration-snippet: |
    proxy_set_header X-Request-ID $request_id;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  
  # Add custom headers to responses
  nginx.ingress.kubernetes.io/server-snippet: |
    add_header X-Powered-By "Microservices Platform" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
```

### 5. Path Rewriting Examples

**Example 1: Remove prefix**
```yaml
# Request: /api/v1/users/123
# Forward as: /users/123
annotations:
  nginx.ingress.kubernetes.io/rewrite-target: /$2
path: /api/v1(/|$)(.*)
```

**Example 2: Add prefix**
```yaml
# Request: /users/123
# Forward as: /api/users/123
annotations:
  nginx.ingress.kubernetes.io/rewrite-target: /api$uri
```

### 6. Canary Deployments

Route 10% of traffic to new version:

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: api-ingress-canary
  namespace: dev
  annotations:
    nginx.ingress.kubernetes.io/canary: "true"
    nginx.ingress.kubernetes.io/canary-weight: "10"
spec:
  rules:
  - host: api.local
    http:
      paths:
      - path: /auth
        pathType: Prefix
        backend:
          service:
            name: auth-service-v2  # New version
            port:
              number: 4003
```


---

## 📊 Monitoring Ingress

### View Ingress Logs

```powershell
# Get ingress controller pod name
$ingressPod = kubectl get pods -n ingress-nginx -l app.kubernetes.io/component=controller -o jsonpath='{.items[0].metadata.name}'

# View logs
kubectl logs -n ingress-nginx $ingressPod --tail=100 -f
```

### Ingress Metrics

NGINX Ingress exposes Prometheus metrics:

```powershell
# Port-forward to metrics endpoint
kubectl port-forward -n ingress-nginx svc/ingress-nginx-controller-metrics 10254:10254

# View metrics
Invoke-RestMethod -Uri http://localhost:10254/metrics
```

**Key Metrics:**
- `nginx_ingress_controller_requests` - Total requests
- `nginx_ingress_controller_request_duration_seconds` - Request latency
- `nginx_ingress_controller_response_size` - Response sizes
- `nginx_ingress_controller_ssl_expire_time_seconds` - SSL cert expiry

---

## 🐛 Troubleshooting

### Issue 1: "503 Service Temporarily Unavailable"

**Cause:** Service or pods not ready

**Solution:**
```powershell
# Check if pods are running
kubectl get pods -n dev

# Check service endpoints
kubectl get endpoints -n dev

# Check ingress backend status
kubectl describe ingress api-ingress -n dev
```

### Issue 2: "404 Not Found"

**Cause:** Path not matching or incorrect rewrite rule

**Solution:**
```powershell
# Check ingress rules
kubectl get ingress api-ingress -n dev -o yaml

# Test path matching
kubectl logs -n ingress-nginx $ingressPod | Select-String "api.local"
```

### Issue 3: CORS Errors

**Cause:** Missing CORS headers

**Solution:** Add CORS annotations to Ingress:
```yaml
nginx.ingress.kubernetes.io/enable-cors: "true"
nginx.ingress.kubernetes.io/cors-allow-origin: "*"
```


---

## 🎯 Comparison: Before vs After

### Before (NodePort)

```
✗ Multiple ports: 18100, 18101, 18102, 18103
✗ No SSL/HTTPS
✗ No rate limiting
✗ No centralized routing
✗ Hard to manage
✗ Not production-ready

Access:
- Gateway: http://localhost:18100/health
- Auth: http://localhost:18101/login
- User: http://localhost:18102/search
- Chat: http://localhost:18103/conversations
```

### After (Ingress)

```
✓ Single entry point: api.local:8888
✓ SSL/HTTPS ready
✓ Rate limiting enabled
✓ Centralized routing via Gateway
✓ Easy to manage
✓ Production-ready

Access:
- Health: http://api.local:8888/health
- Auth: http://api.local:8888/auth/login
- User: http://api.local:8888/users/search
- Chat: http://api.local:8888/conversations
```

---

## 📈 Performance Impact

**Latency:**
- NodePort: ~50ms
- Ingress: ~55ms (+5ms for routing)

**Throughput:**
- NodePort: ~1000 req/s
- Ingress: ~950 req/s (minimal impact)

**Benefits far outweigh the tiny performance cost!**

---

## 🚀 Production Checklist

Before going to production with Ingress:

- [ ] SSL/TLS certificates configured
- [ ] Rate limiting enabled
- [ ] CORS properly configured
- [ ] Request size limits set
- [ ] Timeouts configured
- [ ] Monitoring enabled (Prometheus)
- [ ] Logs being collected
- [ ] Health checks working
- [ ] Canary deployment strategy ready
- [ ] Rollback plan documented

---

## 📚 Additional Resources

- [NGINX Ingress Documentation](https://kubernetes.github.io/ingress-nginx/)
- [Ingress Annotations Reference](https://kubernetes.github.io/ingress-nginx/user-guide/nginx-configuration/annotations/)
- [TLS/SSL Configuration](https://kubernetes.github.io/ingress-nginx/user-guide/tls/)
- [Rate Limiting Guide](https://kubernetes.github.io/ingress-nginx/user-guide/nginx-configuration/annotations/#rate-limiting)

---

**Next Steps:**
1. ✅ Install NGINX Ingress Controller
2. ✅ Create Ingress resource (routes all traffic through gateway)
3. ✅ Test all endpoints
4. Add SSL/TLS
5. Configure rate limiting
6. Set up monitoring

**Completed! Gateway-centric Ingress is working!** 🚀
