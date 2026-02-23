import { useState } from "react";
import { useConsent } from "@/contexts/ConsentContext";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { AnimatePresence, motion } from "framer-motion";
import { ShieldCheck, Settings2, MapPin, Mic, Bell } from "lucide-react";

const CookieConsentBanner = () => {
  const { showBanner, acceptAll, rejectAll, updatePreferences } = useConsent();
  const [showCustomize, setShowCustomize] = useState(false);
  const [analyticsOn, setAnalyticsOn] = useState(false);
  const [marketingOn, setMarketingOn] = useState(false);
  const [locationOn, setLocationOn] = useState(false);

  const handleSaveCustom = () => {
    updatePreferences({ analytics: analyticsOn, marketing: marketingOn });
    // Request location permission if consented
    if (locationOn && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(() => {}, () => {});
    }
  };

  return (
    <AnimatePresence>
      {showBanner && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="fixed bottom-0 left-0 right-0 z-[100] p-4 md:p-6"
        >
          <div className="max-w-3xl mx-auto bg-card border border-border rounded-2xl shadow-lg overflow-hidden">
            {/* Main banner */}
            <div className="p-5 md:p-6">
              <div className="flex items-start gap-3 mb-4">
                <ShieldCheck className="text-primary shrink-0 mt-0.5" size={20} />
                <div>
                  <p className="text-sm font-semibold text-foreground mb-1">Privacy & Permissions</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    We use essential cookies for site functionality and request permissions to enhance clinical features.
                    No PHI is ever stored in cookies. Compliant with <strong>HIPAA</strong>, <strong>DPDP Act 2023</strong>,
                    <strong> UK GDPR</strong>, and <strong>EU AI Act</strong>.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" onClick={acceptAll} className="bg-primary hover:bg-primary/90 text-primary-foreground">
                  Accept All
                </Button>
                <Button size="sm" variant="outline" onClick={rejectAll}>
                  Reject All
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setShowCustomize(!showCustomize)} className="text-muted-foreground">
                  <Settings2 size={14} className="mr-1" /> Customise
                </Button>
              </div>
            </div>

            {/* Customize panel */}
            <AnimatePresence>
              {showCustomize && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="border-t border-border overflow-hidden"
                >
                  <div className="p-5 space-y-4">
                    {/* Cookie preferences */}
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Cookie Preferences</p>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-foreground">Essential</p>
                        <p className="text-xs text-muted-foreground">Required for site functionality</p>
                      </div>
                      <Switch checked disabled className="data-[state=checked]:bg-primary" />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-foreground">Analytics</p>
                        <p className="text-xs text-muted-foreground">Privacy-safe usage analytics (no PHI)</p>
                      </div>
                      <Switch checked={analyticsOn} onCheckedChange={setAnalyticsOn} />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-foreground">Marketing</p>
                        <p className="text-xs text-muted-foreground">Personalised content and features</p>
                      </div>
                      <Switch checked={marketingOn} onCheckedChange={setMarketingOn} />
                    </div>

                    {/* Device permissions */}
                    <div className="border-t border-border pt-4">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Device Permissions</p>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="text-sm font-medium text-foreground">Location</p>
                            <p className="text-xs text-muted-foreground">For AQI environmental data & clinic search</p>
                          </div>
                        </div>
                        <Switch checked={locationOn} onCheckedChange={setLocationOn} />
                      </div>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Mic className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="text-sm font-medium text-foreground">Microphone</p>
                            <p className="text-xs text-muted-foreground">Voice-to-text for clinical notes (requested on use)</p>
                          </div>
                        </div>
                        <Switch checked disabled={false} className="opacity-50 cursor-not-allowed" />
                      </div>
                    </div>

                    {/* Regulatory footer */}
                    <div className="border-t border-border pt-3">
                      <p className="text-[10px] text-muted-foreground leading-relaxed">
                        Governed by WHO Digital Health Guidelines 2021–2030, EU AI Act (Article 6 — High-Risk AI),
                        IEEE 7000 Ethically Aligned Design, MCI Telemedicine Practice Guidelines 2020, and HL7 FHIR R4 interoperability standards.
                        All data encrypted with TLS 1.3 at rest and in transit.
                      </p>
                    </div>

                    <Button size="sm" onClick={handleSaveCustom}>Save Preferences</Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default CookieConsentBanner;
