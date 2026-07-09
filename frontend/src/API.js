//NOTE this is a slimmed down version of API.js in spr

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

class API {
  baseURL = ''
  authHeaders = ''

  getAuthHeaders() {
    const { REACT_APP_TOKEN } = process.env
    if (REACT_APP_TOKEN) {
      this.authHeaders = `Bearer ${REACT_APP_TOKEN}`

      return this.authHeaders
    }

    //else get it from localStorage
    let login = localStorage.user
    let user = login ? JSON.parse(login) : null
    this.authHeaders = user?.authdata ? 'Basic ' + user.authdata : null

    return this.authHeaders
  }

  getApiURL() {
    const { REACT_APP_API } = process.env
    const API_URL = REACT_APP_API || window?.SPR_API_URL || ''
    return API_URL
  }

  async fetch(method = 'GET', url, body) {
    if (url === undefined) {
      url = method
      method = 'GET'
    }

    if (!this.authHeaders) {
      this.authHeaders = this.getAuthHeaders()
    }

    let headers = {
      Authorization: this.authHeaders,
      'X-Requested-With': 'react',
      'Content-Type': 'application/json'
    }

    let opts = {
      method,
      headers
    }

    if (body) {
      opts.body = JSON.stringify(body)
    }

    let baseURL = this.getApiURL() + (this.baseURL || '')
    // get rid of //
    if (
      url[0] === '/' &&
      baseURL.length &&
      baseURL[baseURL.length - 1] === '/'
    ) {
      url = url.substr(1)
    }

    let _url = `${baseURL}${url}`
    return fetch(_url, opts)
  }

  async request(method, url, body) {
    if (PREVIEW) {
      return Promise.resolve(previewResponse(method, url))
    }

    let skipReturnValue = method === 'DELETE'

    return this.fetch(method, url, body).then((response) => {
      if (response.redirected) {
        window.location = '/auth/validate'
      }

      if (!response.ok) {
        return Promise.reject({
          message: response.status,
          status: response.status,
          response
        })
      }

      const contentType = response.headers.get('Content-Type')
      if (!contentType || skipReturnValue) {
        return Promise.resolve(true)
      }

      // weird behaviour from react-native
      if (contentType.includes('text/html')) {
        return response.json()
      }

      if (contentType.includes('application/json')) {
        return response.json()
      } else if (contentType.includes('text/plain')) {
        return response.text()
      }

      return Promise.reject({ message: 'unknown Content-Type' })
    })
  }

  get(url) {
    return this.request('GET', url)
  }

  put(url, data) {
    return this.request('PUT', url, data)
  }

  delete(url, data) {
    return this.request('DELETE', url, data)
  }
}

export default API
export const api = new API()
