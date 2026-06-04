import http.server
import socketserver

PORT = 8000
handler = http.server.SimpleHTTPRequestHandler

# Ensure the server sends the correct MIME type for .wasm files
handler.extensions_map.update({
    ".wasm": "application/wasm",
})

with socketserver.TCPServer(("", PORT), handler) as httpd:
    print(f"OS running at http://localhost:{PORT}")
    httpd.serve_forever()
