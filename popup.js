document.addEventListener('DOMContentLoaded', function() {
    const tabList = document.getElementById('tabList');
    const savedTabsList = document.getElementById('savedTabsList');
    const saveButton = document.getElementById('saveButton');
    const noteTitle = document.getElementById('noteTitle');
    const searchBox = document.getElementById('searchBox');
    const filterButtons = document.querySelectorAll('.filter-button');
    let currentFilter = 'all';

    // Function to create a tab item element
    function createTabItem(tab) {
        const tabItem = document.createElement('div');
        tabItem.className = 'tab-item';
        
        const favicon = document.createElement('img');
        favicon.className = 'tab-favicon';
        favicon.src = tab.favicon || 'images/default-favicon.png';
        
        const title = document.createElement('span');
        title.className = 'tab-title';
        title.textContent = tab.title;
        title.onclick = () => openTab(tab.url);
        
        const deleteButton = document.createElement('button');
        deleteButton.className = 'delete-button';
        deleteButton.textContent = 'Delete';
        deleteButton.onclick = () => deleteTab(tab.url);

        // Create preview box
        const previewBox = document.createElement('div');
        previewBox.className = 'preview-box';
        
        const previewTitle = document.createElement('div');
        previewTitle.className = 'preview-title';
        previewTitle.textContent = tab.title;
        
        const previewUrl = document.createElement('div');
        previewUrl.className = 'preview-url';
        previewUrl.textContent = tab.url;
        
        // Add screenshot preview
        const previewScreenshot = document.createElement('img');
        previewScreenshot.className = 'preview-screenshot';
        previewScreenshot.src = tab.screenshot || 'images/no-preview.png';
        
        const previewSnippet = document.createElement('div');
        previewSnippet.className = 'preview-snippet';
        previewSnippet.textContent = tab.snippet || 'Loading preview...';

        // Add notes section
        const previewNotes = document.createElement('div');
        previewNotes.className = 'preview-notes';
        const notesTextarea = document.createElement('textarea');
        notesTextarea.placeholder = 'Add notes...';
        notesTextarea.value = tab.notes || '';
        const saveNotesButton = document.createElement('button');
        saveNotesButton.textContent = 'Save Notes';
        saveNotesButton.onclick = () => saveTabNotes(tab.url, notesTextarea.value);
        
        previewNotes.appendChild(notesTextarea);
        previewNotes.appendChild(saveNotesButton);
        
        previewBox.appendChild(previewTitle);
        previewBox.appendChild(previewUrl);
        previewBox.appendChild(previewScreenshot);
        previewBox.appendChild(previewSnippet);
        previewBox.appendChild(previewNotes);
        
        // Add category tag if exists
        if (tab.category) {
            const categoryTag = document.createElement('span');
            categoryTag.className = 'category-tag';
            categoryTag.textContent = tab.category;
            title.appendChild(categoryTag);
        }
        
        // Add hover events
        let previewTimeout;
        let isPreviewLoading = false;

        const showPreview = () => {
            clearTimeout(previewTimeout);
            previewBox.style.display = 'block';
            
            if (!tab.snippet && !isPreviewLoading) {
                isPreviewLoading = true;
                previewSnippet.textContent = 'Loading preview...';
                
                fetchPagePreview(tab.url)
                    .then(snippet => {
                        tab.snippet = snippet;
                        previewSnippet.textContent = snippet;
                        updateTabSnippet(tab.url, snippet);
                    })
                    .catch(error => {
                        console.error('Error fetching preview:', error);
                        previewSnippet.textContent = 'Unable to load preview';
                    })
                    .finally(() => {
                        isPreviewLoading = false;
                    });
            }
        };

        const hidePreview = () => {
            previewTimeout = setTimeout(() => {
                previewBox.style.display = 'none';
            }, 200);
        };

        tabItem.addEventListener('mouseenter', showPreview);
        tabItem.addEventListener('mouseleave', hidePreview);
        previewBox.addEventListener('mouseenter', () => clearTimeout(previewTimeout));
        previewBox.addEventListener('mouseleave', () => previewBox.style.display = 'none');
        
        tabItem.appendChild(favicon);
        tabItem.appendChild(title);
        tabItem.appendChild(deleteButton);
        tabItem.appendChild(previewBox);
        
        return tabItem;
    }

    // Function to create a saved tab item element
    function createSavedTabItem(tab, noteId, tabIndex) {
        const tabItem = document.createElement('div');
        tabItem.className = 'tab-item';
        
        const favicon = document.createElement('img');
        favicon.className = 'tab-favicon';
        favicon.src = tab.favicon || 'images/default-favicon.png';
        
        const title = document.createElement('span');
        title.className = 'tab-title';
        title.textContent = tab.title;
        title.onclick = () => openSavedTab(tab.url);
        
        const deleteButton = document.createElement('button');
        deleteButton.className = 'delete-button';
        deleteButton.textContent = 'Delete';
        deleteButton.onclick = () => deleteSavedTab(noteId, tabIndex);
        
        tabItem.appendChild(favicon);
        tabItem.appendChild(title);
        tabItem.appendChild(deleteButton);
        
        return tabItem;
    }

    // Function to save tab notes
    function saveTabNotes(url, notes) {
        chrome.storage.local.get(['savedTabs'], function(result) {
            const tabs = result.savedTabs || [];
            const updatedTabs = tabs.map(tab => {
                if (tab.url === url) {
                    return { ...tab, notes };
                }
                return tab;
            });
            chrome.storage.local.set({ savedTabs: updatedTabs });
        });
    }

    // Function to fetch page preview
    async function fetchPagePreview(url) {
        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Accept': 'text/html',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                }
            });
            
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            
            const html = await response.text();
            
            // Try to get meta description
            const metaDescription = html.match(/<meta[^>]*name="description"[^>]*content="([^"]*)"[^>]*>/i);
            if (metaDescription && metaDescription[1]) {
                return metaDescription[1].trim();
            }
            
            // Try to get og:description
            const ogDescription = html.match(/<meta[^>]*property="og:description"[^>]*content="([^"]*)"[^>]*>/i);
            if (ogDescription && ogDescription[1]) {
                return ogDescription[1].trim();
            }
            
            // Try to get first paragraph
            const firstParagraph = html.match(/<p[^>]*>([^<]+)<\/p>/i);
            if (firstParagraph && firstParagraph[1]) {
                return firstParagraph[1].trim();
            }
            
            // Try to get first h1 or h2
            const firstHeading = html.match(/<h[12][^>]*>([^<]+)<\/h[12]>/i);
            if (firstHeading && firstHeading[1]) {
                return firstHeading[1].trim();
            }
            
            return 'No preview available';
        } catch (error) {
            console.error('Error fetching page content:', error);
            return 'Unable to load preview';
        }
    }

    // Function to update tab snippet in storage
    function updateTabSnippet(url, snippet) {
        chrome.storage.local.get(['savedTabs'], function(result) {
            const tabs = result.savedTabs || [];
            const updatedTabs = tabs.map(tab => {
                if (tab.url === url) {
                    return { ...tab, snippet };
                }
                return tab;
            });
            chrome.storage.local.set({ savedTabs: updatedTabs });
        });
    }

    // Function to open a tab
    function openTab(url) {
        chrome.tabs.create({ url: url });
    }

    // Function to delete a tab
    function deleteTab(url) {
        chrome.storage.local.get(['savedTabs'], function(result) {
            const tabs = result.savedTabs || [];
            const updatedTabs = tabs.filter(tab => tab.url !== url);
            
            chrome.storage.local.set({ savedTabs: updatedTabs }, function() {
                loadTabs();
            });
        });
    }

    // Function to load and display tabs
    function loadTabs(searchTerm = '') {
        chrome.storage.local.get(['savedTabs'], function(result) {
            if (!tabList) return;
            
            tabList.innerHTML = '';
            const tabs = result.savedTabs || [];
            
            if (tabs.length === 0) {
                const noTabs = document.createElement('div');
                noTabs.className = 'no-tabs';
                noTabs.textContent = 'No saved tabs found';
                tabList.appendChild(noTabs);
                return;
            }

            let filteredTabs = tabs;

            // Apply search filter
            if (searchTerm) {
                filteredTabs = filteredTabs.filter(tab => 
                    tab.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    tab.url.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    (tab.notes && tab.notes.toLowerCase().includes(searchTerm.toLowerCase()))
                );
            }

            // Apply category filter
            switch (currentFilter) {
                case 'recent':
                    filteredTabs.sort((a, b) => b.timestamp - a.timestamp);
                    break;
                case 'frequent':
                    filteredTabs.sort((a, b) => (b.visitCount || 0) - (a.visitCount || 0));
                    break;
                case 'old':
                    filteredTabs.sort((a, b) => a.timestamp - b.timestamp);
                    break;
                default:
                    filteredTabs.sort((a, b) => b.timestamp - a.timestamp);
            }

            if (filteredTabs.length === 0) {
                const noResults = document.createElement('div');
                noResults.className = 'no-tabs';
                noResults.textContent = 'No matching tabs found';
                tabList.appendChild(noResults);
                return;
            }

            filteredTabs.forEach(tab => {
                tabList.appendChild(createTabItem(tab));
            });
        });
    }

    // Function to open a saved tab
    function openSavedTab(url) {
        chrome.tabs.create({ url: url });
    }

    // Function to delete a saved tab
    function deleteSavedTab(noteId, tabIndex) {
        chrome.storage.local.get(['notes'], function(result) {
            const notes = result.notes || [];
            if (notes[noteId] && notes[noteId].tabs[tabIndex]) {
                notes[noteId].tabs.splice(tabIndex, 1);
                
                // If no tabs left in the note, remove the entire note
                if (notes[noteId].tabs.length === 0) {
                    notes.splice(noteId, 1);
                }
                
                chrome.storage.local.set({ notes: notes }, function() {
                    loadSavedTabs();
                });
            }
        });
    }

    // Function to save all open tabs
    function saveAllTabs() {
        chrome.tabs.query({}, function(tabs) {
            const tabsToSave = tabs
                .filter(tab => !tab.url.startsWith('chrome://'))
                .map(tab => ({
                    id: tab.id,
                    title: tab.title,
                    url: tab.url,
                    favicon: tab.favIconUrl
                }));

            chrome.storage.local.set({ tabs: tabsToSave });
        });
    }

    // Listen for tab updates
    chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
        if (changeInfo.status === 'complete') {
            saveAllTabs();
        }
    });

    // Listen for tab removal
    chrome.tabs.onRemoved.addListener(function(tabId, removeInfo) {
        saveAllTabs();
    });

    // Listen for window focus changes
    chrome.windows.onFocusChanged.addListener(function(windowId) {
        if (windowId !== chrome.windows.WINDOW_ID_NONE) {
            saveAllTabs();
        }
    });

    // Add filter button click handlers
    filterButtons.forEach(button => {
        button.addEventListener('click', () => {
            filterButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            currentFilter = button.dataset.filter;
            loadTabs(searchBox.value);
        });
    });

    // Search functionality
    if (searchBox) {
        searchBox.addEventListener('input', function() {
            loadTabs(this.value);
        });
    }

    // Function to load saved tabs
    function loadSavedTabs() {
        chrome.storage.local.get(['notes'], function(result) {
            savedTabsList.innerHTML = '';
            const notes = result.notes || [];
            
            notes.forEach((note, noteIndex) => {
                note.tabs.forEach((tab, tabIndex) => {
                    savedTabsList.appendChild(createSavedTabItem(tab, noteIndex, tabIndex));
                });
            });
        });
    }

    // Function to save selected tabs
    function saveSelectedTabs() {
        const title = noteTitle.value.trim() || 'Untitled Note';
        const selectedTabs = Array.from(document.querySelectorAll('.tab-checkbox:checked'))
            .map(checkbox => {
                const tabId = parseInt(checkbox.dataset.tabId);
                return chrome.tabs.get(tabId);
            });

        Promise.all(selectedTabs).then(tabs => {
            const note = {
                title: title,
                date: new Date().toISOString(),
                tabs: tabs.map(tab => ({
                    title: tab.title,
                    url: tab.url,
                    favicon: tab.favIconUrl
                }))
            };

            // Get existing notes from storage
            chrome.storage.local.get(['notes'], function(result) {
                const notes = result.notes || [];
                notes.push(note);
                
                // Save updated notes
                chrome.storage.local.set({ notes: notes }, function() {
                    // Clear the title input
                    noteTitle.value = '';
                    // Uncheck all checkboxes
                    document.querySelectorAll('.tab-checkbox').forEach(cb => cb.checked = false);
                    // Reload saved tabs
                    loadSavedTabs();
                    // Show success message
                    alert('Tabs saved successfully!');
                });
            });
        });
    }

    // Add screenshot button functionality
    const screenshotButton = document.getElementById('screenshotButton');
    if (screenshotButton) {
        screenshotButton.addEventListener('click', async () => {
            try {
                // Get the current active tab
                const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                
                if (tab) {
                    // Capture visible tab
                    const dataUrl = await chrome.tabs.captureVisibleTab(null, {
                        format: 'jpeg',
                        quality: 100
                    });

                    // Create a download link
                    const link = document.createElement('a');
                    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                    const filename = `screenshot-${timestamp}.jpg`;
                    
                    link.href = dataUrl;
                    link.download = filename;
                    link.style.display = 'none';
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);

                    // Update the tab's screenshot in storage
                    const result = await chrome.storage.local.get(['savedTabs']);
                    const tabs = result.savedTabs || [];
                    const updatedTabs = tabs.map(t => {
                        if (t.url === tab.url) {
                            return { ...t, screenshot: dataUrl };
                        }
                        return t;
                    });
                    
                    await chrome.storage.local.set({ savedTabs: updatedTabs });
                    
                    // Show success message
                    const originalText = screenshotButton.textContent;
                    screenshotButton.textContent = 'Screenshot Saved!';
                    setTimeout(() => {
                        screenshotButton.textContent = originalText;
                    }, 2000);
                }
            } catch (error) {
                console.error('Error capturing screenshot:', error);
                screenshotButton.textContent = 'Error Taking Screenshot';
                setTimeout(() => {
                    screenshotButton.textContent = 'Take Screenshot';
                }, 2000);
            }
        });
    }

    // Load tabs when popup opens
    loadTabs();
    loadSavedTabs();

    // Add click handler for save button
    saveButton.addEventListener('click', saveSelectedTabs);

    // Refresh tabs every 5 seconds
    setInterval(loadTabs, 5000);
}); 