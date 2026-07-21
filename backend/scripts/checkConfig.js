require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

function fail(msg) {
  console.error(`✗ ${msg}`);
  process.exitCode = 1;
}

function ok(msg) {
  console.log(`✓ ${msg}`);
}

function checkGeminiConfig() {
  if (!process.env.GEMINI_API_KEY) {
    fail('GEMINI_API_KEY is not set');
  } else {
    ok('GEMINI_API_KEY is set');
  }

  ok(`GEMINI_MODEL=${process.env.GEMINI_MODEL || 'gemini-2.5-flash (default)'}`);
}

function checkNvidiaConfig() {
  if (!process.env.NVIDIA_API_KEY) {
    fail('NVIDIA_API_KEY is not set (required for DeepSeek/Kimi models)');
  } else {
    ok('NVIDIA_API_KEY is set');
  }
}

checkGeminiConfig();
checkNvidiaConfig();

if (process.exitCode) {
  console.error('\nConfig check failed.');
} else {
  console.log('\nAll checks passed.');
}
