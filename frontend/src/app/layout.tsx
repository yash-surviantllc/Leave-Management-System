import type { Metadata } from "next";
import lmsIcon from "@/assets/hrms-icon.png";
import "./globals.css";

export const metadata: Metadata = {
  title: "LMS",
  description: "Role-based Leave Management System",
  icons: {
    icon: [
      {
        url: lmsIcon.src,
        type: "image/png"
      }
    ]
  }
};


export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
