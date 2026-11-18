// Keep this dependency-free parser identical in api/ and web/ (checked in tests).
export function tourLink(value) {
  if (typeof value !== "string" || value.length > 800) return null;
  let link;
  try {
    link = new URL(value.trim());
  } catch {
    return null;
  }
  if (link.protocol !== "https:" || link.username || link.password || link.port)
    return null;
  const host = link.hostname.toLowerCase().replace(/^www\./, "");
  if (host === "my.matterport.com" && /^\/show\/?$/.test(link.pathname)) {
    const id = link.searchParams.get("m");
    if (
      link.searchParams.getAll("m").length !== 1 ||
      !/^[a-zA-Z0-9]{6,32}$/.test(id || "")
    )
      return null;
    const url = `https://my.matterport.com/show/?m=${id}`;
    return { provider: "Matterport", url, embedUrl: url };
  }
  if (host === "kuula.co") {
    const match =
      /^\/(?:post|share)\/(collection\/)?([a-zA-Z0-9_-]{4,80})\/?$/.exec(
        link.pathname,
      );
    if (!match) return null;
    const url = `https://kuula.co/share/${match[1] || ""}${match[2]}`;
    return { provider: "Kuula", url, embedUrl: url };
  }
  if (host === "sketchfab.com") {
    const match =
      /^\/models\/([a-f0-9]{32})(?:\/embed)?\/?$/i.exec(link.pathname) ||
      /^\/3d-models\/(?:[a-z0-9_-]+-)?([a-f0-9]{32})\/?$/i.exec(link.pathname);
    if (!match) return null;
    const id = match[1].toLowerCase();
    return {
      provider: "Sketchfab",
      url: `https://sketchfab.com/models/${id}`,
      embedUrl: `https://sketchfab.com/models/${id}/embed`,
    };
  }
  return null;
}
