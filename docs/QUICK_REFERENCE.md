# Quick Reference Guide - Presentation Manager

## Table of Contents
1. [Basic Usage](#basic-usage)
2. [Command Reference](#command-reference)
3. [Configuration Examples](#configuration-examples)
4. [Troubleshooting](#troubleshooting)
5. [API Reference](#api-reference)

---

## Basic Usage

### Launch Presentations

**Endpoint**: `POST /api/launch-presentations`

**Request Body**:
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

**Response**:
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

## Command Reference

### Linux Commands

#### Screen Detection
```bash
# List all screens
xrandr --query

# Get screen info
xrandr --query | grep " connected"
```

#### Window Management
```bash
# List all windows
wmctrl -l

# List windows with PID
wmctrl -lp

# Move window
wmctrl -i -r <WINDOW_ID> -e 0,X,Y,WIDTH,HEIGHT

# Maximize window
wmctrl -i -r <WINDOW_ID> -b add,maximized_vert,maximized_horz

# Keep window on top
wmctrl -i -r <WINDOW_ID> -b add,above
```

#### Fallback Tools
```bash
# Get active window
xdotool getactivewindow

# Move window
xdotool windowmove <WINDOW_ID> X Y

# Resize window
xdotool windowsize <WINDOW_ID> WIDTH HEIGHT
```

---

### Windows Commands

#### Screen Detection
```powershell
# List all displays
Get-CimInstance -Namespace root\wmi -ClassName WmiMonitorBasicDisplayParams

# Get display configuration
Get-DisplayResolution
```

#### Window Management
```powershell
# List windows
Get-Process | Where-Object {$_.MainWindowTitle}

# Get foreground window
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class Win32 {
    [DllImport("user32.dll")]
    public static extern IntPtr GetForegroundWindow();
}
"@
[Win32]::GetForegroundWindow()
```

---

## Configuration Examples

### Example 1: Single Presentation on Primary Screen
```json
{
  "presentations": [
    {
      "url": "http://localhost:5173/dashboard",
      "screen_id": 0,
      "browser": "chrome"
    }
  ]
}
```

**Result**: Fullscreen presentation on screen 0

---

### Example 2: Two Presentations Side-by-Side
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

**Result**: Screen 0 split 50/50 (960px each on 1920px screen)

---

### Example 3: Multi-Screen Setup
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

**Result**: 
- Screen 0: chart1 fullscreen
- Screen 1: chart2 and chart3 split 50/50

---

### Example 4: Three Presentations on One Screen
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
    },
    {
      "url": "http://localhost:5173/chart3",
      "screen_id": 0,
      "browser": "chrome"
    }
  ]
}
```

**Result**: Screen 0 split into thirds (640px each on 1920px screen)

---

## Troubleshooting

### Linux

#### Issue: "Could not find window by PID"
**Cause**: Chrome's multi-process architecture
**Status**: Normal - fallback to :ACTIVE: is working
**Fix**: None needed (informational message only)

#### Issue: Windows not positioning correctly
**Solution**:
```bash
# Check if wmctrl is installed
which wmctrl

# Install if missing
sudo apt install wmctrl

# Check if xdotool is installed
which xdotool

# Install if missing
sudo apt install xdotool
```

#### Issue: Windows overlap instead of split
**Solution**:
```bash
# Check window manager compatibility
echo $XDG_CURRENT_DESKTOP

# Test wmctrl
wmctrl -l

# If empty, your WM may not support EWMH
```

#### Issue: Screen detection returns wrong resolution
**Solution**:
```bash
# Verify with xrandr
xrandr --query

# Check primary screen
xrandr --query | grep primary

# Force screen refresh
xrandr --output <DISPLAY> --mode <RESOLUTION>
```

---

### Windows

#### Issue: PowerShell execution blocked
**Solution**:
```powershell
# Check execution policy
Get-ExecutionPolicy

# Set to RemoteSigned (run as Administrator)
Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
```

#### Issue: Wrong window gets positioned
**Cause**: User clicked elsewhere during launch
**Solution**: Wait 1.5s between launches (already implemented)

#### Issue: Window doesn't maximize
**Solution**:
```powershell
# Test Win32 API manually
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class Win32 {
    [DllImport("user32.dll")]
    public static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")]
    public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
}
"@
$hwnd = [Win32]::GetForegroundWindow()
[Win32]::ShowWindow($hwnd, 3)
```

#### Issue: High DPI scaling causes wrong position
**Solution**: Check display scaling settings
```powershell
# Get DPI awareness
Get-ItemProperty "HKCU:\Control Panel\Desktop\WindowMetrics"
```

---

### Common Issues (Both Platforms)

#### Issue: Browser doesn't launch
**Check**:
1. Browser path is correct
2. Browser is installed
3. No firewall blocking

**Debug**:
```bash
# Linux
which google-chrome
which chromium

# Windows
where chrome.exe
where chromium.exe
```

#### Issue: URL not loading
**Check**:
1. URL is accessible (curl/wget)
2. No CORS issues
3. Server is running

**Debug**:
```bash
# Test URL
curl http://localhost:5173/chart1

# Check server
netstat -an | grep 5173
```

---

## API Reference

### POST /api/launch-presentations

Launch browser windows on specified screens.

**Request**:
```typescript
{
  presentations: Array<{
    url: string;           // Required: URL to display
    screen_id: number;     // Required: Target screen (0-based)
    browser: string;       // Optional: "chrome" (default) | "firefox" | "chromium"
  }>
}
```

**Response**:
```typescript
{
  success: boolean;
  windows: Array<{
    screen_id: number;
    pid: number;
    url: string;
    split: boolean;
    split_index?: number;    // If split: true
    split_total?: number;    // If split: true
  }>;
  errors: string[];
  screens: Array<{
    id: number;
    x: number;
    y: number;
    width: number;
    height: number;
    primary: boolean;
    name?: string;           // Linux only
  }>;
}
```

---

### Direct Python Usage

```python
from presentation_manager import launch_presentations

config = {
    "presentations": [
        {
            "url": "http://localhost:5173/chart1",
            "screen_id": 0,
            "browser": "chrome"
        }
    ]
}

result = launch_presentations(config)
print(result)
```

---

## Timing Reference

| Event | Duration | Purpose |
|-------|----------|---------|
| Browser launch wait | 2.5s | Allow Chrome to fully initialize |
| Window state transition | 0.3s | Ensure state changes apply |
| Between window launches | 1.5s | Prevent detection conflicts |
| PowerShell execution | ~200ms | Script compilation overhead (Windows) |
| wmctrl command | ~50ms | Window manipulation (Linux) |

**Total per window**: ~4-5 seconds

**For 3 windows**: ~12-15 seconds

---

## Environment Variables

### Optional Configuration

```bash
# Default browser (if not specified in config)
export TANSAM_BROWSER="chrome"

# Debug mode (verbose logging)
export TANSAM_DEBUG=1

# Custom browser paths
export CHROME_PATH="/usr/bin/google-chrome"
export FIREFOX_PATH="/usr/bin/firefox"
```

---

## Platform-Specific Notes

### Linux
- **X11 Required**: Best compatibility with X11, limited Wayland support
- **Window Managers**: Tested on GNOME, KDE, XFCE, i3
- **Dependencies**: wmctrl, xdotool, xrandr
- **Installation**: `sudo apt install wmctrl xdotool`

### Windows
- **PowerShell Version**: 5.1+ required
- **Execution Policy**: May need to be set to RemoteSigned
- **Administrator**: Not required for window manipulation
- **Versions**: Tested on Windows 10/11

---

## Performance Tips

1. **Close Unnecessary Apps**: Reduce window detection conflicts
2. **Disable Animations**: Faster window positioning
3. **Use Wired Connection**: Faster page loading
4. **Pre-warm Browser**: Launch browser once before presentations
5. **Screen Saver Off**: Prevent screen blanking during presentations

---

## Screen Configuration Examples

### Laptop + External Monitor (Horizontal)
```
Screen 0: 1920x1080 at (0, 0) - Laptop
Screen 1: 1920x1080 at (1920, 0) - External
```

### Laptop + External Monitor (Vertical Stack)
```
Screen 0: 1920x1080 at (0, 0) - Laptop
Screen 1: 1920x1080 at (0, 1080) - External (below)
```

### Three Monitors (Horizontal)
```
Screen 0: 1920x1080 at (0, 0)
Screen 1: 1920x1080 at (1920, 0)
Screen 2: 1920x1080 at (3840, 0)
```

### Mixed Resolution
```
Screen 0: 2560x1440 at (0, 0) - Primary
Screen 1: 1920x1080 at (2560, 180) - Secondary (vertically centered)
```

---

## Testing

### Manual Test Script

```bash
# Linux
python3 src/backend/presentation_manager.py

# Windows
python src\backend\presentation_manager.py
```

**Expected Output**: JSON with detected screens

### Integration Test

```bash
# Start server
npm start

# In another terminal, test launch
curl -X POST http://localhost:8085/api/launch-presentations \
  -H "Content-Type: application/json" \
  -d '{
    "presentations": [
      {
        "url": "http://localhost:5173",
        "screen_id": 0,
        "browser": "chrome"
      }
    ]
  }'
```

---

## Support Matrix

| Feature | Linux | Windows | macOS |
|---------|-------|---------|-------|
| Screen Detection | ✅ | ✅ | ⚠️ Basic |
| Window Positioning | ✅ | ✅ | ❌ |
| Multi-Screen | ✅ | ✅ | ⚠️ Limited |
| Split Windows | ✅ | ✅ | ❌ |
| Chrome | ✅ | ✅ | ✅ |
| Firefox | ✅ | ⚠️ | ✅ |
| Chromium | ✅ | ✅ | ✅ |

**Legend**: ✅ Full Support | ⚠️ Partial Support | ❌ Not Supported

---

## Additional Resources

- [Windows Implementation Details](./WINDOWS_PRESENTATION_LOGIC.md)
- [Platform Comparison](./PLATFORM_COMPARISON.md)
- [Win32 API Documentation](https://docs.microsoft.com/en-us/windows/win32/api/)
- [wmctrl Manual](http://tripie.sweb.cz/utils/wmctrl/)
- [xdotool Documentation](https://github.com/jordansissel/xdotool)

---

## Version History

### v1.0 (Current)
- ✅ Multi-screen support
- ✅ Split-screen presentations
- ✅ Linux (X11) full support
- ✅ Windows full support
- ✅ Before/after window detection
- ✅ Robust error handling

### Future Roadmap
- [ ] Wayland support
- [ ] macOS full support
- [ ] Window title matching
- [ ] Configuration profiles
- [ ] Auto-recovery