const https = require('https');
const signupData = JSON.stringify({ email: 'remote-debug-' + Date.now() + '@example.com', password: 'Password123!' });
const signupOptions = {
  hostname: 'financial-ai-advisor-app-production.up.railway.app',
  port: 443,
  path: '/api/auth/signup',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(signupData),
  },
};
const signupReq = https.request(signupOptions, (res) => {
  let body = '';
  res.on('data', (chunk) => body += chunk);
  res.on('end', () => {
    console.log('SIGNUP STATUS', res.statusCode);
    console.log('SIGNUP BODY', body);
    try {
      const data = JSON.parse(body);
      if (res.statusCode === 200 && data.user) {
        const userId = data.user.id;
        const chatData = JSON.stringify({ userId, message: 'Hello from remote debug' });
        const chatOptions = {
          hostname: 'financial-ai-advisor-app-production.up.railway.app',
          port: 443,
          path: '/api/ai/chat',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(chatData),
          },
        };
        const chatReq = https.request(chatOptions, (chatRes) => {
          let chatBody = '';
          chatRes.on('data', (chunk) => chatBody += chunk);
          chatRes.on('end', () => {
            console.log('CHAT STATUS', chatRes.statusCode);
            console.log('CHAT BODY', chatBody);
          });
        });
        chatReq.on('error', (err) => console.error('CHAT ERROR', err.message));
        chatReq.write(chatData);
        chatReq.end();
      }
    } catch (err) {
      console.error('SIGNUP PARSE ERROR', err.message);
    }
  });
});
signupReq.on('error', (err) => console.error('SIGNUP ERROR', err.message));
signupReq.write(signupData);
signupReq.end();
