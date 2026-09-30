import { Geist, Geist_Mono } from "next/font/google";

// Creator Hub typography, shared by the home page and the internal areas.
export const hubFont = Geist({ subsets: ["latin"], variable: "--hub-font" });
export const hubMono = Geist_Mono({ subsets: ["latin"], variable: "--hub-mono" });
