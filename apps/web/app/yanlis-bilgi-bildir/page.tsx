import { Metadata } from "next";
import { ReportForm } from "./report-form";

export const metadata: Metadata = {
  title: "Yanlis Bilgi Bildir",
  description: "Nobetci eczane verisinde hata bildirimi"
};

export default function ReportPage() {
  return <ReportForm />;
}
