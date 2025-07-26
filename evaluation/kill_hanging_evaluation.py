#!/usr/bin/env python3
"""
Utility script to safely terminate hanging evaluation processes.
Use this if the evaluation gets stuck and you need to stop it.
"""

import subprocess
import sys
from pathlib import Path

def kill_hanging_processes():
    """Kill hanging Python evaluation processes."""
    
    print("🔍 Looking for hanging Python evaluation processes...")
    
    try:
        # Get all Python processes
        if sys.platform == "win32":
            # Windows
            result = subprocess.run([
                "powershell", "-Command",
                "Get-Process python -ErrorAction SilentlyContinue | Where-Object { $_.Path -like '*evaluation*' -or $_.CommandLine -like '*evaluation*' } | Format-Table Id,ProcessName,CPU -AutoSize"
            ], capture_output=True, text=True, timeout=10)
            
            if result.returncode == 0 and result.stdout.strip():
                print("📋 Found Python processes:")
                print(result.stdout)
                
                # Ask for confirmation
                response = input("\n⚠️  Do you want to terminate these processes? (y/N): ").strip().lower()
                if response == 'y':
                    # Kill processes
                    kill_result = subprocess.run([
                        "powershell", "-Command",
                        "Get-Process python -ErrorAction SilentlyContinue | Where-Object { $_.Path -like '*evaluation*' -or $_.CommandLine -like '*evaluation*' } | Stop-Process -Force"
                    ], capture_output=True, text=True, timeout=10)
                    
                    if kill_result.returncode == 0:
                        print("✅ Processes terminated successfully")
                    else:
                        print(f"❌ Failed to terminate processes: {kill_result.stderr}")
                else:
                    print("🚫 Process termination cancelled")
            else:
                print("✅ No hanging evaluation processes found")
                
        else:
            # Unix/Linux/Mac
            result = subprocess.run([
                "ps", "aux"
            ], capture_output=True, text=True, timeout=10)
            
            if result.returncode == 0:
                lines = result.stdout.split('\n')
                python_processes = [line for line in lines if 'python' in line and 'evaluation' in line]
                
                if python_processes:
                    print("📋 Found Python evaluation processes:")
                    for proc in python_processes:
                        print(f"   {proc}")
                    
                    response = input("\n⚠️  Do you want to terminate these processes? (y/N): ").strip().lower()
                    if response == 'y':
                        for proc in python_processes:
                            parts = proc.split()
                            if len(parts) > 1:
                                pid = parts[1]
                                try:
                                    subprocess.run(["kill", "-9", pid], timeout=5)
                                    print(f"✅ Terminated process {pid}")
                                except:
                                    print(f"❌ Failed to terminate process {pid}")
                    else:
                        print("🚫 Process termination cancelled")
                else:
                    print("✅ No hanging evaluation processes found")
                    
    except subprocess.TimeoutExpired:
        print("❌ Command timed out")
    except Exception as e:
        print(f"❌ Error: {e}")

def show_process_usage():
    """Show current process and memory usage."""
    
    print("\n💻 Current System Usage:")
    try:
        if sys.platform == "win32":
            # Windows - show Python processes and memory usage
            result = subprocess.run([
                "powershell", "-Command",
                "Get-Process python -ErrorAction SilentlyContinue | Select-Object Id,ProcessName,@{Name='CPU(s)';Expression={$_.CPU}},@{Name='Memory(MB)';Expression={[math]::Round($_.WorkingSet/1MB,2)}} | Format-Table -AutoSize"
            ], capture_output=True, text=True, timeout=10)
            
            if result.returncode == 0:
                print(result.stdout)
            else:
                print("No Python processes found")
                
        else:
            # Unix/Linux/Mac
            result = subprocess.run([
                "ps", "-eo", "pid,ppid,cmd,%mem,%cpu", "--sort=-%mem"
            ], capture_output=True, text=True, timeout=10)
            
            if result.returncode == 0:
                lines = result.stdout.split('\n')
                python_lines = [lines[0]] + [line for line in lines[1:] if 'python' in line]
                for line in python_lines[:10]:  # Show top 10
                    print(line)
                    
    except Exception as e:
        print(f"❌ Error getting process info: {e}")

if __name__ == "__main__":
    print("🚨 Hanging Evaluation Process Killer")
    print("=" * 40)
    
    show_process_usage()
    kill_hanging_processes()
    
    print("\n💡 Tips to avoid hangs:")
    print("   1. Use concurrent mode instead of sequential")
    print("   2. Select fewer projects at once if memory is limited")
    print("   3. Check for sufficient disk space")
    print("   4. Monitor the progress indicators in the terminal")
    print("\n🔄 After terminating processes, you can restart the evaluation safely.") 