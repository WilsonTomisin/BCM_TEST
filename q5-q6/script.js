// Q6 – paragraph copies, pair separators and an image-paragraph toggle.
(() => {
  const article = document.querySelector('article');
  const addButton = document.getElementById('add-paragraphs');

  // Snapshot the three original paragraphs once, before anything changes them,
  // so every copy starts clean (no hidden state, no separators inside).
  const templates = [...article.querySelectorAll(':scope > p')].map((p) => p.cloneNode(true));

  let imagesHidden = false;

  const paragraphs = () => [...article.querySelectorAll(':scope > p')];
  const hasImage = (p) => p.querySelector('img') !== null;

  // Fisher–Yates: every order is equally likely (sort(() => Math.random() - 0.5) is biased).
  function shuffled(items) {
    const a = [...items];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // Rebuild separators from scratch: an <hr> after every 2nd paragraph,
  // but only if another paragraph follows. Hidden paragraphs still count.
  function renderSeparators() {
    article.querySelectorAll(':scope > hr.pair-separator').forEach((hr) => hr.remove());
    const ps = paragraphs();
    ps.forEach((p, i) => {
      const position = i + 1;
      if (position % 2 === 0 && position < ps.length) {
        const hr = document.createElement('hr');
        hr.className = 'pair-separator';
        p.after(hr);
      }
    });
  }

  function applyImageVisibility(p) {
    if (hasImage(p)) p.hidden = imagesHidden;
  }

  function addCopies() {
    const last = paragraphs().at(-1);
    const fragment = document.createDocumentFragment();
    shuffled(templates).forEach((template) => {
      const copy = template.cloneNode(true);
      applyImageVisibility(copy); // new image paragraphs follow the current toggle state
      fragment.append(copy);
    });
    last.after(fragment);
    renderSeparators();
  }

  // Second button: created only through JavaScript.
  const toggleButton = document.createElement('button');
  toggleButton.type = 'button';
  toggleButton.id = 'toggle-images';

  function updateToggleLabel() {
    toggleButton.textContent = imagesHidden ? 'Show image paragraphs' : 'Hide image paragraphs';
    toggleButton.setAttribute('aria-pressed', String(imagesHidden));
  }

  toggleButton.addEventListener('click', () => {
    imagesHidden = !imagesHidden;
    paragraphs().forEach(applyImageVisibility);
    updateToggleLabel();
  });

  addButton.addEventListener('click', addCopies);
  addButton.after(toggleButton);
  updateToggleLabel();
  renderSeparators(); // initial load
})();
