# spa-seo-gateway Helm chart

K8s 클러스터에 게이트웨이를 배포하는 표준화된 차트.

## 설치

```bash
# 1) admin token + redis url Secret 생성
kubectl create secret generic gateway-secrets \
  --from-literal=admin-token=$(openssl rand -hex 32) \
  --from-literal=redis-url=redis://redis-master:6379

# 2) 차트 설치
helm install seo ./charts/spa-seo-gateway \
  --set gateway.mode=cms \
  --set adminToken.existingSecret=gateway-secrets \
  --set cache.redis.existingSecret=gateway-secrets \
  --set ingress.enabled=true \
  --set ingress.hosts[0].host=seo.example.com

# 또는 values.yaml 파일 사용
helm install seo ./charts/spa-seo-gateway -f my-values.yaml
```

## 주요 옵션

| 키 | 기본 | 설명 |
|--|--|--|
| `gateway.mode` | `render-only` | render-only / proxy / cms / saas |
| `gateway.originUrl` | `""` | 단일 사이트 origin |
| `gateway.poolMin` / `poolMax` | 2 / 8 | 브라우저 풀 크기 |
| `adminToken.existingSecret` | – | Secret 이름 (권장) |
| `cache.redis.enabled` | `true` | Redis 2-tier 캐시 |
| `cache.redis.existingSecret` | – | Redis URL 의 Secret |
| `persistence.enabled` | `true` | cms/saas store 영구화 PVC |
| `dshm.enabled` | `true` | /dev/shm tmpfs (chromium 안정성) |
| `ingress.enabled` | `false` | Ingress 노출 |
| `autoscaling.enabled` | `false` | HPA |
| `serviceMonitor.enabled` | `false` | Prometheus Operator |
| `otel.endpoint` | `""` | OpenTelemetry OTLP endpoint |
| `warmCron.enabled` | `false` | Sitemap 정기 워밍 |

## 권장 설정

### 운영 환경
```yaml
replicaCount: 3
gateway:
  mode: cms
  poolMax: 16
adminToken:
  existingSecret: gateway-secrets
cache:
  redis:
    enabled: true
    existingSecret: gateway-secrets
persistence:
  enabled: true
  size: 5Gi
  storageClass: gp3
dshm:
  enabled: true
  sizeLimit: 2Gi
resources:
  requests:
    cpu: "1"
    memory: 2Gi
  limits:
    cpu: "4"
    memory: 4Gi
autoscaling:
  enabled: true
  minReplicas: 3
  maxReplicas: 20
  targetCPUUtilizationPercentage: 60
serviceMonitor:
  enabled: true
otel:
  endpoint: http://otel-collector:4318
ingress:
  enabled: true
  className: nginx
  hosts:
    - host: seo.your-domain.com
      paths:
        - path: /
          pathType: Prefix
  tls:
    - hosts: [seo.your-domain.com]
      secretName: seo-tls
```

## 업그레이드

```bash
helm upgrade seo ./charts/spa-seo-gateway -f my-values.yaml
```

## 제거

```bash
helm uninstall seo
# PVC 는 별도 삭제
kubectl delete pvc seo-spa-seo-gateway-data
```
