# TANSAM 4.0 Documentation

Welcome to the TANSAM 4.0 documentation. This folder contains comprehensive guides for the presentation manager system.

## Documentation Files

### 📘 [Quick Reference Guide](./QUICK_REFERENCE.md)
**Start here!** A concise guide covering:
- Basic usage and API endpoints
- Command reference (Linux & Windows)
- Configuration examples
- Troubleshooting common issues
- Performance tips

**Best for**: Getting started quickly, daily operations, and quick lookups.

---

### 🪟 [Windows Presentation Logic](./WINDOWS_PRESENTATION_LOGIC.md)
Deep dive into Windows implementation:
- Win32 API usage and PowerShell integration
- Screen detection with `EnumDisplayMonitors`
- Window manipulation with `MoveWindow`, `ShowWindow`, `SetWindowPos`
- Complete flow diagrams
- Testing and debugging strategies

**Best for**: Understanding Windows-specific implementation, debugging Windows issues, extending Windows functionality.

---

### 🔄 [Platform Comparison](./PLATFORM_COMPARISON.md)
Side-by-side comparison of Linux vs Windows:
- Window detection methods
- Positioning strategies
- State management differences
- Performance metrics
- Complete code examples

**Best for**: Understanding cross-platform differences, porting code, choosing implementation strategies.

---

## Quick Start

### 1. Launch a Single Presentation

```bash
curl -X POST http://localhost:8085/api/launch-presentations \
  -H "Content-Type: application/json" \
  -d '{
    "presentations": [
      {
        "url": "http://localhost:5173/dashboard",
        "screen_id": 0,
        "browser": "chrome"
      }
    ]
  }'
```

### 2. Split Screen Setup (2 Charts on One Screen)

```json
{
  "presentations": [
    {
      "url": "http://localhost:5173/chart1",
      "screen_id": 0,
      "browser": "chrome"
    },
    {
      "url": "http://localhost:5173/chart2",
      "screen_id": 0,
      "browser": "chrome"
    }
  ]
}
```

Result: Screen 0 split 50/50 horizontally

### 3. Multi-Screen Setup

```json
{
  "presentations": [
    {
      "url": "http://localhost:5173/chart1",
      "screen_id": 0,
      "browser": "chrome"
    },
    {
      "url": "http://localhost:5173/chart2",
      "screen_id": 1,
      "browser": "chrome"
    },
    {
      "url": "http://localhost:5173/chart3",
      "screen_id": 1,
      "browser": "chrome"
    }
  ]
}
```

Result:
- Screen 0: Chart 1 fullscreen
- Screen 1: Charts 2 & 3 split 50/50

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                  Node.js Server (8085)                  │
│  POST /api/launch-presentations                         │
└────────────────────┬────────────────────────────────────┘
                     │
                     ├─ JSON Config
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│           presentation_manager.py (Python)              │
│                                                         │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │   Screen    │  │   Window     │  │   Launch     │  │
│  │  Detection  │→ │  Positioning │→ │ Coordination │  │
│  └─────────────┘  └──────────────┘  └──────────────┘  │
└────────────────────┬────────────────────────────────────┘
                     │
        ┌────────────┴────────────┐
        │                         │
        ▼                         ▼
┌───────────────┐         ┌───────────────┐
│     LINUX     │         │    WINDOWS    │
│               │         │               │
│  • wmctrl     │         │  • PowerShell │
│  • xdotool    │         │  • Win32 API  │
│  • xrandr     │         │  • user32.dll │
└───────────────┘         └───────────────┘
        │                         │
        └────────────┬────────────┘
                     │
                     ▼
             ┌──────────────┐
             │   Chrome/    │
             │   Browser    │
             │   Windows    │
             └──────────────┘
```

---

## Platform Support

| Platform | Status | Notes |
|----------|--------|-------|
| **Linux (X11)** | ✅ Full Support | Requires wmctrl, xdotool |
| **Windows 10/11** | ✅ Full Support | PowerShell 5.1+ |
| **Linux (Wayland)** | ⚠️ Limited | Window positioning may not work |
| **macOS** | ⚠️ Basic | Screen detection only |

---

## Key Features

### ✅ Multi-Screen Support
Automatically detects all connected displays and can launch presentations on any screen.

### ✅ Smart Window Splitting
When multiple presentations target the same screen, automatically splits the screen horizontally.

### ✅ Screen Distribution Logic
Respects `screen_id` configuration - you control which presentations go on which screen.

### ✅ Robust Window Detection
- **Linux**: Before/after window list comparison
- **Windows**: Foreground window detection with timing safeguards

### ✅ Fallback Mechanisms
- **Linux**: wmctrl → xdotool fallback
- **Windows**: Graceful degradation if positioning fails

### ✅ Browser Agnostic
Supports Chrome, Chromium, Firefox, and other browsers.

---

## Common Scenarios

### Scenario 1: Control Room (3 Screens, 6 Charts)
```
Screen 0: Charts 1 & 2 (split)
Screen 1: Charts 3 & 4 (split)
Screen 2: Charts 5 & 6 (split)
```

### Scenario 2: Conference Room (1 Projector, 3 Presentations)
```
Screen 0: Presentations 1, 2, 3 (split into thirds)
```

### Scenario 3: Trading Floor (2 Screens, 1 Main Dashboard + 2 Detail Views)
```
Screen 0: Main Dashboard (fullscreen)
Screen 1: Detail View 1 & 2 (split)
```

---

## Troubleshooting Quick Links

### Linux Issues
- [Window not positioning](./QUICK_REFERENCE.md#issue-windows-not-positioning-correctly)
- [wmctrl not found](./QUICK_REFERENCE.md#issue-windows-not-positioning-correctly)
- [Wrong screen resolution](./QUICK_REFERENCE.md#issue-screen-detection-returns-wrong-resolution)

### Windows Issues
- [PowerShell blocked](./QUICK_REFERENCE.md#issue-powershell-execution-blocked)
- [Wrong window positioned](./QUICK_REFERENCE.md#issue-wrong-window-gets-positioned)
- [High DPI problems](./QUICK_REFERENCE.md#issue-high-dpi-scaling-causes-wrong-position)

### Common Issues
- [Browser doesn't launch](./QUICK_REFERENCE.md#issue-browser-doesnt-launch)
- [URL not loading](./QUICK_REFERENCE.md#issue-url-not-loading)

---

## Development

### Project Structure
```
src/backend/
├── presentation_manager.py    # Main implementation
│   ├── ScreenManager          # Screen detection & window launching
│   ├── launch_presentations   # Distribution logic
│   └── Platform-specific methods:
│       ├── _launch_linux()
│       ├── _launch_windows()
│       ├── _launch_linux_at_position()
│       └── _launch_windows_at_position()
```

### Testing
```bash
# Test screen detection
python3 src/backend/presentation_manager.py

# Test with Node server
npm start

# Launch test presentation
curl -X POST http://localhost:8085/api/launch-presentations \
  -H "Content-Type: application/json" \
  -d @test-config.json
```

---

## Performance

| Metric | Value | Notes |
|--------|-------|-------|
| Time per window | 4-5s | Includes browser launch + positioning |
| Screen detection | <100ms | Cached after first detection |
| Window positioning | 200-400ms | Platform-dependent |
| Max simultaneous windows | 10+ | Limited by screen space |

---

## Dependencies

### Linux
```bash
sudo apt install wmctrl xdotool
# xrandr usually pre-installed
```

### Windows
- PowerShell 5.1+ (built-in)
- .NET Framework (built-in)

### Python
```bash
pip install subprocess platform
# Both are standard library
```

---

## API Response Format

### Success Response
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

### Error Response
```json
{
  "success": false,
  "windows": [],
  "errors": [
    "Failed to launch window on screen 1",
    "Missing URL in presentation config"
  ],
  "screens": [...]
}
```

---

## Contributing

When adding new features or platforms:

1. Update the main `presentation_manager.py` file
2. Add platform-specific methods following naming convention: `_launch_<platform>()`
3. Update documentation in this folder
4. Add test cases
5. Update the Quick Reference guide

---

## Version

**Current Version**: 1.0  
**Last Updated**: 2024  
**Python Version**: 3.6+  
**Node.js Version**: 14+

---

## Related Files

- [Main Presentation Manager](../src/backend/presentation_manager.py)
- [Server Implementation](../src/backend/server.js)
- [Frontend Integration](../src/frontend/)

---

## Support

For issues and questions:
1. Check [Quick Reference](./QUICK_REFERENCE.md) troubleshooting section
2. Review platform-specific docs ([Windows](./WINDOWS_PRESENTATION_LOGIC.md))
3. Check platform comparison for implementation details

---

## License

See project LICENSE file.