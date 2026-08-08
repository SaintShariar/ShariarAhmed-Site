(function () {
  'use strict';

  /* ---- Nav scroll + mobile menu ---- */
  var nav = document.getElementById('nav');
  var toggle = document.getElementById('nav-toggle');
  var links = document.getElementById('nav-links');

  function onScroll() {
    if (!nav) return;
    nav.classList.toggle('scrolled', window.scrollY > 40);
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  if (toggle && links && nav) {
    toggle.addEventListener('click', function () {
      var open = nav.classList.toggle('open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    });

    links.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () {
        nav.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
        toggle.setAttribute('aria-label', 'Open menu');
      });
    });
  }

  /* ---- Scroll reveal ---- */
  var reveals = document.querySelectorAll('[data-reveal]');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

    reveals.forEach(function (el) { io.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add('is-visible'); });
  }

  requestAnimationFrame(function () {
    document.querySelectorAll('.hero [data-reveal]').forEach(function (el) {
      el.classList.add('is-visible');
    });
  });

  /* Experience photos are wired in index.html (experience-rfk.jpg, etc.). */

  /* ---- Reel videos: autoplay muted; sound only after user unmutes ---- */
  document.querySelectorAll('video.reel-video').forEach(function (video) {
    var userUnmuted = false;

    function ensureMuted() {
      if (!userUnmuted) {
        video.muted = true;
        video.defaultMuted = true;
      }
    }

    function tryPlay() {
      ensureMuted();
      var playPromise = video.play();
      if (playPromise && playPromise.catch) {
        playPromise.catch(function () {
          /* Autoplay blocked — retry once media is ready / in view again */
        });
      }
    }

    ensureMuted();

    video.addEventListener('volumechange', function () {
      userUnmuted = !video.muted && video.volume > 0;
    });

    video.addEventListener('play', ensureMuted);
    video.addEventListener('loadeddata', tryPlay);
    video.addEventListener('canplay', tryPlay);

    if ('IntersectionObserver' in window) {
      var reelIo = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            tryPlay();
          } else {
            video.pause();
          }
        });
      }, { threshold: 0.2 });
      reelIo.observe(video);
    }

    tryPlay();
  });

  /* ---- Contact form ---- */
  var form = document.forms['submit-to-google-sheet'];
  var status = document.getElementById('form-status');
  if (form && status) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      status.textContent = 'Sending...';
      fetch(
        'https://script.google.com/macros/s/AKfycbyD3bEGguR43V5VJduEy_7_Qla2TACLSKgiF0W3tCm3jdTwV75Sd1ovfeokb1iyF9n3wg/exec',
        { method: 'POST', body: new FormData(form) }
      )
        .then(function () {
          status.textContent = 'Sent — thank you!';
          form.reset();
        })
        .catch(function () {
          status.textContent = 'Failed — try again.';
        });
    });
  }

  /* ---- Year ---- */
  var year = document.getElementById('year');
  if (year) year.textContent = String(new Date().getFullYear());
})();
