import WebSocket from 'ws';

const TEST_TOKEN = process.env.TEST_TOKEN || 'test-token-123';
const WS_URL = process.env.WS_URL || 'ws://localhost:3001/ws/bridge';

console.log('🧪 Bridge Execution Test Client');
console.log(`Connecting to: ${WS_URL}?token=${TEST_TOKEN}`);

// 1. Connect and handshake
const ws = new WebSocket(`${WS_URL}?token=${TEST_TOKEN}`);

ws.on('open', () => {
  console.log('✅ Connected to WebSocket server');
  
  // Send handshake
  const handshake = {
    type: 'handshake',
    nodeKey: 'test-node-' + Date.now(),
    agents: ['TestAgent', 'FrontendBot'],
    platform: 'linux'
  };
  
  console.log('📤 Sending handshake:', handshake);
  ws.send(JSON.stringify(handshake));
});

ws.on('message', (data) => {
  const message = JSON.parse(data.toString());
  console.log('📨 Received:', message.type);

  switch (message.type) {
    case 'auth_ok':
      console.log('✅ Authentication successful');
      break;

    case 'handshake_complete':
      console.log('✅ Handshake complete, nodeId:', message.nodeId);
      console.log('💡 Node is now online and ready to receive instructions');
      console.log('💡 Send a message to TestAgent or FrontendBot via Command Center API');
      break;

    case 'execute':
      console.log('📥 Received instruction to execute:');
      console.log('  Session ID:', message.sessionId);
      console.log('  Agent ID:', message.agentId);
      console.log('  Instruction:', message.instruction);
      
      // Simulate agent execution
      simulateExecution(message.sessionId, message.instruction);
      break;

    case 'ping':
      // Respond with pong
      ws.send(JSON.stringify({ type: 'pong' }));
      break;

    case 'stop':
      console.log('🛑 Received stop signal for session:', message.sessionId);
      break;

    case 'error':
      console.error('❌ Error:', message.message);
      break;

    default:
      console.log('⚠️ Unknown message type:', message.type);
  }
});

ws.on('error', (error) => {
  console.error('❌ WebSocket error:', error.message);
});

ws.on('close', () => {
  console.log('🔌 Connection closed');
  process.exit(0);
});

/**
 * Simulate agent execution with various events
 */
function simulateExecution(sessionId, instruction) {
  console.log('🤖 Simulating agent execution...');

  // Step 1: Send initial response
  setTimeout(() => {
    console.log('📤 Sending initial response...');
    ws.send(JSON.stringify({
      type: 'result',
      sessionId,
      content: 'I received your instruction: "' + instruction + '"',
      done: false
    }));
  }, 500);

  // Step 2: Send file change
  setTimeout(() => {
    console.log('📤 Sending file change event...');
    ws.send(JSON.stringify({
      type: 'file_change',
      sessionId,
      filePath: '/test/example.txt',
      diff: '+Added new line\n-Removed old line'
    }));
  }, 1000);

  // Step 3: Send command output
  setTimeout(() => {
    console.log('📤 Sending command output...');
    ws.send(JSON.stringify({
      type: 'command_output',
      sessionId,
      output: 'npm install completed successfully\nInstalled 42 packages'
    }));
  }, 1500);

  // Step 4: Send progress update
  setTimeout(() => {
    console.log('📤 Sending progress update...');
    ws.send(JSON.stringify({
      type: 'result',
      sessionId,
      content: 'Processing your request... 50% complete',
      done: false
    }));
  }, 2000);

  // Step 5: Send another command
  setTimeout(() => {
    console.log('📤 Sending another command output...');
    ws.send(JSON.stringify({
      type: 'command_output',
      sessionId,
      output: 'git commit -m "feat: implemented feature X"'
    }));
  }, 2500);

  // Step 6: Send final result
  setTimeout(() => {
    console.log('📤 Sending final result...');
    ws.send(JSON.stringify({
      type: 'result',
      sessionId,
      content: '✅ Task completed successfully! All changes have been applied.',
      done: true
    }));
    console.log('✅ Execution simulation complete');
  }, 3000);
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down...');
  ws.close();
});
