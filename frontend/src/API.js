//NOTE requests go through @spr-networks/plugin-ui's API client; this wrapper
// only adds preview mode on top.

import { API as BaseAPI } from '@spr-networks/plugin-ui'

// Preview mode: when the app is started with REACT_APP_PREVIEW=1, every request
// resolves to canned data so the full UI (node card + peers) can be viewed
// without an SPR backend. This whole block is dead-code-eliminated in the
// production/container build, where REACT_APP_PREVIEW is undefined.
const PREVIEW = process.env.REACT_APP_PREVIEW === '1'

function previewResponse(method, url) {
  const now = Date.now()
  const iso = (msAgo) => new Date(now - msAgo).toISOString()
  if (method === 'GET') {
    if (url.includes('/plugins/spr-tailscale/config')) {
      return JSON.stringify({
        TailscaleAuthKey: 'tskey-auth-kD3xample00CNTRL',
        Peers: [{ IP: '100.101.102.104', Groups: ['tailnet', 'lab'], Policies: ['api'] }]
      })
    }
    if (url.includes('/plugins/spr-tailscale/status')) {
      return JSON.stringify({
        BackendState: 'Running',
        Version: '1.74.1-t0a1b2c3d',
        Self: {
          HostName: 'spr-router',
          DNSName: 'spr-router.tailnet-a1b2.ts.net.',
          Online: true,
          Relay: 'nyc',
          PublicKey: 'nodekey:abc123def4567890abc123def4567890abc123def4567890',
          TailscaleIPs: ['100.101.102.103', 'fd7a:115c:a1e0::1234'],
          Addrs: ['73.12.44.9:41641', '192.168.2.10:41641'],
          LastHandshake: '0001-01-01T00:00:00Z' // Go zero value — Self never handshakes itself
        }
      })
    }
    if (url.includes('/plugins/spr-tailscale/peers')) {
      return JSON.stringify([
        { HostName: 'alex-macbook', DNSName: 'alex-macbook.tailnet-a1b2.ts.net.', OS: 'macOS', Online: true, TailscaleIPs: ['100.101.102.104'], PublicKey: 'nodekey:aa11223344556677889900aabbccddeeff00112233', LastSeen: iso(30 * 1000), LastHandshake: iso(30 * 1000) },
        { HostName: 'pixel-8', DNSName: 'pixel-8.tailnet-a1b2.ts.net.', OS: 'android', Online: true, TailscaleIPs: ['100.101.102.105'], PublicKey: 'nodekey:bb22334455667788990011aabbccddeeff0011223344', LastSeen: iso(5 * 60 * 1000), LastHandshake: iso(5 * 60 * 1000) },
        { HostName: 'office-nas', DNSName: 'office-nas.tailnet-a1b2.ts.net.', OS: 'linux', Online: false, TailscaleIPs: ['100.101.102.106'], PublicKey: 'nodekey:cc33445566778899001122aabbccddeeff0011223355', LastSeen: iso(3 * 3600 * 1000), LastHandshake: '0001-01-01T00:00:00Z' }
      ])
    }
    if (url.includes('/info/dockernetworks')) {
      return [{ Options: { 'com.docker.network.bridge.name': 'spr-tailscale' }, IPAM: { Config: [{ Subnet: '100.64.10.0/24' }] } }]
    }
  }
  return true // all mutations succeed in preview
}

class API extends BaseAPI {
  async request(method, url, body) {
    if (PREVIEW) {
      return Promise.resolve(previewResponse(method, url))
    }
    return super.request(method, url, body)
  }
}

export default API
export const api = new API()
