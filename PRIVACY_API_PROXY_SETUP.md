# 🔒 Privacy-First External API Proxy Configuration

**CRITICAL SECURITY ISSUE:** Direct external API calls expose operator IP addresses and break privacy guarantees.

## ❌ Current Vulnerability

External services currently accessed directly:
- `https://nominatim.openstreetmap.org` - Geocoding (SearchService, LocationSharingService)
- `https://router.project-osrm.org` - Routing (NavigationService)
- `https://api.tfl.gov.uk` - Transit (TransitService)
- `https://staticmap.openstreetmap.de` - Static maps (LocationSharingService)

**Risk:** Operator IP addresses, locations, and search queries visible to third parties.

## ✅ Solution: Backend Proxy

All external API calls MUST route through messaging-server.js on port 3001.

### Implementation

**1. Add Proxy Endpoints to messaging-server.js:**

```javascript
// Privacy-preserving API proxy endpoints
app.get('/api/proxy/geocode', async (req, res) => {
  const { q, lat, lon } = req.query;
  try {
    const response = await axios.get('https://nominatim.openstreetmap.org/search', {
      params: { q, format: 'json', limit: 10 },
      headers: { 'User-Agent': 'G3ZKP-Server/1.0' }
    });
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: 'Geocoding failed' });
  }
});

app.get('/api/proxy/route', async (req, res) => {
  const { coords, profile } = req.query;
  try {
    const response = await axios.get(
      `https://router.project-osrm.org/route/v1/${profile}/${coords}`,
      { params: { alternatives: true, steps: true, overview: 'full' } }
    );
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: 'Routing failed' });
  }
});

app.get('/api/proxy/transit', async (req, res) => {
  const { endpoint, ...params } = req.query;
  try {
    const response = await axios.get(`https://api.tfl.gov.uk${endpoint}`, { params });
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: 'Transit API failed' });
  }
});
```

**2. Update Frontend Services:**

**SearchService.ts:**
```typescript
const response = await axios.get('http://localhost:3001/api/proxy/geocode', {
  params: { q: query, lat: userLat, lon: userLon },
  signal: this.abortController.signal
});
```

**NavigationService.ts:**
```typescript
const response = await fetch(
  `http://localhost:3001/api/proxy/route?coords=${coords}&profile=${profile}`
);
```

**TransitService.ts:**
```typescript
const url = `http://localhost:3001/api/proxy/transit?endpoint=${endpoint}`;
```

**LocationSharingService.ts:**
```typescript
const response = await axios.get('http://localhost:3001/api/proxy/geocode', {
  params: { lat, lon, format: 'json' }
});
```

## 🔐 Privacy Benefits

✅ **IP Masking:** All requests appear from server, not operator  
✅ **Request Aggregation:** Multiple operators share same server IP  
✅ **Rate Limiting:** Server controls API usage  
✅ **Caching:** Reduce duplicate requests  
✅ **Audit Trail:** Server logs for security monitoring  
✅ **API Key Protection:** Keys stored server-side only  

## 📋 TODO

- [ ] Add proxy endpoints to messaging-server.js
- [ ] Update SearchService to use proxy
- [ ] Update NavigationService to use proxy
- [ ] Update TransitService to use proxy
- [ ] Update LocationSharingService to use proxy
- [ ] Remove all User-Agent headers from frontend
- [ ] Test all navigation and search features
- [ ] Add caching layer to reduce API calls
- [ ] Implement rate limiting on proxy
- [ ] Add fallback for offline/proxy failure

## 🚨 DEPLOYMENT BLOCKER

**This MUST be fixed before production deployment to maintain privacy guarantees.**

Status: IDENTIFIED - REQUIRES IMPLEMENTATION
Priority: CRITICAL
