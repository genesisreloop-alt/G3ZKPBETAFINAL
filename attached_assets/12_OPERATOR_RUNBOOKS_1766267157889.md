# G3ZKP Implementation Plan - Part 12
## Operator Runbooks

---

## 1. DAILY OPERATIONS

### 1.1 Morning Check Script

**File: `scripts/operator/morning-check.sh`**

```bash
#!/bin/bash
set -euo pipefail

# G3ZKP Morning Operations Check
# Run daily at start of shift

NAMESPACE="g3zkp"

echo "=========================================="
echo "G3ZKP Morning Operations Check"
echo "Date: $(date)"
echo "=========================================="

# 1. Cluster Health
echo ""
echo "=== CLUSTER HEALTH ==="
kubectl get nodes
kubectl top nodes

# 2. Deployment Status
echo ""
echo "=== DEPLOYMENT STATUS ==="
kubectl get deployments -n $NAMESPACE
kubectl get pods -n $NAMESPACE -o wide

# 3. Recent Events
echo ""
echo "=== RECENT EVENTS (last 2 hours) ==="
kubectl get events -n $NAMESPACE --sort-by='.lastTimestamp' | tail -20

# 4. Resource Usage
echo ""
echo "=== RESOURCE USAGE ==="
kubectl top pods -n $NAMESPACE

# 5. Error Logs (last hour)
echo ""
echo "=== ERROR LOGS (last hour) ==="
kubectl logs -n $NAMESPACE -l app=g3zkp --since=1h | grep -i error | tail -10 || echo "No errors"

# 6. Security Alerts
echo ""
echo "=== SECURITY ALERTS ==="
kubectl logs -n $NAMESPACE -l app=g3zkp --since=24h | grep -i "security\|audit\|alert" | tail -10 || echo "No alerts"

# 7. Key Metrics
echo ""
echo "=== KEY METRICS ==="
curl -s http://g3zkp-service.$NAMESPACE/metrics 2>/dev/null | grep -E "^g3zkp_(messages|connections|proofs)" | head -10 || echo "Metrics unavailable"

# 8. Backup Status
echo ""
echo "=== BACKUP STATUS ==="
aws s3 ls s3://g3zkp-backups/$(date +%Y/%m)/ --human-readable | tail -5

# 9. Certificate Expiry
echo ""
echo "=== CERTIFICATE STATUS ==="
kubectl get certificate -n $NAMESPACE 2>/dev/null || echo "No cert-manager certificates"

# 10. Summary
echo ""
echo "=========================================="
PODS_READY=$(kubectl get pods -n $NAMESPACE -o jsonpath='{.items[*].status.conditions[?(@.type=="Ready")].status}' | tr ' ' '\n' | grep -c True || echo 0)
PODS_TOTAL=$(kubectl get pods -n $NAMESPACE --no-headers | wc -l)
echo "Summary: $PODS_READY/$PODS_TOTAL pods ready"
echo "=========================================="
```

### 1.2 Status Check Command

**File: `scripts/operator/status.sh`**

```bash
#!/bin/bash
set -euo pipefail

# G3ZKP Quick Status Check

NAMESPACE="g3zkp"

echo "G3ZKP Status @ $(date)"
echo "---"

# Quick health check
if curl -sf http://g3zkp-service.$NAMESPACE/health > /dev/null 2>&1; then
  echo "✓ Service: HEALTHY"
else
  echo "✗ Service: UNHEALTHY"
fi

# Pod status
READY=$(kubectl get deployment g3zkp-messenger -n $NAMESPACE -o jsonpath='{.status.readyReplicas}' 2>/dev/null || echo 0)
DESIRED=$(kubectl get deployment g3zkp-messenger -n $NAMESPACE -o jsonpath='{.spec.replicas}' 2>/dev/null || echo 0)
if [ "$READY" = "$DESIRED" ]; then
  echo "✓ Pods: $READY/$DESIRED"
else
  echo "⚠ Pods: $READY/$DESIRED"
fi

# Version
VERSION=$(kubectl get deployment g3zkp-messenger -n $NAMESPACE -o jsonpath='{.spec.template.spec.containers[0].image}' 2>/dev/null | cut -d: -f2)
echo "  Version: $VERSION"

# Connections
CONNECTIONS=$(curl -s http://g3zkp-service.$NAMESPACE/metrics 2>/dev/null | grep "g3zkp_active_connections" | awk '{print $2}' || echo "N/A")
echo "  Connections: $CONNECTIONS"

# Messages (24h)
MESSAGES=$(curl -s http://g3zkp-service.$NAMESPACE/metrics 2>/dev/null | grep "g3zkp_messages_total" | awk '{print $2}' || echo "N/A")
echo "  Messages (total): $MESSAGES"
```

---

## 2. COMMON OPERATIONS

### 2.1 Start Node

**File: `scripts/operator/start-node.sh`**

```bash
#!/bin/bash
set -euo pipefail

# G3ZKP Start Node
# Usage: ./start-node.sh [replicas]

NAMESPACE="g3zkp"
REPLICAS="${1:-3}"

echo "Starting G3ZKP with $REPLICAS replicas..."

# Ensure namespace exists
kubectl get namespace $NAMESPACE || kubectl create namespace $NAMESPACE

# Apply configurations
kubectl apply -f infrastructure/kubernetes/base/

# Scale deployment
kubectl scale deployment g3zkp-messenger -n $NAMESPACE --replicas=$REPLICAS

# Wait for ready
kubectl wait --for=condition=Available deployment/g3zkp-messenger -n $NAMESPACE --timeout=300s

# Verify
./scripts/operator/status.sh

echo "G3ZKP started successfully"
```

### 2.2 Stop Node

**File: `scripts/operator/stop-node.sh`**

```bash
#!/bin/bash
set -euo pipefail

# G3ZKP Stop Node
# Usage: ./stop-node.sh [--force]

NAMESPACE="g3zkp"
FORCE="${1:-}"

echo "Stopping G3ZKP..."

if [ "$FORCE" != "--force" ]; then
  # Graceful shutdown - drain connections first
  echo "Draining connections (30s timeout)..."
  kubectl exec -n $NAMESPACE deploy/g3zkp-messenger -- \
    node -e "require('@g3zkp/network').drainConnections(30000)" 2>/dev/null || true
fi

# Scale to zero
kubectl scale deployment g3zkp-messenger -n $NAMESPACE --replicas=0

# Wait for termination
kubectl wait --for=delete pod -l app=g3zkp -n $NAMESPACE --timeout=60s || true

echo "G3ZKP stopped"
```

### 2.3 Restart Node

**File: `scripts/operator/restart-node.sh`**

```bash
#!/bin/bash
set -euo pipefail

# G3ZKP Restart Node
# Usage: ./restart-node.sh [--rolling]

NAMESPACE="g3zkp"
MODE="${1:---rolling}"

echo "Restarting G3ZKP ($MODE)..."

if [ "$MODE" = "--rolling" ]; then
  # Rolling restart (no downtime)
  kubectl rollout restart deployment/g3zkp-messenger -n $NAMESPACE
  kubectl rollout status deployment/g3zkp-messenger -n $NAMESPACE --timeout=300s
else
  # Full restart
  ./scripts/operator/stop-node.sh
  sleep 5
  ./scripts/operator/start-node.sh
fi

./scripts/operator/status.sh
echo "G3ZKP restarted"
```

### 2.4 View Logs

**File: `scripts/operator/logs.sh`**

```bash
#!/bin/bash
set -euo pipefail

# G3ZKP Log Viewer
# Usage: ./logs.sh [options]
#   -f, --follow     Follow log output
#   -e, --errors     Show only errors
#   -s, --security   Show security events
#   -n, --lines N    Show last N lines (default: 100)

NAMESPACE="g3zkp"
FOLLOW=""
FILTER=""
LINES=100

while [[ $# -gt 0 ]]; do
  case $1 in
    -f|--follow) FOLLOW="-f"; shift ;;
    -e|--errors) FILTER="error|Error|ERROR|exception|Exception"; shift ;;
    -s|--security) FILTER="security|audit|Security|Audit"; shift ;;
    -n|--lines) LINES="$2"; shift 2 ;;
    *) shift ;;
  esac
done

if [ -n "$FILTER" ]; then
  kubectl logs -n $NAMESPACE -l app=g3zkp --tail=$LINES $FOLLOW | grep -iE "$FILTER"
else
  kubectl logs -n $NAMESPACE -l app=g3zkp --tail=$LINES $FOLLOW
fi
```

---

## 3. TROUBLESHOOTING PROCEDURES

### 3.1 Pod Not Starting

```markdown
## Symptom: Pods stuck in Pending/CrashLoopBackOff

### Diagnosis Steps:
1. Check pod status and events:
   ```bash
   kubectl describe pod <pod-name> -n g3zkp
   kubectl get events -n g3zkp --sort-by='.lastTimestamp'
   ```

2. Check resource availability:
   ```bash
   kubectl describe nodes | grep -A5 "Allocated resources"
   ```

3. Check logs:
   ```bash
   kubectl logs <pod-name> -n g3zkp --previous
   ```

### Common Causes & Solutions:

| Cause | Solution |
|-------|----------|
| Insufficient resources | Scale down other workloads or add nodes |
| Image pull error | Verify registry credentials and image tag |
| Config/Secret missing | Apply missing ConfigMaps/Secrets |
| PVC not bound | Check PVC status, provision storage |
| Health check failing | Check app logs, verify endpoints |
```

### 3.2 High Latency

```markdown
## Symptom: Response times > 2 seconds

### Diagnosis Steps:
1. Check current latency metrics:
   ```bash
   curl -s http://g3zkp-service/metrics | grep latency
   ```

2. Check resource usage:
   ```bash
   kubectl top pods -n g3zkp
   ```

3. Check network:
   ```bash
   kubectl exec -n g3zkp deploy/g3zkp-messenger -- \
     curl -w "@/dev/stdin" -o /dev/null -s http://localhost:3000/health <<< \
     "time_total: %{time_total}s\n"
   ```

### Solutions:
- **CPU bound**: Scale horizontally (increase replicas)
- **Memory bound**: Increase memory limits, check for leaks
- **Network**: Check IPFS peer connections, verify bootstrap nodes
- **ZKP proofs slow**: Check circuit complexity, enable proof caching
```

### 3.3 Connection Failures

```markdown
## Symptom: Users cannot connect

### Diagnosis:
1. Verify service is accessible:
   ```bash
   kubectl get svc -n g3zkp
   curl -v http://<service-ip>/health
   ```

2. Check IPFS swarm:
   ```bash
   kubectl exec -n g3zkp deploy/g3zkp-messenger -- \
     node -e "require('@g3zkp/network').getPeerCount().then(console.log)"
   ```

3. Check firewall/ingress:
   ```bash
   kubectl get ingress -n g3zkp
   kubectl describe ingress g3zkp-ingress -n g3zkp
   ```

### Solutions:
- Verify bootstrap nodes are reachable
- Check WebSocket/WebRTC ports (4001, 9090)
- Restart IPFS node: `kubectl delete pod -l app=g3zkp -n g3zkp`
- Check SSL certificates if using HTTPS
```

### 3.4 Security Alert Response

```markdown
## Symptom: Security audit alert triggered

### Immediate Actions:
1. **DO NOT PANIC** - Follow procedure

2. Assess severity:
   ```bash
   kubectl logs -n g3zkp -l app=g3zkp | grep -i "security\|alert" | tail -50
   ```

3. If CRITICAL:
   - Notify security team immediately
   - Consider isolating affected nodes
   - Do NOT destroy evidence (logs, metrics)

### Response by Severity:

| Severity | Response Time | Actions |
|----------|---------------|---------|
| Critical | Immediate | Page on-call, isolate if needed |
| High | < 1 hour | Investigate, prepare patch |
| Medium | < 24 hours | Schedule fix in next release |
| Low | < 1 week | Add to backlog |

### Evidence Collection:
```bash
# Save logs
kubectl logs -n g3zkp -l app=g3zkp > incident_logs_$(date +%s).txt

# Save metrics
curl http://g3zkp-service/metrics > incident_metrics_$(date +%s).txt

# Save pod descriptions
kubectl describe pods -n g3zkp > incident_pods_$(date +%s).txt
```
```

---

## 4. SCALING OPERATIONS

### 4.1 Manual Scaling

```bash
#!/bin/bash
# scripts/operator/scale.sh

REPLICAS="${1:?Usage: ./scale.sh <replicas>}"
NAMESPACE="g3zkp"

echo "Scaling G3ZKP to $REPLICAS replicas..."

kubectl scale deployment g3zkp-messenger -n $NAMESPACE --replicas=$REPLICAS

kubectl rollout status deployment/g3zkp-messenger -n $NAMESPACE

echo "Current status:"
kubectl get pods -n $NAMESPACE -l app=g3zkp
```

### 4.2 Auto-scaling Configuration

```yaml
# Adjust HPA settings
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
  maxReplicas: 20
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 60
      policies:
      - type: Pods
        value: 2
        periodSeconds: 60
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
      - type: Percent
        value: 10
        periodSeconds: 60
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
```

---

## 5. MONITORING DASHBOARDS

### 5.1 Key Metrics to Monitor

```yaml
critical_metrics:
  - g3zkp_health_status           # 1 = healthy, 0 = unhealthy
  - g3zkp_error_rate              # Should be < 0.1%
  - g3zkp_request_latency_p95     # Should be < 500ms
  - g3zkp_active_connections      # Compare to baseline

important_metrics:
  - g3zkp_messages_sent_total
  - g3zkp_messages_received_total
  - g3zkp_proof_generation_time
  - g3zkp_proof_verification_time
  - g3zkp_peer_count
  - g3zkp_session_count

resource_metrics:
  - container_cpu_usage_seconds
  - container_memory_usage_bytes
  - container_network_receive_bytes
  - container_network_transmit_bytes
```

### 5.2 Grafana Dashboard JSON

```json
{
  "title": "G3ZKP Operations",
  "panels": [
    {
      "title": "Health Status",
      "type": "stat",
      "targets": [{"expr": "g3zkp_health_status"}]
    },
    {
      "title": "Active Connections",
      "type": "graph",
      "targets": [{"expr": "g3zkp_active_connections"}]
    },
    {
      "title": "Messages/min",
      "type": "graph",
      "targets": [{"expr": "rate(g3zkp_messages_total[1m]) * 60"}]
    },
    {
      "title": "Error Rate",
      "type": "graph",
      "targets": [{"expr": "rate(g3zkp_errors_total[5m])"}]
    },
    {
      "title": "Latency P95",
      "type": "graph",
      "targets": [{"expr": "histogram_quantile(0.95, g3zkp_request_duration_bucket)"}]
    },
    {
      "title": "Proof Generation Time",
      "type": "graph",
      "targets": [{"expr": "g3zkp_proof_generation_seconds"}]
    }
  ]
}
```

---

## 6. CONTACT ESCALATION

```yaml
escalation_path:
  level_1:
    role: On-call Engineer
    response_time: 15 minutes
    contact: PagerDuty rotation
    
  level_2:
    role: Senior Engineer
    response_time: 30 minutes
    contact: ops-senior@g3zkp.net
    
  level_3:
    role: Tech Lead
    response_time: 1 hour
    contact: tech-lead@g3zkp.net
    
  security:
    role: Security Team
    response_time: Immediate for critical
    contact: security@g3zkp.net
```

---

*Next: Part 13 - Emergency Procedures*
