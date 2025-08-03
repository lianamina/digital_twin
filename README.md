# LinkedIn Profile Chatbot Browser Extension

A Chrome browser extension that creates AI chatbots that mimic LinkedIn profile personalities. When you visit someone's LinkedIn profile, you can chat with an AI that responds as if it were that person, using their profile information and your custom personality settings.

Demo: https://www.youtube.com/watch?v=vWkI0GEDwoc

Pitch Deck: [AI digital twin.pdf](https://github.com/user-attachments/files/21563086/AI.digital.twin.pdf)

## 🚀 Features

- **Auto-Detection**: Automatically detects LinkedIn profile pages (`linkedin.com/in/username`)
- **Profile Scraping**: Extracts name, headline, about section, experience, and education
- **AI-Powered Responses**: Optional integration with Cerebrum GPT-4o for intelligent, context-aware responses
- **Fallback System**: Works with pattern-based responses even without API key
- **Smart Chatbot**: Responds as the profile person using scraped data and AI
- **Personality Customization**: Customize your own chatbot personality for authentic responses
- **Multiple Response Styles**: Choose from friendly, professional, casual, enthusiastic, or thoughtful
- **Custom Q&A**: Add your own question-response pairs
- **Local Storage**: All data stored securely on your device
- **Modern UI**: Clean, professional interface that matches LinkedIn's design
- **Improved Scrolling**: Fixed chatbox scrolling with larger, more readable interface

## 📦 Installation

### Method 1: Load as Unpacked Extension (Development)

1. **Clone or Download** this repository to your local machine
2. **Open Chrome** and navigate to `chrome://extensions/`
3. **Enable Developer Mode** by toggling the switch in the top right
4. **Click "Load unpacked"** and select the folder containing the extension files
5. **Pin the extension** to your browser toolbar for easy access

### Important: After Updates
If you update the extension files:
1. Go to `chrome://extensions/`
2. Click the **refresh** button on the LinkedIn Profile Chatbot extension
3. This reloads the extension with your changes

### Method 2: Create Icons (Optional)

The extension references icon files but doesn't include them. You can:
- Add your own icon files (`icon16.png`, `icon48.png`, `icon128.png`) to the `icons/` folder
- Or remove the icons section from `manifest.json`

## 🎯 How to Use

### 1. Customize Your Personality
- Click the extension icon in your browser toolbar
- Fill out the customization form:
  - **API Key** (Optional): Add your Cerebrum API key for AI-powered responses
  - **Basic Info**: Your name, headline, bio
  - **Response Style**: Choose how you want to sound
  - **Common Responses**: Set responses for frequently asked questions
  - **Custom Q&A**: Add specific question-answer pairs
- Click "Save Personality"

### 1.5. Get Cerebrum API Access (Optional)
- For the best experience, get a Cerebrum API key from your organization
- Without an API key, the extension uses pattern-based responses
- With an API key, you get intelligent GPT-4o powered conversations

### 2. Chat with LinkedIn Profiles
- Navigate to any LinkedIn profile (`linkedin.com/in/username`)
- Look for the blue "Chat with [Name]" button in the bottom right
- Click to open the chat window
- Start asking questions about their experience, skills, goals, etc.

## 🛠 File Structure

```
llamaz-intern-hackathon/
├── manifest.json          # Extension configuration
├── content.js            # Main chatbot logic and profile scraping
├── styles.css            # Chatbot interface styles
├── popup.html            # Customization interface
├── popup.css             # Popup styles
├── popup.js              # Customization functionality
├── icons/                # Extension icons (create your own)
└── README.md             # This file
```

## 🔧 Technical Details

- **Manifest Version**: 3 (latest Chrome extension standard)
- **Permissions**: 
  - `storage` - For saving user personality data
  - `activeTab` - For accessing LinkedIn pages
- **Host Permissions**: `https://www.linkedin.com/*`
- **Storage**: Uses Chrome's `chrome.storage.local` API
- **Content Script**: Runs only on LinkedIn profile pages

## ⚡ Features Breakdown

### Profile Scraping
- Extracts name from multiple possible selectors
- Gets professional headline
- Parses about/summary section
- Collects recent work experience
- Gathers education information

### AI-Powered Intelligence
- **GPT-4o Integration**: Uses Cerebrum's API for natural, context-aware responses
- **Smart System Prompts**: Builds detailed prompts with profile data and personality settings
- **Graceful Fallback**: Automatically switches to pattern-based responses if API fails
- **Typing Indicators**: Shows when AI is thinking with animated typing indicator

### Intelligent Responses
- Prioritizes user's custom responses
- Uses AI to generate contextual responses based on profile data
- Falls back to scraped profile data with pattern matching
- Applies personality style (friendly, professional, etc.)
- Handles common questions about work, skills, goals, contact info

### Customization Options
- **Response Styles**: 
  - Friendly & Approachable
  - Professional & Formal
  - Casual & Relaxed
  - Enthusiastic & Energetic
  - Thoughtful & Analytical
- **Custom Q&A**: Add unlimited question-response pairs
- **Export/Import**: Built-in functionality for backing up settings

## 🎨 UI/UX Features

- **Responsive Design**: Works on desktop and mobile LinkedIn
- **Smooth Animations**: Fade-in effects and hover states
- **LinkedIn-like Styling**: Matches LinkedIn's color scheme and typography
- **Keyboard Shortcuts**: Ctrl/Cmd+S to save in customization popup
- **Auto-scroll**: Chat messages automatically scroll to newest

## 🔒 Privacy & Security

- **Local Storage Only**: All data stays on your device
- **No External APIs**: No data sent to external servers
- **LinkedIn TOS Compliant**: Respectful scraping that doesn't overload LinkedIn
- **No Tracking**: No analytics or user tracking

## 🐛 Troubleshooting

### Chatbot Not Appearing
- Ensure you're on a LinkedIn profile page (`/in/username`)
- Check that the extension is enabled in `chrome://extensions/`
- Refresh the page and wait a moment for loading

### Profile Data Not Scraping
- LinkedIn frequently updates their HTML structure
- Some profiles may have privacy settings that limit data
- The extension includes fallback responses for missing data

### Customization Not Saving
- Ensure you've filled in at least the "Name" field
- Check Chrome's storage permissions
- Try refreshing the popup and saving again

## 🚀 Future Enhancements

Potential improvements for future versions:
- Integration with actual AI APIs (OpenAI, Claude, etc.)
- Support for other professional networks
- More sophisticated natural language processing
- Team collaboration features
- Advanced personality training

## 📄 License

This project is open source and available under the MIT License.

## ⚠️ Disclaimer

This extension is for educational and networking purposes. Always respect LinkedIn's Terms of Service and use responsibly. The chatbot responses are simulated and should not be considered as actual communication from the profile owner.
