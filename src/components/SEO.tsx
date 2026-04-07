import { useEffect } from "react";
import { useLocation } from "react-router-dom";

interface SEOProps {
  title: string;
  description: string;
  canonical?: string;
}

const PRODUCTION_DOMAIN = "https://elixair.uk";

/** Normalize path: no trailing slash except root */
const normalizePath = (path: string) => {
  if (path === "/" || path === "") return "/";
  return path.replace(/\/+$/, "");
};

const isProductionHost = () => {
  const host = window.location.hostname;
  return host === "elixair.uk" || host === "www.elixair.uk";
};

const SEO = ({ title, description, canonical }: SEOProps) => {
  const location = useLocation();
  const normalizedPath = normalizePath(location.pathname);
  const canonicalUrl =
    canonical || `${PRODUCTION_DOMAIN}${normalizedPath === "/" ? "" : normalizedPath}`;

  useEffect(() => {
    document.title = title;

    const setMeta = (name: string, content: string, attr = "name") => {
      let el = document.querySelector(`meta[${attr}="${name}"]`) as HTMLMetaElement | null;
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute(attr, name);
        document.head.appendChild(el);
      }
      el.setAttribute("content", content);
    };

    // Block indexing of non-production hosts (lovable.app, localhost, etc.)
    if (!isProductionHost()) {
      setMeta("robots", "noindex, nofollow");
    } else {
      setMeta("robots", "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1");
    }

    setMeta("description", description);
    setMeta("og:title", title, "property");
    setMeta("og:description", description, "property");
    setMeta("og:url", canonicalUrl, "property");
    setMeta("og:type", "website", "property");
    setMeta("twitter:title", title);
    setMeta("twitter:description", description);

    // Update the static canonical href for SPA navigation
    let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement("link");
      link.setAttribute("rel", "canonical");
      document.head.appendChild(link);
    }
    link.setAttribute("href", canonicalUrl);
  }, [title, description, canonicalUrl]);

  return null;
};

export default SEO;
