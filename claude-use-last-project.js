// ==UserScript==
// @name         Claude Re-use last project
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  Automatically selects the last used project for new chats in Claude.ai
// @author       You
// @match        https://claude.ai/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=claude.ai
// @grant        GM_setValue
// @grant        GM_getValue
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    const DEBUG = true;
    const log = (...args) => DEBUG && console.log('[Claude Project Selector]', ...args);
    
    // Reference to the project selector button element
    let projectSelectorElement = null;
    
    // Function to check currently stored project
    function checkStoredProject() {
        const storedProject = GM_getValue('defaultProject', null);
        log('Currently stored default project:', storedProject);
        return storedProject;
    }
    
    // Function to find and store reference to the project selector element
    function findProjectSelector() {
        // Look for the button with aria-label="Select project"
        const projectButton = document.querySelector('button[aria-label="Select project"]');
        
        if (projectButton) {
            log('Found project selector button:', projectButton);
            projectSelectorElement = projectButton;
            
            // Check if a project is already selected and save it
            const fullText = projectButton.textContent.trim();
            const projectName = extractProjectName(fullText);
            
            log('Current project selector text (full):', fullText);
            log('Extracted project name:', projectName);
            
            if (projectName && projectName !== 'Select project') {
                log('Project already selected:', projectName);
                GM_setValue('defaultProject', projectName);
            }
            
            return projectButton;
        }
        
        log('Project selector button not found yet');
        return null;
    }
    
    // Function to extract just the project name from the selector text
    function extractProjectName(selectorText) {
        // The pattern appears to be "projectNameCreated by me" or similar
        // Let's extract just the project name part
        if (!selectorText || selectorText === 'Select project') {
            return selectorText;
        }
        
        // If there's "Created by" text, extract only the project name
        if (selectorText.includes('Created by')) {
            return selectorText.split('Created by')[0].trim();
        }
        
        return selectorText;
    }

    // Function to monitor project selection changes
    function monitorProjectSelection() {
        log('Setting up project selection monitoring');
        
        // Find the project selector if we haven't already
        if (!projectSelectorElement) {
            projectSelectorElement = findProjectSelector();
        }
        
        // Set up a MutationObserver to watch for changes to the project selector
        if (projectSelectorElement) {
            log('Setting up observer for project selector');
            
            const observer = new MutationObserver((mutations) => {
                for (const mutation of mutations) {
                    if (mutation.type === 'childList' || mutation.type === 'characterData') {
                        const fullText = projectSelectorElement.textContent.trim();
                        const projectName = extractProjectName(fullText);
                        
                        log('Project selector text changed to full text:', fullText);
                        log('Extracted project name:', projectName);
                        
                        // If a valid project is selected, save it
                        if (projectName && projectName !== 'Select project') {
                            const storedProject = GM_getValue('defaultProject', null);
                            if (storedProject !== projectName) {
                                log('Saving new project:', projectName);
                                GM_setValue('defaultProject', projectName);
                                console.log('PROJECT SELECTOR: Saved new default project:', projectName);
                            }
                        }
                    }
                }
            });
            
            // Observe text changes to the button and its children
            observer.observe(projectSelectorElement, { 
                childList: true, 
                characterData: true,
                subtree: true 
            });
            
            return true;
        }
        
        return false;
    }
    
    // Function to watch for project selection via clicks
    function watchForProjectClicks() {
        log('Setting up click monitoring for project selection');
        
        document.addEventListener('click', function(e) {
            // Check if we clicked a project option
            let target = e.target;
            
            // Walk up a few levels to find if we clicked on a project option
            for (let i = 0; i < 5; i++) {
                if (!target) break;
                
                // If this is an option in a dropdown
                if (target.getAttribute && target.getAttribute('role') === 'option') {
                    const fullText = target.textContent.trim();
                    const projectName = extractProjectName(fullText);
                    
                    log('Clicked on project option full text:', fullText);
                    log('Extracted project name:', projectName);
                    
                    // Save this as the selected project
                    if (projectName && projectName !== 'Select project') {
                        GM_setValue('defaultProject', projectName);
                        console.log('PROJECT SELECTOR: Saved project from click:', projectName);
                    }
                    
                    break;
                }
                
                target = target.parentElement;
            }
            
            // After any click, check if we need to find the project selector
            setTimeout(() => {
                if (!projectSelectorElement) {
                    findProjectSelector();
                    if (projectSelectorElement) {
                        monitorProjectSelection();
                    }
                }
            }, 500);
        }, true);
    }
    
    // Function to apply the default project to a new chat
    function applyDefaultProject() {
        // Only run on new chat pages
        if (!window.location.pathname.includes('/chat/') && 
            window.location.pathname !== '/new') {
            return;
        }
        
        log('On chat page, looking for default project to apply');
        
        // Get the stored default project
        const defaultProject = GM_getValue('defaultProject', null);
        if (!defaultProject) {
            log('No default project stored, nothing to apply');
            return;
        }
        
        log('Found stored project to apply:', defaultProject);
        console.log('PROJECT SELECTOR: Will try to apply project:', defaultProject);
        
        // Wait for the page to be fully loaded
        let attempts = 0;
        const maxAttempts = 30;
        
        function waitAndApplyProject() {
            attempts++;
            
            // First, look for the "Use a project" button
            const useProjectButton = Array.from(document.querySelectorAll('button')).find(btn => 
                btn.textContent.includes('Use a project') || 
                btn.textContent.includes('Select project')
            );
            
            if (!useProjectButton) {
                log(`"Use a project" button not found, waiting... (attempt ${attempts}/${maxAttempts})`);
                if (attempts < maxAttempts) {
                    setTimeout(waitAndApplyProject, 500);
                } else {
                    log('Gave up looking for "Use a project" button');
                }
                return;
            }
            
            log('Found "Use a project" button, clicking it');
            useProjectButton.click();
            
            // Wait for the dropdown to appear
            setTimeout(() => {
                // Look for the project in the dropdown
                log('Looking for project in dropdown:', defaultProject);
                
                // Try different selectors that might contain the option
                const options = document.querySelectorAll('[role="option"], [role="menuitem"], li');
                log(`Found ${options.length} potential options`);
                
                // Debug - log all option texts
                options.forEach(opt => {
                    const text = opt.textContent.trim();
                    const extracted = extractProjectName(text);
                    log(`Option text: "${text}" => Extracted: "${extracted}"`);
                });
                
                // Find the option with the matching project name
                let found = false;
                for (const option of options) {
                    const optionText = option.textContent.trim();
                    const optionProjectName = extractProjectName(optionText);
                    
                    if (optionProjectName === defaultProject) {
                        log('Found matching project, clicking it');
                        console.log('PROJECT SELECTOR: Selecting project:', defaultProject);
                        option.click();
                        found = true;
                        
                        // Save reference to the project selector for future use
                        setTimeout(() => {
                            findProjectSelector();
                            if (projectSelectorElement) {
                                monitorProjectSelection();
                            }
                        }, 500);
                        
                        break;
                    }
                }
                
                if (!found) {
                    log('Project not found in dropdown, closing it');
                    // Close dropdown by clicking elsewhere
                    document.body.click();
                }
            }, 500);
        }
        
        // Start looking for the project selector with a delay
        setTimeout(waitAndApplyProject, 1500);
    }
    
    // Add a debug button (only visible when DEBUG is true)
    function addDebugButton() {
        if (!DEBUG) return;
        
        // Create a simple debug button
        const button = document.createElement('button');
        button.textContent = 'Project Debug';
        button.style.position = 'fixed';
        button.style.bottom = '10px';
        button.style.right = '10px'; // Changed from left to right
        button.style.zIndex = '9999';
        button.style.background = '#eeeeee';
        button.style.border = '1px solid #cccccc';
        button.style.borderRadius = '4px';
        button.style.padding = '4px 8px';
        button.style.fontSize = '12px';
        button.style.opacity = '0.8';
        
        // Add click handler
        button.addEventListener('click', function() {
            const storedProject = GM_getValue('defaultProject', null);
            alert(`Stored project: ${storedProject || 'None'}\nProject selector found: ${projectSelectorElement ? 'Yes' : 'No'}`);
            console.log('PROJECT SELECTOR DEBUG:', {
                storedProject,
                selectorFound: !!projectSelectorElement,
                currentUrl: window.location.href
            });
            
            // Find the selector if it's not already found
            if (!projectSelectorElement) {
                findProjectSelector();
            }
            
            // Trigger project selection again
            applyDefaultProject();
        });
        
        // Add to document
        document.body.appendChild(button);
    }
    
    // Main initialization function
    function init() {
        log('Initializing Claude Project Selector');
        console.log('PROJECT SELECTOR: Script initialized');
        
        // Check what's currently stored
        const defaultProject = checkStoredProject();
        
        // Make multiple attempts to find the elements and apply the project
        let attempts = 0;
        const maxAttempts = 5;
        
        function attemptInit() {
            attempts++;
            log(`Init attempt ${attempts}/${maxAttempts}`);
            
            // Find the project selector
            findProjectSelector();
            
            // Set up monitoring
            if (projectSelectorElement) {
                monitorProjectSelection();
            } else {
                log('Project selector not found on init attempt ' + attempts);
            }
            
            // Try to apply the default project
            if (defaultProject) {
                applyDefaultProject();
            }
            
            // If we haven't found the selector yet, try again later
            if (!projectSelectorElement && attempts < maxAttempts) {
                setTimeout(attemptInit, 2000);
            }
        }
        
        // Start the first attempt
        attemptInit();
        
        // Always watch for clicks
        watchForProjectClicks();
        
        // Add debug button
        if (DEBUG) {
            setTimeout(addDebugButton, 2000);
        }
    }
    
    // Set up listeners for navigation and URL changes
    function setupNavigationListeners() {
        // Listen for history changes
        window.addEventListener('popstate', () => {
            log('Navigation detected');
            setTimeout(applyDefaultProject, 1000);
        });
        
        // Watch for URL changes
        let lastUrl = location.href;
        new MutationObserver(() => {
            const url = location.href;
            if (url !== lastUrl) {
                lastUrl = url;
                log('URL changed to', url);
                setTimeout(applyDefaultProject, 1000);
            }
        }).observe(document, {subtree: true, childList: true});
    }
    
    // Start everything
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            init();
            setupNavigationListeners();
        });
    } else {
        init();
        setupNavigationListeners();
    }
})();
