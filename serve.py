#!/usr/bin/env python3
"""
Universal Claude Memory Visualizer Server
=========================================

Simple HTTP server to serve the knowledge graph visualization.
Automatically finds memory.json from common locations or custom path.

Usage:
    python3 serve.py                              # Default port 8021, auto-find memory.json
    python3 serve.py 3000                         # Custom port, auto-find memory.json
    python3 serve.py ~/my-memory.json             # Default port, custom file
    python3 serve.py 3000 ~/my-memory.json        # Custom port and file
    
Then open: http://localhost:port
"""

import http.server
import socketserver
import os
import shutil
import sys
from pathlib import Path

def find_memory_file(custom_path=None):
    """Find memory.json file in order of priority"""
    search_locations = []
    
    # 1. Custom path from command line
    if custom_path:
        custom_path = Path(custom_path).expanduser()
        search_locations.append(custom_path)
    
    # 2. Current directory
    search_locations.append(Path("memory.json"))
    
    # 3. Common user locations
    search_locations.extend([
        Path.home() / "memory.json",
        Path.home() / "code" / "memory.json", 
        Path.home() / ".config" / "claude" / "memory.json",
    ])
    
    for location in search_locations:
        if location.exists():
            print(f"📋 Found memory.json at {location}")
            return location
    
    print("⚠️  No memory.json found in common locations:")
    for loc in search_locations[1:]:  # Skip custom path in error message if it was provided
        print(f"   ✗ {loc}")
    print("\n💡 To use your memory file:")
    print("   python3 serve.py /path/to/your/memory.json")
    print("   OR copy it to ./memory.json") 
    print("   OR set up MCP with MEMORY_FILE_PATH pointing to a standard location")
    print("\n📝 Will use demo data for visualization")
    return None

def setup_memory_file(custom_path=None):
    """Find and set up memory.json file"""
    memory_source = find_memory_file(custom_path)
    local_memory = Path("memory.json")
    
    if memory_source and memory_source != local_memory:
        print(f"📁 Copying to {local_memory}")
        shutil.copy2(memory_source, local_memory)
        print(f"✅ Ready to serve")
    elif memory_source:
        print(f"✅ Using {memory_source}")
    
    # Count entities and relations if file exists
    if local_memory.exists():
        try:
            with open(local_memory, 'r', encoding='utf-8') as f:
                lines = f.readlines()
                entities = sum(1 for line in lines if '"type":"entity"' in line)
                relations = sum(1 for line in lines if '"type":"relation"' in line)
                
            print(f"🧠 Knowledge Graph: {entities} entities, {relations} relations")
        except Exception as e:
            print(f"⚠️  Could not parse memory file: {e}")

def parse_args():
    """Parse command line arguments flexibly"""
    args = sys.argv[1:]
    port = 8021
    memory_path = None
    
    for arg in args:
        if arg.isdigit():
            port = int(arg)
        else:
            memory_path = arg
    
    return port, memory_path

def main():
    port, memory_path = parse_args()
    
    print("🧠 Claude Memory Knowledge Graph Visualizer")
    print("=" * 50)
    
    # Setup memory file
    setup_memory_file(memory_path)
    
    # Start server
    handler = http.server.SimpleHTTPRequestHandler
    handler.extensions_map.update({
        '.js': 'application/javascript',
        '.json': 'application/json',
    })
    
    with socketserver.TCPServer(("", port), handler) as httpd:
        print(f"\n🚀 Server running at: http://localhost:{port}")
        print(f"📱 Open in browser to visualize your Claude memory!")
        print(f"🛑 Press Ctrl+C to stop")
        print()
        
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n👋 Server stopped")

if __name__ == "__main__":
    main()
