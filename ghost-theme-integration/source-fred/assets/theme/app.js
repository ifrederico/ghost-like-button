// app.js - Ghost Theme JavaScript

/**
 * First-time visitor signup prompt
 * Shows signup modal to new visitors on homepage
 */
(async function initSignupPrompt() {
    const isHomepage = window.location.pathname === '/';
    const hasSeenSplash = document.cookie.includes('splashSeen');
    const isHandledThisSession = sessionStorage.getItem('splashHandled');
    
    if (!isHomepage || hasSeenSplash || isHandledThisSession) return;
    
    // Mark as handled immediately to prevent race conditions
    sessionStorage.setItem('splashHandled', 'true');
    
    try {
        const response = await fetch('/members/api/member/');
        const isNotMember = response.status !== 200;
        
        if (isNotMember) {
            showSignupModal();
        }
    } catch (error) {
        // Network error - assume not a member
        showSignupModal();
    }
    
    function showSignupModal() {
        document.cookie = 'splashSeen=true; max-age=2592000; path=/; domain=.fred.pt';
        window.location.hash = '#/portal/signup';
    }
})();

/**
 * Hide Ghost Portal branding
 * Removes Ghost logo and powered-by text from portal iframe
 */
(function hidePortalBranding() {
    const observer = new MutationObserver(handleMutations);
    observer.observe(document.body, { childList: true, subtree: true });
    
    function handleMutations(mutations) {
        mutations.forEach(({ addedNodes }) => {
            addedNodes.forEach(node => {
                if (!node.querySelector) return;
                
                const iframe = node.querySelector('iframe[data-testid="portal-popup-frame"]');
                if (iframe) {
                    injectPortalStyles(iframe);
                }
            });
        });
    }
    
    function injectPortalStyles(iframe) {
        iframe.onload = () => {
            try {
                const style = document.createElement("style");
                style.textContent = `
                    .gh-portal-signup-logo,
                    .gh-portal-powered {
                        display: none !important;
                    }
                `;
                iframe.contentWindow.document.head.appendChild(style);
            } catch(e) {
                // Cross-origin error - portal may be on different domain
                console.debug('Could not modify portal styles:', e.message);
            }
        };
    }
})();