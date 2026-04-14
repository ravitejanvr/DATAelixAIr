/**
 * Canonical Service — V4 Public API
 *
 * Single entry point for all canonicalization.
 * No other module should define synonym maps.
 */

export type {
  CanonicalFeature,
  CanonicalizationResult,
  CanonicalizationTrace,
  CanonicalEntry,
  SupportedLanguage,
  FeatureCategory,
} from "./types";

export {
  canonicalize,
  resolveCanonicalId,
  getCanonicalEntry,
  getAllCanonicalIds,
  getSynonymCount,
  detectLanguage,
} from "./normalizer";
