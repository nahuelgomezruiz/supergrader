# supergrader - Quick Test Checklist

## ⚡ 5-Minute Functionality Test

### Before You Start
- [ ] Chrome browser ready
- [ ] Gradescope account with TA/instructor access
- [ ] Extension files validated (run `node test-manifest.js`)

### 1. Load Extension (2 minutes)
1. Open Chrome → `chrome://extensions/`
2. Enable "Developer mode" (top-right toggle)
3. Click "Load unpacked" → select `chrome-extension` folder
4. **✅ Check:** Extension appears as "supergrader" without errors

### 2. Basic Popup Test (1 minute)
1. Click supergrader icon in toolbar
2. **On non-Gradescope page:** Should show red "Not on a Gradescope page"
3. **On Gradescope homepage:** Should show red "Navigate to a grading page"
4. **✅ Check:** Popup opens and shows correct status

### 3. Grading Page Test (2 minutes)
1. Navigate to: `gradescope.com/courses/*/assignments/*/submissions/*/grade`
2. **✅ Check:** supergrader panel appears on page with blue border
3. **✅ Check:** Panel shows "🤖 supergrader" header
4. **✅ Check:** "Start AI Grading" button is present (disabled)
5. **✅ Check:** Extension popup shows green "Ready to assist"

### 4. Console Verification (30 seconds)
1. Press F12 → Console tab
2. **✅ Check:** See "supergrader: Content script loaded"
3. **✅ Check:** See "supergrader: Detected grading page"
4. **✅ Check:** No red error messages

## 🚨 If Something Doesn't Work

### Extension Won't Load
- Check `chrome://extensions/` for error details
- Verify manifest.json syntax with online JSON validator
- Run `node test-manifest.js` again

### Panel Doesn't Appear
- Confirm URL contains `/grade` (actual grading page)
- Check browser console for errors
- Try refreshing the page
- Verify content script URL pattern matches

### Wrong Popup Status  
- Check that you're on the correct page type
- Try different Gradescope pages to test detection

## ✅ Success Criteria

If all checks pass, you have:
- ✅ Working Chrome extension
- ✅ Proper page detection
- ✅ UI injection working
- ✅ No console errors
- ✅ Settings functionality

**🎉 Ready for Week 2 development!**

## 📞 Need Help?

Check the full testing guide in `TESTING.md` or:
1. Verify all files exist: `dir` (Windows) or `ls` (Mac/Linux)
2. Check manifest syntax: `node test-manifest.js`
3. Look for console errors in Chrome DevTools
4. Confirm you're on a real Gradescope grading page 