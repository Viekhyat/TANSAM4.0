#!/usr/bin/env python3
"""
Presentation Manager - Handles multi-screen window management for presentations
Launches browser windows on specific screens with precise positioning
"""

import subprocess
import sys
import json
import time
import os
import platform
from typing import List, Dict, Optional

class ScreenManager:
    """Manages screen detection and window positioning"""
    
    def __init__(self):
        self.system = platform.system()
        self.screens = self._detect_screens()
    
    def _detect_screens(self) -> List[Dict]:
        """Detect available screens based on OS"""
        if self.system == "Linux":
            return self._detect_screens_linux()
        elif self.system == "Darwin":  # macOS
            return self._detect_screens_macos()
        elif self.system == "Windows":
            return self._detect_screens_windows()
        return []
    
    def _detect_screens_linux(self) -> List[Dict]:
        """Detect screens on Linux using xrandr"""
        try:
            result = subprocess.run(['xrandr', '--query'], capture_output=True, text=True)
            screens = []
            screen_id = 0
            
            for line in result.stdout.split('\n'):
                # Look for connected displays
                if ' connected' in line:
                    parts = line.split()
                    if len(parts) >= 2:
                        display_name = parts[0]
                        is_primary = 'primary' in line
                        
                        # Find the resolution and position info
                        # Format: 1920x1080+0+0 or 1920x1080+1920+0
                        import re
                        match = re.search(r'(\d+)x(\d+)\+(\d+)\+(\d+)', line)
                        
                        if match:
                            width = int(match.group(1))
                            height = int(match.group(2))
                            x = int(match.group(3))
                            y = int(match.group(4))
                            
                            screens.append({
                                'id': screen_id,
                                'x': x,
                                'y': y,
                                'width': width,
                                'height': height,
                                'primary': is_primary,
                                'name': display_name
                            })
                            screen_id += 1
            
            return screens if screens else [{'id': 0, 'x': 0, 'y': 0, 'width': 1920, 'height': 1080, 'primary': True}]
        except Exception as e:
            return [{'id': 0, 'x': 0, 'y': 0, 'width': 1920, 'height': 1080, 'primary': True}]
    
    def _detect_screens_macos(self) -> List[Dict]:
        """Detect screens on macOS"""
        try:
            result = subprocess.run(['system_profiler', 'SPDisplaysDataType'], capture_output=True, text=True)
            # Simplified detection - returns primary screen
            return [{'id': 0, 'x': 0, 'y': 0, 'width': 1920, 'height': 1080, 'primary': True}]
        except Exception as e:
            print(f"Error detecting macOS screens: {e}")
            return [{'id': 0, 'x': 0, 'y': 0, 'width': 1920, 'height': 1080, 'primary': True}]
    
    def _detect_screens_windows(self) -> List[Dict]:
        """Detect screens on Windows"""
        try:
            import tkinter as tk
            root = tk.Tk()
            root.update_idletasks()
            
            screens = []
            screen_id = 0
            
            # Get primary screen
            screens.append({
                'id': screen_id,
                'x': 0,
                'y': 0,
                'width': root.winfo_screenwidth(),
                'height': root.winfo_screenheight(),
                'primary': True
            })
            
            root.destroy()
            return screens
        except Exception as e:
            print(f"Error detecting Windows screens: {e}")
            return [{'id': 0, 'x': 0, 'y': 0, 'width': 1920, 'height': 1080, 'primary': True}]
    
    def get_screens(self) -> List[Dict]:
        """Get list of available screens"""
        return self.screens
    
    def launch_presentation_window(self, url: str, screen_id: int, browser: str = "chrome") -> Optional[int]:
        """
        Launch a browser window on a specific screen
        
        Args:
            url: URL to open
            screen_id: Screen ID to launch on
            browser: Browser to use (chrome, firefox, chromium)
        
        Returns:
            Process ID if successful, None otherwise
        """
        # If requested screen doesn't exist, fall back to primary screen
        if screen_id >= len(self.screens):
            screen_id = 0
        
        screen = self.screens[screen_id]
        
        try:
            if self.system == "Linux":
                return self._launch_linux(url, screen, browser)
            elif self.system == "Darwin":
                return self._launch_macos(url, screen, browser)
            elif self.system == "Windows":
                return self._launch_windows(url, screen, browser)
        except Exception as e:
            print(f"Error launching presentation window: {e}")
            return None
    
    def launch_presentation_window_at_position(self, url: str, x: int, y: int, width: int, height: int, browser: str = "chrome") -> Optional[int]:
        """
        Launch a browser window at a specific position and size
        
        Args:
            url: URL to open
            x: X position
            y: Y position
            width: Window width
            height: Window height
            browser: Browser to use (chrome, firefox, chromium)
        
        Returns:
            Process ID if successful, None otherwise
        """
        try:
            if self.system == "Linux":
                return self._launch_linux_at_position(url, x, y, width, height, browser)
            elif self.system == "Darwin":
                return self._launch_macos(url, {"x": x, "y": y, "width": width, "height": height}, browser)
            elif self.system == "Windows":
                return self._launch_windows_at_position(url, x, y, width, height, browser)
        except Exception as e:
            print(f"Error launching presentation window at position: {e}")
            return None
    
    def _launch_linux(self, url: str, screen: Dict, browser: str) -> Optional[int]:
        """Launch browser on Linux"""
        browser_cmd = self._get_browser_command(browser)
        
        # Launch window with position and size
        cmd = [
            browser_cmd,
            f"--new-window",
            f"--window-position={screen['x']},{screen['y']}",
            f"--window-size={screen['width']},{screen['height']}",
            url
        ]
        
        process = subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        time.sleep(1.5)  # Give window time to open
        
        # Try to maximize window on the target screen using wmctrl
        try:
            # First, move the window to exact position
            subprocess.run([
                'wmctrl', '-r', ':ACTIVE:',
                '-e', f'0,{screen["x"]},{screen["y"]},{screen["width"]},{screen["height"]}'
            ], timeout=2)
            
            # Then maximize it
            time.sleep(0.3)
            subprocess.run([
                'wmctrl', '-r', ':ACTIVE:',
                '-b', 'add,maximized_vert,maximized_horz'
            ], timeout=2)
        except Exception as e:
            print(f"wmctrl positioning attempt: {e}", file=sys.stderr)
        
        return process.pid
    
    def _launch_macos(self, url: str, screen: Dict, browser: str) -> Optional[int]:
        """Launch browser on macOS"""
        browser_cmd = self._get_browser_command(browser)
        
        cmd = [
            browser_cmd,
            "--new-window",
            url
        ]
        
        process = subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        return process.pid
    
    def _launch_windows(self, url: str, screen: Dict, browser: str) -> Optional[int]:
        """Launch browser on Windows"""
        browser_cmd = self._get_browser_command(browser)
        
        cmd = [
            browser_cmd,
            f"--new-window",
            f"--window-position={screen['x']},{screen['y']}",
            f"--window-size={screen['width']},{screen['height']}",
            f"--start-fullscreen",
            url
        ]
        
        process = subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        return process.pid
    
    def _launch_linux_at_position(self, url: str, x: int, y: int, width: int, height: int, browser: str) -> Optional[int]:
        """Launch browser on Linux at specific position"""
        browser_cmd = self._get_browser_command(browser)
        
        cmd = [
            browser_cmd,
            f"--new-window",
            f"--window-position={x},{y}",
            f"--window-size={width},{height}",
            url
        ]
        
        process = subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        time.sleep(1.0)
        
        # Try to position window using wmctrl
        try:
            subprocess.run([
                'wmctrl', '-r', ':ACTIVE:',
                '-b', 'remove,maximized_vert,maximized_horz',
                '-e', f'0,{x},{y},{width},{height}'
            ], timeout=2)
        except Exception as e:
            print(f"wmctrl positioning attempt: {e}", file=sys.stderr)
        
        return process.pid
    
    def _launch_windows_at_position(self, url: str, x: int, y: int, width: int, height: int, browser: str) -> Optional[int]:
        """Launch browser on Windows at specific position"""
        browser_cmd = self._get_browser_command(browser)
        
        cmd = [
            browser_cmd,
            f"--new-window",
            f"--window-position={x},{y}",
            f"--window-size={width},{height}",
            url
        ]
        
        process = subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        return process.pid
    
    def _get_browser_command(self, browser: str) -> str:
        """Get browser command based on OS and browser type"""
        if self.system == "Linux":
            if browser.lower() in ["chrome", "chromium"]:
                return "google-chrome" if self._command_exists("google-chrome") else "chromium"
            elif browser.lower() == "firefox":
                return "firefox"
        elif self.system == "Darwin":
            if browser.lower() in ["chrome", "chromium"]:
                return "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
            elif browser.lower() == "firefox":
                return "/Applications/Firefox.app/Contents/MacOS/firefox"
        elif self.system == "Windows":
            if browser.lower() in ["chrome", "chromium"]:
                return "chrome.exe"
            elif browser.lower() == "firefox":
                return "firefox.exe"
        
        return "google-chrome"  # Default fallback
    
    def _command_exists(self, command: str) -> bool:
        """Check if command exists in PATH"""
        try:
            subprocess.run(['which', command], capture_output=True, check=True)
            return True
        except:
            return False


def launch_presentations(config: Dict) -> Dict:
    """
    Launch presentation windows based on configuration
    
    Args:
        config: {
            'presentations': [
                {
                    'url': 'http://localhost:5173/presentation-window?...',
                    'screen_id': 0,  # Optional, will auto-distribute if not specified
                    'browser': 'chrome'
                },
                ...
            ]
        }
    
    Returns:
        {
            'success': bool,
            'windows': [{'screen_id': int, 'pid': int, 'url': str}, ...],
            'errors': [str, ...]
        }
    """
    import random
    
    manager = ScreenManager()
    result = {
        'success': True,
        'windows': [],
        'errors': [],
        'screens': manager.get_screens()
    }
    
    presentations = config.get('presentations', [])
    num_presentations = len(presentations)
    num_screens = len(manager.screens)
    
    if num_presentations == 0:
        result['errors'].append("No presentations to launch")
        result['success'] = False
        return result
    
    # Strategy: Smart distribution based on presentations vs screens
    if num_presentations <= num_screens:
        # One presentation per screen - distribute normally
        for index, presentation in enumerate(presentations):
            url = presentation.get('url')
            browser = presentation.get('browser', 'chrome')
            
            if not url:
                result['errors'].append("Missing URL in presentation config")
                result['success'] = False
                continue
            
            target_screen_id = index % num_screens
            
            pid = manager.launch_presentation_window(url, target_screen_id, browser)
            
            if pid:
                result['windows'].append({
                    'screen_id': target_screen_id,
                    'pid': pid,
                    'url': url
                })
            else:
                result['errors'].append(f"Failed to launch window {index + 1} on screen {target_screen_id}")
                result['success'] = False
                
            # Add delay between launches
            time.sleep(0.5)
    else:
        # More presentations than screens
        # Calculate how many presentations go on each screen
        presentations_per_screen = {}
        remaining = num_presentations
        
        # First, try to fit one per screen
        for screen_id in range(num_screens):
            if remaining > 0:
                presentations_per_screen[screen_id] = 1
                remaining -= 1
        
        # Then distribute remaining presentations
        while remaining > 0:
            # Pick a random screen to add an extra presentation
            screen_id = random.randint(0, num_screens - 1)
            presentations_per_screen[screen_id] = presentations_per_screen.get(screen_id, 0) + 1
            remaining -= 1
        
        # Now launch presentations according to the distribution
        presentation_index = 0
        for screen_id in sorted(presentations_per_screen.keys()):
            count = presentations_per_screen[screen_id]
            screen = manager.screens[screen_id]
            
            if count == 1:
                # Single presentation - fullscreen
                presentation = presentations[presentation_index]
                url = presentation.get('url')
                browser = presentation.get('browser', 'chrome')
                
                if not url:
                    result['errors'].append("Missing URL in presentation config")
                    result['success'] = False
                    presentation_index += 1
                    continue
                
                pid = manager.launch_presentation_window(url, screen_id, browser)
                
                if pid:
                    result['windows'].append({
                        'screen_id': screen_id,
                        'pid': pid,
                        'url': url,
                        'split': False
                    })
                else:
                    result['errors'].append(f"Failed to launch window on screen {screen_id}")
                    result['success'] = False
                
                presentation_index += 1
            else:
                # Multiple presentations - split the screen
                window_width = screen['width'] // count
                
                for i in range(count):
                    presentation = presentations[presentation_index]
                    url = presentation.get('url')
                    browser = presentation.get('browser', 'chrome')
                    
                    if not url:
                        result['errors'].append("Missing URL in presentation config")
                        result['success'] = False
                        presentation_index += 1
                        continue
                    
                    x_pos = screen['x'] + (i * window_width)
                    y_pos = screen['y']
                    
                    pid = manager.launch_presentation_window_at_position(
                        url, x_pos, y_pos, window_width, screen['height'], browser
                    )
                    
                    if pid:
                        result['windows'].append({
                            'screen_id': screen_id,
                            'pid': pid,
                            'url': url,
                            'split': True,
                            'split_index': i,
                            'split_total': count
                        })
                    else:
                        result['errors'].append(f"Failed to launch window {presentation_index + 1}")
                        result['success'] = False
                    
                    presentation_index += 1
                    time.sleep(0.5)
    
    return result


if __name__ == "__main__":
    if len(sys.argv) > 1:
        try:
            config = json.loads(sys.argv[1])
            result = launch_presentations(config)
            print(json.dumps(result))
        except json.JSONDecodeError as e:
            print(json.dumps({
                'success': False,
                'errors': [f"Invalid JSON: {str(e)}"],
                'windows': []
            }))
    else:
        # Test mode
        manager = ScreenManager()
        print(json.dumps({
            'screens': manager.get_screens(),
            'system': manager.system
        }, indent=2))