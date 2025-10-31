import { SerialPort } from "serialport";

/**
 * config: { port: "/dev/ttyUSB0" or "COM3", baudRate: 9600 }
 * onData: receives incoming strings / objects
 */
export default {
  connect: async (config = {}, onData) => {
    const path = config.port;
    const baudRate = config.baudRate ? Number(config.baudRate) : 9600;
    if (!path) throw new Error("serialHandler: port path required in config.port");

    const port = new SerialPort({ path, baudRate, autoOpen: true });

    port.on("open", () => {
      console.log("Serial port opened:", path);
    });

    port.on("data", (chunk) => {
      const txt = chunk.toString();
      try {
        // try JSON parse if possible
        let parsed;
        try { parsed = JSON.parse(txt); } catch { parsed = txt; }
        onData({ __ts: new Date().toISOString(), data: parsed });
      } catch (e) { console.error("serialHandler ondata err", e); }
    });

    port.on("error", (err) => {
      console.error("Serial port error", err);
    });

    return {
      port,
      close() {
        try { port.close(); } catch (e) {}
      }
    };
  }
};
