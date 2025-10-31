import mqtt from "mqtt";
export function createMqttConnection(config) {
  return mqtt.connect(config.brokerUrl, config.options || {});
}
