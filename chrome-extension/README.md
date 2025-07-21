# supergrader - Chrome Extension

A Chrome extension that uses AI to help grade assignments on Gradescope.

## Development Setup

### Prerequisites
- Chrome browser (latest version)
- Access to Gradescope with grading permissions

### Installation for Development

1. **Load the extension in Chrome:**
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top right)
   - Click "Load unpacked" 
   - Select the `chrome-extension` folder

2. **Verify installation:**
   - The supergrader icon should appear in your extensions toolbar
   - Check the Extensions page to ensure it's loaded without errors

### Testing the Extension

#### Basic Functionality Test
1. Navigate to Gradescope: `https://www.gradescope.com`
2. Log in with your instructor/TA account
3. Navigate to any assignment's grading page:
   - Format: `/courses/{id}/assignments/{id}/submissions/{id}/grade`
4. The supergrader panel should appear on the page
5. Click the extension icon to access settings

#### Console Testing
1. Open Chrome DevTools (F12)
2. Check the Console tab for extension logs:
   - Should see "supergrader: Content script loaded"
   - Should see page detection and initialization logs

#### Expected Behavior (Week 1 MVP)
- ✅ Extension loads on Gradescope grading pages
- ✅ AI panel appears in the interface  
- ✅ Basic UI controls (toggle panel, settings button)
- ✅ Console logging shows proper page detection
- ✅ Popup shows correct status for different page types

### Development Workflow

#### Hot Reload Setup
1. Make changes to any extension files
2. Go to `chrome://extensions/`
3. Click the refresh button on the "supergrader" card
4. Reload any Gradescope tabs to see changes

#### Debugging
- **Content Script Issues**: Check browser console on Gradescope pages
- **Background Script Issues**: Check extension service worker in DevTools
- **Popup Issues**: Right-click extension icon → "Inspect popup"

### File Structure
```
chrome-extension/
├── manifest.json          # Extension configuration
├── content.js             # Main orchestrator 
├── gradescope-api.js      # Gradescope integration (placeholder)
├── ui-controller.js       # UI management
├── background.js          # Service worker
├── popup.html            # Extension popup interface
├── popup.js              # Popup functionality  
├── styles.css            # UI styles
├── icons/                # Extension icons (placeholder)
└── README.md            # This file
```

### Current Status: Week 1 - Day 1-2 Complete ✅

**Implemented:**
- ✅ Basic Chrome extension structure
- ✅ Manifest V3 configuration
- ✅ Content script with page detection
- ✅ UI injection into Gradescope interface
- ✅ Basic popup with settings
- ✅ Extension loads without errors

**Next Steps (Day 3-4):**
- URL pattern matching improvements
- Enhanced DOM injection
- Authentication token extraction
- Error handling improvements

### Troubleshooting

#### Extension Won't Load
- Check manifest.json syntax
- Verify all referenced files exist
- Check Chrome Extensions page for error messages

#### Not Working on Gradescope
- Verify you're on a grading page (URL contains `/grade`)
- Check console for JavaScript errors
- Ensure you're logged into Gradescope

#### Popup Not Working
- Right-click extension icon → "Inspect popup" for debugging
- Check that popup.html and popup.js are loading properly

### Development Notes

- All placeholder functions are marked with `// TODO:` comments
- Console logging is extensive for debugging
- Error handling is basic but functional
- Settings are stored in Chrome sync storage
- Extension uses Manifest V3 (latest standard)

For questions or issues, refer to the main project scope document. 