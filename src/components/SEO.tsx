import { useEffect } from "react";
import { useLocation } from "react-router-dom";

interface SEOProps {
  title: string;
  description: string;
  canonical?: string;
  ogType?: string;
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
  noindex?: boolean;
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

const SEO = ({ title, description, canonical, ogType = "website", jsonLd, noindex = false }: SEOProps) => {
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

    // Block indexing of non-production hosts or noindex pages
    if (!isProductionHost() || noindex) {
      setMeta("robots", noindex ? "noindex, follow" : "noindex, nofollow");
    } else {
      setMeta("robots", "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1");
    }

    setMeta("description", description);

    // OpenGraph
    setMeta("og:title", title, "property");
    setMeta("og:description", description, "property");
    setMeta("og:url", canonicalUrl, "property");
    setMeta("og:type", ogType, "property");
    setMeta("og:site_name", "DATAelixAIr™ by elixAIr", "property");

    // Twitter
    setMeta("twitter:title", title);
    setMeta("twitter:description", description);
    setMeta("twitter:card", "summary_large_image");

    // Canonical link
    let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement("link");
      link.setAttribute("rel", "canonical");
      document.head.appendChild(link);
    }
    link.setAttribute("href", canonicalUrl);

    // JSON-LD structured data
    // Remove any previously injected SEO JSON-LD
    document.querySelectorAll('script[data-seo-jsonld]').forEach(el => el.remove());
    if (jsonLd) {
      const items = Array.isArray(jsonLd) ? jsonLd : [jsonLd];
      items.forEach(item => {
        const script = document.createElement("script");
        script.type = "application/ld+json";
        script.setAttribute("data-seo-jsonld", "true");
        script.textContent = JSON.stringify(item);
        document.head.appendChild(script);
      });
    }
  }, [title, description, canonicalUrl, ogType, jsonLd]);

  return null;
};

export default SEO;

/** Shared brand description for consistency */
export const BRAND_DESCRIPTION =
  "DATAelixAIr™ is an AI-powered clinical reasoning workspace developed by elixAIr, designed to assist healthcare professionals with structured, probabilistic decision-making.";

/** Organization JSON-LD */
export const ORG_JSONLD = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "elixAIr",
  url: "https://elixair.uk",
  logo: "https://elixair.uk/logo.png",
  description: "AI-powered clinical reasoning systems for healthcare professionals",
  sameAs: ["https://www.linkedin.com/company/elixair-limited"],
};

/** Product JSON-LD */
export const PRODUCT_JSONLD = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "DATAelixAIr",
  applicationCategory: "HealthApplication",
  operatingSystem: "Web",
  url: "https://elixair.uk",
  description: "AI clinical reasoning workspace for probabilistic diagnosis support",
  offers: { "@type": "Offer", price: "0", priceCurrency: "GBP", availability: "https://schema.org/ComingSoon" },
};
