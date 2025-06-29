import "./globals.css";

export const metadata = {
  title: "OurCanteen",
  description: "OurCanteen",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
