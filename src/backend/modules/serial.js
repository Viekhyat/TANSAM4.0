import SerialPort from "serialport";
import Readline from "@serialport/parser-readline";
export function createSerialConnection(config) {
  const port = new SerialPort(config.port, { baudRate: Number(config.baudRate) });
  const parser = port.pipe(new Readline({ delimiter: "\n" }));
  return { port, parser };
}
