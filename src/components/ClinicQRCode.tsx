import { QRCodeSVG } from "qrcode.react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, QrCode, Printer } from "lucide-react";

interface ClinicQRCodeProps {
  clinicId: string;
  clinicName?: string;
}

export default function ClinicQRCode({ clinicId, clinicName }: ClinicQRCodeProps) {
  const baseUrl = window.location.origin;
  const qrUrl = `${baseUrl}/register?clinic=${clinicId}`;

  const handlePrint = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(`
      <html><head><title>QR Code - ${clinicName || "Clinic"}</title>
      <style>
        body { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; font-family: system-ui, sans-serif; }
        h2 { margin-bottom: 8px; }
        p { color: #666; font-size: 14px; margin-bottom: 24px; }
        .qr { border: 2px solid #e5e7eb; border-radius: 16px; padding: 24px; }
        .footer { margin-top: 16px; font-size: 12px; color: #999; }
      </style></head><body>
        <h2>${clinicName || "Clinic"}</h2>
        <p>Scan to register your visit</p>
        <div class="qr">${document.getElementById("clinic-qr-svg")?.innerHTML || ""}</div>
        <p class="footer">Powered by DATAelixAIr™</p>
      </body></html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <QrCode className="h-4 w-4 text-primary" />
          Patient QR Registration
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex justify-center" id="clinic-qr-svg">
          <QRCodeSVG
            value={qrUrl}
            size={180}
            level="M"
            includeMargin
            bgColor="transparent"
            fgColor="hsl(222, 47%, 11%)"
          />
        </div>
        <p className="text-xs text-center text-muted-foreground">
          Patients scan this code to self-register
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="flex-1" onClick={handlePrint}>
            <Printer className="h-3.5 w-3.5 mr-1" /> Print
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
