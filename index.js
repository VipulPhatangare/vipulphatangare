// Mobile menu toggle
const menuBtn = document.getElementById('menuBtn');
const sidebar = document.getElementById('sidebar');
const mainContainer = document.getElementById('mainContainer');

menuBtn.addEventListener('click', function() {
    sidebar.classList.toggle('active');
    mainContainer.classList.toggle('sidebar-open');
    
    // Change icon
    const icon = this.querySelector('i');
    if (sidebar.classList.contains('active')) {
        icon.classList.remove('fa-bars');
        icon.classList.add('fa-times');
    } else {
        icon.classList.remove('fa-times');
        icon.classList.add('fa-bars');
    }
});

// Smooth page transitions
document.addEventListener('DOMContentLoaded', function() {
    // Navigation
    const navLinks = document.querySelectorAll('.nav-link, .mobile-nav a');
    
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            
            // Get target section
            const targetId = this.getAttribute('href');
            const targetSection = document.querySelector(targetId);
            
            // Hide all sections
            document.querySelectorAll('.main-content').forEach(section => {
                section.style.display = 'none';
            });
            
            // Show target section with animation
            targetSection.style.display = 'block';
            targetSection.style.opacity = '0';
            targetSection.style.transform = 'translateY(20px)';
            
            setTimeout(() => {
                targetSection.style.opacity = '1';
                targetSection.style.transform = 'translateY(0)';
            }, 10);
            
            // Update active link
            navLinks.forEach(navLink => {
                navLink.classList.remove('active');
            });
            this.classList.add('active');
            
            // Close sidebar on mobile
            if (window.innerWidth <= 768) {
                sidebar.classList.remove('active');
                mainContainer.classList.remove('sidebar-open');
                menuBtn.querySelector('i').classList.remove('fa-times');
                menuBtn.querySelector('i').classList.add('fa-bars');
            }
            
            // Scroll to top
            window.scrollTo(0, 0);
        });
    });
    
    // Project filtering
    const filterButtons = document.querySelectorAll('.filter-btn');
    const projectCards = document.querySelectorAll('.project-card');
    
    filterButtons.forEach(button => {
        button.addEventListener('click', function() {
            // Update active button
            filterButtons.forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');
            
            const filterValue = this.getAttribute('data-filter');
            
            // Filter projects
            projectCards.forEach(card => {
                if (filterValue === 'all' || card.getAttribute('data-category') === filterValue) {
                    card.style.display = 'flex';
                    card.style.animation = 'fadeIn 0.6s forwards';
                } else {
                    card.style.display = 'none';
                }
            });
        });
    });
    
    // Notes filtering
    const categoryButtons = document.querySelectorAll('.category-btn');
    const noteCards = document.querySelectorAll('.note-card');
    
    categoryButtons.forEach(button => {
        button.addEventListener('click', function() {
            // Update active button
            categoryButtons.forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');
            
            const categoryValue = this.getAttribute('data-category');
            
            // Filter notes
            noteCards.forEach(card => {
                if (categoryValue === 'all' || card.getAttribute('data-category') === categoryValue) {
                    card.style.display = 'flex';
                    card.style.animation = 'fadeIn 0.6s forwards';
                } else {
                    card.style.display = 'none';
                }
            });
        });
    });
    
    // Show home page by default
    document.querySelector('#home').style.display = 'block';
    document.querySelector('#home').style.opacity = '1';
    document.querySelector('#home').style.transform = 'translateY(0)';
});








// Welcome Animation
// document.addEventListener('DOMContentLoaded', function() {
//     const welcomeOverlay = document.querySelector('.welcome-overlay');
//     const welcomeText = document.querySelector('.welcome-text');
//     const cursor = document.querySelector('.cursor');
    
//     if (welcomeOverlay) {
//       const text = "Explore my world!";
//       let i = 0;
      
//       function typeWriter() {
//         if (i < text.length) {
//           welcomeText.textContent += text.charAt(i);
//           i++;
//           setTimeout(typeWriter, 200);
//         } else {
//           cursor.style.display = 'none';
//           setTimeout(() => {
//             welcomeOverlay.classList.add('fade-out');
//             setTimeout(() => {
//               welcomeOverlay.remove();
//             }, 1000);
//           }, 2000);
//         }
//       }
      
//       setTimeout(typeWriter, 500);
//     }
//   });