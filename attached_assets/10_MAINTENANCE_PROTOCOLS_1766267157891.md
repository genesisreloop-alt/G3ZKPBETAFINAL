# G3ZKP Implementation Plan - Part 10
## Maintenance Protocols

---

## 1. SCHEDULED MAINTENANCE WINDOWS

| Type | Frequency | Duration | Notification |
|------|-----------|----------|--------------|
| Security Patches | As needed | 15-30 min | 24 hours |
| Minor Updates | Weekly | 30 min | 48 hours |
| Major Updates | Monthly | 1-2 hours | 1 week |
| Infrastructure | Quarterly | 2-4 hours | 2 weeks |

---

## 2. BACKUP PROCEDURES

### 2.1 Backup Script

**File: `scripts/maintenance/backup.sh`**

```bash
#!/bin/bash
set -euo pipefail

# G3ZKP Backup Script
# Usage: ./backup.sh [full|incremental]

BACKUP_TYPE="${1:-incremental}"
BACKUP_DIR="/backups/g3zkp"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="g3zkp_${BACKUP_TYPE}_${TIMESTAMP}"
RETENTION_DAYS=30
S3_BUCKET="s3://g3zkp-backups"

echo "=========================================="
echo "G3ZKP Backup: $BACKUP_TYPE"
echo "Timestamp: $TIMESTAMP"
echo "=========================================="

mkdir -p "$BACKUP_DIR"

# 1. Backup IPFS data
echo "[1/5] Backing up IPFS data..."
kubectl exec -n g3zkp deploy/g3zkp-messenger -- \
  tar czf - /data/ipfs > "$BACKUP_DIR/${BACKUP_NAME}_ipfs.tar.gz"

# 2. Backup encrypted keys (encrypted at rest)
echo "[2/5] Backing up encrypted keys..."
kubectl exec -n g3zkp deploy/g3zkp-messenger -- \
  tar czf - /data/keys > "$BACKUP_DIR/${BACKUP_NAME}_keys.tar.gz.enc"

# 3. Backup Redis data
echo "[3/5] Backing up Redis..."
kubectl exec -n g3zkp deploy/redis -- redis-cli BGSAVE
sleep 5
kubectl cp g3zkp/redis-0:/data/dump.rdb "$BACKUP_DIR/${BACKUP_NAME}_redis.rdb"

# 4. Backup Kubernetes configs
echo "[4/5] Backing up Kubernetes configs..."
kubectl get all,configmap,secret,pvc -n g3zkp -o yaml > \
  "$BACKUP_DIR/${BACKUP_NAME}_k8s.yaml"

# 5. Upload to S3
echo "[5/5] Uploading to S3..."
aws s3 sync "$BACKUP_DIR" "$S3_BUCKET/$(date +%Y/%m)/" \
  --exclude "*" --include "${BACKUP_NAME}*"

# Cleanup old local backups
find "$BACKUP_DIR" -type f -mtime +7 -delete

# Verify backup
echo "Verifying backup integrity..."
for file in "$BACKUP_DIR/${BACKUP_NAME}"*; do
  if [ -f "$file" ]; then
    size=$(stat -f%z "$file" 2>/dev/null || stat -c%s "$file")
    echo "  ✓ $(basename $file): $size bytes"
  fi
done

# Log backup completion
echo "{\"type\":\"backup\",\"name\":\"$BACKUP_NAME\",\"status\":\"success\",\"timestamp\":\"$TIMESTAMP\"}" | \
  kubectl exec -i -n g3zkp deploy/g3zkp-messenger -- \
  tee -a /data/logs/backup.log

echo "=========================================="
echo "Backup complete: $BACKUP_NAME"
echo "=========================================="
```

### 2.2 Restore Script

**File: `scripts/maintenance/restore.sh`**

```bash
#!/bin/bash
set -euo pipefail

# G3ZKP Restore Script
# Usage: ./restore.sh <backup_name>

BACKUP_NAME="${1:?Backup name required}"
BACKUP_DIR="/backups/g3zkp"
S3_BUCKET="s3://g3zkp-backups"

echo "=========================================="
echo "G3ZKP Restore"
echo "Backup: $BACKUP_NAME"
echo "=========================================="
echo "WARNING: This will overwrite current data!"
read -p "Continue? (yes/no): " confirm
[ "$confirm" = "yes" ] || exit 1

# Download from S3 if not local
if [ ! -f "$BACKUP_DIR/${BACKUP_NAME}_ipfs.tar.gz" ]; then
  echo "Downloading backup from S3..."
  aws s3 cp "$S3_BUCKET/" "$BACKUP_DIR/" --recursive \
    --exclude "*" --include "${BACKUP_NAME}*"
fi

# Scale down deployment
echo "[1/6] Scaling down deployment..."
kubectl scale deployment g3zkp-messenger -n g3zkp --replicas=0
kubectl wait --for=delete pod -l app=g3zkp -n g3zkp --timeout=120s || true

# Restore IPFS data
echo "[2/6] Restoring IPFS data..."
kubectl run restore-pod --image=alpine -n g3zkp --restart=Never -- sleep 3600
kubectl wait --for=condition=Ready pod/restore-pod -n g3zkp
kubectl cp "$BACKUP_DIR/${BACKUP_NAME}_ipfs.tar.gz" g3zkp/restore-pod:/tmp/
kubectl exec -n g3zkp restore-pod -- tar xzf /tmp/${BACKUP_NAME}_ipfs.tar.gz -C /

# Restore keys
echo "[3/6] Restoring keys..."
kubectl cp "$BACKUP_DIR/${BACKUP_NAME}_keys.tar.gz.enc" g3zkp/restore-pod:/tmp/
kubectl exec -n g3zkp restore-pod -- tar xzf /tmp/${BACKUP_NAME}_keys.tar.gz.enc -C /

# Restore Redis
echo "[4/6] Restoring Redis..."
kubectl cp "$BACKUP_DIR/${BACKUP_NAME}_redis.rdb" g3zkp/redis-0:/data/dump.rdb
kubectl delete pod redis-0 -n g3zkp
kubectl wait --for=condition=Ready pod/redis-0 -n g3zkp

# Cleanup restore pod
echo "[5/6] Cleaning up..."
kubectl delete pod restore-pod -n g3zkp

# Scale up deployment
echo "[6/6] Scaling up deployment..."
kubectl scale deployment g3zkp-messenger -n g3zkp --replicas=3
kubectl wait --for=condition=Available deployment/g3zkp-messenger -n g3zkp --timeout=300s

# Verify restore
echo "Verifying restore..."
./scripts/deploy/health-check.sh

echo "=========================================="
echo "Restore complete"
echo "=========================================="
```

---

## 3. KEY ROTATION

### 3.1 Key Rotation Script

**File: `scripts/maintenance/rotate-keys.sh`**

```bash
#!/bin/bash
set -euo pipefail

# G3ZKP Key Rotation Script
# Usage: ./rotate-keys.sh [--force]

FORCE="${1:-}"
NAMESPACE="g3zkp"
KEY_TYPES=("identity" "signing" "encryption" "session")

echo "=========================================="
echo "G3ZKP Key Rotation"
echo "=========================================="

# Check if rotation is due
check_rotation_due() {
  local key_type=$1
  local last_rotation=$(kubectl get secret g3zkp-keys -n $NAMESPACE \
    -o jsonpath="{.metadata.annotations.last-rotation-$key_type}" 2>/dev/null || echo "0")
  local rotation_interval=86400  # 24 hours in seconds
  local now=$(date +%s)
  
  if [ "$FORCE" = "--force" ] || [ $((now - last_rotation)) -gt $rotation_interval ]; then
    return 0
  fi
  return 1
}

# Rotate specific key type
rotate_key() {
  local key_type=$1
  echo "Rotating $key_type keys..."
  
  # Generate new keys via the application
  kubectl exec -n $NAMESPACE deploy/g3zkp-messenger -- \
    node -e "
      const crypto = require('@g3zkp/crypto');
      const newKey = crypto.generateKey('$key_type');
      console.log(JSON.stringify({
        type: '$key_type',
        publicKey: newKey.publicKey.toString('base64'),
        keyId: newKey.keyId,
        createdAt: new Date().toISOString()
      }));
    " > /tmp/new_${key_type}_key.json

  # Update secret
  kubectl patch secret g3zkp-keys -n $NAMESPACE --type=merge \
    -p "{\"data\":{\"${key_type}-key\":\"$(base64 /tmp/new_${key_type}_key.json)\"}}"
  
  # Annotate with rotation timestamp
  kubectl annotate secret g3zkp-keys -n $NAMESPACE \
    "last-rotation-$key_type=$(date +%s)" --overwrite
  
  # Trigger rolling restart to pick up new keys
  kubectl rollout restart deployment/g3zkp-messenger -n $NAMESPACE
  
  echo "  ✓ $key_type keys rotated"
}

# Main rotation loop
for key_type in "${KEY_TYPES[@]}"; do
  if check_rotation_due "$key_type"; then
    rotate_key "$key_type"
  else
    echo "  - $key_type: rotation not due"
  fi
done

# Wait for rollout
echo "Waiting for deployment to stabilize..."
kubectl rollout status deployment/g3zkp-messenger -n $NAMESPACE --timeout=300s

# Verify
./scripts/deploy/health-check.sh

echo "=========================================="
echo "Key rotation complete"
echo "=========================================="
```

---

## 4. DATABASE MAINTENANCE

### 4.1 Cleanup Script

**File: `scripts/maintenance/cleanup.sh`**

```bash
#!/bin/bash
set -euo pipefail

# G3ZKP Cleanup Script
# Removes expired messages, old proofs, stale sessions

NAMESPACE="g3zkp"
RETENTION_DAYS="${1:-30}"

echo "=========================================="
echo "G3ZKP Cleanup"
echo "Retention: $RETENTION_DAYS days"
echo "=========================================="

# Cleanup expired messages
echo "[1/4] Cleaning expired messages..."
kubectl exec -n $NAMESPACE deploy/g3zkp-messenger -- \
  node -e "
    const storage = require('@g3zkp/storage');
    const cutoff = Date.now() - ($RETENTION_DAYS * 24 * 60 * 60 * 1000);
    storage.deleteMessagesBefore(cutoff).then(count => {
      console.log('Deleted ' + count + ' expired messages');
    });
  "

# Cleanup old ZKP proofs
echo "[2/4] Cleaning old proofs..."
kubectl exec -n $NAMESPACE deploy/g3zkp-messenger -- \
  node -e "
    const storage = require('@g3zkp/storage');
    const cutoff = Date.now() - (7 * 24 * 60 * 60 * 1000); // 7 days for proofs
    storage.deleteProofsBefore(cutoff).then(count => {
      console.log('Deleted ' + count + ' old proofs');
    });
  "

# Cleanup stale sessions
echo "[3/4] Cleaning stale sessions..."
kubectl exec -n $NAMESPACE deploy/g3zkp-messenger -- \
  node -e "
    const crypto = require('@g3zkp/crypto');
    const cutoff = Date.now() - (24 * 60 * 60 * 1000); // 24 hours inactive
    crypto.cleanupStaleSessions(cutoff).then(count => {
      console.log('Cleaned ' + count + ' stale sessions');
    });
  "

# Compact storage
echo "[4/4] Compacting storage..."
kubectl exec -n $NAMESPACE deploy/g3zkp-messenger -- \
  node -e "
    const storage = require('@g3zkp/storage');
    storage.compact().then(stats => {
      console.log('Compacted: freed ' + stats.freedBytes + ' bytes');
    });
  "

echo "=========================================="
echo "Cleanup complete"
echo "=========================================="
```

---

## 5. MONITORING & ALERTS

### 5.1 Prometheus Alerts

```yaml
# prometheus-alerts.yaml
groups:
  - name: g3zkp-alerts
    rules:
      - alert: G3ZKPHighErrorRate
        expr: rate(g3zkp_errors_total[5m]) > 0.1
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: High error rate detected
          
      - alert: G3ZKPHighLatency
        expr: histogram_quantile(0.95, g3zkp_request_duration_seconds_bucket) > 2
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: High latency detected
          
      - alert: G3ZKPProofGenerationSlow
        expr: g3zkp_proof_generation_seconds > 30
        for: 2m
        labels:
          severity: warning
        annotations:
          summary: ZKP proof generation is slow
          
      - alert: G3ZKPLowDiskSpace
        expr: g3zkp_disk_usage_percent > 85
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: Disk space is running low
          
      - alert: G3ZKPSecurityAuditFailed
        expr: g3zkp_security_audit_passed == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: Security audit detected issues
```

### 5.2 Health Monitoring Cron

```yaml
# cronjob-health.yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: g3zkp-health-check
  namespace: g3zkp
spec:
  schedule: "*/5 * * * *"
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: health-check
            image: curlimages/curl:latest
            command:
            - /bin/sh
            - -c
            - |
              curl -sf http://g3zkp-service/health || exit 1
              curl -sf http://g3zkp-service/ready || exit 1
          restartPolicy: OnFailure
```

---

## 6. MAINTENANCE SCHEDULE

```yaml
# Automated maintenance schedule
daily:
  - "02:00 UTC": Incremental backup
  - "03:00 UTC": Cleanup expired data
  - "04:00 UTC": Security scan

weekly:
  - "Sunday 02:00 UTC": Full backup
  - "Sunday 03:00 UTC": Key rotation check
  - "Sunday 04:00 UTC": Performance benchmark

monthly:
  - "1st 02:00 UTC": Certificate renewal check
  - "1st 03:00 UTC": Dependency updates
  - "1st 04:00 UTC": Full security audit
```

---

*Next: Part 11 - Update & Push Protocols*
