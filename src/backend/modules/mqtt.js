import mqtt from "mqtt";
export function createMqttConnection(config) {
  console.log("🔌 Creating MQTT connection with config:", {
    brokerUrl: config.brokerUrl,
    topic: config.topic,
    hasOptions: !!config.options
  });
  
  // Validate and fix broker URL
  let brokerUrl = config.brokerUrl;
  if (!brokerUrl) {
    throw new Error("Broker URL is required");
  }
  
  // Ensure URL has a protocol
  if (!brokerUrl.match(/^(mqtt|ws|wss|tcp):\/\//)) {
    console.warn("⚠️ Broker URL missing protocol, defaulting to mqtt://");
    brokerUrl = "mqtt://" + brokerUrl;
  }
  
  console.log("🔌 Using broker URL:", brokerUrl);
  
  const options = config.options || {};
  // Add default options if needed
  if (!options.clientId) {
    options.clientId = `mqtt-client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
  
  // For WebSocket connections, set protocol properly
  if (brokerUrl.startsWith('ws://') || brokerUrl.startsWith('wss://')) {
    options.protocol = brokerUrl.startsWith('wss://') ? 'wss' : 'ws';
    // Extract host and port from WebSocket URL
    const urlMatch = brokerUrl.match(/^(wss?):\/\/([^:\/]+)(?::(\d+))?(?:\/.*)?$/);
    if (urlMatch) {
      options.host = urlMatch[2];
      if (urlMatch[3]) {
        options.port = parseInt(urlMatch[3]);
      }
    }
  }
  
  console.log("🔌 Connection options:", { clientId: options.clientId, protocol: options.protocol, host: options.host, port: options.port });
  
  const client = mqtt.connect(brokerUrl, options);
  
  client.on('connect', (packet) => {
    console.log("✅ MQTT client connected successfully", packet);
  });
  
  client.on('error', (err) => {
    console.error("❌ MQTT client error:", err.message);
    console.error("   Broker URL was:", brokerUrl);
    console.error("   Full error:", err);
  });
  
  client.on('offline', () => {
    console.warn("⚠️ MQTT client went offline");
  });
  
  client.on('reconnect', () => {
    console.log("🔄 MQTT client reconnecting...");
  });
  
  client.on('close', () => {
    console.log("🔌 MQTT client connection closed");
  });
  
  return client;
}
