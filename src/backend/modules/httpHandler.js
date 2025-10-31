import axios from "axios";

/**
 * config: { url, method, headers, body, pollIntervalMs (optional), extractPath (optional) }
 * onData receives array/object
 */
export default {
  connect: async (config = {}, onData) => {
    const url = config.url;
    const method = (config.method || "GET").toUpperCase();
    const pollInterval = config.pollIntervalMs ? Number(config.pollIntervalMs) : 0;

    async function fetchOnce() {
      try {
        const resp = await axios({ url, method, headers: config.headers || {}, data: config.body || null, timeout: 8000 });
        let payload = resp.data;
        if (config.extractPath) {
          const parts = config.extractPath.split(".").filter(Boolean);
          for (const p of parts) {
            if (payload == null) break;
            payload = payload[p];
          }
        }
        const rows = Array.isArray(payload) ? payload : [payload];
        onData(rows.map(r => ({ __ts: new Date().toISOString(), ...r })));
      } catch (err) {
        console.error("httpHandler fetch error", err.message || err);
      }
    }

    // initial fetch
    await fetchOnce();

    let timer = null;
    if (pollInterval > 0) {
      timer = setInterval(fetchOnce, pollInterval);
    }

    return {
      stop() {
        if (timer) clearInterval(timer);
      }
    };
  }
};
