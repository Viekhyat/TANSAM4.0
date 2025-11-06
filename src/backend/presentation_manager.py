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
        
        # Use wmctrl to position window if available
        cmd = [
            browser_cmd,
            f"--new-window",
            f"--window-position={screen['x']},{screen['y']}",
            f"--window-size={screen['width']},{screen['height']}",
            f"--start-fullscreen",
            url
        ]
        
        process = subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        time.sleep(1)  # Give window time to open
        
        # Try to move window using wmctrl
        try:
            subprocess.run([
                'wmctrl', '-r', ':ACTIVE:',
                '-b', 'add,maximized_vert,maximized_horz'
            ], timeout=2)
        except:
            pass
        
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
        time.sleep(0.5)
        
        # Try to position window using wmctrl
        try:
            subprocess.run([
                'wmctrl', '-r', ':ACTIVE:',
                '-b', '-maximized_vert,-maximized_horz',
                '-e', f'0,{x},{y},{width},{height}'
            ], timeout=2)
        except:
            pass
        
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
                    'screen_id': 0,
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
    manager = ScreenManager()
    result = {
        'success': True,
        'windows': [],
        'errors': [],
        'screens': manager.get_screens()
    }
    
    presentations = config.get('presentations', [])
    num_presentations = len(presentations)
    
    # If we have more presentations than screens, split the primary screen
    if num_presentations > len(manager.screens):
        primary_screen = manager.screens[0]
        screen_width = primary_screen['width']
        screen_height = primary_screen['height']
        window_width = screen_width // num_presentations
        
        for index, presentation in enumerate(presentations):
            url = presentation.get('url')
            browser = presentation.get('browser', 'chrome')
            
            if not url:
                result['errors'].append("Missing URL in presentation config")
                result['success'] = False
                continue
            
            # Position windows side-by-side
            x_pos = primary_screen['x'] + (index * window_width)
            y_pos = primary_screen['y']
            
            pid = manager.launch_presentation_window_at_position(
                url, x_pos, y_pos, window_width, screen_height, browser
            )
            
            if pid:
                result['windows'].append({
                    'screen_id': index,
                    'pid': pid,
                    'url': url
                })
            else:
                result['errors'].append(f"Failed to launch window {index + 1}")
                result['success'] = False
    else:
        # Original behavior: one presentation per screen
        for presentation in presentations:
            url = presentation.get('url')
            screen_id = presentation.get('screen_id', 0)
            browser = presentation.get('browser', 'chrome')
            
            if not url:
                result['errors'].append("Missing URL in presentation config")
                result['success'] = False
                continue
            
            pid = manager.launch_presentation_window(url, screen_id, browser)
            
            if pid:
                result['windows'].append({
                    'screen_id': screen_id,
                    'pid': pid,
                    'url': url
                })
            else:
                result['errors'].append(f"Failed to launch window on screen {screen_id}")
                result['success'] = False
    
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
