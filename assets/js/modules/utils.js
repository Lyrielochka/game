export function byId(id) {
  return document.getElementById(id);
}

export function normalize(str) {
  return (str || "")
    .toUpperCase()
    .replace(/Ё/g, "Е")
    .replace(/[^А-ЯA-Z]/g, "");
}
