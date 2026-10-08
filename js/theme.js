const root = document.documentElement;
const toggle = document.getElementById("theme-toggle");
const STORAGE_KEY = "theme";

function currentTheme() {
  return (
    root.getAttribute("data-theme") ||
    (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
  );
}

function applyTheme(theme) {
  root.setAttribute("data-theme", theme);

  const label = `Mudar para o tema ${theme === "dark" ? "claro" : "escuro"}`;
  toggle.setAttribute("aria-label", label);
  toggle.title = label;
}

applyTheme(currentTheme());

toggle.addEventListener("click", () => {
  const next = currentTheme() === "dark" ? "light" : "dark";
  applyTheme(next);

  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch (error) {
    /* Storage unavailable: the theme still changes for this visit. */
  }
});