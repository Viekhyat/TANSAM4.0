import { SerialPort, ReadlineParser } from "serialport";

export function createSerialConnection(config) {
  try {
    const port = new SerialPort({
      path: config.port,
      baudRate: Number(config.baudRate)
    });
    // Use LF as delimiter; CR (from CRLF) will be trimmed in handler
    const parser = port.pipe(new ReadlineParser({ delimiter: "\n" }));
    
    // Add error handling
    port.on('error', (err) => {
      console.error(`❌ Serial port error (${config.port}):`, err.message);
    });
    
    port.on('open', () => {
      console.log(`✅ Serial port opened: ${config.port} at ${config.baudRate} baud`);
    });
    
    // Optional: low-level byte logging for diagnostics (single line preview)
    // Uncomment if needed to debug devices that don't send newlines
    // port.on('data', (buf) => {
    //   console.log(`🔎 Serial bytes (${buf.length}):`, buf.toString('utf8'));
    // });
    
    return { port, parser };
  } catch (err) {
    console.error(`❌ Failed to create serial connection to ${config.port}:`, err.message);
    throw err;
  }
}
