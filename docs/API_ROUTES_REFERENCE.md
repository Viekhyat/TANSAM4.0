# API Routes Reference - Complete Guide

## Overview

This document provides comprehensive documentation for all API endpoints in TANSAM 4.0 backend server.

**Base URL**: `http://localhost:8085`  
**API Prefix**: `/api`

---

## Table of Contents

1. [Connection Management](#connection-management)
2. [SQL Operations](#sql-operations)
3. [MQTT Operations](#mqtt-operations)
4. [HTTP Operations](#http-operations)
5. [Serial Operations](#serial-operations)
6. [Data Retrieval](#data-retrieval)
7. [Chart Management](#chart-management)
8. [Presentation Control](#presentation-control)
9. [Health & Status](#health--status)

---

## Connection Management

### Add Connection

**Endpoint**: `POST /api/add-connection`

**Description**: Create a new data source connection

**Request Headers**:
```
Content-Type: application/json
```

#### SQL Connection Example

**Request**:
```json
{
  "type": "sql",
  "config": {
    "name": "Production Database",
    "dbType": "mysql",
    "host": "localhost",
    "port": 3306,
    "user": "admin",
    "password": "secure_password",
    "database": "production_db"
  }
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "id": "conn_1705315200_1",
  "type": "sql"
}
```

**Supported dbType values**:
- `mysql` - MySQL database
- `postgres` - PostgreSQL database
- `sqlite` - SQLite database

---

#### MQTT Connection Example

**Request**:
```json
{
  "type": "mqtt",
  "config": {
    "name": "IoT Sensor Broker",
    "broker": "mqtt://broker.example.com:1883",
    "topic": "sensors/#",
    "username": "mqtt_user",
    "password": "mqtt_password",
    "qos": 1
  }
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "id": "conn_1705315201_2",
  "type": "mqtt"
}
```

**Config Parameters**:
- `broker`: MQTT broker URL (mqtt:// or mqtts://)
- `topic`: Topic to subscribe to (supports wildcards # and +)
- `username`: Optional authentication
- `password`: Optional authentication
- `qos`: Quality of Service (0, 1, or 2)

---

#### HTTP Connection Example

**Request**:
```json
{
  "type": "http",
  "config": {
    "name": "Weather API",
    "endpoint": "https://api.weather.com/v1/current",
    "method": "GET",
    "pollInterval": 5000,
    "headers": {
      "Authorization": "Bearer token123"
    }
  }
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "id": "conn_1705315202_3",
  "type": "http"
}
```

**Config Parameters**:
- `endpoint`: Full URL to poll
- `method`: HTTP method (GET, POST)
- `pollInterval`: Polling interval in milliseconds (default: 5000)
- `headers`: Optional HTTP headers

---

#### Serial Connection Example

**Request**:
```json
{
  "type": "serial",
  "config": {
    "name": "Arduino Temperature Sensor",
    "port": "/dev/ttyUSB0",
    "baudRate": 9600,
    "dataBits": 8,
    "stopBits": 1,
    "parity": "none"
  }
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "id": "conn_1705315203_4",
  "type": "serial"
}
```

**Config Parameters**:
- `port`: Serial port path (/dev/ttyUSB0, COM3, etc.)
- `baudRate`: Baud rate (9600, 115200, etc.)
- `dataBits`: Data bits (5, 6, 7, 8)
- `stopBits`: Stop bits (1, 2)
- `parity`: Parity (none, even, odd, mark, space)

---

#### Static/Snapshot Connection Example

**Request**:
```json
{
  "type": "static",
  "config": {
    "name": "January Sales Data",
    "snapshotData": [
      {
        "table": "sales",
        "rows": [
          {"date": "2024-01-01", "amount": 1500},
          {"date": "2024-01-02", "amount": 2300}
        ]
      }
    ]
  }
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "id": "conn_1705315204_5",
  "type": "static"
}
```

---

**Error Response** (500 Internal Server Error):
```json
{
  "success": false,
  "error": "Failed to connect to database: Connection refused"
}
```

---

### Remove Connection

**Endpoint**: `DELETE /api/remove-connection/:id`

**Description**: Remove and close a connection

**URL Parameters**:
- `id`: Connection ID (from add-connection response)

**Example Request**:
```bash
DELETE /api/remove-connection/conn_1705315200_1
```

**Response** (200 OK):
```json
{
  "success": true
}
```

**Side Effects**:
- Closes database connections
- Disconnects MQTT clients
- Stops HTTP polling
- Closes serial ports
- Removes cached data

---

### List Connections

**Endpoint**: `GET /api/connections`

**Description**: Get all active connections

**Example Request**:
```bash
GET /api/connections
```

**Response** (200 OK):
```json
{
  "success": true,
  "connections": [
    {
      "id": "conn_1705315200_1",
      "type": "sql",
      "dbType": "mysql",
      "config": {
        "name": "Production Database"
      },
      "count": 1542,
      "selectedTables": ["users", "orders", "products"]
    },
    {
      "id": "conn_1705315201_2",
      "type": "mqtt",
      "config": {
        "name": "IoT Sensor Broker"
      },
      "count": 3847,
      "selectedTables": []
    }
  ]
}
```

**Response Fields**:
- `id`: Unique connection identifier
- `type`: Connection type (sql, mqtt, http, serial, static)
- `dbType`: Database type (SQL only)
- `config.name`: User-friendly connection name
- `count`: Number of cached data points
- `selectedTables`: Selected tables (SQL only)

---

## SQL Operations

### Get SQL Tables

**Endpoint**: `GET /api/sql/tables/:id`

**Description**: List all tables in a SQL database

**URL Parameters**:
- `id`: SQL connection ID

**Example Request**:
```bash
GET /api/sql/tables/conn_1705315200_1
```

**Response** (200 OK):
```json
{
  "success": true,
  "tables": [
    "users",
    "orders",
    "products",
    "inventory",
    "customers"
  ]
}
```

**Error Response** (404):
```json
{
  "success": false,
  "error": "Connection not found"
}
```

---

### Select SQL Tables

**Endpoint**: `POST /api/sql/select-tables/:id`

**Description**: Set which tables to query from database

**URL Parameters**:
- `id`: SQL connection ID

**Request Body**:
```json
{
  "tables": ["users", "orders"]
}
```

**Response** (200 OK):
```json
{
  "success": true
}
```

**Effect**: Only selected tables will be returned by `/api/data/:id`

**Error Responses**:
```json
// Not found
{
  "success": false,
  "error": "Connection not found"
}

// Wrong type
{
  "success": false,
  "error": "Not SQL"
}

// Invalid input
{
  "success": false,
  "error": "'tables' must be an array"
}
```

---

### Preview SQL Table

**Endpoint**: `GET /api/sql/preview/:id`

**Description**: Preview data from a specific SQL table

**URL Parameters**:
- `id`: SQL connection ID

**Query Parameters**:
- `table` (required): Table name
- `limit` (optional): Number of rows (default: 5, max: 1000)

**Example Request**:
```bash
GET /api/sql/preview/conn_1705315200_1?table=users&limit=3
```

**Response** (200 OK):
```json
{
  "success": true,
  "rows": [
    {
      "id": 1,
      "name": "John Doe",
      "email": "john@example.com",
      "created_at": "2024-01-01T10:00:00Z"
    },
    {
      "id": 2,
      "name": "Jane Smith",
      "email": "jane@example.com",
      "created_at": "2024-01-02T11:30:00Z"
    },
    {
      "id": 3,
      "name": "Bob Johnson",
      "email": "bob@example.com",
      "created_at": "2024-01-03T09:15:00Z"
    }
  ]
}
```

**Error Response**:
```json
{
  "success": false,
  "error": "Table 'invalid_table' does not exist"
}
```

---

## MQTT Operations

### Preview MQTT Data

**Endpoint**: `GET /api/mqtt/preview/:id`

**Description**: Get recent messages from an MQTT topic

**URL Parameters**:
- `id`: MQTT connection ID

**Query Parameters**:
- `topic` (required): MQTT topic
- `limit` (optional): Number of messages (default: 10, max: 1000)

**Example Request**:
```bash
GET /api/mqtt/preview/conn_1705315201_2?topic=sensors/temperature&limit=5
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": [
    {
      "topic": "sensors/temperature",
      "timestamp": "2024-01-15T10:30:00Z",
      "device_id": "sensor_001",
      "temperature": 22.5,
      "unit": "celsius"
    },
    {
      "topic": "sensors/temperature",
      "timestamp": "2024-01-15T10:30:05Z",
      "device_id": "sensor_001",
      "temperature": 22.7,
      "unit": "celsius"
    }
  ]
}
```

**Behavior**:
- Auto-subscribes to topic if not already subscribed
- Returns cached messages (up to 10,000 per topic)
- Real-time updates via WebSocket

**Error Response**:
```json
{
  "success": false,
  "error": "Topic is required"
}
```

---

## HTTP Operations

### Preview HTTP Data

**Endpoint**: `GET /api/http/preview/:id`

**Description**: Get cached data from HTTP endpoint

**URL Parameters**:
- `id`: HTTP connection ID

**Query Parameters**:
- `endpoint` (required): API endpoint path
- `limit` (optional): Number of cached entries (default: 5)

**Example Request**:
```bash
GET /api/http/preview/conn_1705315202_3?endpoint=/api/weather&limit=3
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": [
    {
      "endpoint": "/api/weather",
      "timestamp": "2024-01-15T10:30:00Z",
      "temperature": 15,
      "humidity": 65,
      "conditions": "Partly Cloudy"
    },
    {
      "endpoint": "/api/weather",
      "timestamp": "2024-01-15T10:35:00Z",
      "temperature": 16,
      "humidity": 63,
      "conditions": "Sunny"
    }
  ]
}
```

---

### Receive Sensor Data

**Endpoint**: `POST /api/sensor-data`

**Description**: Direct endpoint for IoT devices to POST sensor data

**Request Headers**:
```
Content-Type: application/json
```

**Request Body**:
```json
{
  "device_id": "sensor_001",
  "temperature": 22.5,
  "humidity": 65,
  "pressure": 1013.2,
  "timestamp": "2024-01-15T10:30:00Z"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Data received from sensor_001",
  "stored": true
}
```

**Behavior**:
- Stores data in HTTP connection caches
- Broadcasts to WebSocket clients
- Returns 200 even if no connections exist
- Auto-flattens nested JSON objects

**No Connections Response**:
```json
{
  "success": true,
  "message": "Data received but no HTTP connections configured"
}
```

**Error Response** (400):
```json
{
  "success": false,
  "error": "device_id is required"
}
```

---

## Serial Operations

### Preview Serial Data

**Endpoint**: `GET /api/serial/preview/:id`

**Description**: Get recent serial port readings

**URL Parameters**:
- `id`: Serial connection ID

**Query Parameters**:
- `limit` (optional): Number of recent readings (default: 20)

**Example Request**:
```bash
GET /api/serial/preview/conn_1705315203_4?limit=5
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": [
    {
      "timestamp": "2024-01-15T10:30:00.123Z",
      "raw": "TEMP:22.5,HUM:65",
      "TEMP": 22.5,
      "HUM": 65
    },
    {
      "timestamp": "2024-01-15T10:30:01.234Z",
      "raw": "{\"temp\":22.7,\"hum\":64}",
      "temp": 22.7,
      "hum": 64
    },
    {
      "timestamp": "2024-01-15T10:30:02.345Z",
      "raw": "22.8,63,1013.2",
      "value_0": 22.8,
      "value_1": 63,
      "value_2": 1013.2
    }
  ]
}
```

**Parsing Formats Supported**:
1. **JSON**: `{"temp":22.5,"hum":65}`
2. **Key-Value**: `TEMP:22.5,HUM:65`
3. **Comma-Separated**: `22.5,65,1013.2`

**Fields**:
- `timestamp`: ISO 8601 timestamp (auto-generated)
- `raw`: Original serial string
- Additional fields based on parsed data

---

## Data Retrieval

### Get Connection Data

**Endpoint**: `GET /api/data/:id`

**Description**: Universal endpoint to retrieve data from any connection type

**URL Parameters**:
- `id`: Connection ID

**Example Request**:
```bash
GET /api/data/conn_1705315200_1
```

**SQL Response**:
```json
{
  "success": true,
  "data": [
    {
      "table": "users",
      "rows": [
        {"id": 1, "name": "John", "email": "john@example.com"},
        {"id": 2, "name": "Jane", "email": "jane@example.com"}
      ]
    },
    {
      "table": "orders",
      "rows": [
        {"id": 101, "user_id": 1, "total": 99.99},
        {"id": 102, "user_id": 2, "total": 149.99}
      ]
    }
  ]
}
```

**MQTT Response**:
```json
{
  "success": true,
  "data": [
    {
      "table": "sensors/temperature",
      "rows": [
        {"timestamp": "2024-01-15T10:30:00Z", "value": 22.5},
        {"timestamp": "2024-01-15T10:30:05Z", "value": 22.7}
      ]
    },
    {
      "table": "sensors/humidity",
      "rows": [
        {"timestamp": "2024-01-15T10:30:00Z", "value": 65},
        {"timestamp": "2024-01-15T10:30:05Z", "value": 64}
      ]
    }
  ]
}
```

**HTTP Response**:
```json
{
  "success": true,
  "data": [
    {
      "table": "/api/weather",
      "rows": [
        {"timestamp": "2024-01-15T10:30:00Z", "temperature": 15},
        {"timestamp": "2024-01-15T10:35:00Z", "temperature": 16}
      ]
    }
  ]
}
```

**Serial Response**:
```json
{
  "success": true,
  "data": [
    {
      "table": "Serial Data",
      "rows": [
        {"timestamp": "2024-01-15T10:30:00Z", "TEMP": 22.5, "HUM": 65}
      ]
    }
  ]
}
```

**Static/Snapshot Response**:
```json
{
  "success": true,
  "data": [
    {
      "table": "sales",
      "rows": [
        {"date": "2024-01-01", "amount": 1500},
        {"date": "2024-01-02", "amount": 2300}
      ]
    }
  ]
}
```

**Error Response**:
```json
{
  "success": false,
  "error": "Connection not found"
}
```

---

## Chart Management

### List All Charts

**Endpoint**: `GET /api/charts`

**Description**: Get all saved chart configurations

**Example Request**:
```bash
GET /api/charts
```

**Response** (200 OK):
```json
{
  "success": true,
  "charts": [
    {
      "id": "chart_1705315200_1",
      "title": "Temperature Trends",
      "type": "line",
      "chartType": "line",
      "dataSource": {
        "connectionId": "conn_1705315201_2",
        "table": "sensors/temperature"
      },
      "dimension": "2d",
      "xField": "timestamp",
      "yField": "temperature",
      "createdAt": "2024-01-15T10:00:00Z",
      "updatedAt": "2024-01-15T10:00:00Z"
    },
    {
      "id": "chart_1705315201_2",
      "title": "Sales by Region",
      "type": "bar",
      "chartType": "bar",
      "dataSource": {
        "connectionId": "conn_1705315200_1",
        "table": "sales"
      },
      "dimension": "2d",
      "xField": "region",
      "yField": "amount",
      "createdAt": "2024-01-15T11:00:00Z",
      "updatedAt": "2024-01-15T11:00:00Z"
    }
  ]
}
```

---

### Get Single Chart

**Endpoint**: `GET /api/charts/:id`

**Description**: Get a specific chart configuration

**URL Parameters**:
- `id`: Chart ID

**Example Request**:
```bash
GET /api/charts/chart_1705315200_1
```

**Response** (200 OK):
```json
{
  "success": true,
  "chart": {
    "id": "chart_1705315200_1",
    "title": "Temperature Trends",
    "type": "line",
    "chartType": "line",
    "dataSource": {
      "connectionId": "conn_1705315201_2",
      "table": "sensors/temperature"
    },
    "dimension": "2d",
    "xField": "timestamp",
    "yField": "temperature",
    "createdAt": "2024-01-15T10:00:00Z",
    "updatedAt": "2024-01-15T10:00:00Z"
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

---

### Create Chart

**Endpoint**: `POST /api/charts`

**Description**: Create a new chart configuration

**Request Headers**:
```
Content-Type: application/json
```

**Request Body**:
```json
{
  "title": "CPU Usage Over Time",
  "type": "line",
  "dataSource": {
    "connectionId": "conn_1705315203_4",
    "table": "system_metrics"
  },
  "dimension": "2d",
  "xField": "timestamp",
  "yField": "cpu_percent"
}
```

**Chart Types**:
- `line` - Line chart
- `bar` - Bar chart
- `scatter` - Scatter plot
- `pie` - Pie chart
- `area` - Area chart
- `radar` - Radar chart

**Dimensions**:
- `2d` - 2D chart (default)
- `3d` - 3D chart (experimental)

**Response** (200 OK):
```json
{
  "success": true,
  "chart": {
    "id": "chart_1705315203_3",
    "title": "CPU Usage Over Time",
    "type": "line",
    "chartType": "line",
    "dataSource": {
      "connectionId": "conn_1705315203_4",
      "table": "system_metrics"
    },
    "dimension": "2d",
    "xField": "timestamp",
    "yField": "cpu_percent",
    "createdAt": "2024-01-15T12:00:00Z",
    "updatedAt": "2024-01-15T12:00:00Z"
  },
  "id": "chart_1705315203_3"
}
```

**Error Response** (500):
```json
{
  "success": false,
  "error": "Failed to create chart: Invalid configuration"
}
```

---

### Update Chart

**Endpoint**: `PUT /api/charts/:id`

**Description**: Update an existing chart configuration

**URL Parameters**:
- `id`: Chart ID

**Request Body** (partial update):
```json
{
  "title": "CPU Usage (Updated)",
  "type": "area",
  "yField": "cpu_usage_percent"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "chart": {
    "id": "chart_1705315203_3",
    "title": "CPU Usage (Updated)",
    "type": "area",
    "chartType": "area",
    "dataSource": {
      "connectionId": "conn_1705315203_4",
      "table": "system_metrics"
    },
    "dimension": "2d",
    "xField": "timestamp",
    "yField": "cpu_usage_percent",
    "createdAt": "2024-01-15T12:00:00Z",
    "updatedAt": "2024-01-15T12:30:00Z"
  }
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

### Delete Chart

**Endpoint**: `DELETE /api/charts/:id`

**Description**: Delete a chart configuration

**URL Parameters**:
- `id`: Chart ID

**Example Request**:
```bash
DELETE /api/charts/chart_1705315203_3
```

**Response** (200 OK):
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

## Presentation Control

### Launch Presentations

**Endpoint**: `POST /api/launch-presentations`

**Description**: Launch browser windows on multiple screens for presentations

**Request Headers**:
```
Content-Type: application/json
```

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
    },
    {
      "url": "http://localhost:5173/presentation?chartId=chart_789",
      "screen_id": 1,
      "browser": "chrome"
    }
  ]
}
```

**Parameters**:
- `url`: Full URL to display
- `screen_id`: Target screen (0-based index)
- `browser`: Browser to use (chrome, firefox, chromium)

**Response** (200 OK):
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
      "split": true,
      "split_index": 0,
      "split_total": 2
    },
    {
      "screen_id": 1,
      "pid": 12347,
      "url": "http://localhost:5173/presentation?chartId=chart_789",
      "split": true,
      "split_index": 1,
      "split_total": 2
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
  ]
}
```

**Behavior**:
- Multiple presentations on same screen: Split horizontally
- One presentation per screen: Fullscreen/maximized
- Auto-detects and positions windows

**Error Response** (400):
```json
{
  "success": false,
  "error": "presentations array is required"
}
```

**Error Response** (500):
```json
{
  "success": false,
  "error": "Python script failed: wmctrl not found"
}
```

---

### Get Available Screens

**Endpoint**: `GET /api/screens`

**Description**: Detect all connected displays

**Example Request**:
```bash
GET /api/screens
```

**Response** (200 OK):
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
    },
    {
      "id": 2,
      "x": 0,
      "y": 1080,
      "width": 1920,
      "height": 1080,
      "primary": false,
      "name": "DP-1"
    }
  ],
  "system": "Linux"
}
```

**Screen Properties**:
- `id`: Screen identifier (0-based)
- `x`, `y`: Position in virtual desktop
- `width`, `height`: Screen resolution
- `primary`: Whether this is the primary screen
- `name`: Display name (Linux only)
- `system`: Operating system (Linux, Windows, Darwin)

**Error Response** (500):
```json
{
  "success": false,
  "error": "Failed to detect screens: xrandr not found"
}
```

---

## Health & Status

### Server Status

**Endpoint**: `GET /status`

**Description**: Health check endpoint

**Example Request**:
```bash
GET /status
```

**Response** (200 OK):
```json
{
  "server": "Unified Multi-Protocol Server",
  "status": "running"
}
```

**Use Case**: 
- Load balancer health checks
- Monitoring systems
- Uptime verification

---

## WebSocket Integration

### Connection

**WebSocket URL**: `ws://localhost:8085`

**Example** (JavaScript):
```javascript
const ws = new WebSocket('ws://localhost:8085');

ws.onopen = () => {
  console.log('Connected to TANSAM backend');
};

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  console.log('Received:', message);
};

ws.onerror = (error) => {
  console.error('WebSocket error:', error);
};

ws.onclose = () => {
  console.log('Disconnected from TANSAM backend');
};
```

---

### Message Format

**Update Message**:
```json
{
  "type": "update",
  "id": "conn_1705315201_2",
  "topic": "sensors/temperature",
  "rows": {
    "timestamp": "2024-01-15T10:30:00Z",
    "device_id": "sensor_001",
    "temperature": 22.5
  }
}
```

**Message Fields**:
- `type`: Message type ("update")
- `id`: Connection ID that generated the update
- `topic`: Topic/table/endpoint name
- `rows`: New data point

---

## Error Codes & Responses

### HTTP Status Codes

| Code | Meaning | Example |
|------|---------|---------|
| 200 | Success | Operation completed successfully |
| 400 | Bad Request | Invalid input, missing required fields |
| 404 | Not Found | Resource (connection, chart) doesn't exist |
| 500 | Server Error | Database error, Python script failure |

---

### Common Error Messages

**Connection Not Found**:
```json
{
  "success": false,
  "error": "Connection not found"
}
```

**Invalid Input**:
```json
{
  "success": false,
  "error": "'tables' must be an array"
}
```

**Database Error**:
```json
{
  "success": false,
  "error": "Failed to connect to database: Connection refused"
}
```

**Python Script Error**:
```json
{
  "success": false,
  "error": "Python script failed: wmctrl not found"
}
```

---

## Rate Limiting

**Current Status**: No rate limiting implemented

**Recommended for Production**:
```javascript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP'
});

app.use('/api/', limiter);
```

---

## Authentication

**Current Status**: No authentication implemented

**Recommended for Production**:
```javascript
import jwt from 'jsonwebtoken';

const authMiddleware = (req, res, next) => {
  const token = req.headers['authorization'];
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    req.userId = decoded.id;
    next();
  });
};

// Apply to protected routes
app.use('/api/charts', authMiddleware);
```

---

## Best Practices

### Request Guidelines

1. **Always set Content-Type**: `Content-Type: application/json`
2. **Validate input**: Check required fields before sending
3. **Handle errors**: Check `success` field in response
4. **Use proper HTTP methods**: GET for retrieval, POST for creation, etc.
5. **Close connections**: Call remove-connection when done

### Response Handling

```javascript
// Good practice
fetch('/api/charts')
  .then(response => response.json())
  .then(data => {
    if (data.success) {
      // Handle success
      console.log('Charts:', data.charts);
    } else {
      // Handle error
      console.error('Error:', data.error);
    }
  })
  .catch(error => {
    // Handle network errors
    console.error('Network error:', error);
  });
```

### WebSocket Reconnection

```javascript
let ws;
let reconnectInterval = 5000;

function connect() {
  ws = new WebSocket('ws://localhost:8085');
  
  ws.onopen = () => {
    console.log('Connected');
    reconnectInterval = 5000; // Reset
  };
  
  ws.onclose = () => {
    console.log('Disconnected, reconnecting...');
    setTimeout(connect, reconnectInterval);
    reconnectInterval = Math.min(reconnectInterval * 1.5, 30000);
  };
  
  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    handleUpdate(data);
  };
}

connect();
```

---

## Examples

### Complete Workflow: SQL to Chart

```javascript
// 1. Add SQL connection
const connResponse = await fetch('/api/add-connection', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    type: 'sql',
    config: {
      name: 'My Database',
      dbType: 'mysql',
      host: 'localhost',
      user: 'root',
      password: 'password',
      database: 'mydb'
    }
  })
});
const { id: connectionId } = await connResponse.json();

// 2. Get available tables
const tablesResponse = await fetch(`/api/sql/tables/${connectionId}`);
const { tables } = await tablesResponse.json();

// 3. Select specific tables
await fetch(`/api/sql/select-tables/${connectionId}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ tables: ['sales'] })
});

// 4. Create a chart
const chartResponse = await fetch('/api/charts', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    title: 'Sales Over Time',
    type: 'line',
    dataSource: {
      connectionId: connectionId,
      table: 'sales'
    },
    xField: 'date',
    yField: 'amount'
  })
});
const { id: chartId } = await chartResponse.json();

// 5. Get chart data
const dataResponse = await fetch(`/api/data/${connectionId}`);
const { data } = await dataResponse.json();

console.log('Chart created with ID:', chartId);
console.log('Data:', data);
```

---

### Complete Workflow: IoT Sensor to Chart

```javascript
// Backend: Setup HTTP connection to receive sensor data
const connResponse = await fetch('/api/add-connection', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    type: 'http',
    config: {
      name: 'Temperature Sensors',
      endpoint: '/sensor-data/temp_001',
      pollInterval: 5000
    }
  })
});
const { id: connectionId } = await connResponse.json();

// IoT Device: Send sensor data
setInterval(() => {
  fetch('http://localhost:8085/api/sensor-data', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      device_id: 'temp_001',
      temperature: Math.random() * 30 + 10,
      humidity: Math.random() * 40 + 40,
      timestamp: new Date().toISOString()
    })
  });
}, 5000);

// Frontend: Create real-time chart with WebSocket
const ws = new WebSocket('ws://localhost:8085');
ws.onmessage = (event) => {
  const update = JSON.parse(event.data);
  if (update.id === connectionId) {
    updateChart(update.rows);
  }
};
```

---

### Multi-Screen Presentation Launch

```javascript
// 1. Get available screens
const screensResponse = await fetch('/api/screens');
const { screens } = await screensResponse.json();
console.log('Available screens:', screens.length);

// 2. Create charts
const chart1 = await createChart('Temperature', 'line');
const chart2 = await createChart('Humidity', 'bar');
const chart3 = await createChart('Pressure', 'area');

// 3. Launch presentations
const presentations = [
  {
    url: `http://localhost:5173/presentation?chartId=${chart1.id}`,
    screen_id: 0,
    browser: 'chrome'
  },
  {
    url: `http://localhost:5173/presentation?chartId=${chart2.id}`,
    screen_id: 1,
    browser: 'chrome'
  },
  {
    url: `http://localhost:5173/presentation?chartId=${chart3.id}`,
    screen_id: 1,
    browser: 'chrome'
  }
];

const launchResponse = await fetch('/api/launch-presentations', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ presentations })
});

const result = await launchResponse.json();
console.log('Windows launched:', result.windows.length);
console.log('Screen 0: 1 window (fullscreen)');
console.log('Screen 1: 2 windows (split 50/50)');
```

---

## Appendix

### Connection Type Summary

| Type | Use Case | Real-Time | Polling |
|------|----------|-----------|---------|
| **SQL** | Databases | No | On-demand |
| **MQTT** | IoT sensors | Yes | N/A |
| **HTTP** | REST APIs | Via polling | Yes |
| **Serial** | Arduino, sensors | Yes | N/A |
| **Static** | Snapshots | No | N/A |

### Chart Type Summary

| Type | Best For | X-Axis | Y-Axis |
|------|----------|--------|--------|
| **line** | Time series, trends | Continuous | Numeric |
| **bar** | Categorical comparison | Categories | Numeric |
| **scatter** | Correlation, distribution | Numeric | Numeric |
| **pie** | Proportions, percentages | N/A | Numeric |
| **area** | Cumulative trends | Continuous | Numeric |
| **radar** | Multi-variable comparison | N/A | Numeric |

---

## Support & Resources

- [Backend Architecture](./BACKEND_ARCHITECTURE.md)
- [Quick Reference](./QUICK_REFERENCE.md)
- [Presentation Manager](./WINDOWS_PRESENTATION_LOGIC.md)
- [Platform Comparison](./PLATFORM_COMPARISON.md)

---

**Version**: 1.0  
**Last Updated**: 2024  
**API Version**: v1  
**Base URL**: `http://localhost:8085`