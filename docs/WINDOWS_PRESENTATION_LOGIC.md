# Windows Presentation Manager Logic Documentation

## Overview

This document explains the Windows-specific implementation of the presentation manager, which mirrors the Linux logic for launching and positioning browser windows across multiple screens.

## Architecture

The Windows implementation uses **PowerShell with Win32 API** calls to control window positioning and state, similar to how Linux uses `wmctrl` and `xdotool`.

## Core Components

### 1. Screen Detection (`_detect_screens_windows`)

**Method**: Uses PowerShell with Win32 `EnumDisplayMonitors` API

```powershell
# Enumerate all displays and get their dimensions
[Display]::EnumDisplayMonitors() -> monitors[]
foreach monitor:
    - X, Y (position)
    - Width, Height (dimensions)
    - Primary (boolean)
```

**Output**: List of screen objects with coordinates and dimensions

### 2. Window Launching

Two main methods handle window launching:

#### A. `_launch_windows()` - Full Screen Launch

**Purpose**: Launch a browser window maximized on a specific screen

**Process**:
1. Launch Chrome/browser with `--new-window` flag
2. Wait 2.5 seconds for window to fully initialize
3. Get foreground window handle via `GetForegroundWindow()`
4. Restore window to normal state (SW_RESTORE = 1)
5. Move and resize window to screen dimensions
6. Maximize window (SW_MAXIMIZE = 3)

**PowerShell Implementation**:
```powershell
# Get window handle
$hwnd = [Win32]::GetForegroundWindow()

# Restore to normal (removes minimize/maximize)
[Win32]::ShowWindow($hwnd, 1)

# Move and resize
[Win32]::MoveWindow($hwnd, x, y, width, height, $true)

# Maximize
[Win32]::ShowWindow($hwnd, 3)
```

**Win32 Constants**:
- `SW_RESTORE = 1` - Restore window to normal state
- `SW_MAXIMIZE = 3` - Maximize window

#### B. `_launch_windows_at_position()` - Split Screen Launch

**Purpose**: Launch a browser window at specific coordinates (for split-screen presentations)

**Process**:
1. Launch Chrome/browser with `--new-window` flag
2. Wait 2.5 seconds for window to initialize
3. Get foreground window handle
4. Restore to normal state
5. Move and resize to exact coordinates
6. Set window to TOPMOST for split-screen visibility

**PowerShell Implementation**:
```powershell
# Get window handle
$hwnd = [Win32]::GetForegroundWindow()

# Restore to normal
[Win32]::ShowWindow($hwnd, 1)

# Move and resize to specific position
[Win32]::MoveWindow($hwnd, x, y, width, height, $true)

# Set as topmost window
[Win32]::SetWindowPos($hwnd, $HWND_TOPMOST, x, y, width, height, $SWP_SHOWWINDOW)
```

**Win32 Constants**:
- `HWND_TOPMOST = -1` - Place window above all non-topmost windows
- `SWP_SHOWWINDOW = 0x0040` - Display the window

## Win32 API Functions Used

### 1. GetForegroundWindow
```c
IntPtr GetForegroundWindow()
```
**Purpose**: Gets the handle of the window that has keyboard focus (newly launched browser)

### 2. MoveWindow
```c
bool MoveWindow(IntPtr hWnd, int X, int Y, int nWidth, int nHeight, bool bRepaint)
```
**Purpose**: Changes position and dimensions of a window

**Parameters**:
- `hWnd`: Window handle
- `X, Y`: New position (top-left corner)
- `nWidth, nHeight`: New dimensions
- `bRepaint`: Whether to repaint (always true)

### 3. ShowWindow
```c
bool ShowWindow(IntPtr hWnd, int nCmdShow)
```
**Purpose**: Sets the window's show state

**Common nCmdShow values**:
- `1 (SW_RESTORE)`: Restore to normal size/position
- `3 (SW_MAXIMIZE)`: Maximize the window
- `9 (SW_RESTORE)`: Activate and display

### 4. SetWindowPos
```c
bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags)
```
**Purpose**: Changes size, position, and Z-order of a window

**Parameters**:
- `hWndInsertAfter`: Placement order handle (HWND_TOPMOST for always on top)
- `uFlags`: Window positioning flags

## Comparison: Linux vs Windows

| Feature | Linux | Windows |
|---------|-------|---------|
| **Window Detection** | `wmctrl -l` (compare before/after) | `GetForegroundWindow()` |
| **Window Positioning** | `wmctrl -i -r <id> -e` | `MoveWindow()` |
| **Maximize** | `wmctrl -b add,maximized_vert,maximized_horz` | `ShowWindow(3)` |
| **Keep on Top** | `wmctrl -b add,above` | `SetWindowPos(HWND_TOPMOST)` |
| **Language** | Bash/Shell | PowerShell + C# |

## Flow Diagram

### Single Screen Presentation
```
1. Launch Browser
   ↓
2. Wait 2.5s
   ↓
3. Get Foreground Window Handle
   ↓
4. Restore Window (SW_RESTORE)
   ↓
5. Move & Resize to Screen Dimensions
   ↓
6. Maximize Window (SW_MAXIMIZE)
   ↓
7. Return PID
```

### Split Screen Presentation
```
1. Launch Browser
   ↓
2. Wait 2.5s
   ↓
3. Get Foreground Window Handle
   ↓
4. Restore Window (SW_RESTORE)
   ↓
5. Move & Resize to Specific Coordinates
   ↓
6. Set as TOPMOST Window
   ↓
7. Return PID
```

## Launch Presentations Logic

The main `launch_presentations()` function is **platform-agnostic** and works identically on Windows and Linux:

### Algorithm

1. **Group by screen_id**: Group presentations by their target screen
2. **Iterate by screen**: For each screen with presentations:
   - **If 1 presentation**: Launch fullscreen/maximized
   - **If multiple presentations**: Split screen horizontally

### Example: 3 Presentations, 2 Screens

**Input**:
```json
{
  "presentations": [
    {"url": "chart1", "screen_id": 0},
    {"url": "chart2", "screen_id": 1},
    {"url": "chart3", "screen_id": 1}
  ]
}
```

**Grouping**:
- Screen 0: [chart1] → 1 presentation → Fullscreen
- Screen 1: [chart2, chart3] → 2 presentations → Split 50/50

**Execution**:
```
Screen 0 (1920x1080):
├─ chart1: _launch_windows(url, screen[0])
   → Fullscreen at (0, 0, 1920, 1080)

Screen 1 (1920x1080 at x=1920):
├─ chart2: _launch_windows_at_position(url, 1920, 0, 960, 1080)
├─ chart3: _launch_windows_at_position(url, 2880, 0, 960, 1080)
   → Split: Left half (1920-2880), Right half (2880-3840)
```

## Timing and Delays

| Action | Delay | Reason |
|--------|-------|--------|
| After browser launch | 2.5s | Chrome initialization time |
| Between ShowWindow operations | 300ms | Window state transition |
| Between MoveWindow and ShowWindow | 300ms | Ensure position is applied |
| Between window launches | 1.5s | Prevent window detection conflicts |

## Error Handling

```python
try:
    # PowerShell window manipulation
    subprocess.run(["powershell", "-Command", script], timeout=5)
except Exception as e:
    print(f"Windows positioning error: {e}", file=sys.stderr)
    # Continue anyway - browser is launched, just not positioned
```

**Philosophy**: Even if positioning fails, the browser window is created. Better to have an incorrectly positioned window than no window at all.

## Limitations and Notes

### 1. Foreground Window Assumption
- Uses `GetForegroundWindow()` which assumes the newly launched browser becomes the active window
- If user clicks elsewhere during the 2.5s wait, wrong window might be targeted
- **Solution**: 1.5s delay between launches to prevent overlapping operations

### 2. Chrome Multi-Process Architecture
- Chrome spawns multiple processes; the PID returned is the parent process
- Cannot reliably match PID to window handle
- **Solution**: Use foreground window assumption instead of PID matching

### 3. Browser Support
- Tested with Chrome/Chromium
- Firefox may have different behavior
- Edge (Chromium-based) should work similarly

## Testing

### Test Case 1: Single Screen, Single Presentation
```json
{"presentations": [{"url": "http://localhost:5173", "screen_id": 0}]}
```
**Expected**: Fullscreen maximized window on primary screen

### Test Case 2: Single Screen, Multiple Presentations
```json
{
  "presentations": [
    {"url": "chart1", "screen_id": 0},
    {"url": "chart2", "screen_id": 0}
  ]
}
```
**Expected**: Two windows side-by-side, each 960px wide

### Test Case 3: Multiple Screens, Mixed Distribution
```json
{
  "presentations": [
    {"url": "chart1", "screen_id": 0},
    {"url": "chart2", "screen_id": 1},
    {"url": "chart3", "screen_id": 1}
  ]
}
```
**Expected**: 
- Screen 0: chart1 fullscreen
- Screen 1: chart2 and chart3 split 50/50

## Debugging

### PowerShell Testing
Run PowerShell commands manually to test:

```powershell
# List all windows with titles
Get-Process | Where-Object {$_.MainWindowTitle} | Select-Object Id, MainWindowTitle, MainWindowHandle

# Test window manipulation
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class Win32 {
    [DllImport("user32.dll")]
    public static extern IntPtr GetForegroundWindow();
}
"@
$hwnd = [Win32]::GetForegroundWindow()
Write-Host "Current foreground window: $hwnd"
```

### Common Issues

**Issue**: Window positions incorrectly
- **Cause**: User interaction during launch
- **Fix**: Increase delay between launches

**Issue**: Wrong window gets positioned
- **Cause**: Another application stole focus
- **Fix**: Close unnecessary applications before launching

**Issue**: Windows overlap instead of split
- **Cause**: SetWindowPos not called or failed
- **Fix**: Check PowerShell execution policy

## Future Improvements

1. **Window Title Matching**: Match windows by title/URL instead of foreground assumption
2. **Process Tree Analysis**: Find child Chrome process that owns the window
3. **Retry Logic**: Retry positioning if window detection fails
4. **Window List Comparison**: Implement before/after window list comparison (like Linux)

## References

- [Win32 Window Functions](https://docs.microsoft.com/en-us/windows/win32/api/winuser/)
- [ShowWindow Constants](https://docs.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-showwindow)
- [PowerShell P/Invoke Examples](https://docs.microsoft.com/en-us/powershell/scripting/samples/sample-scripts-for-administration)