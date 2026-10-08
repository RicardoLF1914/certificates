const DATA_URL = "data/certificates.json";

const TYPE_ORDER = ["Graduação", "Formação", "Curso"];
const TYPE_LABELS = { Graduação: "Graduação", Formação: "Formações", Curso: "Cursos" };

const PDFJS_WORKER_URL =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
const THUMB_WIDTH = 640;
const VIEWER_MAX_WIDTH = 900;

const grid = document.getElementById("certificates");
const typeFilters = document.getElementById("type-filters");
const searchInput = document.getElementById("search");
const categorySelect = document.getElementById("category-select");
const resultsCount = document.getElementById("results-count");

const viewer = document.getElementById("viewer");
const viewerTitle = document.getElementById("viewer-title");
const viewerSubtitle = document.getElementById("viewer-subtitle");
const viewerOpen = document.getElementById("viewer-open");
const viewerClose = document.getElementById("viewer-close");
const viewerBody = document.getElementById("viewer-body");

const state = { certificates: [], type: "all", category: "", query: "" };

if (window.pdfjsLib) {
  window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;
}

/* ---------- Utilidades ---------- */

const normalize = (text) =>
  text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

const isPdf = (file) => file.toLowerCase().endsWith(".pdf");

function createElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text) element.textContent = text;
  return element;
}

function formatDate(value) {
  const [year, month] = value.split("-").map(Number);
  const text = new Date(year, month - 1, 1)
    .toLocaleDateString("pt-BR", { month: "short", year: "numeric" })
    .replace(".", "")
    .replace(" de ", " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function typeRank(type) {
  const index = TYPE_ORDER.indexOf(type);
  return index === -1 ? TYPE_ORDER.length : index;
}

function sortCertificates(list) {
  return [...list].sort(
    (a, b) => typeRank(a.type) - typeRank(b.type) || b.date.localeCompare(a.date)
  );
}

/* ---------- Miniaturas (PDF.js) ---------- */

const thumbCache = new Map();

async function renderPdfThumb(file) {
  if (thumbCache.has(file)) return thumbCache.get(file);

  const pdf = await window.pdfjsLib.getDocument(file).promise;

  try {
    const page = await pdf.getPage(1);
    const baseViewport = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: THUMB_WIDTH / baseViewport.width });

    const canvas = document.createElement("canvas");
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);

    const context = canvas.getContext("2d");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({ canvasContext: context, viewport }).promise;

    const src = canvas.toDataURL("image/jpeg", 0.85);
    thumbCache.set(file, src);
    return src;
  } finally {
    pdf.destroy();
  }
}

function showThumbImage(thumb, src, title) {
  const img = document.createElement("img");
  img.src = src;
  img.alt = `Prévia do certificado ${title}`;
  thumb.replaceChildren(img);
}

async function loadPdfThumb(thumb) {
  const { file, title } = thumb.dataset;

  try {
    const src = await renderPdfThumb(file);
    showThumbImage(thumb, src, title);
  } catch (error) {
    console.warn(`Could not render thumbnail for ${file}:`, error);
  }
}

const thumbObserver =
  "IntersectionObserver" in window
    ? new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            thumbObserver.unobserve(entry.target);
            loadPdfThumb(entry.target);
          });
        },
        { rootMargin: "200px" }
      )
    : null;

/* ---------- Visualizador (modal) ---------- */

let viewerToken = 0;

async function renderPdfPages(file, container, status, token) {
  const pdf = await window.pdfjsLib.getDocument(file).promise;

  try {
    const cssWidth = Math.min(container.clientWidth, VIEWER_MAX_WIDTH);
    const ratio = Math.min(window.devicePixelRatio || 1, 2);

    for (let number = 1; number <= pdf.numPages; number += 1) {
      if (token !== viewerToken) return;

      const page = await pdf.getPage(number);
      const baseViewport = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: (cssWidth * ratio) / baseViewport.width });

      const canvas = document.createElement("canvas");
      canvas.className = "viewer-page";
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      canvas.setAttribute("role", "img");
      canvas.setAttribute("aria-label", `Página ${number} de ${pdf.numPages}`);

      const context = canvas.getContext("2d");
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);

      await page.render({ canvasContext: context, viewport }).promise;

      if (token !== viewerToken) return;
      status.remove();
      container.append(canvas);
    }
  } finally {
    pdf.destroy();
  }
}

function openViewer(cert) {
  viewerToken += 1;
  const token = viewerToken;

  viewerTitle.textContent = cert.title;
  viewerSubtitle.textContent = `${cert.issuer} · ${formatDate(cert.date)}`;
  viewerOpen.href = cert.file;

  if (!viewer.open) viewer.showModal();
  viewerBody.scrollTop = 0;

  if (!isPdf(cert.file)) {
    const img = createElement("img", "viewer-image");
    img.src = cert.file;
    img.alt = `Certificado: ${cert.title}`;
    viewerBody.replaceChildren(img);
    return;
  }

  const status = createElement("p", "viewer-status", "Carregando certificado…");
  viewerBody.replaceChildren(status);

  renderPdfPages(cert.file, viewerBody, status, token).catch((error) => {
    console.error(`Could not render ${cert.file}:`, error);
    if (token === viewerToken) {
      status.textContent = "Não foi possível exibir o certificado aqui. Use “Abrir em nova aba”.";
    }
  });
}

viewerClose.addEventListener("click", () => viewer.close());

viewer.addEventListener("click", (event) => {
  if (event.target === viewer) viewer.close();
});

viewer.addEventListener("close", () => {
  viewerToken += 1;
  viewerBody.replaceChildren();
});

/* ---------- Cards ---------- */

function createThumb(cert) {
  const thumb = createElement("div", "card-thumb");

  const initial = createElement("span", "card-initial", cert.issuer.charAt(0));
  initial.setAttribute("aria-hidden", "true");
  thumb.append(initial);

  const cached = thumbCache.get(cert.file);

  if (cert.thumbnail) {
    showThumbImage(thumb, cert.thumbnail, cert.title);
  } else if (!isPdf(cert.file)) {
    showThumbImage(thumb, cert.file, cert.title);
  } else if (cached) {
    showThumbImage(thumb, cached, cert.title);
  } else if (window.pdfjsLib) {
    thumb.dataset.file = cert.file;
    thumb.dataset.title = cert.title;

    if (thumbObserver) thumbObserver.observe(thumb);
    else loadPdfThumb(thumb);
  }

  return thumb;
}

function createActions(cert) {
  const actions = createElement("div", "card-actions");

  const view = createElement("a", "btn btn-primary", "Visualizar");
  view.href = cert.file;
  view.target = "_blank";
  view.rel = "noopener noreferrer";
  view.setAttribute("aria-label", `Visualizar certificado: ${cert.title}`);

  view.addEventListener("click", (event) => {
    const modified = event.ctrlKey || event.metaKey || event.shiftKey || event.button !== 0;
    if (modified || (isPdf(cert.file) && !window.pdfjsLib)) return;

    event.preventDefault();
    openViewer(cert);
  });

  actions.append(view);
  return actions;
}

function createCard(cert) {
  const card = createElement("article", "card");

  const meta = createElement("ul", "card-meta");
  meta.append(createElement("li", "", formatDate(cert.date)));
  if (cert.hours) meta.append(createElement("li", "", `${cert.hours} horas`));

  const body = createElement("div", "card-body");
  body.append(
    createElement("span", "badge", cert.category),
    createElement("h3", "card-title", cert.title),
    createElement("p", "card-issuer", cert.issuer),
    meta,
    createActions(cert)
  );

  card.append(createThumb(cert), body);
  return card;
}

/* ---------- Estatísticas ---------- */

function renderStats(certificates) {
  const totalHours = certificates.reduce((sum, c) => sum + (Number(c.hours) || 0), 0);
  const issuers = new Set(certificates.map((c) => c.issuer));

  document.querySelector('[data-stat="total"]').textContent = certificates.length;
  document.querySelector('[data-stat="hours"]').textContent = totalHours;
  document.querySelector('[data-stat="issuers"]').textContent = issuers.size;
}

/* ---------- Filtros ---------- */

function renderTypeFilters() {
  const counts = state.certificates.reduce((acc, c) => {
    acc[c.type] = (acc[c.type] || 0) + 1;
    return acc;
  }, {});

  const options = [{ value: "all", label: "Todos", count: state.certificates.length }];
  const types = [...new Set([...TYPE_ORDER, ...Object.keys(counts)])].filter(
    (type) => counts[type]
  );
  types.forEach((type) =>
    options.push({ value: type, label: TYPE_LABELS[type] || type, count: counts[type] })
  );

  typeFilters.replaceChildren(
    ...options.map(({ value, label, count }) => {
      const button = createElement("button", "chip", `${label} (${count})`);
      button.type = "button";
      button.dataset.type = value;
      button.setAttribute("aria-pressed", String(value === state.type));
      return button;
    })
  );
}

function updateChips() {
  typeFilters.querySelectorAll("button").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.type === state.type));
  });
}

function renderCategoryOptions() {
  const categories = [...new Set(state.certificates.map((c) => c.category))].sort((a, b) =>
    a.localeCompare(b, "pt-BR")
  );

  categories.forEach((category) => {
    const option = createElement("option", "", category);
    option.value = category;
    categorySelect.append(option);
  });
}

function getFiltered() {
  const query = normalize(state.query);

  return state.certificates.filter((c) => {
    const matchesType = state.type === "all" || c.type === state.type;
    const matchesCategory = !state.category || c.category === state.category;
    const matchesQuery =
      !query || normalize(`${c.title} ${c.issuer} ${c.category}`).includes(query);

    return matchesType && matchesCategory && matchesQuery;
  });
}

function render() {
  const filtered = getFiltered();

  if (thumbObserver) thumbObserver.disconnect();

  if (filtered.length === 0) {
    grid.replaceChildren(
      createElement("p", "empty", "Nenhum certificado encontrado com esses filtros.")
    );
  } else {
    grid.replaceChildren(...filtered.map(createCard));
  }

  resultsCount.textContent = `Mostrando ${filtered.length} de ${state.certificates.length} certificados`;
}

/* ---------- Eventos ---------- */

typeFilters.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-type]");
  if (!button) return;

  state.type = button.dataset.type;
  updateChips();
  render();
});

searchInput.addEventListener("input", () => {
  state.query = searchInput.value;
  render();
});

categorySelect.addEventListener("change", () => {
  state.category = categorySelect.value;
  render();
});

/* ---------- Inicialização ---------- */

async function init() {
  try {
    const response = await fetch(DATA_URL);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    state.certificates = sortCertificates(data.map((c) => ({ type: "Curso", ...c })));

    renderStats(state.certificates);
    renderTypeFilters();
    renderCategoryOptions();
    render();
  } catch (error) {
    console.error("Failed to load certificates:", error);
    grid.replaceChildren(
      createElement("p", "empty", "Não foi possível carregar os certificados. Tente novamente mais tarde.")
    );
  }
}

init();