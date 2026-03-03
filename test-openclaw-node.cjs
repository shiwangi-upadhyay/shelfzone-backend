const WebSocket = require('ws');

const PAIR_TOKEN = 'test-token-debug-001';
const SERVER_URL = `ws://localhost:3001/ws/bridge?token=${PAIR_TOKEN}`;

console.log('🔗 Connecting to ShelfZone Agent Bridge...');
console.log(`Server: ${SERVER_URL}`);

const ws = new WebSocket(SERVER_URL);

ws.on('open', () => {
  console.log('✅ Connected to ShelfZone!');
  console.log('📤 Sending handshake...');
  
  // Send handshake
  ws.send(JSON.stringify({
    type: 'handshake',
    nodeKey: 'test-server-node-001',
    agents: ['TestAgent', 'DemoAgent'],
    platform: 'linux'
  }));
});

ws.on('message', (data) => {
  const message = JSON.parse(data.toString());
  console.log('📨 Received:', JSON.stringify(message, null, 2));
  
  if (message.type === 'ping') {
    // Respond to heartbeat
    ws.send(JSON.stringify({ type: 'pong' }));
    console.log('💓 Heartbeat pong sent');
  }
  
  if (message.type === 'execute') {
    const { sessionId, agentId, instruction } = message;
    console.log(`\n🎯 EXECUTING INSTRUCTION:`);
    console.log(`   Session: ${sessionId}`);
    console.log(`   Agent: ${agentId}`);
    console.log(`   Instruction: ${instruction}`);
    
    // Simulate agent execution
    setTimeout(() => {
      console.log('\n📝 Sending response chunks...');
      
      // Send response chunk
      ws.send(JSON.stringify({
        type: 'result',
        sessionId,
        content: 'I am analyzing your request...',
        done: false
      }));
      
      // Simulate file change
      setTimeout(() => {
        ws.send(JSON.stringify({
          type: 'file_change',
          sessionId,
          filePath: '/home/user/project/test.txt',
          diff: '+Hello from remote execution!\n-Old line removed'
        }));
        console.log('📁 File change sent');
        
        // Simulate command execution
        setTimeout(() => {
          ws.send(JSON.stringify({
            type: 'command_output',
            sessionId,
            output: 'npm install complete\n✓ Dependencies updated\n✓ Build successful'
          }));
          console.log('💻 Command output sent');
          
          // Final response
          setTimeout(() => {
            ws.send(JSON.stringify({
              type: 'result',
              sessionId,
              content: 'Task completed successfully! I executed your instruction and made the required changes.',
              done: true
            }));
            console.log('✅ Final result sent\n');
          }, 1000);
        }, 1000);
      }, 1000);
    }, 500);
  }
});

ws.on('error', (error) => {
  console.error('❌ WebSocket error:', error.message);
});

ws.on('close', () => {
  console.log('🔌 Connection closed');
});

// Keep process alive
setInterval(() => {}, 1000);
