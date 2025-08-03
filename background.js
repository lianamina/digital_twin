// Background service worker for handling Cerebrum API calls

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('[Background] Received message:', request.action);
  
  if (request.action === 'ping') {
    console.log('[Background] Ping received, responding with pong');
    sendResponse({ status: 'pong' });
    return false;
  }
  
  if (request.action === 'callCerebrumAPI') {
    console.log('[Background] Handling Cerebrum API call');
    handleCerebrumAPICall(request, sendResponse);
    return true; // Keep the message channel open for async response
  }
  
  if (request.action === 'testCerebrumAPI') {
    console.log('[Background] Handling Cerebrum API test');
    handleCerebrumAPITest(request, sendResponse);
    return true; // Keep the message channel open for async response
  }
  
  console.log('[Background] Unknown action:', request.action);
});

async function handleCerebrumAPICall(request, sendResponse) {
  try {
    console.log('[Background] Making Cerebrum API call:', request.payload);
    
    const url = 'https://cerebrum-dev.lnkdprod.com/openai/deployments/gpt-4o/chat/completions?api-version=2024-12-01-preview';
    
    // Clean and validate API key
    let apiKey = String(request.apiKey || '').trim();
    
    // Only keep standard alphanumeric and common special characters used in API keys
    const cleanKey = apiKey.replace(/[^a-zA-Z0-9\-_\.+=\/]/g, '');
    
    console.log('[Background] API key processing:', {
      hasKey: !!apiKey,
      originalLength: apiKey.length,
      cleanLength: cleanKey.length,
      needsCleaning: apiKey !== cleanKey
    });
    
    if (!cleanKey || cleanKey.length === 0) {
      console.error('[Background] API key is invalid after cleaning!');
      sendResponse({ success: false, error: 'Invalid API key format' });
      return;
    }
    
    // Create request options without problematic characters
    const requestOptions = {
      method: 'POST',
      body: JSON.stringify(request.payload)
    };
    
    // Set headers individually to avoid encoding issues
    requestOptions.headers = {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    };
    requestOptions.headers['api-key'] = cleanKey;

    const response = await fetch(url, requestOptions);

    console.log('[Background] API response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Background] API error response:', errorText);
      sendResponse({ 
        success: false, 
        error: `API request failed: ${response.status} - ${errorText}` 
      });
      return;
    }

    const data = await response.json();
    console.log('[Background] API response data:', data);

    if (data.choices && data.choices[0] && data.choices[0].message) {
      sendResponse({ 
        success: true, 
        content: data.choices[0].message.content.trim() 
      });
    } else {
      console.error('[Background] Unexpected API response structure:', data);
      sendResponse({ 
        success: false, 
        error: 'Invalid API response structure' 
      });
    }
  } catch (error) {
    console.error('[Background] Fetch error:', error);
    sendResponse({ 
      success: false, 
      error: error.message 
    });
  }
}

async function handleCerebrumAPITest(request, sendResponse) {
  try {
    console.log('[Background] Testing Cerebrum API connection');
    
    const url = 'https://cerebrum-dev.lnkdprod.com/openai/deployments/gpt-4o/chat/completions?api-version=2024-12-01-preview';
    
    // Clean and validate API key
    let apiKey = String(request.apiKey || '').trim();
    
    // Only keep standard alphanumeric and common special characters used in API keys
    const cleanKey = apiKey.replace(/[^a-zA-Z0-9\-_\.+=\/]/g, '');
    
    console.log('[Background] Test API key processing:', {
      hasKey: !!apiKey,
      originalLength: apiKey.length,
      cleanLength: cleanKey.length,
      needsCleaning: apiKey !== cleanKey
    });
    
    if (!cleanKey || cleanKey.length === 0) {
      console.error('[Background] Test API key is invalid after cleaning!');
      sendResponse({ success: false, message: 'Invalid API key format' });
      return;
    }
    
    const payload = {
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'Say hello in one word.' }
      ],
      max_tokens: 10,
      temperature: 0.1
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'api-key': cleanKey
      },
      body: JSON.stringify(payload)
    });

    console.log('[Background] Test API response status:', response.status);

    if (response.ok) {
      const data = await response.json();
      if (data.choices && data.choices[0]) {
        sendResponse({ 
          success: true, 
          message: 'API connection successful!' 
        });
      } else {
        sendResponse({ 
          success: false, 
          message: 'API responded but format unexpected' 
        });
      }
    } else {
      const errorText = await response.text();
      sendResponse({ 
        success: false, 
        message: `API Error: ${response.status} - ${errorText}` 
      });
    }
  } catch (error) {
    console.error('[Background] API test error:', error);
    sendResponse({ 
      success: false, 
      message: `Connection failed: ${error.message}` 
    });
  }
}

console.log('[Background] Cerebrum API background service worker loaded'); 