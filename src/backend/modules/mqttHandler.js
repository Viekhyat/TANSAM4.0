// modules/mqtt.js
import mqtt from "mqtt";

/**
 * Connects to an MQTT broker, subscribes to a topic, and processes messages as JSON.
 * @param {Object} config - Connection config { brokerUrl, port?, topic, username?, password? }
 * @param {Function} onData - Callback invoked with parsed JSON message data
 * @returns {Object} - { client, close() }
 */
export default {
  connect: async (config = {}, onData) => {
    let brokerUrl = config.brokerUrl || "wss://test.mosquitto.org";
    if (config.port && !brokerUrl.match(/:\d+/)) brokerUrl += `:${config.port}`;
    const topic = config.topic || "#";

    const options = {};
    if (config.username) options.username = config.username;
    if (config.password) options.password = config.password;

    const client = mqtt.connect(brokerUrl, options);

    client.on("connect", () => {
      console.log(`Connected to MQTT broker at ${brokerUrl}`);
      client.subscribe(topic, { qos: 0 }, (err) => {
        if (err) {
          console.error("Subscription error:", err);
        } else {
          console.log(`Subscribed to topic: ${topic}`);
        }
      });
    });

    client.on("message", (t, payload) => {
      console.log("Received message:", t, payload.toString());

      let parsed;
      try {
        parsed = JSON.parse(payload.toString());
      } catch {
        parsed = { raw: payload.toString() };
      }

      const row = { __ts: new Date().toISOString(), topic: t, payload: parsed };

      // Pass the JSON-ready object to onData callback
      try {
        onData(row);
      } catch (e) {
        console.error("Error in onData callback:", e);
      }
    });

    client.on("error", (e) => {
      console.error("MQTT client error:", e);
    });

    return {
      client,
      close() {
        try {
          client.end(true);
          console.log("MQTT client connection closed");
        } catch (e) {
          console.error("Error closing connection:", e);
        }
      },
    };
  },
};
