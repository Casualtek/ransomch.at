// Main JavaScript for Ransomch.at

// Function to format numbers with appropriate suffixes
function formatNumber(num) {
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
}

// Function to animate number counting
function animateNumber(element, targetNum, duration = 2000) {
    const startNum = 0;
    const startTime = performance.now();
    
    function updateNumber(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Easing function for smooth animation
        const easeOut = 1 - Math.pow(1 - progress, 3);
        const currentNum = Math.floor(startNum + (targetNum - startNum) * easeOut);
        
        element.textContent = formatNumber(currentNum);
        
        if (progress < 1) {
            requestAnimationFrame(updateNumber);
        } else {
            element.textContent = formatNumber(targetNum);
        }
    }
    
    requestAnimationFrame(updateNumber);
}

// Function to load and display the last updated date
async function loadLastUpdated() {
    const lastUpdatedElement = document.getElementById('last-updated');
    
    try {
        const url = `https://raw.githubusercontent.com/Casualtek/Ransomchats/main/chat_index.json?t=${Date.now()}`;
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`Failed to load chat index: HTTP ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.last_updated) {
            const date = new Date(data.last_updated);
            const formattedDate = date.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
            lastUpdatedElement.textContent = `Last updated: ${formattedDate}`;
        } else {
            lastUpdatedElement.textContent = 'Last updated: Unknown';
        }
    } catch (error) {
        console.error('Error loading last updated date:', error);
        lastUpdatedElement.textContent = 'Last updated: Unable to load';
    }
}

// Function to load statistics from the JSON file
async function loadStatistics() {
    const statElements = {
        chats: document.getElementById('stat-chats'),
        groups: document.getElementById('stat-groups'),
        messages: document.getElementById('stat-messages')
    };

    const errorElements = {
        chats: document.getElementById('error-chats'),
        groups: document.getElementById('error-groups'),
        messages: document.getElementById('error-messages')
    };

    const lastUpdatedElement = document.getElementById('last-updated');

    // Add loading animation
    Object.values(statElements).forEach(el => {
        if (el) el.classList.add('loading');
    });

    // Clear any previous error messages
    Object.values(errorElements).forEach(el => {
        if (el) {
            el.classList.remove('show');
            el.textContent = '';
        }
    });

    console.log('Attempting to load statistics...');

    try {
        // Use the same URL and method as viewer.html with cache busting
        const url = `https://raw.githubusercontent.com/Casualtek/Ransomchats/main/chat_index.json?t=${Date.now()}`;
        
        console.log(`Loading data from: ${url}`);
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`Failed to load chat index: HTTP ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Successfully loaded JSON:', data);

        // Remove loading animation
        Object.values(statElements).forEach(el => {
            if (el) el.classList.remove('loading');
        });

        // Update last updated date
        if (data.last_updated && lastUpdatedElement) {
            const date = new Date(data.last_updated);
            const formattedDate = date.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
            lastUpdatedElement.textContent = `Last updated: ${formattedDate}`;
        } else if (lastUpdatedElement) {
            lastUpdatedElement.textContent = 'Last updated: Unknown';
        }

        // Extract statistics - check if data has statistics property or if it's the root
        const stats = data.statistics || data;
        
        // Animate the numbers with the actual data
        if (stats.total_chats !== undefined && statElements.chats) {
            animateNumber(statElements.chats, stats.total_chats);
        } else {
            // Try to calculate from groups if available
            if (data.groups && statElements.chats) {
                const totalChats = Object.values(data.groups).reduce((sum, group) => {
                    return sum + (group.chats ? group.chats.length : 0);
                }, 0);
                animateNumber(statElements.chats, totalChats);
            } else if (statElements.chats) {
                statElements.chats.textContent = 'N/A';
                if (errorElements.chats) {
                    errorElements.chats.textContent = 'total_chats not found';
                    errorElements.chats.classList.add('show');
                }
            }
        }
        
        if (stats.total_groups !== undefined && statElements.groups) {
            animateNumber(statElements.groups, stats.total_groups);
        } else {
            // Try to calculate from groups if available
            if (data.groups && statElements.groups) {
                const totalGroups = Object.keys(data.groups).length;
                animateNumber(statElements.groups, totalGroups);
            } else if (statElements.groups) {
                statElements.groups.textContent = 'N/A';
                if (errorElements.groups) {
                    errorElements.groups.textContent = 'total_groups not found';
                    errorElements.groups.classList.add('show');
                }
            }
        }
        
        if (stats.total_messages !== undefined && statElements.messages) {
            animateNumber(statElements.messages, stats.total_messages);
        } else {
            // Try to calculate from groups if available
            if (data.groups && statElements.messages) {
                const totalMessages = Object.values(data.groups).reduce((sum, group) => {
                    return sum + (group.chats ? group.chats.reduce((chatSum, chat) => {
                        return chatSum + (chat.message_count || 0);
                    }, 0) : 0);
                }, 0);
                animateNumber(statElements.messages, totalMessages);
            } else if (statElements.messages) {
                statElements.messages.textContent = 'N/A';
                if (errorElements.messages) {
                    errorElements.messages.textContent = 'total_messages not found';
                    errorElements.messages.classList.add('show');
                }
            }
        }

    } catch (error) {
        console.error('Error loading statistics:', error);
        
        // Remove loading animation and show fallback numbers
        Object.values(statElements).forEach(el => {
            if (el) el.classList.remove('loading');
        });

        // Show fallback last updated date
        if (lastUpdatedElement) {
            lastUpdatedElement.textContent = 'Last updated: Unable to load';
        }

        // Show some demo numbers as fallback
        if (statElements.chats) animateNumber(statElements.chats, 218);
        if (statElements.groups) animateNumber(statElements.groups, 23);
        if (statElements.messages) animateNumber(statElements.messages, 10699);

        // Show error messages
        Object.values(errorElements).forEach(el => {
            if (el) {
                el.textContent = 'Using demo data';
                el.classList.add('show');
            }
        });
        
        console.log('Using fallback demo data due to loading error');
    }
}

// Create floating particles effect
function createParticles() {
    const particlesContainer = document.getElementById('particles');
    if (!particlesContainer) return;
    
    const particleCount = 50;

    for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        particle.style.left = Math.random() * 100 + '%';
        particle.style.animationDelay = Math.random() * 20 + 's';
        particle.style.animationDuration = (15 + Math.random() * 10) + 's';
        particlesContainer.appendChild(particle);
    }
}

// Smooth scrolling for navigation links
function setupSmoothScrolling() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });
}

// Add parallax effect to hero section
function setupParallaxEffect() {
    window.addEventListener('scroll', () => {
        const scrolled = window.pageYOffset;
        const hero = document.querySelector('.hero');
        if (hero) {
            hero.style.transform = `translateY(${scrolled * 0.5}px)`;
        }
    });
}

// Add loading animation to CTA buttons
function setupCTAButtons() {
    document.querySelectorAll('.btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            if (this.classList.contains('btn-primary')) {
                this.style.transform = 'scale(0.95)';
                setTimeout(() => {
                    this.style.transform = '';
                }, 150);
            }
        });
    });
}

// Initialize common functionality when page loads
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, initializing...');
    createParticles();
    setupSmoothScrolling();
    setupParallaxEffect();
    setupCTAButtons();
    
    // Load statistics if the elements exist (for index.html)
    if (document.getElementById('stat-chats')) {
        loadStatistics();
    }
    
    // Load last updated date if the element exists
    if (document.getElementById('last-updated')) {
        loadLastUpdated();
    }
});

// Also try loading stats when the page is fully loaded
window.addEventListener('load', function() {
    console.log('Window loaded');
    // Don't reload if already loaded successfully
    const firstStat = document.getElementById('stat-chats');
    if (firstStat && firstStat.textContent === '...') {
        console.log('Stats not loaded yet, retrying...');
        setTimeout(loadStatistics, 1000);
    }
});
