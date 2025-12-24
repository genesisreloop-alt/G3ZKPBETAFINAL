# G3ZKP Implementation Plan - Part 13
## Emergency Procedures

---

## 1. INCIDENT SEVERITY LEVELS

| Level | Name | Description | Response Time | Examples |
|-------|------|-------------|---------------|----------|
| SEV-1 | Critical | Complete service outage | 15 min | All nodes down, data breach |
| SEV-2 | High | Major feature broken | 30 min | Messages not delivering, auth failing |
| SEV-3 | Medium | Degraded performance | 2 hours | High latency, partial failures |
| SEV-4 | Low | Minor issues | 24 hours | UI bugs, non-critical errors |

---

## 2. INCIDENT RESPONSE PROCEDURE

### 2.1 Incident Declaration

```bash
#!/bin/bash
# scripts/emergency/declare-incident.sh

SEVERITY="${1:?Usage: ./declare-incident.sh <severity> <description>}"
DESCRIPTION="${2:?Description required}"
TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)
INCIDENT_ID="INC-$(date +%Y%m%d%H%M%S)"

echo "=========================================="
echo "INCIDENT DECLARED"
echo "ID: $INCIDENT_ID"
echo "Severity: $SEVERITY"
echo "Time: $TIMESTAMP"
echo "Description: $DESCRIPTION"
echo "=========================================="

# Create incident record
cat > /tmp/incident_$INCIDENT_ID.json << EOF
{
  "id": "$INCIDENT_ID",
  "severity": "$SEVERITY",
  "status": "open",
  "declared_at": "$TIMESTAMP",
  "description": "$DESCRIPTION",
  "commander": "$(whoami)",
  "timeline": []
}
EOF

# Notify team
curl -X POST "$SLACK_WEBHOOK_URL" -H 'Content-type: application/json' \
  -d "{\"text\":\"🚨 INCIDENT $INCIDENT_ID ($SEVERITY)\\n$DESCRIPTION\"}"

# Page on-call for SEV-1/SEV-2
if [[ "$SEVERITY" =~ ^(SEV-1|SEV-2)$ ]]; then
  curl -X POST "https://events.pagerduty.com/v2/enqueue" \
    -H 'Content-Type: application/json' \
    -d "{
      \"routing_key\": \"$PAGERDUTY_KEY\",
      \"event_action\": \"trigger\",
      \"payload\": {
        \"summary\": \"$INCIDENT_ID: $DESCRIPTION\",
        \"severity\": \"critical\",
        \"source\": \"g3zkp-ops\"
      }
    }"
fi

echo "Incident $INCIDENT_ID created. Begin response procedures."
```

### 2.2 Incident Response Checklist

```markdown
## Immediate Actions (First 15 minutes)

### 1. Assess & Communicate
- [ ] Acknowledge incident in PagerDuty
- [ ] Join incident channel (#incident-{id})
- [ ] Assign Incident Commander (IC)
- [ ] Post initial status update

### 2. Triage
- [ ] Verify the issue is real (not monitoring false positive)
- [ ] Determine blast radius (how many users affected)
- [ ] Identify immediate mitigation options
- [ ] Decide: mitigate vs investigate

### 3. Mitigate
- [ ] Apply immediate fix if available
- [ ] Consider rollback if recent deployment
- [ ] Scale up if load-related
- [ ] Failover to backup if infrastructure issue

### 4. Communicate
- [ ] Update status page
- [ ] Notify stakeholders
- [ ] Set next update time (every 30 min for SEV-1/2)
```

---

## 3. EMERGENCY SCRIPTS

### 3.1 Emergency Shutdown

```bash
#!/bin/bash
# scripts/emergency/emergency-shutdown.sh
# USE ONLY IN CRITICAL SECURITY INCIDENTS

set -euo pipefail

echo "=========================================="
echo "⚠️  EMERGENCY SHUTDOWN INITIATED"
echo "=========================================="

read -p "Type 'CONFIRM SHUTDOWN' to proceed: " confirm
[ "$confirm" = "CONFIRM SHUTDOWN" ] || exit 1

NAMESPACE="g3zkp"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# 1. Save evidence
echo "[1/5] Saving forensic evidence..."
kubectl logs -n $NAMESPACE -l app=g3zkp --all-containers > \
  /var/log/g3zkp/emergency_logs_$TIMESTAMP.txt 2>&1
kubectl get all,events -n $NAMESPACE -o yaml > \
  /var/log/g3zkp/emergency_state_$TIMESTAMP.yaml

# 2. Block external traffic
echo "[2/5] Blocking external traffic..."
kubectl patch svc g3zkp-service -n $NAMESPACE \
  -p '{"spec":{"type":"ClusterIP"}}'

# 3. Scale to zero
echo "[3/5] Scaling down all pods..."
kubectl scale deployment --all -n $NAMESPACE --replicas=0

# 4. Revoke network access
echo "[4/5] Applying network policy..."
kubectl apply -f - << EOF
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: emergency-deny-all
  namespace: $NAMESPACE
spec:
  podSelector: {}
  policyTypes:
  - Ingress
  - Egress
EOF

# 5. Notify
echo "[5/5] Sending notifications..."
curl -X POST "$SLACK_WEBHOOK_URL" -H 'Content-type: application/json' \
  -d '{"text":"🛑 G3ZKP EMERGENCY SHUTDOWN COMPLETE - All services offline"}'

echo "=========================================="
echo "SHUTDOWN COMPLETE"
echo "Evidence saved to /var/log/g3zkp/"
echo "Contact security team immediately"
echo "=========================================="
```

### 3.2 Emergency Rollback

```bash
#!/bin/bash
# scripts/emergency/emergency-rollback.sh

set -euo pipefail

NAMESPACE="g3zkp"
TARGET_REVISION="${1:-}"

echo "=========================================="
echo "⚠️  EMERGENCY ROLLBACK"
echo "=========================================="

# Show current state
echo "Current deployment:"
kubectl get deployment g3zkp-messenger -n $NAMESPACE \
  -o jsonpath='{.spec.template.spec.containers[0].image}'
echo ""

# Show history
echo "Rollout history:"
kubectl rollout history deployment/g3zkp-messenger -n $NAMESPACE

if [ -z "$TARGET_REVISION" ]; then
  echo ""
  echo "Rolling back to previous revision..."
  kubectl rollout undo deployment/g3zkp-messenger -n $NAMESPACE
else
  echo ""
  echo "Rolling back to revision $TARGET_REVISION..."
  kubectl rollout undo deployment/g3zkp-messenger -n $NAMESPACE \
    --to-revision=$TARGET_REVISION
fi

# Wait with timeout
echo "Waiting for rollback (timeout: 5 min)..."
if ! kubectl rollout status deployment/g3zkp-messenger -n $NAMESPACE --timeout=300s; then
  echo "❌ Rollback failed! Manual intervention required."
  exit 1
fi

# Quick health check
sleep 10
if curl -sf http://g3zkp-service.$NAMESPACE/health > /dev/null; then
  echo "✅ Rollback successful - service healthy"
else
  echo "⚠️  Rollback complete but health check failing"
fi

# Notify
curl -X POST "$SLACK_WEBHOOK_URL" -H 'Content-type: application/json' \
  -d '{"text":"🔄 G3ZKP emergency rollback completed"}'
```

### 3.3 Emergency Key Revocation

```bash
#!/bin/bash
# scripts/emergency/revoke-keys.sh
# Use when keys may be compromised

set -euo pipefail

KEY_TYPE="${1:?Usage: ./revoke-keys.sh <identity|signing|encryption|all>}"
NAMESPACE="g3zkp"

echo "=========================================="
echo "⚠️  EMERGENCY KEY REVOCATION"
echo "Key Type: $KEY_TYPE"
echo "=========================================="

read -p "This will invalidate existing sessions. Continue? (yes/no): " confirm
[ "$confirm" = "yes" ] || exit 1

# 1. Generate new keys
echo "[1/4] Generating new keys..."
NEW_KEYS=$(kubectl exec -n $NAMESPACE deploy/g3zkp-messenger -- \
  node -e "
    const crypto = require('@g3zkp/crypto');
    const newKeys = crypto.generateEmergencyKeys('$KEY_TYPE');
    console.log(JSON.stringify(newKeys));
  ")

# 2. Store old keys for investigation
echo "[2/4] Archiving compromised keys..."
kubectl get secret g3zkp-keys -n $NAMESPACE -o yaml > \
  /var/log/g3zkp/revoked_keys_$(date +%s).yaml

# 3. Update secrets with new keys
echo "[3/4] Deploying new keys..."
echo "$NEW_KEYS" | kubectl exec -i -n $NAMESPACE deploy/g3zkp-messenger -- \
  node -e "
    const fs = require('fs');
    const data = JSON.parse(fs.readFileSync('/dev/stdin', 'utf8'));
    require('@g3zkp/crypto').deployEmergencyKeys(data);
  "

# 4. Force restart all pods
echo "[4/4] Restarting all pods..."
kubectl delete pods -n $NAMESPACE -l app=g3zkp --force --grace-period=0

# Wait for recovery
kubectl wait --for=condition=Available deployment/g3zkp-messenger \
  -n $NAMESPACE --timeout=300s

echo "=========================================="
echo "KEY REVOCATION COMPLETE"
echo "All existing sessions have been invalidated"
echo "Users will need to re-authenticate"
echo "=========================================="
```

---

## 4. DISASTER RECOVERY

### 4.1 Full System Recovery

```bash
#!/bin/bash
# scripts/emergency/disaster-recovery.sh

set -euo pipefail

BACKUP_NAME="${1:?Usage: ./disaster-recovery.sh <backup_name>}"
S3_BUCKET="s3://g3zkp-backups"

echo "=========================================="
echo "G3ZKP DISASTER RECOVERY"
echo "Backup: $BACKUP_NAME"
echo "=========================================="

# Verify backup exists
if ! aws s3 ls "$S3_BUCKET/$BACKUP_NAME" > /dev/null 2>&1; then
  echo "❌ Backup not found: $BACKUP_NAME"
  echo "Available backups:"
  aws s3 ls $S3_BUCKET/ --recursive | grep ".tar.gz" | tail -10
  exit 1
fi

read -p "This will REPLACE all current data. Continue? (yes/no): " confirm
[ "$confirm" = "yes" ] || exit 1

echo "[1/7] Downloading backup..."
mkdir -p /tmp/disaster-recovery
aws s3 cp "$S3_BUCKET/$BACKUP_NAME" /tmp/disaster-recovery/ --recursive

echo "[2/7] Verifying backup integrity..."
for file in /tmp/disaster-recovery/*.tar.gz; do
  gzip -t "$file" || { echo "❌ Corrupt file: $file"; exit 1; }
done

echo "[3/7] Creating fresh namespace..."
kubectl delete namespace g3zkp --ignore-not-found
kubectl create namespace g3zkp

echo "[4/7] Applying base configuration..."
kubectl apply -f infrastructure/kubernetes/base/

echo "[5/7] Restoring data volumes..."
# Create PVCs and restore data
kubectl apply -f infrastructure/kubernetes/base/pvc.yaml
kubectl wait --for=condition=Bound pvc/g3zkp-data-pvc -n g3zkp --timeout=120s

# Run restore job
kubectl apply -f - << EOF
apiVersion: batch/v1
kind: Job
metadata:
  name: restore-job
  namespace: g3zkp
spec:
  template:
    spec:
      containers:
      - name: restore
        image: amazon/aws-cli
        command: ["/bin/sh", "-c"]
        args:
        - |
          aws s3 cp $S3_BUCKET/$BACKUP_NAME /restore/ --recursive
          tar xzf /restore/*_ipfs.tar.gz -C /data
          tar xzf /restore/*_keys.tar.gz.enc -C /data
        volumeMounts:
        - name: data
          mountPath: /data
      volumes:
      - name: data
        persistentVolumeClaim:
          claimName: g3zkp-data-pvc
      restartPolicy: Never
EOF

kubectl wait --for=condition=Complete job/restore-job -n g3zkp --timeout=600s

echo "[6/7] Starting services..."
kubectl scale deployment g3zkp-messenger -n g3zkp --replicas=3
kubectl wait --for=condition=Available deployment/g3zkp-messenger \
  -n g3zkp --timeout=300s

echo "[7/7] Verifying recovery..."
./scripts/deploy/health-check.sh

echo "=========================================="
echo "DISASTER RECOVERY COMPLETE"
echo "Please verify all functionality manually"
echo "=========================================="
```

### 4.2 Recovery Verification Checklist

```markdown
## Post-Recovery Verification

### Core Functions
- [ ] Health endpoint responding
- [ ] Users can authenticate
- [ ] Messages can be sent/received
- [ ] ZKP proofs generating/verifying
- [ ] Peer connections establishing

### Data Integrity
- [ ] Message history intact
- [ ] User keys restored
- [ ] Conversations accessible
- [ ] Proofs verifiable

### Security
- [ ] Audit logs intact
- [ ] No unauthorized access during outage
- [ ] Key rotation completed if needed
- [ ] Security scan passed

### Performance
- [ ] Latency within baseline
- [ ] No error rate increase
- [ ] Resource usage normal
```

---

## 5. SECURITY INCIDENT RESPONSE

### 5.1 Security Incident Playbook

```markdown
## SUSPECTED DATA BREACH

### Immediate (0-15 minutes)
1. Page security team
2. DO NOT destroy any evidence
3. Assess scope: What data may be affected?
4. Consider emergency shutdown if active attack

### Short-term (15-60 minutes)
1. Isolate affected systems
2. Capture forensic evidence:
   - System logs
   - Network traffic captures
   - Memory dumps if possible
3. Identify attack vector
4. Block attacker access if identified

### Medium-term (1-24 hours)
1. Full security audit
2. Patch vulnerability
3. Rotate all potentially compromised keys
4. Prepare user notifications if PII affected
5. Engage legal/compliance if required

### Long-term
1. Post-incident review
2. Update security controls
3. Improve monitoring
4. Document lessons learned
```

### 5.2 Compromise Indicators

```yaml
indicators_of_compromise:
  network:
    - Unusual outbound connections
    - High volume of failed auth attempts
    - Connections from blacklisted IPs
    - Unusual port usage
    
  application:
    - Unexpected admin account creation
    - Bulk data access patterns
    - Failed ZKP verifications spike
    - Key access from unexpected sources
    
  system:
    - Unexpected process execution
    - File integrity changes
    - Unusual resource consumption
    - Log gaps or tampering
```

---

## 6. COMMUNICATION TEMPLATES

### 6.1 Status Page Updates

```markdown
## Investigating - [Time]
We are investigating reports of [issue]. More updates to follow.

## Identified - [Time]  
We have identified the cause of [issue]. We are working on a fix.

## Monitoring - [Time]
A fix has been deployed. We are monitoring the situation.

## Resolved - [Time]
The issue has been resolved. [Brief explanation].
Total duration: [X hours Y minutes]
```

### 6.2 User Notification (Data Breach)

```markdown
Subject: Important Security Notice from G3ZKP

Dear User,

We are writing to inform you of a security incident that occurred 
on [DATE]. [Brief factual description of what happened].

**What information was affected:**
[List specific data types]

**What we are doing:**
- [Action 1]
- [Action 2]
- [Action 3]

**What you should do:**
- [Recommendation 1]
- [Recommendation 2]

We take the security of your data seriously and apologize for 
any inconvenience this may cause.

For questions, contact: security@g3zkp.net
```

---

## 7. POST-INCIDENT

### 7.1 Incident Closure

```bash
#!/bin/bash
# scripts/emergency/close-incident.sh

INCIDENT_ID="${1:?Usage: ./close-incident.sh <incident_id>}"

echo "Closing incident $INCIDENT_ID..."

# Update incident record
cat > /tmp/incident_${INCIDENT_ID}_closure.json << EOF
{
  "id": "$INCIDENT_ID",
  "status": "closed",
  "closed_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "closed_by": "$(whoami)",
  "resolution": "See post-mortem document"
}
EOF

# Notify
curl -X POST "$SLACK_WEBHOOK_URL" -H 'Content-type: application/json' \
  -d "{\"text\":\"✅ Incident $INCIDENT_ID has been resolved and closed.\"}"

echo "Incident closed. Schedule post-mortem within 48 hours."
```

### 7.2 Post-Mortem Template

```markdown
# Post-Mortem: [INCIDENT_ID]

## Summary
- **Date**: [DATE]
- **Duration**: [X hours Y minutes]
- **Severity**: [SEV-X]
- **Impact**: [Number of users affected, messages delayed, etc.]

## Timeline
| Time | Event |
|------|-------|
| HH:MM | First alert |
| HH:MM | Incident declared |
| HH:MM | Root cause identified |
| HH:MM | Fix deployed |
| HH:MM | Service restored |

## Root Cause
[Detailed technical explanation]

## Resolution
[What was done to fix the issue]

## Lessons Learned
### What went well
- 

### What could be improved
- 

## Action Items
| Item | Owner | Due Date | Status |
|------|-------|----------|--------|
| | | | |

## Appendix
- Links to logs, metrics, etc.
```

---

## 8. EMERGENCY CONTACTS

```yaml
contacts:
  on_call:
    primary: "+1-XXX-XXX-XXXX"
    pagerduty: "g3zkp-ops"
    
  security:
    email: "security@g3zkp.net"
    phone: "+1-XXX-XXX-XXXX"
    
  infrastructure:
    aws_support: "Premium Support Case"
    cloudflare: "Enterprise Support"
    
  legal:
    email: "legal@g3zkp.net"
    phone: "+1-XXX-XXX-XXXX"
```

---

*End of Implementation Plan Documentation*
