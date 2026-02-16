const http = require('http');

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ message: 'Test server working!' }));
});

server.listen(3001, () => {
  console.log('✅ Test server running on http://localhost:3001');
});
