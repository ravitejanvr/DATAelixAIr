import { useEffect } from "react";
import { useLocation } from "react-router-dom";

interface SEOProps {
  title: string;
  description: string;
  canonical?: string;
}

const PRODUCTION_DOMAIN = "https://elixair.uk";

const SEO = ({ title, description, canonical }: SEOProps) => {
  const location = useLocation();
  const canonicalUrl = canonical || `${PRODUCTION_DOMAIN}${location.pathname}`;

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

    setMeta("description", description);
    setMeta("og:title", title, "property");
    setMeta("og:description", description, "property");
    setMeta("og:url", canonicalUrl, "property");
    setMeta("og:type", "website", "property");
    setMeta("twitter:title", title);
    setMeta("twitter:description", description);

    // Update the static canonical href for SPA navigation
    const link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (link) {
      link.setAttribute("href", canonicalUrl);
    }
  }, [title, description, canonicalUrl]);

  return null;
};

export default SEO;
