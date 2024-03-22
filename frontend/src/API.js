//NOTE this is a slimmed down version of API.js in spr

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
