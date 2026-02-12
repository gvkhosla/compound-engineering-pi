/**
 * Compounding Engineering Documentation
 * Main JavaScript functionality
 */

document.addEventListener('DOMContentLoaded', () => {
  initMobileNav();
  initSmoothScroll();
  initCopyCode();
  initThemeToggle();
});

/**
 * Mobile Navigation Toggle
 */
function initMobileNav() {
  const mobileToggle = document.querySelector('[data-mobile-toggle]');
  const navigation = document.querySelector('[data-navigation]');

  if (!mobileToggle || !navigation) return;

  mobileToggle.addEventListener('click', () => {
    navigation.classList.toggle('open');
    mobileToggle.classList.toggle('active');

    // Update aria-expanded
    const isOpen = navigation.classList.contains('open');
    mobileToggle.setAttribute('aria-expanded', isOpen);
  });

  // Close menu when clicking outside
  document.addEventListener('click', (event) => {
    if (!mobileToggle.contains(event.target) && !navigation.contains(event.target)) {
      navigation.classList.remove('open');
      mobileToggle.classList.remove('active');
      mobileToggle.setAttribute('aria-expanded', 'false');
    }
  });

  // Close menu when clicking a nav link
  navigation.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', () => {
      navigation.classList.remove('open');
      mobileToggle.classList.remove('active');
      mobileToggle.setAttribute('aria-expanded', 'false');
    });
  });
}

/**
 * Smooth Scroll for Anchor Links
 */
function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      const targetId = this.getAttribute('href');
      if (targetId === '#') return;

      const targetElement = document.querySelector(targetId);
      if (!targetElement) return;

      e.preventDefault();

      const navHeight = document.querySelector('.nav-container')?.offsetHeight || 0;
      const targetPosition = targetElement.getBoundingClientRect().top + window.pageYOffset - navHeight - 24;

      window.scrollTo({
        top: targetPosition,
        behavior: 'smooth'
      });

      // Update URL without jumping
      history.pushState(null, null, targetId);
    });
  });
}

/**
 * Copy Code Functionality
 */
function initCopyCode() {
  document.querySelectorAll('.card-code-block').forEach(block => {
    // Create copy button
    const copyBtn = document.createElement('button');
    copyBtn.className = 'copy-btn';
    copyBtn.innerHTML = '<i class="fa-regular fa-copy"></i>';
    copyBtn.setAttribute('aria-label', 'Copy code');
    copyBtn.setAttribute('title', 'Copy to clipboard');

    // Style the button
    copyBtn.style.cssText = `
      position: absolute;
      top: 8px;
      right: 8px;
      padding: 6px 10px;
      background: rgba(255, 255, 255, 0.1);
      border: none;
      border-radius: 6px;
      color: #94a3b8;
      cursor: pointer;
      opacity: 0;
      transition: all 0.2s ease;
      font-size: 14px;
    `;

    // Make parent relative for positioning
    block.style.position = 'relative';
    block.appendChild(copyBtn);

    // Show/hide on hover
    block.addEventListener('mouseenter', () => {
      copyBtn.style.opacity = '1';
    });

    block.addEventListener('mouseleave', () => {
      copyBtn.style.opacity = '0';
    });

    // Copy functionality
    copyBtn.addEventListener('click', async () => {
      const code = block.querySelector('code');
      if (!code) return;

      try {
        await navigator.clipboard.writeText(code.textContent);
        copyBtn.innerHTML = '<i class="fa-solid fa-check"></i>';
        copyBtn.style.color = '#34d399';

        setTimeout(() => {
          copyBtn.innerHTML = '<i class="fa-regular fa-copy"></i>';
          copyBtn.style.color = '#94a3b8';
        }, 2000);
      } catch (err) {
        console.error('Failed to copy:', err);
        copyBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
        copyBtn.style.color = '#f87171';

        setTimeout(() => {
          copyBtn.innerHTML = '<i class="fa-regular fa-copy"></i>';
          copyBtn.style.color = '#94a3b8';
        }, 2000);
      }
    });
  });
}

/**
 * Theme Toggle (Light/Dark)
 */
function initThemeToggle() {
  // Check for saved theme preference or default to dark
  const savedTheme = localStorage.getItem('theme') || 'dark';
  document.documentElement.className = `theme-${savedTheme}`;

  // Create theme toggle button if it doesn't exist
  const existingToggle = document.querySelector('[data-theme-toggle]');
  if (existingToggle) {
    existingToggle.addEventListener('click', toggleTheme);
    updateThemeToggleIcon(existingToggle, savedTheme);
  }
}

function toggleTheme() {
  const html = document.documentElement;
  const currentTheme = html.classList.contains('theme-dark') ? 'dark' : 'light';
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

  html.className = `theme-${newTheme}`;
  localStorage.setItem('theme', newTheme);

  const toggle = document.querySelector('[data-theme-toggle]');
  if (toggle) {
    updateThemeToggleIcon(toggle, newTheme);
  }
}

function updateThemeToggleIcon(toggle, theme) {
  const icon = toggle.querySelector('i');
  if (icon) {
    icon.className = theme === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
  }
}

/**
 * Intersection Observer for Animation on Scroll
 */
function initScrollAnimations() {
  const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, observerOptions);

  document.querySelectorAll('.agent-card, .command-card, .skill-card, .mcp-card, .stat-card').forEach(card => {
    card.style.opacity = '0';
    card.style.transform = 'translateY(20px)';
    card.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
    observer.observe(card);
  });
}

// Add visible class styles
const style = document.createElement('style');
style.textContent = `
  .agent-card.visible,
  .command-card.visible,
  .skill-card.visible,
  .mcp-card.visible,
  .stat-card.visible {
    opacity: 1 !important;
    transform: translateY(0) !important;
  }
`;
document.head.appendChild(style);

// Initialize scroll animations after a short delay
setTimeout(initScrollAnimations, 100);
