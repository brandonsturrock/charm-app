import html2canvas from "html2canvas";
import jsPDF from "jspdf";

export async function exportDashboardPdf(element: HTMLElement, frontendName: string): Promise<void> {
  const canvas = await html2canvas(element, {
    scale: 1.5,
    useCORS: true,
    backgroundColor: "#0f1117",
    logging: false,
    width: element.offsetWidth,
    height: element.offsetHeight,
    windowWidth: element.offsetWidth,
    windowHeight: element.offsetHeight,
  });

  const imgData = canvas.toDataURL("image/jpeg", 0.85);
  const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  pdf.addImage(imgData, "JPEG", 0, 0, pageWidth, pageHeight);

  const now = new Date();
  const filename = `monthly-review-${frontendName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}.pdf`;
  pdf.save(filename);
}

export async function exportDashboard3PagePdf(pages: HTMLElement[], frontendName: string): Promise<void> {
  const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  for (let i = 0; i < pages.length; i++) {
    const el = pages[i];
    const canvas = await html2canvas(el, {
      scale: 1.5,
      useCORS: true,
      backgroundColor: "#0f1117",
      logging: false,
      width: el.offsetWidth,
      height: el.offsetHeight,
      windowWidth: el.offsetWidth,
      windowHeight: el.offsetHeight,
    });
    const imgData = canvas.toDataURL("image/jpeg", 0.85);
    if (i > 0) pdf.addPage();
    pdf.addImage(imgData, "JPEG", 0, 0, pageWidth, pageHeight);
  }

  const now = new Date();
  const filename = `monthly-review-3pg-${frontendName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}.pdf`;
  pdf.save(filename);
}
