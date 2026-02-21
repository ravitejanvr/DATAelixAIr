import { useState } from "react";
import { useConsent } from "@/contexts/ConsentContext";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { AnimatePresence, motion } from "framer-motion";
import { ShieldCheck, X, Settings2 } from "lucide-react";

const CookieConsentBanner = () => {
  const { showBanner, acceptAll, rejectAll, updatePreferences } = useConsent();
  const [showCustomize, setShowCustomize] = useState(false);
  const [analyticsOn, setAnalyticsOn] = useState(false);
  const [marketingOn, setMarketingOn] = useState(false);

  const handleSaveCustom = () => {
    updatePreferences({ analytics: analyticsOn, marketing: marketingOn });
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
                  <p className="text-sm font-semibold text-foreground mb-1">We value your privacy</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    We use essential cookies for site functionality and optional analytics cookies to improve your experience. No patient data or PHI is ever collected. DPDP & GDPR compliant.
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
