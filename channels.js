const elements = safeGetElementsById([
  "portexe-language-select",
  "portexe-category-select", 
  "portexe-search-button",
  "portexe-quality-select"
]);

const {
  "portexe-language-select": languageElement,
  "portexe-category-select": categoryElement,
  "portexe-search-button": catLangApplyButton,
  "portexe-quality-select": qualityElement
} = elements;

// Channel category constants
const CHANNEL_CATEGORIES = {
  FAVORITES: 'favorites',
  TAMIL: 'tamil',
  ENGLISH: 'english',
  SPORTS: 'sports',
  ENTERTAINMENT: 'entertainment',
  NEWS: 'news',
  ALL: 'all'
};

// Language and category mappings from the backend
const LANGUAGE_IDS = {
  TAMIL: 8,
  ENGLISH: 6
};

const CATEGORY_IDS = {
  NEWS: 12,
  SPORTS: 8,
  ENTERTAINMENT: 5
};

// Current active category
let currentCategory = CHANNEL_CATEGORIES.FAVORITES;

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
  initializeChannels();
  setupEventListeners();
  showChannelCategory(CHANNEL_CATEGORIES.FAVORITES);
});

// Setup event listeners
function setupEventListeners() {
  catLangApplyButton.addEventListener("click", () => {
    updateUrlParameters({
      language: languageElement.value,
      category: categoryElement.value,
      q: qualityElement.value
    });
    document.location.href = window.location.href;
  });

  // Set initial values from URL parameters
  const urlParams = getCurrentUrlParams();
  if (urlParams.get("language") && languageElement) {
    languageElement.value = urlParams.get("language");
  }
  if (urlParams.get("category") && categoryElement) {
    categoryElement.value = urlParams.get("category");
  }

  // Set quality from localStorage or URL
  const storedQuality = getLocalStorageItem("quality");
  if (storedQuality && qualityElement) {
    qualityElement.value = storedQuality;
  }
  
  const urlQuality = urlParams.get("q");
  if (urlQuality && qualityElement) {
    qualityElement.value = urlQuality;
    onQualityChange(qualityElement);
  }
}

// Initialize channels and populate all categories
function initializeChannels() {
  const allChannelCards = document.querySelectorAll('a.card[data-channel-id]');
  
  // Process each channel card
  allChannelCards.forEach(card => {
    const channelId = card.dataset.channelId;
    const channelName = card.dataset.channelName;
    const channelCategory = parseInt(card.dataset.channelCategory);
    const channelLanguage = parseInt(card.dataset.channelLanguage);
    const channelLogo = card.dataset.channelLogo;
    
    // Create a clone for each category it belongs to
    const categories = getChannelCategories(channelCategory, channelLanguage);
    
    categories.forEach(category => {
      const clonedCard = card.cloneNode(true);
      clonedCard.id = `${category}-${channelId}`;
      
      // Update favorite button IDs and event handlers
      const favoriteBtn = clonedCard.querySelector('.favorite-btn');
      if (favoriteBtn) {
        favoriteBtn.id = `favorite-btn-${category}-${channelId}`;
        favoriteBtn.onclick = (e) => {
          e.preventDefault();
          toggleFavorite(channelId);
        };
      }
      
      // Update star and X icon IDs
      const starIcon = clonedCard.querySelector(`#star-icon-${channelId}`);
      const xIcon = clonedCard.querySelector(`#x-icon-${channelId}`);
      if (starIcon) starIcon.id = `star-icon-${category}-${channelId}`;
      if (xIcon) xIcon.id = `x-icon-${category}-${channelId}`;
      
      // Add to appropriate container
      const container = document.getElementById(`${category}-container`);
      if (container) {
        container.appendChild(clonedCard);
      }
    });
  });
  
  // Update counts and favorite states
  updateChannelCounts();
  updateFavoriteButtonStates();
  displayFavoriteChannels();
}

// Determine which categories a channel belongs to
function getChannelCategories(category, language) {
  const categories = [CHANNEL_CATEGORIES.ALL];
  
  // Add language-specific categories
  if (language === LANGUAGE_IDS.TAMIL) {
    categories.push(CHANNEL_CATEGORIES.TAMIL);
  }
  if (language === LANGUAGE_IDS.ENGLISH) {
    categories.push(CHANNEL_CATEGORIES.ENGLISH);
  }
  
  // Add category-specific categories
  if (category === CATEGORY_IDS.NEWS) {
    categories.push(CHANNEL_CATEGORIES.NEWS);
  }
  if (category === CATEGORY_IDS.SPORTS) {
    categories.push(CHANNEL_CATEGORIES.SPORTS);
  }
  if (category === CATEGORY_IDS.ENTERTAINMENT) {
    categories.push(CHANNEL_CATEGORIES.ENTERTAINMENT);
  }
  
  return categories;
}

// Show channels for a specific category
function showChannelCategory(category) {
  // Update active tab
  updateActiveTab(category);
  
  // Hide all category sections
  const allSections = document.querySelectorAll('.channel-category');
  allSections.forEach(section => {
    section.classList.add('hidden');
  });
  
  // Show selected category section
  const selectedSection = document.getElementById(`${category}-section`);
  if (selectedSection) {
    selectedSection.classList.remove('hidden');
  }
  
  currentCategory = category;
  
  // Update channel counts
  updateChannelCounts();
}

// Update active tab styling
function updateActiveTab(activeCategory) {
  const allTabs = document.querySelectorAll('.tab');
  allTabs.forEach(tab => {
    tab.classList.remove('tab-active');
  });
  
  // Find the tab button for the active category
  const tabButtons = document.querySelectorAll('.tab');
  tabButtons.forEach(tab => {
    if (tab.textContent.trim().toLowerCase().includes(activeCategory)) {
      tab.classList.add('tab-active');
    }
  });
}

// Update channel counts for each category
function updateChannelCounts() {
    // Update count for each category
    const favoritesCount = document.getElementById('favorites-container').children.length;
    const tamilCount = document.getElementById('tamil-container').children.length;
    const englishCount = document.getElementById('english-container').children.length;
    const sportsCount = document.getElementById('sports-container').children.length;
    const entertainmentCount = document.getElementById('entertainment-container').children.length;
    const newsCount = document.getElementById('news-container').children.length;
    const allCount = document.getElementById('all-container').children.length;
    
    // Update the badge counts
    document.getElementById('favorites-count').textContent = favoritesCount;
    document.getElementById('tamil-count').textContent = tamilCount;
    document.getElementById('english-count').textContent = englishCount;
    document.getElementById('sports-count').textContent = sportsCount;
    document.getElementById('entertainment-count').textContent = entertainmentCount;
    document.getElementById('news-count').textContent = newsCount;
    document.getElementById('all-count').textContent = allCount;
}

// Quality change handler
const onQualityChange = (elem) => {
  const quality = elem.value;
  
  if (quality === "auto") {
    updateUrlParameter("q", "");
    removeLocalStorageItem("quality");
  } else {
    updateUrlParameter("q", quality);
    setLocalStorageItem("quality", quality);
  }
  
  // Update all card href attributes with new query parameter
  const playElems = document.querySelectorAll(".card");
  const currentParams = getCurrentUrlParams();
  
  for (let i = 0; i < playElems.length; i++) {
    const cardElem = playElems[i];
    const href = cardElem.getAttribute("href");
    cardElem.setAttribute("href", href.split("?")[0] + "?" + currentParams.toString());
  }
};

// Scroll to top function
const scrollToTop = () => {
  window.scrollTo({
    top: 0,
    behavior: "smooth",
  });
};

// Favorite Channels Functionality
const FAVORITES_STORAGE_KEY = "favoriteChannels";

function getFavoriteChannels() {
  return getLocalStorageItem(FAVORITES_STORAGE_KEY, []);
}

function saveFavoriteChannels(favoriteIds) {
  setLocalStorageItem(FAVORITES_STORAGE_KEY, favoriteIds);
}

function displayFavoriteChannels() {
  const favoriteIds = getFavoriteChannels();
  const favoritesContainer = document.getElementById('favorites-container');
  
  if (!favoritesContainer) return;
  
  // Clear favorites container
  favoritesContainer.innerHTML = '';
  
  if (favoriteIds.length > 0) {
    // Find and clone favorite channel cards
    favoriteIds.forEach(channelId => {
      const originalCard = document.querySelector(`a.card[data-channel-id="${channelId}"]`);
      if (originalCard) {
        const clonedCard = originalCard.cloneNode(true);
        clonedCard.id = `favorites-${channelId}`;
        
        // Update favorite button
        const favoriteBtn = clonedCard.querySelector('.favorite-btn');
        if (favoriteBtn) {
          favoriteBtn.id = `favorite-btn-favorites-${channelId}`;
          favoriteBtn.onclick = (e) => {
            e.preventDefault();
            toggleFavorite(channelId);
          };
        }
        
        // Update star and X icon IDs
        const starIcon = clonedCard.querySelector(`#star-icon-${channelId}`);
        const xIcon = clonedCard.querySelector(`#x-icon-${channelId}`);
        if (starIcon) starIcon.id = `star-icon-favorites-${channelId}`;
        if (xIcon) xIcon.id = `x-icon-favorites-${channelId}`;
        
        favoritesContainer.appendChild(clonedCard);
      }
    });
  }
  
  // Update counts
  updateChannelCounts();
}

function toggleFavorite(channelId) {
  const favoriteIds = getFavoriteChannels();
  const index = favoriteIds.indexOf(channelId);

  if (index > -1) { // Channel was a favorite, removing it
    favoriteIds.splice(index, 1);
    updateFavoriteButtonState(channelId, false);
  } else { // Channel was not a favorite, adding it
    favoriteIds.push(channelId);
    updateFavoriteButtonState(channelId, true);
  }
  
  saveFavoriteChannels(favoriteIds);
  displayFavoriteChannels(); // Refresh the favorites list
  
  // Also refresh the category sections to show favorites at the top
  refreshCategorySections();
}

function updateFavoriteButtonState(channelId, isFavorite) {
    // Update all instances of this channel across categories
    const categories = [CHANNEL_CATEGORIES.FAVORITES, CHANNEL_CATEGORIES.TAMIL, CHANNEL_CATEGORIES.ENGLISH, CHANNEL_CATEGORIES.SPORTS, CHANNEL_CATEGORIES.ENTERTAINMENT, CHANNEL_CATEGORIES.NEWS, CHANNEL_CATEGORIES.ALL];
    
    categories.forEach(category => {
        const starIcon = document.getElementById(`star-icon-${category}-${channelId}`);
        const xIcon = document.getElementById(`x-icon-${category}-${channelId}`);
        
        if (starIcon && xIcon) {
            if (isFavorite) {
                starIcon.classList.add('hidden');
                xIcon.classList.remove('hidden');
            } else {
                starIcon.classList.remove('hidden');
                xIcon.classList.add('hidden');
            }
        }
    });
}

function updateFavoriteButtonStates() {
  const favoriteIds = getFavoriteChannels();
  const favoriteButtons = document.querySelectorAll(".favorite-btn");

  favoriteButtons.forEach(button => {
    const channelId = button.id.replace(/favorite-btn-.*?-/, "");
    updateFavoriteButtonState(channelId, favoriteIds.includes(channelId));
  });
}

// Helper function to update favorite button state in a cloned card
function updateCardFavoriteButton(card, channelId, isFavorite) {
  const favoriteBtn = card.querySelector('.favorite-btn');
  if (favoriteBtn) {
    favoriteBtn.onclick = (e) => {
      e.preventDefault();
      toggleFavorite(channelId);
    };
  }
  
  // Update star and X icon visibility
  const starIcon = card.querySelector(`#star-icon-${channelId}`);
  const xIcon = card.querySelector(`#x-icon-${channelId}`);
  
  if (starIcon && xIcon) {
    if (isFavorite) {
      starIcon.classList.add('hidden');
      xIcon.classList.remove('hidden');
    } else {
      starIcon.classList.remove('hidden');
      xIcon.classList.add('hidden');
    }
  }
}

// New function to refresh all category sections with favorites at the top
function refreshCategorySections() {
  const allChannels = document.querySelectorAll('#original-channels-grid .card');
  const favoriteIds = getFavoriteChannels();
  
  // Clear all category containers
  const categoryContainers = {
    'tamil': document.getElementById('tamil-container'),
    'english': document.getElementById('english-container'),
    'sports': document.getElementById('sports-container'),
    'entertainment': document.getElementById('entertainment-container'),
    'news': document.getElementById('news-container'),
    'all': document.getElementById('all-container')
  };
  
  // Clear each container
  Object.values(categoryContainers).forEach(container => {
    if (container) container.innerHTML = '';
  });
  
  // Prepare channels for each category with favorites first
  const categoryChannels = {
    'tamil': [],
    'english': [],
    'sports': [],
    'entertainment': [],
    'news': [],
    'all': []
  };
  
  // Process each channel and categorize them
  allChannels.forEach(channelCard => {
    const channelId = channelCard.getAttribute('data-channel-id');
    const channelLanguage = parseInt(channelCard.getAttribute('data-channel-language'));
    const channelCategory = parseInt(channelCard.getAttribute('data-channel-category'));
    const isFavorite = favoriteIds.includes(channelId);
    
    // Clone the channel card
    const cardClone = channelCard.cloneNode(true);
    
    // Update favorite button state
    updateCardFavoriteButton(cardClone, channelId, isFavorite);
    
    // Create channel object with favorite priority
    const channelObj = {
      card: cardClone,
      isFavorite: isFavorite,
      channelId: channelId
    };
    
    // Add to Tamil section if Tamil language (ID: 8)
    if (channelLanguage === 8) {
      categoryChannels.tamil.push(channelObj);
    }
    
    // Add to English section if English language (ID: 6)
    if (channelLanguage === 6) {
      categoryChannels.english.push(channelObj);
    }
    
    // Add to Sports section if Sports category (ID: 8)
    if (channelCategory === 8) {
      categoryChannels.sports.push(channelObj);
    }
    
    // Add to Entertainment section if Entertainment category (ID: 5)
    if (channelCategory === 5) {
      categoryChannels.entertainment.push(channelObj);
    }
    
    // Add to News section if News category (ID: 12)
    if (channelCategory === 12) {
      categoryChannels.news.push(channelObj);
    }
    
    // Add to All section
    categoryChannels.all.push(channelObj);
  });
  
  // Sort each category: favorites first, then others
  Object.keys(categoryChannels).forEach(category => {
    categoryChannels[category].sort((a, b) => {
      // Favorites first (true comes before false)
      if (a.isFavorite && !b.isFavorite) return -1;
      if (!a.isFavorite && b.isFavorite) return 1;
      // If both have same favorite status, maintain original order
      return 0;
    });
  });
  
  // Add sorted channels to containers
  Object.keys(categoryChannels).forEach(category => {
    const container = categoryContainers[category];
    if (container) {
      categoryChannels[category].forEach((channelObj, index) => {
        const finalCard = channelObj.card.cloneNode(true);
        finalCard.id = `${category}-${channelObj.channelId}`;
        
        // Update favorite button state again for the final card
        updateCardFavoriteButton(finalCard, channelObj.channelId, channelObj.isFavorite);
        
        container.appendChild(finalCard);
      });
    }
  });
  
  // Update channel counts
  updateChannelCounts();
}

// Missing functions
function toggleTheme() {
    // This function should be defined in common.js
    if (typeof window.toggleTheme === 'function') {
        window.toggleTheme();
    }
}

function logout() {
    // Simple logout function
    if (confirm('Are you sure you want to logout?')) {
        window.location.href = '/logout';
    }
}
