import { Cairo } from "next/font/google";

const cairo = Cairo({ subsets: ["arabic"], weight: ["400","600","700","800"] });

export const metadata = {
  title: "مدير المصاريف الذكي",
  description: "تتبع مصاريفك ودخلك تلقائياً من كشف الحساب البنكي",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ar" dir="rtl">
      <body className={cairo.className} style={{ margin: 0, padding: 0, background: "#0f1117" }}>
        {children}
      </body>
    </html>
  );
}
