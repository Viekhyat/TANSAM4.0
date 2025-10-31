import axios from "axios";
export function createHttpConnection(config) {
  // Save config or return Axios instance if you want automatic polling
  return axios.create({ baseURL: config.url, timeout: 30000 });
}
