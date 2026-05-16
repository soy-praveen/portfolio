// ===== DOM READY =====
document.addEventListener('DOMContentLoaded', () => {
    initThemeToggle();
    initLoader();
    initNavbar();
    initMobileMenu();
    initScrollReveal();
    initCountUp();
    initFilters();
    initFAQ();
    initPricingToggle();
    initParticles();
    initBlurDemo();
    initTimelineProgress();
    initSmoothScroll();
});

// ===== LOADER =====
function initLoader() {
    const loader = document.getElementById('loader');
    const progress = document.getElementById('loaderProgress');
    let width = 0;

    const interval = setInterval(() => {
        width += Math.random() * 15 + 5;
        if (width >= 100) {
            width = 100;
            clearInterval(interval);
            setTimeout(() => {
                loader.classList.add('hidden');
                document.body.style.overflow = 'auto';
            }, 400);
        }
        progress.style.width = width + '%';
    }, 100);

    document.body.style.overflow = 'hidden';
}


// ===== NAVBAR =====
function initNavbar() {
    const navbar = document.getElementById('navbar');
    const navLinks = document.querySelectorAll('.nav-link');

    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }

        // Active section highlighting
        const sections = document.querySelectorAll('section[id]');
        let current = '';
        sections.forEach(section => {
            const top = section.offsetTop - 200;
            if (window.scrollY >= top) {
                current = section.getAttribute('id');
            }
        });

        navLinks.forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href') === '#' + current) {
                link.classList.add('active');
            }
        });
    });
}

// ===== MOBILE MENU =====
function initMobileMenu() {
    const toggle = document.getElementById('navToggle');
    const menu = document.getElementById('mobileMenu');

    toggle.addEventListener('click', () => {
        toggle.classList.toggle('open');
        menu.classList.toggle('open');
        document.body.style.overflow = menu.classList.contains('open') ? 'hidden' : '';
    });

    document.querySelectorAll('.mobile-link').forEach(link => {
        link.addEventListener('click', () => {
            toggle.classList.remove('open');
            menu.classList.remove('open');
            document.body.style.overflow = '';
        });
    });
}

// ===== SCROLL REVEAL =====
function initScrollReveal() {
    const reveals = document.querySelectorAll('.reveal');

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
            }
        });
    }, {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    });

    reveals.forEach(el => observer.observe(el));
}

// ===== COUNT UP ANIMATION =====
function initCountUp() {
    const statNumbers = document.querySelectorAll('.stat-number');
    let counted = false;

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting && !counted) {
                counted = true;
                statNumbers.forEach(num => {
                    const target = parseFloat(num.getAttribute('data-target'));
                    const isDecimal = target % 1 !== 0;
                    const duration = 2000;
                    const startTime = performance.now();

                    function update(currentTime) {
                        const elapsed = currentTime - startTime;
                        const progress = Math.min(elapsed / duration, 1);

                        // Ease out cubic
                        const eased = 1 - Math.pow(1 - progress, 3);
                        const current = eased * target;

                        if (isDecimal) {
                            num.textContent = current.toFixed(1);
                        } else {
                            num.textContent = Math.floor(current);
                        }

                        if (progress < 1) {
                            requestAnimationFrame(update);
                        }
                    }
                    requestAnimationFrame(update);
                });
            }
        });
    }, { threshold: 0.5 });

    const statsContainer = document.querySelector('.hero-stats');
    if (statsContainer) observer.observe(statsContainer);
}

// ===== EXTENSION FILTERS =====
function initFilters() {
    const filterBtns = document.querySelectorAll('.filter-btn');
    const cards = document.querySelectorAll('.ext-card');

    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Update active button
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const filter = btn.getAttribute('data-filter');

            cards.forEach(card => {
                const categories = card.getAttribute('data-category');
                if (filter === 'all' || categories.includes(filter)) {
                    card.style.display = '';
                    card.style.opacity = '0';
                    card.style.transform = 'translateY(20px)';
                    setTimeout(() => {
                        card.style.opacity = '1';
                        card.style.transform = 'translateY(0)';
                    }, 50);
                } else {
                    card.style.opacity = '0';
                    card.style.transform = 'translateY(20px)';
                    setTimeout(() => {
                        card.style.display = 'none';
                    }, 300);
                }
            });
        });
    });
}

// ===== FAQ ACCORDION =====
function initFAQ() {
    const items = document.querySelectorAll('.faq-item');

    items.forEach(item => {
        const question = item.querySelector('.faq-question');
        question.addEventListener('click', () => {
            const isOpen = item.classList.contains('open');

            // Close all
            items.forEach(i => i.classList.remove('open'));

            // Toggle current
            if (!isOpen) {
                item.classList.add('open');
            }
        });
    });
}

// ===== PRICING TOGGLE =====
function initPricingToggle() {
    const toggle = document.getElementById('pricingToggle');
    const monthlyLabel = document.getElementById('monthlyLabel');
    const yearlyLabel = document.getElementById('yearlyLabel');
    let isYearly = false;

    toggle.addEventListener('click', () => {
        isYearly = !isYearly;
        toggle.classList.toggle('yearly', isYearly);
        monthlyLabel.classList.toggle('active', !isYearly);
        yearlyLabel.classList.toggle('active', isYearly);

        // Update prices
        document.querySelectorAll('.price-amount[data-monthly]').forEach(el => {
            el.textContent = isYearly ? el.dataset.yearly : el.dataset.monthly;
        });
        document.querySelectorAll('.price-period[data-monthly]').forEach(el => {
            el.textContent = isYearly ? el.dataset.yearly : el.dataset.monthly;
        });
    });
}

// ===== FLOATING PARTICLES =====
function initParticles() {
    const container = document.getElementById('particles');
    if (!container) return;

    for (let i = 0; i < 30; i++) {
        const particle = document.createElement('div');
        particle.classList.add('particle');
        particle.style.left = Math.random() * 100 + '%';
        particle.style.animationDuration = (Math.random() * 10 + 8) + 's';
        particle.style.animationDelay = (Math.random() * 10) + 's';
        particle.style.width = (Math.random() * 3 + 1) + 'px';
        particle.style.height = particle.style.width;
        particle.style.opacity = Math.random() * 0.5 + 0.2;
        container.appendChild(particle);
    }
}

// ===== BLUR DEMO ANIMATION =====
function initBlurDemo() {
    const blurSite = document.getElementById('blurDemo');
    const blurTimerEl = document.getElementById('blurTimer');
    if (!blurSite || !blurTimerEl) return;

    let totalSeconds = 5;
    let current = totalSeconds;
    let interval;
    let isBlurred = false;

    function formatTime(s) {
        const mins = Math.floor(s / 60);
        const secs = s % 60;
        return mins + ':' + (secs < 10 ? '0' : '') + secs;
    }

    function startTimer() {
        current = totalSeconds;
        isBlurred = false;
        blurSite.classList.remove('blurred');
        blurTimerEl.textContent = formatTime(current);

        interval = setInterval(() => {
            current--;
            blurTimerEl.textContent = formatTime(current);

            if (current <= 0) {
                clearInterval(interval);
                blurSite.classList.add('blurred');
                isBlurred = true;

                // Reset after 3 seconds
                setTimeout(() => {
                    startTimer();
                }, 3000);
            }
        }, 1000);
    }

    // Start when visible
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                startTimer();
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.5 });

    observer.observe(blurSite);
}

// ===== TIMELINE PROGRESS =====
function initTimelineProgress() {
    const timeline = document.getElementById('timelineProgress');
    const section = document.getElementById('how-it-works');
    if (!timeline || !section) return;

    window.addEventListener('scroll', () => {
        const rect = section.getBoundingClientRect();
        const sectionHeight = section.offsetHeight;
        const windowHeight = window.innerHeight;

        if (rect.top < windowHeight && rect.bottom > 0) {
            const scrolled = (windowHeight - rect.top) / (sectionHeight + windowHeight);
            const progress = Math.min(Math.max(scrolled * 100, 0), 100);
            timeline.style.height = progress + '%';
        }
    });
}

// ===== SMOOTH SCROLL =====
function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                e.preventDefault();
                const offset = 80;
                const top = target.getBoundingClientRect().top + window.scrollY - offset;
                window.scrollTo({ top, behavior: 'smooth' });
            }
        });
    });
}

// ===== THEME TOGGLE (Neo-Brutalism) =====
function initThemeToggle() {
    const toggle = document.getElementById('themeToggle');
    if (!toggle) return;

    const icon = toggle.querySelector('i');

    // Restore saved theme
    const savedTheme = localStorage.getItem('jyoprax-theme');
    if (savedTheme === 'neo-brutalism') {
        document.body.classList.add('neo-brutalism');
        toggle.classList.add('active');
        if (icon) {
            icon.className = 'fas fa-sparkles';
        }
    }

    toggle.addEventListener('click', () => {
        const isNeo = document.body.classList.toggle('neo-brutalism');
        toggle.classList.toggle('active', isNeo);

        // Animate the icon swap
        if (icon) {
            icon.style.transform = 'rotate(180deg) scale(0)';
            setTimeout(() => {
                icon.className = isNeo ? 'fas fa-sparkles' : 'fas fa-cube';
                icon.style.transform = 'rotate(0deg) scale(1)';
            }, 150);
        }

        // Persist preference
        localStorage.setItem('jyoprax-theme', isNeo ? 'neo-brutalism' : 'default');
    });
}