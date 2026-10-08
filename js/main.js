const DATA_URL = "data/certificates.json";
const grid = document.getElementById("certificates");

function formatDate(value) {
  const [year, month] = value.split("-").map(Number);
  const text = new Date(year, month - 1, 1)
    .toLocaleDateString("pt-BR", { month: "short", year: "numeric" })
    .replace(".", "")
    .replace(" de ", " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function createElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text) element.textContent = text;
  return element;
}

function createThumb(cert) {
  const thumb = createElement("div", "card-thumb");

  if (cert.thumbnail) {
    const img = document.createElement("img");
    img.src = cert.thumbnail;
    img.alt = `Prévia do certificado ${cert.title}`;
    img.loading = "lazy";
    thumb.append(img);
  } else {
    const initial = createElement("span", "card-initial", cert.issuer.charAt(0));
    initial.setAttribute("aria-hidden", "true");
    thumb.append(initial);
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

  const download = createElement("a", "btn btn-outline", "Baixar");
  download.href = cert.file;
  download.download = "";
  download.setAttribute("aria-label", `Baixar certificado: ${cert.title}`);

  actions.append(view, download);
  return actions;
}

function createCard(cert) {
  const card = createElement("article", "card");
  card.dataset.category = cert.category;

  const body = createElement("div", "card-body");
  const meta = createElement("ul", "card-meta");
  meta.append(createElement("li", "", formatDate(cert.date)));
  if (cert.hours) meta.append(createElement("li", "", `${cert.hours} horas`));

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

function renderCards(certificates) {
  grid.replaceChildren(...certificates.map(createCard));
}

function renderStats(certificates) {
  const totalHours = certificates.reduce((sum, c) => sum + (Number(c.hours) || 0), 0);
  const issuers = new Set(certificates.map((c) => c.issuer));

  document.querySelector('[data-stat="total"]').textContent = certificates.length;
  document.querySelector('[data-stat="hours"]').textContent = totalHours;
  document.querySelector('[data-stat="issuers"]').textContent = issuers.size;
}

async function init() {
  try {
    const response = await fetch(DATA_URL);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const certificates = await response.json();
    certificates.sort((a, b) => b.date.localeCompare(a.date));

    renderStats(certificates);
    renderCards(certificates);
  } catch (error) {
    console.error("Failed to load certificates:", error);
    grid.replaceChildren(
      createElement("p", "empty", "Não foi possível carregar os certificados. Tente novamente mais tarde.")
    );
  }
}

init();