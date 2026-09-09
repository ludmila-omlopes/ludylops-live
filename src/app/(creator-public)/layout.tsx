import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Comunidade",
};

export default function CreatorPublicLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <main>{children}</main>;
}
