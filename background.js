// Function to categorize a URL
function categorizeUrl(url) {
    const urlObj = new URL(url);
    const domain = urlObj.hostname;
    
    // Common domain patterns for categorization
    const categories = {
        'social': ['facebook', 'twitter', 'instagram', 'linkedin', 'reddit'],
        'news': ['news', 'bbc', 'cnn', 'reuters', 'nytimes'],
        'shopping': ['amazon', 'ebay', 'etsy', 'walmart', 'target'],
        'entertainment': ['youtube', 'netflix', 'spotify', 'twitch', 'hulu'],
        'work': ['github', 'gitlab', 'stackoverflow', 'docs.google', 'drive.google'],
        'education': ['coursera', 'udemy', 'edx', 'khanacademy', 'w3schools']
    };

    for (const [category, patterns] of Object.entries(categories)) {
        if (patterns.some(pattern => domain.includes(pattern))) {
            return category;
        }
    }

    return 'other';
}

// Function to detect and merge duplicate tabs
function mergeDuplicateTabs(tabs) {
    const uniqueTabs = new Map();
    
    tabs.forEach(tab => {
        const key = tab.url;
        if (uniqueTabs.has(key)) {
            const existingTab = uniqueTabs.get(key);
            // Merge visit counts
            existingTab.visitCount = (existingTab.visitCount || 0) + (tab.visitCount || 0);
            // Keep the most recent timestamp
            existingTab.timestamp = Math.max(existingTab.timestamp, tab.timestamp);
            // Merge notes if any
            if (tab.notes) {
                existingTab.notes = existingTab.notes ? 
                    `${existingTab.notes}\n${tab.notes}` : 
                    tab.notes;
            }
        } else {
            uniqueTabs.set(key, tab);
        }
    });

    return Array.from(uniqueTabs.values());
}

// Function to auto-archive old tabs
function autoArchiveTabs(tabs) {
    const now = Date.now();
    const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000); // 30 days in milliseconds
    
    return tabs.map(tab => {
        if (tab.timestamp < thirtyDaysAgo && !tab.archived) {
            return { ...tab, archived: true };
        }
        return tab;
    });
}

// Function to save all tabs
async function saveAllTabs() {
    try {
        const tabs = await chrome.tabs.query({});
        const tabsToSave = tabs
            .filter(tab => !tab.url.startsWith('chrome://'))
            .map(tab => ({
                id: tab.id,
                title: tab.title,
                url: tab.url,
                favicon: tab.favIconUrl,
                timestamp: Date.now(),
                category: categorizeUrl(tab.url),
                visitCount: 1
            }));

        // Get existing saved tabs
        const result = await chrome.storage.local.get(['savedTabs']);
        const existingTabs = result.savedTabs || [];
        
        // Merge with existing tabs
        const allTabs = [...existingTabs, ...tabsToSave];
        
        // Process tabs
        const mergedTabs = mergeDuplicateTabs(allTabs);
        const archivedTabs = autoArchiveTabs(mergedTabs);
        
        // Save processed tabs
        await chrome.storage.local.set({ savedTabs: archivedTabs });
    } catch (error) {
        console.error('Error saving tabs:', error);
    }
}

// Function to capture tab screenshot
async function captureTabScreenshot(tabId) {
    try {
        const dataUrl = await chrome.tabs.captureVisibleTab(null, {
            format: 'jpeg',
            quality: 80
        });
        return dataUrl;
    } catch (error) {
        console.error('Error capturing screenshot:', error);
        return null;
    }
}

// Listen for tab updates
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete') {
        await saveAllTabs();
        
        // Capture screenshot for the updated tab
        const screenshot = await captureTabScreenshot(tabId);
        if (screenshot) {
            const result = await chrome.storage.local.get(['savedTabs']);
            const tabs = result.savedTabs || [];
            const updatedTabs = tabs.map(t => {
                if (t.url === tab.url) {
                    return { ...t, screenshot };
                }
                return t;
            });
            await chrome.storage.local.set({ savedTabs: updatedTabs });
        }
    }
});

// Listen for tab removal
chrome.tabs.onRemoved.addListener(() => {
    saveAllTabs();
});

// Listen for window focus changes
chrome.windows.onFocusChanged.addListener((windowId) => {
    if (windowId !== chrome.windows.WINDOW_ID_NONE) {
        saveAllTabs();
    }
});

// Save tabs when extension is installed
chrome.runtime.onInstalled.addListener(() => {
    saveAllTabs();
});

// Save tabs when Chrome starts
chrome.runtime.onStartup.addListener(() => {
    saveAllTabs();
});

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'captureVisibleTab') {
        chrome.tabs.captureVisibleTab(null, {
            format: 'jpeg',
            quality: 100
        }).then(sendResponse);
        return true; // Required for async response
    }
}); 