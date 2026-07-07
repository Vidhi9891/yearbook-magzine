/* ============================================================
   LANDING PAGE — Digital Library
   Subtle entrance animations and interactive elements
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {

  // Fade in hero content on load
  const heroContent = document.querySelector('.hero-content');
  if (heroContent) {
    heroContent.style.opacity = '0';
    heroContent.style.transform = 'translateY(20px)';
    requestAnimationFrame(() => {
      heroContent.style.transition = 'opacity 0.8s ease, transform 0.8s ease';
      heroContent.style.opacity = '1';
      heroContent.style.transform = 'translateY(0)';
    });
  }

});
