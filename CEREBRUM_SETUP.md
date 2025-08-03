# Cerebrum API Setup Guide

## 🚀 Getting Started with AI-Powered Responses

To enable intelligent AI responses in your LinkedIn Chatbot, you'll need a Cerebrum API key.

## 📋 Setup Steps

### 1. Get Your API Key
- Contact your organization's AI team to obtain a Cerebrum API key
- The key should have access to GPT-4o models

### 2. Configure the Extension
1. Click the extension icon in your browser toolbar
2. Enter your API key in the "Cerebrum API Key" field
3. Click "Test API Connection" to verify it works
4. If successful, you'll see a green checkmark ✅
5. Fill out your personality information
6. Click "Save Personality"

### 3. Test Your Chatbot
1. Visit any LinkedIn profile
2. Click the blue "Chat with [Name]" button
3. Ask a question - you should see "Thinking..." followed by an AI-generated response

## 🔧 Troubleshooting

### CORS / "Failed to fetch" Errors
- **FIXED**: Updated to use background scripts instead of direct API calls
- **Action needed**: Reload the extension in `chrome://extensions/` after updating
- **Should see**: "[Background] Cerebrum API background service worker loaded" in console

### "Thinking..." Never Goes Away
- **Check Console**: Open Developer Tools (F12) → Console tab
- **Look for errors**: Red error messages will show what's wrong
- **Common issues**: Invalid API key, network problems, rate limits

### Getting Default Responses Instead of AI
- **Verify API key**: Use the "Test API Connection" button
- **Check console logs**: Look for "Using Cerebrum API for response" vs "No API key, using fallback response"
- **Common fix**: Re-enter your API key and save again

### API Connection Test Fails
- **401 Unauthorized**: Invalid API key
- **403 Forbidden**: API key doesn't have GPT-4o access
- **500 Server Error**: Cerebrum service issue
- **Network Error**: Check your internet connection

## 🐛 Debug Mode

The extension includes extensive logging to help diagnose issues:

1. **Open Developer Tools**: Press F12 while on a LinkedIn profile
2. **Go to Console tab**
3. **Send a chat message**
4. **Look for these log messages**:
   - "Loaded API key exists: true/false"
   - "Using Cerebrum API for response" (good) or "No API key, using fallback response"
   - "Making API request to: ..." (shows the actual API call)
   - "API response data: ..." (shows the AI response)

## 📝 Expected Console Output (Success)

When everything works correctly, you should see:
```
Loaded API key exists: true
API key length: [some number]
Sending message: tell me about yourself
Generating response with API key: true
Using Cerebrum API for response
Making API request to: https://cerebrum-dev.lnkdprod.com/...
API response status: 200
API response data: { choices: [...] }
AI response received: [the actual AI response]
Generated response: [the actual AI response]
```

## 📝 Expected Console Output (Fallback)

Without an API key, you should see:
```
Loaded API key exists: false
API key length: 0
Sending message: tell me about yourself
Generating response with API key: false
No API key, using fallback response
Generated response: [pattern-based response]
```

## ⚙️ API Configuration

The extension uses these Cerebrum settings:
- **Endpoint**: `https://cerebrum-dev.lnkdprod.com/openai/deployments/gpt-4o/chat/completions`
- **Model**: `gpt-4o`
- **Max Tokens**: 150
- **Temperature**: 0.7
- **API Version**: `2024-12-01-preview`

## 🔒 Privacy & Security

- Your API key is stored locally in your browser
- No data is sent to external servers except the Cerebrum API
- API calls include only the chat message and profile data
- Your API key is never logged to console (shown as "[REDACTED]")

## 💡 Tips for Best Results

1. **Fill out your personality completely** - the AI uses this context
2. **Use descriptive custom responses** - these take priority over AI
3. **Test your setup** before important networking
4. **Check console regularly** if issues arise

## 🆘 Getting Help

If you're still having issues:
1. Copy the console logs (F12 → Console → right-click → "Save as...")
2. Note the exact error messages
3. Contact your AI team or extension developer with this information 