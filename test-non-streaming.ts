import { streamMessage } from './dist/modules/command-center/command-center.service.js';

async function test() {
  try {
    console.log('🧪 Testing non-streaming fallback...\n');
    
    // This will fail with the API key check, but we're testing the structure
    const result = await streamMessage(
      'test-user-id',
      'test-agent-id',
      null,
      'Hello, can you say hi back?'
    );
    
    console.log('✅ SUCCESS! Got response structure:');
    console.log(JSON.stringify(result, null, 2));
    
  } catch (error: any) {
    console.log('\n📝 Expected error (no API key configured):');
    console.log('Status:', error.statusCode || 'N/A');
    console.log('Error:', error.error || 'Unknown');
    console.log('Message:', error.message || error.toString());
    
    if (error.statusCode === 403 && error.message?.includes('API key')) {
      console.log('\n✅ GOOD! The function returned an error before the streaming logic');
      console.log('This means our non-streaming changes are syntactically correct.');
      console.log('\n📌 To test fully, we need:');
      console.log('1. Valid user ID with configured API key');
      console.log('2. Valid agent ID');
      console.log('\nFor now, let me create a minimal API key test...');
    } else {
      console.log('\n❌ UNEXPECTED ERROR:', error);
    }
  }
}

test();
