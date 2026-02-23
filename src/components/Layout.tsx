import { ReactNode } from "react";
import Navbar from "./Navbar";
import Footer from "./Footer";
import TrustBar from "./TrustBar";
import CookieConsentBanner from "./CookieConsentBanner";
import WelcomePopup from "./WelcomePopup";

const Layout = ({ children }: { children: ReactNode }) => (
  <div className="min-h-screen flex flex-col">
    <Navbar />
    <TrustBar />
    <main className="flex-1 pt-16">{children}</main>
    <Footer />
    <CookieConsentBanner />
    <WelcomePopup />
  </div>
);

export default Layout;
