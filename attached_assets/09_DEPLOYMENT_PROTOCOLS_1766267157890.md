# G3ZKP Implementation Plan - Part 09
## Deployment Protocols

---

## 1. DEPLOYMENT ENVIRONMENTS

| Environment | Purpose | URL | Auto-Deploy |
|-------------|---------|-----|-------------|
| Development | Feature testing | dev.g3zkp.net | On PR |
| Staging | Integration testing | staging.g3zkp.net | On merge to develop |
| Production | Live users | g3zkp.net | Manual (2 approvers) |

---

## 2. DOCKER CONFIGURATION

### 2.1 Application Dockerfile

```dockerfile
FROM node:18-alpine AS builder
RUN apk add --no-cache python3 make g++ git
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/*/package.json ./packages/
RUN npm install -g pnpm@8 && pnpm install --frozen-lockfile
COPY . .
RUN pnpm build && pnpm build:circuits

FROM node:18-alpine
RUN apk add --no-cache libstdc++ openssl
RUN addgroup -g 1001 -S g3zkp && adduser -u 1001 -S g3zkp -G g3zkp
WORKDIR /app
COPY --from=builder --chown=g3zkp:g3zkp /app/packages/*/dist ./packages/
COPY --from=builder --chown=g3zkp:g3zkp /app/packages/zkp/build ./packages/zkp/build/
COPY --from=builder --chown=g3zkp:g3zkp /app/node_modules ./node_modules
RUN mkdir -p /data/ipfs /data/keys && chown -R g3zkp:g3zkp /data
USER g3zkp
EXPOSE 3000 5001 4001
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://localhost:3000/health || exit 1
CMD ["node", "packages/server/dist/index.js"]
```

### 2.2 Docker Compose Production

```yaml
version: '3.8'
services:
  g3zkp-node:
    image: g3zkp/messenger:${VERSION:-latest}
    restart: unless-stopped
    ports:
      - "3000:3000"
      - "4001:4001"
      - "4001:4001/udp"
    volumes:
      - g3zkp-data:/data/ipfs
      - g3zkp-keys:/data/keys
    environment:
      - NODE_ENV=production
      - G3ZKP_NODE_TYPE=relay
      - G3ZKP_NETWORK_MODE=hybrid
      - G3ZKP_AUDIT_LEVEL=standard
    networks:
      - g3zkp-network
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G

  g3zkp-relay:
    image: g3zkp/relay:${VERSION:-latest}
    restart: unless-stopped
    ports:
      - "9090:9090"
    environment:
      - MAX_CONNECTIONS=1000
    networks:
      - g3zkp-network

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    command: redis-server --appendonly yes --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis-data:/data
    networks:
      - g3zkp-network

networks:
  g3zkp-network:
    driver: bridge

volumes:
  g3zkp-data:
  g3zkp-keys:
  redis-data:
```

---

## 3. KUBERNETES DEPLOYMENT

### 3.1 Namespace & ConfigMap

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: g3zkp
  labels:
    app: g3zkp
---
apiVersion: v1
kind: ConfigMap
metadata:
  name: g3zkp-config
  namespace: g3zkp
data:
  NODE_ENV: "production"
  G3ZKP_NODE_TYPE: "relay"
  G3ZKP_NETWORK_MODE: "hybrid"
  G3ZKP_AUDIT_LEVEL: "standard"
  G3ZKP_MAX_CONNECTIONS: "50"
  G3ZKP_BOOTSTRAP_NODES: "/dns4/bootstrap1.g3zkp.net/tcp/443/wss/p2p/12D3KooWGzBs"
```

### 3.2 Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: g3zkp-messenger
  namespace: g3zkp
spec:
  replicas: 3
  selector:
    matchLabels:
      app: g3zkp
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  template:
    metadata:
      labels:
        app: g3zkp
    spec:
      securityContext:
        runAsUser: 1001
        runAsNonRoot: true
        fsGroup: 1001
      containers:
      - name: g3zkp
        image: g3zkp/messenger:latest
        ports:
        - containerPort: 3000
        - containerPort: 4001
        envFrom:
        - configMapRef:
            name: g3zkp-config
        - secretRef:
            name: g3zkp-secrets
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "2Gi"
            cpu: "2"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
        volumeMounts:
        - name: data
          mountPath: /data
      volumes:
      - name: data
        persistentVolumeClaim:
          claimName: g3zkp-data-pvc
```

### 3.3 Service & HPA

```yaml
apiVersion: v1
kind: Service
metadata:
  name: g3zkp-service
  namespace: g3zkp
spec:
  selector:
    app: g3zkp
  ports:
  - name: web
    port: 80
    targetPort: 3000
  - name: ipfs
    port: 4001
    targetPort: 4001
  type: LoadBalancer
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: g3zkp-hpa
  namespace: g3zkp
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: g3zkp-messenger
  minReplicas: 3
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
```

---

## 4. DEPLOYMENT SCRIPTS

### 4.1 Production Deployment Script

**File: `scripts/deploy/deploy-production.sh`**

```bash
#!/bin/bash
set -euo pipefail

# G3ZKP Production Deployment Script
# Usage: ./deploy-production.sh [version]

VERSION="${1:-$(git describe --tags --abbrev=0)}"
NAMESPACE="g3zkp"
DEPLOYMENT="g3zkp-messenger"
REGISTRY="ghcr.io/g3zkp"

echo "=========================================="
echo "G3ZKP Production Deployment"
echo "Version: $VERSION"
echo "=========================================="

# Pre-flight checks
echo "[1/8] Running pre-flight checks..."
kubectl get namespace $NAMESPACE || kubectl create namespace $NAMESPACE
kubectl config current-context

# Build and push images
echo "[2/8] Building Docker images..."
docker build -t $REGISTRY/messenger:$VERSION -f infrastructure/docker/Dockerfile .
docker push $REGISTRY/messenger:$VERSION

# Run security scan
echo "[3/8] Running security scan..."
trivy image --exit-code 1 --severity HIGH,CRITICAL $REGISTRY/messenger:$VERSION

# Update image tag in deployment
echo "[4/8] Updating deployment..."
kubectl set image deployment/$DEPLOYMENT g3zkp=$REGISTRY/messenger:$VERSION -n $NAMESPACE

# Wait for rollout
echo "[5/8] Waiting for rollout to complete..."
kubectl rollout status deployment/$DEPLOYMENT -n $NAMESPACE --timeout=600s

# Run smoke tests
echo "[6/8] Running smoke tests..."
./scripts/deploy/smoke-tests.sh

# Verify health
echo "[7/8] Verifying health..."
for i in {1..10}; do
  if kubectl exec -n $NAMESPACE deploy/$DEPLOYMENT -- wget -qO- http://localhost:3000/health; then
    echo "Health check passed"
    break
  fi
  sleep 5
done

# Tag release
echo "[8/8] Tagging release..."
git tag -a "deployed-$VERSION-$(date +%Y%m%d%H%M%S)" -m "Deployed to production"
git push --tags

echo "=========================================="
echo "Deployment complete: $VERSION"
echo "=========================================="
```

### 4.2 Rollback Script

**File: `scripts/deploy/rollback.sh`**

```bash
#!/bin/bash
set -euo pipefail

# G3ZKP Rollback Script
# Usage: ./rollback.sh [revision]

NAMESPACE="g3zkp"
DEPLOYMENT="g3zkp-messenger"
REVISION="${1:-}"

echo "=========================================="
echo "G3ZKP Rollback"
echo "=========================================="

# Show rollout history
echo "Current rollout history:"
kubectl rollout history deployment/$DEPLOYMENT -n $NAMESPACE

if [ -z "$REVISION" ]; then
  echo "Rolling back to previous revision..."
  kubectl rollout undo deployment/$DEPLOYMENT -n $NAMESPACE
else
  echo "Rolling back to revision $REVISION..."
  kubectl rollout undo deployment/$DEPLOYMENT -n $NAMESPACE --to-revision=$REVISION
fi

# Wait for rollback
echo "Waiting for rollback to complete..."
kubectl rollout status deployment/$DEPLOYMENT -n $NAMESPACE --timeout=300s

# Verify health
echo "Verifying health after rollback..."
sleep 10
kubectl exec -n $NAMESPACE deploy/$DEPLOYMENT -- wget -qO- http://localhost:3000/health

echo "=========================================="
echo "Rollback complete"
echo "=========================================="
```

### 4.3 Health Check Script

**File: `scripts/deploy/health-check.sh`**

```bash
#!/bin/bash
set -euo pipefail

# G3ZKP Health Check Script

ENDPOINT="${1:-http://localhost:3000}"
TIMEOUT=5
RETRIES=3

check_health() {
  local url="$1/health"
  curl -sf --max-time $TIMEOUT "$url" > /dev/null 2>&1
}

check_ready() {
  local url="$1/ready"
  curl -sf --max-time $TIMEOUT "$url" > /dev/null 2>&1
}

check_metrics() {
  local url="$1/metrics"
  curl -sf --max-time $TIMEOUT "$url" | grep -q "g3zkp_"
}

echo "Checking G3ZKP health at $ENDPOINT"

for check in health ready metrics; do
  for i in $(seq 1 $RETRIES); do
    if check_$check "$ENDPOINT"; then
      echo "✓ $check check passed"
      break
    elif [ $i -eq $RETRIES ]; then
      echo "✗ $check check failed after $RETRIES attempts"
      exit 1
    fi
    sleep 2
  done
done

echo "All health checks passed"
```

---

## 5. CI/CD PIPELINES

### 5.1 GitHub Actions Production Deploy

**File: `.github/workflows/cd-production.yml`**

```yaml
name: Deploy to Production

on:
  release:
    types: [published]
  workflow_dispatch:
    inputs:
      version:
        description: 'Version to deploy'
        required: true

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: actions/checkout@v4
      
      - name: Set version
        run: echo "VERSION=${{ github.event.inputs.version || github.ref_name }}" >> $GITHUB_ENV

      - name: Login to Registry
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Build and Push
        uses: docker/build-push-action@v5
        with:
          push: true
          tags: ghcr.io/g3zkp/messenger:${{ env.VERSION }}
          file: infrastructure/docker/Dockerfile

      - name: Security Scan
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: ghcr.io/g3zkp/messenger:${{ env.VERSION }}
          exit-code: '1'
          severity: 'HIGH,CRITICAL'

      - name: Deploy to Kubernetes
        uses: azure/k8s-deploy@v4
        with:
          namespace: g3zkp
          manifests: infrastructure/kubernetes/
          images: ghcr.io/g3zkp/messenger:${{ env.VERSION }}

      - name: Smoke Tests
        run: ./scripts/deploy/smoke-tests.sh

      - name: Notify Success
        uses: slackapi/slack-github-action@v1
        with:
          payload: |
            {"text": "✅ G3ZKP ${{ env.VERSION }} deployed to production"}
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK }}
```

---

## 6. DEPLOYMENT CHECKLIST

```markdown
## Pre-Deployment
- [ ] All CI checks passing
- [ ] Security audit: 0 critical, 0 high findings
- [ ] Performance benchmarks within 10% of baseline
- [ ] Documentation updated
- [ ] Rollback plan documented
- [ ] On-call engineer notified

## Deployment
- [ ] Create release tag
- [ ] Build and push images
- [ ] Security scan passed
- [ ] Deploy to staging first
- [ ] Staging smoke tests passed
- [ ] Deploy to production (canary 10%)
- [ ] Monitor metrics 15 minutes
- [ ] Full rollout (100%)

## Post-Deployment
- [ ] All health checks passing
- [ ] No error rate increase
- [ ] Latency within baseline
- [ ] Update status page
- [ ] Close deployment ticket
```

---

*Next: Part 10 - Maintenance Protocols*
