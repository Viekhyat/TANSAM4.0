# TANSAM 4.0 - Backend Architecture Documentation

## Table of Contents
1. [Overview](#overview)
2. [Architecture Diagram](#architecture-diagram)
3. [Core Components](#core-components)
4. [API Routes Reference](#api-routes-reference)
5. [Data Flow](#data-flow)
6. [Connection Manager](#connection-manager)
7. [Charts Storage](#charts-storage)
8. [Presentation Manager](#presentation-manager)
9. [WebSocket Integration](#websocket-integration)
10. [Module System](#module-system)

---

## Overview

TANSAM 4.0 is a unified multi-protocol data visualization platform with a Node.js backend that supports:
- **Multiple data sources**: SQL, MQTT, HTTP, Serial, Static Snapshots
- **Real-time updates**: WebSocket broadcasting
- **Dynamic charting**: In-memory chart configuration storage
- **Multi-screen presentations**: Python-based window management

**Tech Stack**:
- **Runtime**: Node.js with Express
- **Protocol Support**: WebSocket (ws), HTTP REST
- **Database Connectors**: MySQL, PostgreSQL, SQLite
- **IoT Protocols**: MQTT, Serial (COM ports)
- **Presentation Engine**: Python 3 with platform-specific window managers

**Server Port**: `8085`

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (React + Vite)                 │
│                    http://localhost:5173                    │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTP/WebSocket
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                  Express Server (Port 8085)                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   routes.js  │  │  server.js   │  │ WebSocket    │      │
│  │   (API)      │  │  (HTTP)      │  │  Server      │      │
│  └──────┬───────┘  └──────────────┘  └──────┬───────┘      │
│         │                                     │              │
│         ▼                                     ▼              │
│  ┌──────────────────────────────────────────────────┐       │
│  │          connectionManager.js                    │       │
│  │  • Manages all data source connections           │       │
│  │  • Handles real-time data streaming              │       │
│  │  • Broadcasts updates via WebSocket              │       │
│  └─────────────┬────────────────────────────────────┘       │
│                │                                             │
│       ┌────────┼────────┬────────┬────────┬────────┐        │
│       ▼        ▼        ▼        ▼        ▼        ▼        │
│   ┌─────┐ ┌──────┐ ┌──────┐ ┌────────┐ ┌──────┐ ┌────┐    │
│   │ SQL │ │ MQTT │ │ HTTP │ │ Serial │ │Static│ │ ...│    │
│   └─────┘ └──────┘ └──────┘ └────────┘ └──────┘ └────┘    │
│                                                             │
│  ┌──────────────────────────────────────────────────┐       │
│  │          chartsStorage.js                        │       │
│  │  • In-memory chart configuration storage         │       │
│  │  • CRUD operations for dynamic charts            │       │
│  └──────────────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────────────┘
                         │
                         ▼ (spawn process)
┌─────────────────────────────────────────────────────────────┐
│         presentation_manager.py (Python 3)                  │
│  • Multi-screen detection (xrandr/PowerShell)               │
│  • Browser window positioning (wmctrl/Win32 API)            │
│  • Cross-platform support (Linux/Windows)                   │
└─────────────────────────────────────────────────────────────┘
                         │
                         ▼
              ┌──────────────────────┐
              │  Chrome/Browser      │
              │  Windows on Screens  │
              └──────────────────────┘
```

---

## Core Components

### 1. server.js

**Purpose**: Main entry point for the Express server

**Responsibilities**:
- Initialize Express application
- Set up CORS and body-parser middleware
- Mount API routes at `/api`
- Create HTTP server and WebSocket server
- Provide health check endpoint `/status`

**Code Structure**:
```javascript
import express from "express";
import { WebSocketServer } from "ws";
import routes from "./routes.js";
import connectionManager from "./connectionManager.js";

const app = express();
const PORT = 8085;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Routes
app.use("/api", routes);

// Health check
app.get("/status", (req, res) => 
  res.json({ server: "Unified Multi-Protocol Server", status: "running" })
);

// WebSocket setup
const wss = new WebSocketServer({ server: httpServer });
connectionManager.setWebSocketServer(wss);

// Start server
httpServer.listen(PORT);
```

**Key Features**:
- Single port for both HTTP and WebSocket (8085)
- Real-time bidirectional communication
- Health monitoring endpoint

---

### 2. routes.js

**Purpose**: API endpoint definitions and request handling

**File Size**: ~490 lines
**Route Count**: 20+ endpoints

**Categories**:
1. **Connection Management** (7 routes)
2. **Data Source Operations** (8 routes)
3. **Chart Management** (5 routes)
4. **Presentation Control** (2 routes)

---

### 3. connectionManager.js

**Purpose**: Central hub for managing all data source connections

**File Size**: ~680 lines
**Class**: `ConnectionManager` (singleton)

**Key Responsibilities**:
- Add/remove data source connections
- Manage active connections lifecycle
- Cache data from various sources
- Broadcast real-time updates via WebSocket
- Handle reconnection logic

**Connection Types Supported**:
- SQL (MySQL, PostgreSQL, SQLite)
- MQTT (IoT message broker)
- HTTP (REST APIs, polling)
- Serial (COM ports, USB sensors)
- Static (snapshots/imports)

---

### 4. chartsStorage.js

**Purpose**: In-memory storage for dynamic chart configurations

**File Size**: ~65 lines
**Class**: `ChartsStorage` (singleton)

**Storage Structure**:
```javascript
{
  charts: Map<string, ChartConfig>
  idCounter: number
}
```

**Chart Schema**:
```javascript
{
  id: string,              // Unique identifier
  title: string,           // Chart display name
  type: string,            // line|bar|scatter|pie|etc
  chartType: string,       // Alias for type
  dataSource: object,      // Connection reference
  dimension: string,       // 2d|3d
  xField: string,          // X-axis field name
  yField: string,          // Y-axis field name
  createdAt: ISO8601,      // Creation timestamp
  updatedAt: ISO8601       // Last update timestamp
}
```

---

### 5. presentation_manager.py

**Purpose**: Multi-screen browser window management

**File Size**: ~700 lines
**Language**: Python 3

**Platform Support**:
- ✅ Linux (X11) - wmctrl, xdotool, xrandr
- ✅ Windows 10/11 - PowerShell, Win32 API
- ⚠️ macOS - Basic support

**See**: [WINDOWS_PRESENTATION_LOGIC.md](./WINDOWS_PRESENTATION_LOGIC.md) for details

---

## API Routes Reference

### Connection Management Routes

#### 1. Add Connection
```http
POST /api/add-connection
```

**Request Body**:
```json
{
  "type": "sql|mqtt|http|serial",
  "config": {
    // Type-specific configuration
  }
}
```

**SQL Config Example**:
```json
{
  "type": "sql",
  "config": {
    "name": "Production DB",
    "dbType": "mysql",
    "host": "localhost",
    "port": 3306,
    "user": "root",
    "password": "password",
    "database": "mydb"
  }
}
```

**MQTT Config Example**:
```json
{
  "type": "mqtt",
  "config": {
    "name": "IoT Broker",
    "broker": "mqtt://localhost:1883",
    "topic": "sensors/#",
    "username": "user",
    "password": "pass"
  }
}
```

**HTTP Config Example**:
```json
{
  "type": "http",
  "config": {
    "name": "Weather API",
    "endpoint": "http://api.weather.com/data",
    "method": "GET",
    "pollInterval": 5000
  }
}
```

**Serial Config Example**:
```json
{
  "type": "serial",
  "config": {
    "name": "Arduino Sensor",
    "port": "/dev/ttyUSB0",
    "baudRate": 9600
  }
}
```

**Response**:
```json
{
  "success": true,
  "id": "conn_1234567890_1",
  "type": "sql"
}
```

---

#### 2. Remove Connection
```http
DELETE /api/remove-connection/:id
```

**Parameters**:
- `id`: Connection ID (from add-connection response)

**Response**:
```json
{
  "success": true
}
```

**Effects**:
- Closes active database/MQTT connections
- Stops HTTP polling
- Closes serial ports
- Removes from connection list

---

#### 3. List Connections
```http
GET /api/connections
```

**Response**:
```json
{
  "success": true,
  "connections": [
    {
      "id": "conn_1234567890_1",
      "type": "sql",
      "dbType": "mysql",
      "config": {
        "name": "Production DB"
      },
      "count": 1542,
      "selectedTables": ["users", "orders"]
    }
  ]
}
```

**Fields**:
- `id`: Unique connection identifier
- `type`: Connection type
- `dbType`: Database type (for SQL connections)
- `config.name`: User-friendly name
- `count`: Number of cached data points
- `selectedTables`: Currently selected tables (SQL only)

---

### SQL-Specific Routes

#### 4. Get SQL Tables
```http
GET /api/sql/tables/:id
```

**Response**:
```json
{
  "success": true,
  "tables": ["users", "orders", "products", "inventory"]
}
```

**Use Case**: Populate table selection dropdown

---

#### 5. Select SQL Tables
```http
POST /api/sql/select-tables/:id
```

**Request Body**:
```json
{
  "tables": ["users", "orders"]
}
```

**Response**:
```json
{
  "success": true
}
```

**Effect**: Filters data retrieval to selected tables only

---

#### 6. Preview SQL Table
```http
GET /api/sql/preview/:id?table=users&limit=5
```

**Query Parameters**:
- `table`: Table name
- `limit`: Number of rows (default: 5)

**Response**:
```json
{
  "success": true,
  "rows": [
    { "id": 1, "name": "John", "email": "john@example.com" },
    { "id": 2, "name": "Jane", "email": "jane@example.com" }
  ]
}
```

---

### MQTT-Specific Routes

#### 7. Preview MQTT Data
```http
GET /api/mqtt/preview/:id?topic=sensors/temp&limit=10
```

**Query Parameters**:
- `topic`: MQTT topic to subscribe to
- `limit`: Number of messages (default: 10)

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "topic": "sensors/temp",
      "timestamp": "2024-01-15T10:30:00Z",
      "temperature": 22.5,
      "humidity": 65
    }
  ]
}
```

**Behavior**:
- Subscribes to topic if not already subscribed
- Returns cached messages
- Auto-caches up to 10,000 messages per topic

---

### HTTP-Specific Routes

#### 8. Preview HTTP Data
```http
GET /api/http/preview/:id?endpoint=/api/data&limit=5
```

**Query Parameters**:
- `endpoint`: API endpoint to fetch
- `limit`: Number of cached entries (default: 5)

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "endpoint": "/api/data",
      "timestamp": "2024-01-15T10:30:00Z",
      "value": 42
    }
  ]
}
```

---

#### 9. Receive Sensor Data (POST Endpoint)
```http
POST /api/sensor-data
```

**Purpose**: Receive sensor data from IoT devices

**Request Body**:
```json
{
  "device_id": "sensor_001",
  "temperature": 22.5,
  "humidity": 65,
  "timestamp": "2024-01-15T10:30:00Z"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Data received from sensor_001",
  "stored": true
}
```

**Behavior**:
- Stores data in HTTP connection caches
- Broadcasts update via WebSocket
- Returns 200 even if no HTTP connections exist
- Caches up to 10,000 entries per device

**Use Case**: Direct sensor-to-server communication

---

### Serial-Specific Routes

#### 10. Preview Serial Data
```http
GET /api/serial/preview/:id?limit=20
```

**Query Parameters**:
- `limit`: Number of recent readings (default: 20)

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "timestamp": "2024-01-15T10:30:00Z",
      "raw": "TEMP:22.5,HUM:65",
      "temperature": 22.5,
      "humidity": 65
    }
  ]
}
```

**Parsing Logic**:
- Attempts JSON parsing first
- Falls back to key-value parsing (TEMP:22.5)
- Extracts numeric values from comma-separated data
- Auto-generates field names for positional data

---

### Unified Data Endpoint

#### 11. Get Connection Data
```http
GET /api/data/:id
```

**Purpose**: Universal endpoint to fetch data from any connection type

**Response Structure**:
```json
{
  "success": true,
  "data": [
    {
      "table": "users",
      "rows": [
        { "id": 1, "name": "John" }
      ]
    }
  ]
}
```

**Behavior by Type**:

| Type | Table Name | Rows Content |
|------|------------|--------------|
| SQL | Actual table name | SQL query results |
| MQTT | Topic name | Cached messages |
| HTTP | Endpoint path | Cached responses |
| Serial | "Serial Data" | Parsed serial data |
| Static | Original table name | Snapshot data |

**Special Cases**:
- **SQL**: Returns data from `selectedTables` or all tables
- **MQTT**: Auto-subscribes if not already subscribed
- **HTTP**: Auto-polls if no cache exists
- **Serial**: Returns latest buffered readings

**EDA Integration**: This endpoint is used by the EDA (Exploratory Data Analysis) page

---

### Chart Management Routes

#### 12. List All Charts
```http
GET /api/charts
```

**Response**:
```json
{
  "success": true,
  "charts": [
    {
      "id": "chart_1705315200_1",
      "title": "Temperature Over Time",
      "type": "line",
      "chartType": "line",
      "dataSource": {
        "connectionId": "conn_1234567890_1",
        "table": "sensors/temp"
      },
      "dimension": "2d",
      "xField": "timestamp",
      "yField": "temperature",
      "createdAt": "2024-01-15T10:00:00Z",
      "updatedAt": "2024-01-15T10:00:00Z"
    }
  ]
}
```

---

#### 13. Get Single Chart
```http
GET /api/charts/:id
```

**Parameters**:
- `id`: Chart ID

**Response**:
```json
{
  "success": true,
  "chart": {
    "id": "chart_1705315200_1",
    "title": "Temperature Over Time",
    "type": "line",
    "dataSource": {...},
    "xField": "timestamp",
    "yField": "temperature"
  }
}
```

**Error Response** (404):
```json
{
  "success": false,
  "error": "Chart with ID \"chart_xyz\" not found"
}
```

**Use Case**: Load chart configuration for rendering

---

#### 14. Create Chart
```http
POST /api/charts
```

**Request Body**:
```json
{
  "title": "CPU Usage",
  "type": "line",
  "dataSource": {
    "connectionId": "conn_1234567890_1",
    "table": "system_metrics"
  },
  "xField": "timestamp",
  "yField": "cpu_percent",
  "dimension": "2d"
}
```

**Response**:
```json
{
  "success": true,
  "chart": {...},
  "id": "chart_1705315200_2"
}
```

**ID Generation**: `chart_<timestamp>_<counter>`

---

#### 15. Update Chart
```http
PUT /api/charts/:id
```

**Request Body**:
```json
{
  "title": "CPU Usage (Updated)",
  "yField": "cpu_usage"
}
```

**Response**:
```json
{
  "success": true,
  "chart": {
    "id": "chart_1705315200_2",
    "title": "CPU Usage (Updated)",
    "updatedAt": "2024-01-15T11:00:00Z"
  }
}
```

**Partial Updates**: Only provided fields are updated

---

#### 16. Delete Chart
```http
DELETE /api/charts/:id
```

**Response**:
```json
{
  "success": true
}
```

**Error Response** (404):
```json
{
  "success": false,
  "error": "Chart not found"
}
```

---

### Presentation Management Routes

#### 17. Launch Presentations
```http
POST /api/launch-presentations
```

**Purpose**: Launch browser windows on multiple screens

**Request Body**:
```json
{
  "presentations": [
    {
      "url": "http://localhost:5173/presentation?chartId=chart_123",
      "screen_id": 0,
      "browser": "chrome"
    },
    {
      "url": "http://localhost:5173/presentation?chartId=chart_456",
      "screen_id": 1,
      "browser": "chrome"
    }
  ]
}
```

**Response**:
```json
{
  "success": true,
  "windows": [
    {
      "screen_id": 0,
      "pid": 12345,
      "url": "http://localhost:5173/presentation?chartId=chart_123",
      "split": false
    },
    {
      "screen_id": 1,
      "pid": 12346,
      "url": "http://localhost:5173/presentation?chartId=chart_456",
      "split": false
    }
  ],
  "errors": [],
  "screens": [
    {
      "id": 0,
      "x": 0,
      "y": 0,
      "width": 1920,
      "height": 1080,
      "primary": true,
      "name": "eDP-1-1"
    }
  ]
}
```

**Behavior**:
- Spawns Python child process
- Passes config as JSON argument
- Parses Python script output
- Returns window PIDs and screen info

**Error Handling**:
- Returns 500 if Python script fails
- Returns 500 if output parsing fails
- Includes Python stderr in error response

**See**: [Presentation Manager Documentation](./WINDOWS_PRESENTATION_LOGIC.md)

---

#### 18. Get Available Screens
```http
GET /api/screens
```

**Purpose**: Detect connected displays

**Response**:
```json
{
  "success": true,
  "screens": [
    {
      "id": 0,
      "x": 0,
      "y": 0,
      "width": 1920,
      "height": 1080,
      "primary": true,
      "name": "eDP-1-1"
    },
    {
      "id": 1,
      "x": 1920,
      "y": 0,
      "width": 1920,
      "height": 1080,
      "primary": false,
      "name": "HDMI-1-1"
    }
  ],
  "system": "Linux"
}
```

**Platform Detection**:
- **Linux**: Uses `xrandr`
- **Windows**: Uses PowerShell `EnumDisplayMonitors`
- **macOS**: Basic support only

**Use Case**: Populate screen selection dropdown in UI

---

## Data Flow

### 1. SQL Connection Flow

```
┌─────────┐                ┌──────────────────┐
│ Frontend│                │     Backend      │
│         │                │                  │
│ POST    │───────────────▶│ /api/add-        │
│ add-conn│                │ connection       │
└─────────┘                └────────┬─────────┘
                                    │
                                    ▼
                           ┌────────────────┐
                           │ Connection     │
                           │ Manager        │
                           │ .addConnection │
                           └────────┬───────┘
                                    │
                                    ▼
                           ┌────────────────┐
                           │ modules/sql.js │
                           │ createClient() │
                           └────────┬───────┘
                                    │
                                    ▼
                           ┌────────────────┐
                           │ MySQL/PG       │
                           │ Connection     │
                           │ Pool           │
                           └────────────────┘
```

**Steps**:
1. Frontend sends connection config
2. Backend validates and creates connection
3. SQL module initializes connection pool
4. Connection stored in connectionManager
5. Connection ID returned to frontend

---

### 2. MQTT Real-Time Data Flow

```
┌────────┐        ┌──────────────┐        ┌────────────┐
│ MQTT   │        │ Connection   │        │ WebSocket  │
│ Broker │───────▶│ Manager      │───────▶│ Clients    │
│        │ publish│              │broadcast│ (Frontend) │
└────────┘        └──────┬───────┘        └────────────┘
                         │
                         │ cache
                         ▼
                  ┌──────────────┐
                  │ dataCache    │
                  │ {topic: [...]}
                  └──────────────┘
```

**Flow**:
1. MQTT broker publishes message to topic
2. MQTT client (in connectionManager) receives message
3. Message parsed and cached in `dataCache[topic]`
4. WebSocket broadcast to all connected frontends
5. Frontend updates chart in real-time

**Cache Limit**: 10,000 messages per topic (FIFO)

---

### 3. HTTP Polling Flow

```
┌──────────────┐
│ setInterval  │
│ (pollInterval)
└──────┬───────┘
       │ every N ms
       ▼
┌──────────────┐        ┌────────────┐
│ pollHttp     │───────▶│ fetch()    │
│ Endpoint()   │        │ API call   │
└──────┬───────┘        └────────────┘
       │
       │ response
       ▼
┌──────────────┐
│ dataCache    │
│ {endpoint:[]}│
└──────┬───────┘
       │
       │ broadcast
       ▼
┌──────────────┐
│ WebSocket    │
│ Clients      │
└──────────────┘
```

**Polling Strategy**:
- Default interval: 5000ms
- Configurable per connection
- Auto-starts on connection creation
- Stops on connection removal

---

### 4. Serial Data Parsing Flow

```
┌────────────┐
│ Serial     │
│ Port       │
│ (Arduino)  │
└──────┬─────┘
       │ raw bytes
       ▼
┌──────────────────┐
│ on('data')       │
│ event handler    │
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│ parseNonJson     │
│ SerialLine()     │
│                  │
│ Try:             │
│ 1. JSON.parse()  │
│ 2. KEY:VALUE     │
│ 3. Numeric array │
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│ toReadableSerial │
│ Row()            │
│                  │
│ Add:             │
│ - timestamp      │
│ - flatten nested │
│ - normalize keys │
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│ dataCache        │
│ broadcast()      │
└──────────────────┘
```

**Parsing Examples**:

**JSON Input**:
```
{"temp":22.5,"hum":65}
```
**Output**:
```json
{
  "timestamp": "2024-01-15T10:30:00Z",
  "temp": 22.5,
  "hum": 65,
  "raw": "{\"temp\":22.5,\"hum\":65}"
}
```

**Key-Value Input**:
```
TEMP:22.5,HUM:65
```
**Output**:
```json
{
  "timestamp": "2024-01-15T10:30:00Z",
  "TEMP": 22.5,
  "HUM": 65,
  "raw": "TEMP:22.5,HUM:65"
}
```

**Numeric Array Input**:
```
22.5,65,1013.2
```
**Output**:
```json
{
  "timestamp": "2024-01-15T10:30:00Z",
  "value_0": 22.5,
  "value_1": 65,
  "value_2": 1013.2,
  "raw": "22.5,65,1013.2"
}
```

---

### 5. Chart Creation and Rendering Flow

```
┌──────────┐     POST /api/charts      ┌──────────┐
│ Frontend │──────────────────────────▶│ Backend  │
│          │                            │          │
│ Chart    │                            │ charts   │
│ Builder  │                            │ Storage  │
└────┬─────┘                            └────┬─────┘
     │                                       │
     │          Response: {id}               │
     │◀──────────────────────────────────────┤
     │                                       │
     │      GET /api/charts/:id              │
     ├──────────────────────────────────────▶│
     │                                       │
     │   Response: {chart config}            │
     │◀──────────────────────────────────────┤
     │                                       │
     │      GET /api/data/:connectionId      │
     ├──────────────────────────────────────▶│
     │                                       │
     │   Response: {data rows}               │
     │◀──────────────────────────────────────┤
     │                                       │
     ▼                                       │
┌──────────┐                                 │
│ Recharts │                                 │
│ Render   │                                 │
└──────────┘                                 │
```

**Steps**:
1. User configures chart in Chart Builder UI
2. Frontend POSTs chart config to `/api/charts`
3. Backend stores config in `chartsStorage`
4. Backend returns generated chart ID
5. Frontend navigates to chart view with ID
6. Frontend GETs chart config using ID
7. Frontend GETs data from connection
8. Recharts library renders visualization

---

## Connection Manager

### Class Structure

```javascript
class ConnectionManager {
  constructor() {
    this.connections = [];
    this.idCounter = 1;
    this.wss = null; // WebSocket server
  }
}
```

### Key Methods

#### addConnection(type, config)

**Purpose**: Create and initialize a new data source connection

**Parameters**:
- `type`: string - "sql" | "mqtt" | "http" | "serial"
- `config`: object - Type-specific configuration

**Returns**: Connection object with ID

**Process**:
1. Generate unique connection ID
2. Initialize type-specific client (SQL pool, MQTT client, etc.)
3. Set up data caching structures
4. Configure real-time listeners/polling
5. Store connection in manager
6. Return connection metadata

**Example**:
```javascript
const conn = await connectionManager.addConnection("mqtt", {
  broker: "mqtt://localhost:1883",
  topic: "sensors/#"
});
// Returns: { id: "conn_1234567890_1", type: "mqtt" }
```

---

#### removeConnection(id)

**Purpose**: Clean up and remove a connection

**Process**:
1. Find connection by ID
2. Close database pools / MQTT clients / intervals
3. Remove from connections array
4. Clear cached data

**Side Effects**:
- **SQL**: Closes connection pool
- **MQTT**: Unsubscribes and disconnects client
- **HTTP**: Clears polling interval
- **Serial**: Closes serial port

---

#### broadcastUpdate(connectionId, topic, data)

**Purpose**: Send real-time data updates to WebSocket clients

**Parameters**:
- `connectionId`: string - Connection identifier
- `topic`: string - Topic/table/endpoint name
- `data`: object - New data point

**Message Format**:
```json
{
  "type": "update",
  "id": "conn_1234567890_1",
  "topic": "sensors/temp",
  "rows": {
    "timestamp": "2024-01-15T10:30:00Z",
    "temperature": 22.5
  }
}
```

**Broadcast Logic**:
```javascript
broadcastUpdate(connectionId, topic, data) {
  if (!this.wss) return;
  
  const message = JSON.stringify({
    type: "update",
    id: connectionId,
    topic: topic,
    rows: data
  });
  
  this.wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}
```

**Use Case**: Real-time chart updates without polling

---

#### parseNonJsonSerialLine(text)

**Purpose**: Parse non-JSON serial data into structured format

**Supported Formats**:
1. JSON: `{"temp":22.5}`
2. Key-Value: `TEMP:22.5,HUM:65`
3. Numeric: `22.5,65,1013.2`

**Returns**: Parsed object or `{raw: text}`

---

#### toReadableSerialRow(raw)

**Purpose**: Convert raw serial data to chart-friendly format

**Transformations**:
- Add ISO8601 timestamp
- Flatten nested objects
- Normalize field names
- Extract numeric values
- Preserve raw data for debugging

---

### Data Caching Strategy

**Cache Structure**:
```javascript
connection.dataCache = {
  "topic/table/endpoint": [
    { timestamp: "...", field1: value1, ... },
    { timestamp: "...", field1: value2, ... }
  ]
}
```

**Cache Limits**:
- **MQTT**: 10,000 messages per topic
- **HTTP**: 10,000 entries per endpoint
- **Serial**: 1,000 recent readings
- **SQL**: No caching (query on demand)

**Eviction Policy**: FIFO (First In, First Out)

---

## Charts Storage

### In-Memory Storage

**Why In-Memory?**
- Fast access for real-time dashboards
- No database overhead
- Suitable for temporary chart configurations
- Persists during server runtime

**Limitations**:
- Lost on server restart
- Not suitable for production persistence
- Consider adding file/database persistence for production

---

### CRUD Operations

#### create(chartData)
```javascript
const chart = chartsStorage.create({
  title: "Temperature Trend",
  type: "line",
  dataSource: {
    connectionId: "conn_123",
    table: "sensors"
  },
  xField: "timestamp",
  yField: "temperature"
});
// Returns: Chart object with generated ID
```

#### get(id)
```javascript
const chart = chartsStorage.get("chart_1705315200_1");
// Returns: Chart object or undefined
```

#### getAll()
```javascript
const allCharts = chartsStorage.getAll();
// Returns: Array of all chart objects
```

#### update(id, updates)
```javascript
const updated = chartsStorage.update("chart_123", {
  title: "New Title",
  type: "bar"
});
// Returns: Updated chart object
// Throws: Error if chart not found
```

#### delete(id)
```javascript
const deleted = chartsStorage.delete("chart_123");
// Returns: true if deleted, false if not found
```

---

## Presentation Manager

### Integration with Backend

**Communication Method**: Child Process Spawning

**Flow**:
```javascript
const python = spawn('python3', [
  'presentation_manager.py',
  JSON.stringify(config)
]);

python.stdout.on('data', (data) => {
  output += data.toString();
});

python.on('close', (code) => {
  const result = JSON.parse(output);
  res.json(result);
});
```

---

### Configuration Format

**Input** (to Python):
```json
{
  "presentations": [
    {
      "url": "http://localhost:5173/chart1",
      "screen_id": 0,
      "browser": "chrome"
    }
  ]
}
```

**Output** (from Python):
```json
{
  "success": true,
  "windows": [
    {
      "screen_id": 0,
      "pid": 12345,
      "url": "http://localhost:5173/chart1",
      "split": false
    }
  ],
  "errors": [],
  "screens": [...]
}
```

---

## WebSocket Integration

### Connection Lifecycle

```
┌──────────┐                    ┌──────────┐
│ Frontend │                    │ Backend  │
│          │                    │          │
│ new      │                    │          │
│ WebSocket│─────connect───────▶│ wss.on   │
│          │                    │ ('conn') │
└────┬─────┘                    └────┬─────┘
     │                               │
     │                               │ ws.isAlive = true
     │                               │
     │◀────────ping─────────────────┤
     │                               │
     ├─────────pong────────────────▶│
     │                               │ ws.isAlive = true
     │                               │
     │◀────data broadcast───────────┤
     │  {type:"update",data:...}    │
     │                               │
     │                               │
     │─────disconnect───────────────▶│ ws.on('close')
     │                               │
└─────────────────────────────────────────┘
```

### Heartbeat Mechanism

**Purpose**: Detect and clean up stale connections

**Implementation**:
```javascript
wss.on("connection", (ws) => {
  ws.isAlive = true;
  ws.on("pong", () => { 
    ws.isAlive = true; 
  });
});

// Periodic ping
setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) return ws.terminate();
    ws.isAlive = false;
    ws.ping();
  });
}, 30000); // 30 seconds
```

---

### Message Types

#### 1. Update Message
```json
{
  "type": "update",
  "id": "conn_123",
  "topic": "sensors/temp",
  "rows": {
    "timestamp": "2024-01-15T10:30:00Z",
    "temperature": 22.5
  }
}
```

**Trigger**: New data from MQTT/HTTP/Serial

---

#### 2. Connection Status
```json
{
  "type": "connection",
  "id": "conn_123",
  "status": "connected|disconnected",
  "message": "Optional status message"
}
```

**Trigger**: Connection added/removed

---

## Module System

### modules/sql.js

**Purpose**: SQL database connection management

**Supported Databases**:
- MySQL
- PostgreSQL  
- SQLite

**Key Functions**:
- `createClient(config)` - Create connection pool
- `getTables(client)` - List all tables
- `queryTable(client, table, limit)` - Query table data

---

### modules/mqtt.js

**Purpose**: MQTT broker connection

**Dependencies**: `mqtt` npm package

**Key Functions**:
- `createClient(config)` - Connect to broker
- `subscribe(client, topic)` - Subscribe to topic
- `publish(client, topic, message)` - Publish message

---

### modules/http.js

**Purpose**: HTTP API polling

**Key Functions**:
- `createPolling(config)` - Set up polling interval
- `fetchEndpoint(url)` - Fetch data from endpoint

---

### modules/serial.js

**Purpose**: Serial port communication

**Dependencies**: `serialport` npm package

**Key Functions**:
- `listPorts()` - List available COM ports
- `createConnection(port, baudRate)` - Open serial port
- `setupDataListener(port, callback)` - Listen for data

---

## Error Handling

### API Error Responses

**Standard Format**:
```json
{
  "success": false,
  "error": "Human-readable error message"
}
```

**HTTP Status Codes**:
- `200` - Success
- `400` - Bad Request (invalid input)
- `404` - Not Found (resource doesn't exist)
- `500` - Internal Server Error

---

### Connection Error Handling

**SQL Connection Failure**:
```javascript
try {
  const client = await createSqlClient(config);
} catch (err) {
  throw new Error(`SQL connection failed: ${err.message}`);
}
```

**MQTT Connection Failure**:
```javascript
client.on('error', (err) => {
  console.error(`MQTT error: ${err.message}`);
  // Auto-reconnect handled by mqtt client
});
```

**Serial Port Error**:
```javascript
port.on('error', (err) => {
  console.error(`Serial port error: ${err.message}`);
  // Attempt reconnection after delay
});
```

---

## Performance Considerations

### Memory Management

**Data Caching Limits**:
- Prevents memory leaks
- FIFO eviction when limit reached
- Configurable per connection type

**Example**:
```javascript
if (conn.dataCache[topic].length > 10000) {
  conn.dataCache[topic] = conn.dataCache[topic].slice(-10000);
}
```

---

### WebSocket Broadcasting

**Optimization**: Only broadcast to ready clients
```javascript
wss.clients.forEach((client) => {
  if (client.readyState === WebSocket.OPEN) {
    client.send(message);
  }
});
```

---

### SQL Query Optimization

**Limit Rows**: Always use LIMIT in queries
```javascript
queryTable(client, table, limit = 1000) {
  return client.query(`SELECT * FROM ${table} LIMIT ${limit}`);
}
```

---

## Security Considerations

### Input Validation

**SQL Injection Prevention**:
- Use parameterized queries
- Validate table names against whitelist
- Sanitize user inputs

**MQTT Topic Validation**:
- Validate topic format
- Restrict wildcard subscriptions
- Authenticate broker connections

---

### Environment Variables

**Sensitive Configuration**:
```bash
# .env file
DB_PASSWORD=secret
MQTT_PASSWORD=secret
API_KEY=secret
```

**Load in code**:
```javascript
import dotenv from 'dotenv';
dotenv.config();

const password = process.env.DB_PASSWORD;
```

---

## Deployment

### Production Checklist

- [ ] Enable CORS restrictions
- [ ] Use environment variables for secrets
- [ ] Add request rate limiting
- [ ] Enable HTTPS/WSS
- [ ] Add authentication middleware
- [ ] Persist charts to database
- [ ] Add logging middleware
- [ ] Set up error monitoring
- [ ] Configure process manager (PM2)
- [ ] Add health check endpoint

---

### Docker Deployment

**Dockerfile Example**:
```dockerfile
FROM node:18
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 8085
CMD ["npm", "start"]
```

**docker-compose.yml**:
```yaml
version: '3'
services:
  backend:
    build: ./src/backend
    ports:
      - "8085:8085"
    environment:
      - NODE_ENV=production
    volumes:
      - ./data:/app/data
```

---

## Testing

### API Testing with curl

**Test Connection**:
```bash
curl http://localhost:8085/status
```

**Add SQL Connection**:
```bash
curl -X POST http://localhost:8085/api/add-connection \
  -H "Content-Type: application/json" \
  -d '{
    "type": "sql",
    "config": {
      "dbType": "mysql",
      "host": "localhost",
      "user": "root",
      "password": "password",
      "database": "testdb"
    }
  }'
```

**Create Chart**:
```bash
curl -X POST http://localhost:8085/api/charts \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Chart",
    "type": "line",
    "dataSource": {"connectionId": "conn_123"},
    "xField": "timestamp",
    "yField": "value"
  }'
```

---

## Troubleshooting

### Common Issues

**Issue**: "Connection refused" on port 8085
- **Fix**: Check if server is running: `npm start`

**Issue**: WebSocket not connecting
- **Fix**: Verify WS URL: `ws://localhost:8085`

**Issue**: Charts not updating in real-time
- **Fix**: Check WebSocket connection in browser console
- **Fix**: Verify data is being cached in connectionManager

**Issue**: Python presentation manager fails
- **Fix**: Check Python 3 is installed: `python3 --version`
- **Fix**: Install dependencies: `wmctrl`, `xdotool` (Linux)

---

## Related Documentation

- [Quick Reference Guide](./QUICK_REFERENCE.md)
- [Windows Presentation Logic](./WINDOWS_PRESENTATION_LOGIC.md)
- [Platform Comparison](./PLATFORM_COMPARISON.md)

---

## Appendix: API Summary Table

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/add-connection` | POST | Add data source |
| `/api/remove-connection/:id` | DELETE | Remove connection |
| `/api/connections` | GET | List connections |
| `/api/sql/tables/:id` | GET | Get SQL tables |
| `/api/sql/select-tables/:id` | POST | Select tables |
| `/api/sql/preview/:id` | GET | Preview SQL data |
| `/api/mqtt/preview/:id` | GET | Preview MQTT data |
| `/api/http/preview/:id` | GET | Preview HTTP data |
| `/api/serial/preview/:id` | GET | Preview serial data |
| `/api/sensor-data` | POST | Receive sensor data |
| `/api/data/:id` | GET | Get connection data |
| `/api/charts` | GET | List charts |
| `/api/charts/:id` | GET | Get chart |
| `/api/charts` | POST | Create chart |
| `/api/charts/:id` | PUT | Update chart |
| `/api/charts/:id` | DELETE | Delete chart |
| `/api/launch-presentations` | POST | Launch windows |
| `/api/screens` | GET | Get screens |
| `/status` | GET | Server health |

---

**Version**: 1.0  
**Last Updated**: 2024  
**Maintainer**: TANSAM Team